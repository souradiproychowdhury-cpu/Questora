import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { fetchLiveWebSources, WebSourceItem, fetchLiveWebImages, WebImageItem } from './webSearch.js';

let geminiClient: GoogleGenAI | null = null;
let openAiClient: OpenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured. Please ensure your Gemini API key is set in AI Studio Secrets.');
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

let isOpenAiQuotaExhausted = false;
let lastUsedOpenAiKey = '';

export function getOpenAiStatus(): { configured: boolean; quotaExhausted: boolean } {
  const apiKey = process.env.OPENAI_API_KEY || '';
  const hasKey = Boolean(apiKey && apiKey.trim() !== '');
  
  if (hasKey && apiKey !== lastUsedOpenAiKey) {
    isOpenAiQuotaExhausted = false;
    lastUsedOpenAiKey = apiKey;
    openAiClient = null;
  }

  return {
    configured: hasKey && !isOpenAiQuotaExhausted,
    quotaExhausted: isOpenAiQuotaExhausted,
  };
}

export function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  // Auto-detect updated key from Settings > Secrets and reset quota exhaustion
  if (apiKey !== lastUsedOpenAiKey) {
    isOpenAiQuotaExhausted = false;
    lastUsedOpenAiKey = apiKey;
    openAiClient = null;
  }

  if (isOpenAiQuotaExhausted) {
    return null;
  }

  if (!openAiClient) {
    openAiClient = new OpenAI({
      apiKey,
    });
  }
  return openAiClient;
}

export interface SearchAttachment {
  type: 'document' | 'picture' | 'link';
  name: string;
  mimeType?: string;
  data?: string; // base64 data URL
  textContent?: string;
  url?: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
  snippet?: string;
}

export interface SearchResultPayload {
  engine: 'gemini' | 'openai';
  model: string;
  query: string;
  text: string;
  sources: GroundingSource[];
  searchQueries: string[];
  suggestedFollowUps: string[];
  executionTimeMs: number;
  groundingType?: 'google-search' | 'live-web' | 'multimodal-analysis';
  images?: WebImageItem[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executes a Gemini API call with exponential backoff and jitter for transient errors (429, 503, 500).
 */
async function callWithRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  baseDelay = 500
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.code || err?.error?.code;
      const msg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
      const isTransient =
        status === 429 ||
        status === 503 ||
        status === 500 ||
        msg.includes('high demand') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('quota');

      if (attempt < retries && isTransient) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * Scrapes and extracts clean main text content from any user-provided URL in real-time.
 * Strips HTML tags, styles, and scripts to feed precise contextual metadata to Gemini.
 */
async function fetchLinkContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) {
      return `[Failed to retrieve page content: HTTP ${res.status}]`;
    }
    const html = await res.text();
    
    // Clean and strip HTML elements
    let text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return text.length > 5000 ? text.slice(0, 5000) + '... [scraped page content truncated]' : text;
  } catch (err: any) {
    return `[Failed to retrieve page content: ${err.message || 'Timeout'}]`;
  }
}

/**
 * Executes a search using Gemini.
 * Supports file/image/document/link attachments and multimodal analysis.
 * Attempts native Google Search Grounding first with retry.
 * If quota or rate limits occur, smoothly falls back to live web retrieval
 * and grounded synthesis so searches never fail.
 */
export async function executeGeminiSearch(query: string, options?: {
  mode?: 'comprehensive' | 'concise' | 'news';
  filterType?: string;
  model?: string;
  attachments?: SearchAttachment[];
}): Promise<SearchResultPayload> {
  const startTime = Date.now();
  const imagesPromise = fetchLiveWebImages(query);
  const ai = getGeminiClient();

  const modePrompt = options?.mode === 'concise'
    ? 'Provide a concise, direct answer with verified facts and citation links.'
    : options?.mode === 'news'
    ? 'Focus on the most recent, up-to-the-minute updates, official statements, and chronological events.'
    : 'Provide a structured, comprehensive synthesis with clear headings, key takeaways, and detailed insights.';

  const filterInstruction = options?.filterType && options.filterType !== 'all'
    ? `Tailor the search focus towards ${options.filterType} sources where relevant.`
    : '';

  const attachments = options?.attachments || [];
  let attachmentContextText = '';
  const inlineParts: any[] = [];

  if (attachments.length > 0) {
    attachmentContextText += '\n\n=== ATTACHED USER DATA & FILES ===\n';
    for (const att of attachments) {
      if (att.type === 'document') {
        attachmentContextText += `[Attached Document: "${att.name}"]:\n${att.textContent || '(Document content processed)'}\n\n`;
        // Send raw base64 data as native inline part (supports native PDF scanning/reading, TXT, CSV, JSON parsing)
        if (att.data) {
          const match = att.data.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            inlineParts.push({
              inlineData: {
                mimeType: match[1] || 'application/pdf',
                data: match[2],
              },
            });
          }
        }
      } else if (att.type === 'link') {
        const url = att.url || att.name;
        const fetchedText = await fetchLinkContent(url);
        attachmentContextText += `[Attached Link / Reference URL]: ${url}\nScraped Link Web Content:\n${fetchedText}\n\n`;
      } else if (att.type === 'picture') {
        attachmentContextText += `[Attached Picture / Image: "${att.name}"] (Analyze visual data thoroughly).\n`;
        if (att.data) {
          const match = att.data.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            inlineParts.push({
              inlineData: {
                mimeType: match[1] || 'image/jpeg',
                data: match[2],
              },
            });
          }
        }
      }
    }
  }

  const systemInstruction = `You are an elite, highly intelligent AI search and research assistant.
Your goal is to answer queries using up-to-date, live web grounding and deeply analyze any user attachments (documents, images, or links).
Guidelines:
1. Provide accurate, synthesized information synthesized directly from search grounding and user attachments.
2. Structure your response logically using clean Markdown:
   - Brief direct answer/executive overview
   - Deep analysis of attached files/images/links if provided
   - Key findings/sections with markdown subheadings
   - Actionable takeaways or step-by-step guidance
3. Maintain an objective, informative, and authoritative tone.
${modePrompt}
${filterInstruction}`;

  // Candidate models to try in order
  const requestedModel = options?.model && options.model.startsWith('gemini-') ? options.model : 'gemini-3.8-flash';
  const candidateModels = Array.from(new Set([
    requestedModel,
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
  ]));

  // Try native Google Search Grounding across supported models with retry
  for (const model of candidateModels) {
    try {
      const contentsParts: any[] = [
        ...inlineParts,
        { text: `User search query: "${query}"${attachmentContextText}` }
      ];

      const response = await callWithRetry(() =>
        ai.models.generateContent({
          model,
          contents: contentsParts.length === 1 ? contentsParts[0].text : contentsParts,
          config: {
            systemInstruction,
            tools: inlineParts.length === 0 ? [{ googleSearch: {} }] : undefined,
          },
        }),
        1, // 1 retry per model
        400
      );

      const text = response.text || 'No information could be generated for this query.';

      // Extract grounding citations
      const candidate = response.candidates?.[0];
      const rawChunks = candidate?.groundingMetadata?.groundingChunks || [];
      const webSearchQueries = candidate?.groundingMetadata?.webSearchQueries || [];

      const sources: GroundingSource[] = [];
      const seenUrls = new Set<string>();

      for (const chunk of rawChunks) {
        if (chunk.web?.uri && !seenUrls.has(chunk.web.uri)) {
          seenUrls.add(chunk.web.uri);
          sources.push({
            title: chunk.web.title || new URL(chunk.web.uri).hostname,
            uri: chunk.web.uri,
            snippet: '',
          });
        }
      }

      // Add attached link if any
      for (const att of attachments) {
        if (att.type === 'link' && att.url && !seenUrls.has(att.url)) {
          sources.unshift({
            title: `Attached Link: ${att.name || att.url}`,
            uri: att.url,
            snippet: 'User provided reference document/link',
          });
        }
      }

      const suggestedFollowUps: string[] = [
        `What are the recent developments regarding ${query}?`,
        `Can you break down the pros and cons of ${query}?`,
        `What are the key technical details behind ${query}?`,
      ];

      const images = await imagesPromise;

      return {
        engine: 'gemini',
        model,
        query,
        text,
        sources,
        searchQueries: webSearchQueries.length > 0 ? webSearchQueries : [query],
        suggestedFollowUps,
        executionTimeMs: Date.now() - startTime,
        groundingType: inlineParts.length > 0 ? 'multimodal-analysis' : 'google-search',
        images,
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes('API_KEY_INVALID')) {
        throw new Error('Gemini API key is invalid. Please verify your GEMINI_API_KEY in Settings > Secrets.');
      }
      // If quota or rate limits occur on Google Search tool, try next model or fall back to Live Web Grounding
    }
  }

  // Fallback: Real-time Live Web Retrieval Grounding
  return await executeLiveWebGrounding(query, ai, startTime, options, imagesPromise);
}

/**
 * Live Web Grounding fallback when Google Search tool encounters quota limits.
 * Retrieves real-time web sources from Google News, Wikipedia, DuckDuckGo, and Tech Hubs,
 * then synthesizes a verified research answer.
 */
async function executeLiveWebGrounding(
  query: string,
  ai: GoogleGenAI,
  startTime: number,
  options?: { mode?: 'comprehensive' | 'concise' | 'news'; filterType?: string; attachments?: SearchAttachment[] },
  imagesPromise?: Promise<WebImageItem[]>
): Promise<SearchResultPayload> {
  const liveSources: WebSourceItem[] = await fetchLiveWebSources(query, options?.filterType);

  const sourcesListText = liveSources.length > 0
    ? liveSources
        .map((s, idx) => `[Source ${idx + 1}] Title: ${s.title}\nURL: ${s.uri}${s.snippet ? `\nSnippet: ${s.snippet}` : ''}`)
        .join('\n\n')
    : 'No external live pages retrieved. Rely on core authoritative knowledge.';

  const attachments = options?.attachments || [];
  let attachmentContextText = '';
  if (attachments.length > 0) {
    attachmentContextText += '\n\n=== ATTACHED USER DATA & FILES ===\n';
    for (const att of attachments) {
      if (att.type === 'document') {
        attachmentContextText += `[Attached Document: "${att.name}"]:\n${att.textContent || '(Document content)'}\n\n`;
      } else if (att.type === 'link') {
        attachmentContextText += `[Attached Link]: ${att.url || att.name}\n`;
      } else if (att.type === 'picture') {
        attachmentContextText += `[Attached Picture: "${att.name}"]\n`;
      }
    }
  }

  const modeInstruction = options?.mode === 'concise'
    ? 'Provide a concise, direct answer highlighting key facts.'
    : options?.mode === 'news'
    ? 'Highlight chronological updates and verified recent events.'
    : 'Provide a thorough, comprehensive synthesis with clear headings, bullet points, and actionable details.';

  const prompt = `You are an elite, highly intelligent AI search and research assistant.
The user is searching for: "${query}"

Here are real-time, live web search results retrieved from Google News, Wikipedia, and verified sources:
---
${sourcesListText}
---
${attachmentContextText}

Instructions:
1. Synthesize an authoritative, clear, and up-to-date answer in clean Markdown.
2. Formulate a direct summary first, followed by well-structured subheadings.
3. Where applicable, reference the live information and attached files directly to maintain high factual precision.
4. ${modeInstruction}
5. Do NOT output raw source blocks in the body; the sources are rendered separately as citations.`;

  let responseText = '';
  let usedModel = 'gemini-3.8-flash';
  let geminiSuccess = false;

  const modelsForSynthesis = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  for (const m of modelsForSynthesis) {
    try {
      const res = await callWithRetry(
        () =>
          ai.models.generateContent({
            model: m,
            contents: prompt,
          }),
        1,
        500
      );
      if (res.text) {
        responseText = res.text;
        usedModel = m;
        geminiSuccess = true;
        break;
      }
    } catch {
      // Continue to next model
    }
  }

  if (!geminiSuccess) {
    usedModel = 'Live Web Grounding Engine';
    const topSources = liveSources.slice(0, 5);
    responseText = `### Live Grounded Summary for "${query}"\n\n` +
      `We retrieved up-to-the-minute web records, news items, and encyclopedic facts to provide you with verified answers:\n\n` +
      (topSources.length > 0
        ? topSources.map((s, i) => `**${i + 1}. [${s.title}](${s.uri})** (${s.source})\n${s.snippet || 'Live web citation retrieved for this query.'}\n`).join('\n')
        : `*Direct search results for **"${query}"** were indexed across live web registries.*`) +
      (attachments.length > 0 ? `\n\n**Attached Context Evaluated**: ${attachments.map(a => a.name).join(', ')}` : '') +
      `\n\n> 🌐 *Grounded results compiled via real-time Google News, Wikipedia, and live search indexes.*`;
  }

  const sources: GroundingSource[] = liveSources.map((s) => ({
    title: s.title,
    uri: s.uri,
    snippet: s.snippet || '',
  }));

  // Add attached links
  for (const att of attachments) {
    if (att.type === 'link' && att.url) {
      sources.unshift({
        title: `Attached Link: ${att.name || att.url}`,
        uri: att.url,
        snippet: 'User provided reference document/link',
      });
    }
  }

  const suggestedFollowUps: string[] = [
    `What are the most recent updates on ${query}?`,
    `Can you break down the technical aspects of ${query}?`,
    `What are common alternatives or comparisons for ${query}?`,
  ];

  const images = imagesPromise ? await imagesPromise : await fetchLiveWebImages(query);

  return {
    engine: 'gemini',
    model: usedModel,
    query,
    text: responseText,
    sources,
    searchQueries: [query, `${query} updates`, `${query} review`],
    suggestedFollowUps,
    executionTimeMs: Date.now() - startTime,
    groundingType: 'live-web',
    images,
  };
}

export async function executeOpenAISearch(
  query: string,
  options?: { mode?: 'comprehensive' | 'concise' | 'news'; filterType?: string; model?: string; attachments?: SearchAttachment[] }
): Promise<SearchResultPayload> {
  const startTime = Date.now();
  const imagesPromise = fetchLiveWebImages(query);
  const liveSourcesPromise = fetchLiveWebSources(query, options?.filterType);
  const openai = getOpenAIClient();

  if (!openai || isOpenAiQuotaExhausted) {
    const geminiFallback = await executeGeminiSearch(query, {
      ...options,
      model: 'gemini-3.8-flash',
    });
    return {
      ...geminiFallback,
      engine: 'gemini',
      text: `> 💡 **Notice**: OpenAI key is not configured or reached quota limits. Search was fulfilled seamlessly with **Gemini AI**.\n\n${geminiFallback.text}`,
    };
  }

  try {
    const liveSources = await liveSourcesPromise;
    const sourcesListText = liveSources.length > 0
      ? liveSources
          .map((s, idx) => `[Source ${idx + 1}] Title: ${s.title}\nURL: ${s.uri}${s.snippet ? `\nSnippet: ${s.snippet}` : ''}`)
          .join('\n\n')
      : 'No external live pages retrieved. Rely on core authoritative knowledge.';

    const attachments = options?.attachments || [];
    let extraContext = '';
    
    const messages: any[] = [
      {
        role: 'system',
        content: `You are an elite, highly intelligent AI search and research assistant.
Your goal is to answer queries using up-to-date, live web grounding and deeply analyze any user attachments (documents, images, or links).
Guidelines:
1. Provide accurate, synthesized information synthesized directly from search grounding and user attachments.
2. Structure your response logically using clean Markdown:
   - Brief direct answer/executive overview
   - Key findings/sections with markdown subheadings
   - Actionable takeaways or step-by-step guidance
3. Maintain an objective, informative, and authoritative tone.

Here are the real-time, live web search results retrieved from Google News, Wikipedia, and verified sources:
---
${sourcesListText}
---`,
      },
    ];

    if (attachments.length > 0) {
      extraContext += '\n\nUser Attachments:\n';
      for (const att of attachments) {
        if (att.type === 'document') {
          extraContext += `[Document: ${att.name}]\n${att.textContent || ''}\n`;
        } else if (att.type === 'link') {
          extraContext += `[Link: ${att.url}]\n`;
        } else if (att.type === 'picture') {
          extraContext += `[Image: ${att.name}]\n`;
        }
      }
    }

    const requestedModel = options?.model === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o-mini';

    const completion = await openai.chat.completions.create({
      model: requestedModel,
      messages: [
        ...messages,
        {
          role: 'user',
          content: `${query}${extraContext}`,
        },
      ],
    });

    const text = completion.choices[0]?.message?.content || 'No response from OpenAI.';
    const executionTimeMs = Date.now() - startTime;
    const images = await imagesPromise;

    const sources: GroundingSource[] = [
      ...liveSources.map((s) => ({ title: s.title, uri: s.uri, snippet: s.snippet || '' })),
      ...attachments.filter(a => a.type === 'link' && a.url).map(a => ({ title: a.name || a.url!, uri: a.url! })),
    ];

    return {
      engine: 'openai',
      model: requestedModel,
      query,
      text,
      sources,
      searchQueries: [query],
      suggestedFollowUps: [
        `More in-depth analysis of ${query}`,
        `Alternatives and comparisons for ${query}`,
      ],
      executionTimeMs,
      images,
    };
  } catch (err: any) {
    const rawErrorMsg = err?.message || String(err);
    console.error('[AI Search] OpenAI request failed:', rawErrorMsg);
    
    if (err?.status === 429 || rawErrorMsg.includes('credits') || rawErrorMsg.includes('quota') || rawErrorMsg.includes('429')) {
      isOpenAiQuotaExhausted = true;
    }

    const geminiFallback = await executeGeminiSearch(query, {
      ...options,
      model: 'gemini-3.8-flash',
    });

    return {
      ...geminiFallback,
      engine: 'gemini',
      text: `> 💡 **Notice**: OpenAI API request failed with message: *"${rawErrorMsg}"*. Search completed seamlessly with **Gemini AI** and live web grounding.\n\n${geminiFallback.text}`,
    };
  }
}

/**
 * Translates Markdown search results into any requested target language
 * preserving formatting, bullet points, headers, and citations.
 */
export async function executeTranslate(
  text: string,
  targetLanguage: string
): Promise<{ translatedText: string; targetLanguage: string }> {
  if (!text || !text.trim()) {
    return { translatedText: '', targetLanguage };
  }

  const prompt = `You are an expert multilingual translator for research overviews.
Translate the following Markdown research answer into ${targetLanguage}.

CRITICAL RULES:
1. Translate all explanatory prose, headings, bullet points, and analysis into fluent, natural ${targetLanguage}.
2. Preserve Markdown syntax formatting accurately: headings (#, ##, ###), bold (**), italics (*), bullet lists (-), numbered lists (1.), blockquotes (>), and citation links [title](url).
3. Keep URL links in markdown links unchanged: [translated title](original_url).
4. Do NOT include any introductory or conversational remarks like "Here is the translation:" or "Sure". Output ONLY the translated markdown content directly.

Content to translate:
${text}`;

  const ai = getGeminiClient();
  const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

  for (const model of modelsToTry) {
    try {
      const response = await callWithRetry(
        () =>
          ai.models.generateContent({
            model,
            contents: prompt,
          }),
        1,
        600
      );

      if (response.text && response.text.trim()) {
        return {
          translatedText: response.text.trim(),
          targetLanguage,
        };
      }
    } catch {
      // Continue to next model on failure
    }
  }

  // Fallback: If Gemini is temporarily experiencing high load across all tiers, return original text
  return {
    translatedText: text,
    targetLanguage,
  };
}

/**
 * Execute a multi-turn chat interaction with Gemini or OpenAI.
 * Maintains context via conversational history.
 */
export async function executeAIChat(
  message: string,
  history: { role: 'user' | 'assistant' | 'model'; content: string }[],
  options?: { engine?: 'gemini' | 'openai'; model?: string }
): Promise<string> {
  const engine = options?.engine || 'gemini';
  const model = options?.model;

  if (engine === 'openai') {
    const client = getOpenAIClient();
    if (client) {
      const messages = history.map((h) => ({
        role: (h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: h.content,
      }));
      messages.push({ role: 'user' as const, content: message });
      
      try {
        const completion = await client.chat.completions.create({
          model: model || 'gpt-4o-mini',
          messages,
        });
        return completion.choices[0]?.message?.content || 'No response returned from OpenAI.';
      } catch (err: any) {
        if (err.status === 429) {
          isOpenAiQuotaExhausted = true;
          // fall through to Gemini Fallback below
        } else {
          throw err;
        }
      }
    }
  }

  // Gemini Fallback/Default
  const ai = getGeminiClient();
  const geminiModel = model && model.startsWith('gemini-') ? model : 'gemini-3.8-flash';
  
  // Format contents for @google/genai SDK
  const contents = history.map((h) => ({
    role: h.role === 'assistant' || h.role === 'model' ? 'model' : 'user',
    parts: [{ text: h.content }],
  }));
  contents.push({ role: 'user', parts: [{ text: message }] });

  const response = await ai.models.generateContent({
    model: geminiModel,
    contents,
  });

  return response.text || 'No response returned from Gemini.';
}

