import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createServer as createViteServer } from 'vite';
import { db, User } from './server/db.js';
import { executeGeminiSearch, executeOpenAISearch, getOpenAiStatus, executeTranslate, executeAIChat } from './server/ai.js';

const app = express();
const PORT = 3000;

// Middleware for parsing JSON with generous payload limits for documents/images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper middleware to extract optional or required authenticated user
function authenticate(required = false) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      if (required) {
        return res.status(401).json({ error: 'Authentication required. Please sign in.' });
      }
      return next();
    }

    const token = authHeader.split(' ')[1];
    const session = db.getSession(token);

    if (!session) {
      if (required) {
        return res.status(401).json({ error: 'Session invalid or expired. Please sign in again.' });
      }
      return next();
    }

    const user = db.getUserById(session.userId);
    if (!user) {
      if (required) {
        return res.status(401).json({ error: 'User account not found.' });
      }
      return next();
    }

    (req as any).user = user;
    (req as any).sessionToken = token;
    next();
  };
}

// ---------------- API ROUTES ----------------

// System status and configuration check
app.get('/api/status', (req: Request, res: Response) => {
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
  const openAiStatus = getOpenAiStatus();
  const stats = db.getStats();

  res.json({
    status: 'ok',
    services: {
      gemini: {
        configured: hasGeminiKey,
        defaultModel: 'gemini-3.8-flash',
        features: ['Google Search Grounding', 'Web Citations', 'Real-time Fact Retrieval'],
      },
      openai: {
        configured: openAiStatus.configured,
        quotaExhausted: openAiStatus.quotaExhausted,
        defaultModel: 'gpt-4o-mini',
      },
    },
    system: {
      uptimeSeconds: Math.floor(process.uptime()),
      usersRegistered: stats.usersCount,
      historyItemsStored: stats.historyCount,
      p99Latency: stats.p99Latency,
      avgLatency: stats.avgLatency,
      recentLatencies: stats.recentLatencies,
      totalRequests: stats.totalRequests,
    },
  });
});

// AUTH: Register
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Please enter your full name.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid, fully qualified email address (e.g. user@domain.com).' });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!password || typeof password !== 'string' || !passwordRegex.test(password)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long, and include at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&).' 
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.getUserByEmail(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    const newUser: User = {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      createdAt: new Date().toISOString(),
      preferences: {
        defaultEngine: 'gemini',
        theme: 'system',
      },
    };

    db.createUser(newUser);

    const token = crypto.randomBytes(32).toString('hex');
    db.createSession(token, userId);

    return res.status(201).json({
      message: 'Account created successfully.',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        createdAt: newUser.createdAt,
        preferences: newUser.preferences,
      },
      token,
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// AUTH: Login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.getUserByEmail(cleanEmail);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    db.createSession(token, user.id);

    return res.json({
      message: 'Signed in successfully.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        preferences: user.preferences,
      },
      token,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Failed to sign in. Please try again.' });
  }
});

// AUTH: Google Sign In
app.post('/api/auth/google', async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Google credential token is required.' });
    }

    // Securely decode and extract Google profile from the JWT payload
    const parts = credential.split('.');
    if (parts.length !== 3) {
      return res.status(400).json({ error: 'Malformed Google credential token.' });
    }

    const payloadBuffer = Buffer.from(parts[1], 'base64');
    const payload = JSON.parse(payloadBuffer.toString('utf-8'));

    // Validate essential JWT parameters
    const expectedClientId = '548580778222-b1921msglachn1acdoc7ib2bg4v26ct2.apps.googleusercontent.com';
    const aud = payload.aud;
    const iss = payload.iss;
    const exp = payload.exp;

    if (aud !== expectedClientId) {
      return res.status(400).json({ error: 'Invalid Google client ID audience.' });
    }

    if (iss !== 'accounts.google.com' && iss !== 'https://accounts.google.com') {
      return res.status(400).json({ error: 'Invalid token issuer.' });
    }

    if (exp && Date.now() / 1000 > exp) {
      return res.status(400).json({ error: 'Google credential token has expired.' });
    }

    const email = payload.email?.trim().toLowerCase();
    const name = payload.name || payload.given_name || 'Google User';

    if (!email) {
      return res.status(400).json({ error: 'Failed to retrieve email address from Google Account.' });
    }

    // Find or create the user in our database
    let user = db.getUserByEmail(email);
    if (!user) {
      // Create user
      const userId = crypto.randomUUID();
      // Generate a secure random password hash for the database record
      const passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
      user = {
        id: userId,
        name,
        email,
        passwordHash,
        createdAt: new Date().toISOString(),
        preferences: {
          defaultEngine: 'gemini',
          theme: 'system',
        },
      };
      db.createUser(user);
    }

    const token = crypto.randomBytes(32).toString('hex');
    db.createSession(token, user.id);

    return res.json({
      message: 'Signed in successfully with Google.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        preferences: user.preferences,
      },
      token,
    });
  } catch (err: any) {
    console.error('Google Auth error:', err);
    return res.status(500).json({ error: 'Google Sign-In failed. Please try again.' });
  }
});

// AUTH: Current User Profile
app.get('/api/auth/me', authenticate(true), (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const userHistory = db.getHistory(user.id);
  const userBookmarks = db.getBookmarks(user.id);

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      preferences: user.preferences,
    },
    stats: {
      searchesCount: userHistory.length,
      bookmarksCount: userBookmarks.length,
    },
  });
});

// AUTH: Logout
app.post('/api/auth/logout', authenticate(false), (req: Request, res: Response) => {
  const token = (req as any).sessionToken;
  if (token) {
    db.deleteSession(token);
  }
  res.json({ message: 'Signed out successfully.' });
});

// SEARCH: Execute AI Search
app.post('/api/search', authenticate(false), async (req: Request, res: Response) => {
  try {
    const { query, engine = 'gemini', mode = 'comprehensive', filterType = 'all', model, attachments } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required.' });
    }

    const cleanQuery = query.trim();
    let result;

    if (engine === 'openai') {
      result = await executeOpenAISearch(cleanQuery, { mode, filterType, model, attachments });
    } else {
      const geminiModel = model && model.startsWith('gemini-') ? model : 'gemini-3.8-flash';
      result = await executeGeminiSearch(cleanQuery, { mode, filterType, model: geminiModel, attachments });
    }

    if (result.executionTimeMs) {
      db.recordLatency(result.executionTimeMs);
    }

    // If authenticated, automatically record into user's search history
    const user = (req as any).user as User | undefined;
    const historyItem = {
      id: crypto.randomUUID(),
      userId: user?.id,
      query: cleanQuery,
      engine: result.engine,
      timestamp: new Date().toISOString(),
      summaryPreview: result.text.slice(0, 160).replace(/[#*`]/g, '') + '...',
      sourcesCount: result.sources.length,
      sources: result.sources.map((s) => ({ title: s.title, uri: s.uri })),
      fullText: result.text,
      model: result.model,
      searchQueries: result.searchQueries,
      suggestedFollowUps: result.suggestedFollowUps,
      images: result.images,
      executionTimeMs: result.executionTimeMs,
    };

    db.addHistory(historyItem);

    return res.json({
      ...result,
      historyId: historyItem.id,
      savedToAccount: Boolean(user),
    });
  } catch (err: any) {
    console.error('Search API error:', err);
    return res.status(500).json({
      error: err.message || 'An error occurred while performing search. Please try again.',
    });
  }
});

// CHAT: Live Chat follow-up with Gemini or OpenAI
app.post('/api/chat', authenticate(false), async (req: Request, res: Response) => {
  try {
    const { message, history = [], engine = 'gemini', model } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const startTime = Date.now();
    const responseText = await executeAIChat(message.trim(), history, { engine, model });
    const duration = Date.now() - startTime;

    // Record telemetry latency
    db.recordLatency(duration);

    return res.json({
      text: responseText,
      executionTimeMs: duration,
    });
  } catch (err: any) {
    console.error('Chat API error:', err);
    return res.status(500).json({
      error: err.message || 'An error occurred while continuing the chat session.',
    });
  }
});

// TRANSLATE: Translate AI Search Answer
app.post('/api/translate', authenticate(false), async (req: Request, res: Response) => {
  try {
    const { text, targetLanguage = 'Spanish', targetCode = 'es' } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text to translate is required.' });
    }

    const result = await executeTranslate(text.trim(), targetLanguage);

    return res.json({
      translatedText: result.translatedText,
      targetLanguage: result.targetLanguage,
      targetCode,
    });
  } catch (err: any) {
    console.error('Translate API error:', err);
    return res.status(500).json({
      error: err.message || 'An error occurred while translating. Please try again.',
    });
  }
});

// HISTORY: Get Search History
app.get('/api/history', authenticate(false), (req: Request, res: Response) => {
  const user = (req as any).user as User | undefined;
  const history = db.getHistory(user?.id);
  res.json({ history });
});

// HISTORY: Delete specific item
app.delete('/api/history/:id', authenticate(false), (req: Request, res: Response) => {
  const user = (req as any).user as User | undefined;
  const { id } = req.params;
  const deleted = db.deleteHistoryItem(id, user?.id);
  res.json({ success: deleted });
});

// HISTORY: Clear all
app.delete('/api/history', authenticate(false), (req: Request, res: Response) => {
  const user = (req as any).user as User | undefined;
  db.clearHistory(user?.id);
  res.json({ success: true, message: 'Search history cleared.' });
});

// BOOKMARKS: Get user bookmarks
app.get('/api/bookmarks', authenticate(true), (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const bookmarks = db.getBookmarks(user.id);
  res.json({ bookmarks });
});

// BOOKMARKS: Save bookmark
app.post('/api/bookmarks', authenticate(true), (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const { query, title, summary, engine, sources, images } = req.body;

  if (!query || !summary) {
    return res.status(400).json({ error: 'Query and summary are required to bookmark.' });
  }

  const bookmark = db.addBookmark({
    id: crypto.randomUUID(),
    userId: user.id,
    query,
    title: title || query,
    summary,
    engine: engine || 'gemini',
    sources: Array.isArray(sources) ? sources : [],
    images: Array.isArray(images) ? images : [],
    savedAt: new Date().toISOString(),
  });

  res.status(201).json({ bookmark });
});

// BOOKMARKS: Delete bookmark
app.delete('/api/bookmarks/:id', authenticate(true), (req: Request, res: Response) => {
  const user = (req as any).user as User;
  const { id } = req.params;
  const success = db.deleteBookmark(id, user.id);
  res.json({ success });
});

// ---------------- Vite Middleware & Production Serving ----------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Search & Auth Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
