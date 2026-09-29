// ==========================================================================
// INTELLIGENCE DESIGNED TO EVOLVE & FASTSHOT AI SEARCH CONTROLLER
// Full integration with Gemini 3.8 Flash, OpenAI, History, and Auth
// ==========================================================================

(function () {
  'use strict';

  // Check prefers-reduced-motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // View elements
  const evolveView = document.getElementById('evolve-view');
  const fastshotView = document.getElementById('fastshot-view');

  // --------------------------------------------------------------------------
  // GLOBAL APPLICATION STATE
  // --------------------------------------------------------------------------
  const state = {
    token: localStorage.getItem('fastshot_token') || '',
    user: null,
    engine: 'gemini', // 'gemini' | 'openai'
    model: 'gemini-3.8-flash', // 'gemini-3.8-flash' | 'gemini-3.1-flash-lite' | 'gpt-4o' | 'gpt-4o-mini'
    mode: 'comprehensive', // 'comprehensive' | 'concise' | 'news'
    attachments: [], // { id, type: 'document'|'picture'|'link', name, data, textContent, url, mimeType }
    isRecordingVoice: false,
    history: [],
    bookmarks: [],
    localBookmarks: JSON.parse(localStorage.getItem('fastshot_local_bookmarks') || '[]'),
    currentResult: null,
    chatHistory: [], // keeps track of continuous multi-turn chat sessions
    isSearching: false,
    activeDrawerTab: 'history', // 'history' | 'bookmarks'
    isSpeaking: false,
    isPausedSpeech: false,
    autoSpeakAnswers: localStorage.getItem('fastshot_auto_speak') === 'true',
    speechSpeed: parseFloat(localStorage.getItem('fastshot_speech_speed') || '1.0'),
    voicePersona: localStorage.getItem('fastshot_voice_persona') || 'professional',
    customVoicePitch: parseFloat(localStorage.getItem('fastshot_voice_pitch') || '1.0'),
    selectedVoiceURI: localStorage.getItem('fastshot_voice_uri') || 'auto',
    currentLanguage: 'en',
    originalMarkdown: '',
    translations: {},
  };

  try {
    const storedUser = localStorage.getItem('fastshot_user');
    if (storedUser) {
      state.user = JSON.parse(storedUser);
    }
  } catch (e) {
    console.error('Failed to parse stored user:', e);
  }

  // --------------------------------------------------------------------------
  // TOAST NOTIFICATIONS HELPER
  // --------------------------------------------------------------------------
  const toastContainer = document.getElementById('toast-container');

  function showToast(message, type = 'info', duration = 3200) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconHtml = '<i class="fa-solid fa-circle-info"></i>';
    if (type === 'success') iconHtml = '<i class="fa-solid fa-circle-check"></i>';
    if (type === 'error') iconHtml = '<i class="fa-solid fa-triangle-exclamation"></i>';

    toast.innerHTML = `${iconHtml}<span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 260);
    }, duration);
  }

  // --------------------------------------------------------------------------
  // VIEW SWITCHING (EVOLVE vs FASTSHOT)
  // --------------------------------------------------------------------------
  function switchView(target) {
    if (target === 'fastshot') {
      document.title = "Fastshot — Describe anything. We'll solve it.";
      if (evolveView) evolveView.classList.add('hidden-view');
      if (fastshotView) fastshotView.classList.remove('hidden-view');

      if (!prefersReducedMotion) {
        document.documentElement.classList.add('anim');
        const timeout = setTimeout(() => {
          document.documentElement.classList.remove('anim');
        }, 2600);

        const lastElem = document.querySelector('.logo-adobe');
        if (lastElem) {
          lastElem.addEventListener('animationend', () => {
            clearTimeout(timeout);
            document.documentElement.classList.remove('anim');
          }, { once: true });
        }
      }
      history.replaceState(null, '', '#fastshot');
      // Autofocus composer input if available
      setTimeout(() => {
        const input = document.getElementById('fastshot-search-input');
        if (input && window.innerWidth > 768) input.focus();
      }, 300);
    } else {
      document.title = 'Intelligence Designed To Evolve';
      if (fastshotView) fastshotView.classList.add('hidden-view');
      if (evolveView) evolveView.classList.remove('hidden-view');
      history.replaceState(null, '', '#evolve');
    }
  }

  // Bind Switch Buttons
  document.querySelectorAll('.enter-fastshot-trigger').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('fastshot');
    });
  });

  document.querySelectorAll('.enter-evolve-trigger').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('evolve');
    });
  });

  // Check initial hash
  if (window.location.hash === '#fastshot') {
    switchView('fastshot');
  } else {
    switchView('evolve');
  }

  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#fastshot') {
      switchView('fastshot');
    } else {
      switchView('evolve');
    }
  });

  // --------------------------------------------------------------------------
  // INTELLIGENCE STATS COUNT-UP ANIMATION
  // --------------------------------------------------------------------------
  const statsConfig = [
    { id: 'stat-inference', target: 120, decimals: 0, suffix: 'ms', duration: 1500, delay: 480 },
    { id: 'stat-uptime', target: 99.99, decimals: 2, suffix: '%', duration: 1580, delay: 570 },
    { id: 'stat-runtime', target: 24, decimals: 0, suffix: '/7', duration: 1660, delay: 660 },
    { id: 'stat-context', target: 2.4, decimals: 1, suffix: 'M', duration: 1740, delay: 750 },
  ];

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animateStat(stat) {
    const el = document.getElementById(stat.id);
    if (!el) return;

    if (prefersReducedMotion) {
      el.textContent = (stat.decimals > 0 ? stat.target.toFixed(stat.decimals) : Math.round(stat.target)) + stat.suffix;
      return;
    }

    setTimeout(() => {
      const startTime = performance.now();

      function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / stat.duration, 1);
        const eased = easeOutCubic(progress);
        const currentVal = eased * stat.target;

        if (stat.decimals > 0) {
          el.textContent = currentVal.toFixed(stat.decimals) + stat.suffix;
        } else {
          el.textContent = Math.round(currentVal) + stat.suffix;
        }

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          el.textContent = (stat.decimals > 0 ? stat.target.toFixed(stat.decimals) : Math.round(stat.target)) + stat.suffix;
        }
      }

      requestAnimationFrame(update);
    }, stat.delay);
  }

  // Trigger stats with IntersectionObserver
  const statsFooter = document.querySelector('.stats-footer');
  if (statsFooter) {
    let triggered = false;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !triggered) {
            triggered = true;
            statsConfig.forEach((cfg) => animateStat(cfg));
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.25 }
    );
    observer.observe(statsFooter);
  }

  // --------------------------------------------------------------------------
  // MOBILE MENU (EVOLVE PAGE)
  // --------------------------------------------------------------------------
  const mobileBurger = document.getElementById('mobile-burger');
  const mobileOverlay = document.getElementById('mobile-overlay');
  const mobileSheet = document.getElementById('mobile-sheet');

  function toggleMobileMenu(open) {
    if (!mobileBurger || !mobileOverlay || !mobileSheet) return;
    const isOpen = open !== undefined ? open : !mobileBurger.classList.contains('open');
    mobileBurger.classList.toggle('open', isOpen);
    mobileOverlay.classList.toggle('active', isOpen);
    mobileSheet.classList.toggle('active', isOpen);
    mobileBurger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    document.body.classList.toggle('menu-open', isOpen);
  }

  if (mobileBurger && mobileOverlay && mobileSheet) {
    mobileBurger.addEventListener('click', () => toggleMobileMenu());
    mobileOverlay.addEventListener('click', () => toggleMobileMenu(false));

    mobileSheet.querySelectorAll('a, button').forEach((item) => {
      item.addEventListener('click', () => toggleMobileMenu(false));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') toggleMobileMenu(false);
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 720) toggleMobileMenu(false);
    });
  }

  // --------------------------------------------------------------------------
  // AUTHENTICATION & USER MANAGEMENT
  // --------------------------------------------------------------------------
  const authModal = document.getElementById('auth-modal');
  const authTabLogin = document.getElementById('auth-tab-login');
  const authTabRegister = document.getElementById('auth-tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const authAlert = document.getElementById('auth-alert');
  const quickDemoBtn = document.getElementById('btn-quick-demo-login');

  function updateAuthUI() {
    const isLoggedIn = !!state.user && !!state.token;

    // Evolve header
    const evolveSignInBtn = document.getElementById('evolve-signin-btn');
    const evolveUserPill = document.getElementById('evolve-user-pill');

    // Fastshot nav
    const fastshotSignInBtn = document.getElementById('fastshot-signin-btn');
    const fastshotUserPill = document.getElementById('fastshot-user-pill');

    if (isLoggedIn) {
      const initial = (state.user.name || state.user.email || 'U').charAt(0).toUpperCase();
      const displayName = state.user.name || state.user.email.split('@')[0];

      [evolveUserPill, fastshotUserPill].forEach((pill) => {
        if (!pill) return;
        pill.classList.remove('hidden');
        const avatar = pill.querySelector('.user-avatar-circle');
        const nameText = pill.querySelector('.user-name-text');
        const ddName = pill.querySelector('.user-dd-name');
        const ddEmail = pill.querySelector('.user-dd-email');

        if (avatar) avatar.textContent = initial;
        if (nameText) nameText.textContent = displayName;
        if (ddName) ddName.textContent = state.user.name || displayName;
        if (ddEmail) ddEmail.textContent = state.user.email;
      });

      if (evolveSignInBtn) evolveSignInBtn.classList.add('hidden');
      if (fastshotSignInBtn) fastshotSignInBtn.classList.add('hidden');
    } else {
      [evolveUserPill, fastshotUserPill].forEach((pill) => {
        if (pill) {
          pill.classList.add('hidden');
          pill.classList.remove('menu-open');
        }
      });

      if (evolveSignInBtn) evolveSignInBtn.classList.remove('hidden');
      if (fastshotSignInBtn) fastshotSignInBtn.classList.remove('hidden');
    }
  }

  function toggleUserMenu(pillElem) {
    if (!pillElem) return;
    pillElem.classList.toggle('menu-open');
  }

  // Toggle user dropdown on click
  document.querySelectorAll('.user-profile-pill').forEach((pill) => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleUserMenu(pill);
    });
  });

  // Close dropdowns on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.user-profile-pill').forEach((p) => p.classList.remove('menu-open'));
    const modelMenu = document.getElementById('model-dropdown-menu');
    if (modelMenu) modelMenu.classList.add('hidden');
    const qpMenu = document.getElementById('quick-prompts-menu');
    if (qpMenu) qpMenu.classList.add('hidden');
  });

  function openAuthModal(mode = 'login') {
    if (!authModal) return;
    authModal.classList.remove('hidden');
    switchAuthTab(mode);
    clearAuthAlert();
    startYetiAnimation();
  }

  function closeAuthModal() {
    if (!authModal) return;
    authModal.classList.add('hidden');
    clearAuthAlert();
    stopYetiAnimation();
  }

  function switchAuthTab(mode) {
    const titleEl = document.getElementById('auth-modal-title');
    const descEl = document.getElementById('auth-modal-desc');

    if (mode === 'login') {
      authTabLogin?.classList.add('active');
      authTabRegister?.classList.remove('active');
      formLogin?.classList.remove('hidden');
      formRegister?.classList.add('hidden');
      if (titleEl) titleEl.textContent = 'WELCOME BACK';
      if (descEl) descEl.textContent = 'Enter your email and password to access your account';
    } else {
      authTabRegister?.classList.add('active');
      authTabLogin?.classList.remove('active');
      formRegister?.classList.remove('hidden');
      formLogin?.classList.add('hidden');
      if (titleEl) titleEl.textContent = 'CREATE ACCOUNT';
      if (descEl) descEl.textContent = 'Join Yeti AI to explore models and save search history';
    }
    clearAuthAlert();
  }

  function showAuthAlert(message, type = 'error') {
    if (!authAlert) return;
    authAlert.textContent = message;
    authAlert.className = `auth-alert ${type}`;
    authAlert.classList.remove('hidden');
  }

  function clearAuthAlert() {
    if (authAlert) {
      authAlert.textContent = '';
      authAlert.className = 'auth-alert hidden';
    }
  }

  // Bind auth triggers
  document.querySelectorAll('.auth-open-trigger').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openAuthModal('login');
    });
  });

  document.querySelectorAll('.close-auth-trigger').forEach((btn) => {
    btn.addEventListener('click', closeAuthModal);
  });

  if (authTabLogin) authTabLogin.addEventListener('click', () => switchAuthTab('login'));
  if (authTabRegister) authTabRegister.addEventListener('click', () => switchAuthTab('register'));

  // Switch links inside form footer
  const btnSwitchToSignup = document.getElementById('btn-switch-signup');
  const btnSwitchToSignin = document.getElementById('btn-switch-signin');
  if (btnSwitchToSignup) btnSwitchToSignup.addEventListener('click', () => switchAuthTab('register'));
  if (btnSwitchToSignin) btnSwitchToSignin.addEventListener('click', () => switchAuthTab('login'));

  // Password visibility toggle buttons
  function bindPasswordToggle(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = isPass ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
      }
    });
  }
  bindPasswordToggle('btn-toggle-login-pwd', 'login-password');
  bindPasswordToggle('btn-toggle-register-pwd', 'register-password');

  // Secure & Real Google Sign-In GSI Integration
  function initGoogleSignIn() {
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
      setTimeout(initGoogleSignIn, 300);
      return;
    }

    try {
      google.accounts.id.initialize({
        client_id: '548580778222-b1921msglachn1acdoc7ib2bg4v26ct2.apps.googleusercontent.com',
        callback: async (response) => {
          if (!response.credential) {
            showToast('Google Sign-In failed: no credential token returned.', 'error');
            return;
          }

          showToast('Verifying secure connection with Google Account...', 'info');

          try {
            const res = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential: response.credential }),
            });

            const data = await res.json();
            if (!res.ok) {
              throw new Error(data.error || 'Google login failed.');
            }

            state.token = data.token;
            state.user = data.user;
            localStorage.setItem('fastshot_token', data.token);
            localStorage.setItem('fastshot_user', JSON.stringify(data.user));

            updateAuthUI();
            closeAuthModal();
            showToast(`Successfully signed in with Google: ${data.user.name || data.user.email}!`, 'success');

            fetchHistory();
            fetchBookmarks();
          } catch (err) {
            showToast(err.message, 'error');
          }
        },
        auto_select: false,
        use_fedcm_for_prompt: false,
        cancel_on_tap_outside: false
      });

      const container = document.getElementById('google-signin-btn-container');
      if (container) {
        google.accounts.id.renderButton(container, {
          theme: 'outline',
          size: 'large',
          width: 300,
          shape: 'pill',
          text: 'signin_with'
        });
      }

      // Prompt One-Tap Google login overlay (Disabled in Iframe to prevent FedCM trigger errors)
      // google.accounts.id.prompt();
    } catch (e) {
      console.warn('Google Identity Services load error:', e);
    }
  }

  initGoogleSignIn();

  // Quick Demo account auto-fill
  if (quickDemoBtn) {
    quickDemoBtn.addEventListener('click', () => {
      const emailInput = document.getElementById('login-email');
      const passInput = document.getElementById('login-password');
      if (emailInput) emailInput.value = 'dip70665@gmail.com';
      if (passInput) passInput.value = 'password123';
      showToast('Pre-filled demo credentials! Click Sign In.', 'info');
    });
  }

  // --------------------------------------------------------------------------
  // INTERACTIVE YETI CHARACTER ANIMATION (HEAD & EYE CURSOR/SCROLL TRACKING)
  // --------------------------------------------------------------------------
  let yetiAnimFrame = null;
  let isYetiAnimActive = false;
  let isPasswordFocused = false;
  let isEmailFocused = false;

  const yetiState = {
    cursorX: window.innerWidth / 2,
    cursorY: window.innerHeight / 2,
    targetRotY: 0,
    targetRotX: 0,
    targetTx: 0,
    targetTy: 0,
    targetPupilLX: 0,
    targetPupilLY: 0,
    targetPupilRX: 0,
    targetPupilRY: 0,
    currentRotY: 0,
    currentRotX: 0,
    currentTx: 0,
    currentTy: 0,
    currentPupilLX: 0,
    currentPupilLY: 0,
    currentPupilRX: 0,
    currentPupilRY: 0,
  };

  function updateYetiTargets(clientX, clientY) {
    yetiState.cursorX = clientX;
    yetiState.cursorY = clientY;

    const headGroup = document.getElementById('yeti-head-group');
    const eyeL = document.getElementById('yeti-eye-l');
    const eyeR = document.getElementById('yeti-eye-r');

    if (!headGroup || !eyeL || !eyeR) return;

    if (isPasswordFocused) {
      // Shy yeti covers / averts eyes when typing password
      yetiState.targetRotY = -18;
      yetiState.targetRotX = 12;
      yetiState.targetTx = -8;
      yetiState.targetTy = 5;
      yetiState.targetPupilLX = -6;
      yetiState.targetPupilLY = 6;
      yetiState.targetPupilRX = -6;
      yetiState.targetPupilRY = 6;
      return;
    }

    if (isEmailFocused) {
      // Looks down-right towards the email input box
      yetiState.targetRotY = 16;
      yetiState.targetRotX = 14;
      yetiState.targetTx = 8;
      yetiState.targetTy = 6;
      yetiState.targetPupilLX = 6;
      yetiState.targetPupilLY = 5;
      yetiState.targetPupilRX = 6;
      yetiState.targetPupilRY = 5;
      return;
    }

    const headRect = headGroup.getBoundingClientRect();
    const headCenterX = headRect.left + headRect.width / 2;
    const headCenterY = headRect.top + headRect.height * 0.45;

    // Delta from head center to cursor
    const dx = clientX - headCenterX;
    const dy = clientY - headCenterY;

    // Head rotation (left/right up to ±24deg, up/down up to ±16deg)
    const maxRotY = 24;
    const maxRotX = 16;
    const halfW = window.innerWidth / 2 || 400;
    const halfH = window.innerHeight / 2 || 350;

    yetiState.targetRotY = Math.max(-maxRotY, Math.min(maxRotY, (dx / halfW) * maxRotY));
    yetiState.targetRotX = Math.max(-maxRotX, Math.min(maxRotX, (-dy / halfH) * maxRotX));

    // Head subtle perspective translation
    yetiState.targetTx = Math.max(-10, Math.min(10, (dx / halfW) * 10));
    yetiState.targetTy = Math.max(-8, Math.min(8, (dy / halfH) * 8));

    // Pupils tracking (left and right eyes calculate directional vector)
    const eyeLRect = eyeL.getBoundingClientRect();
    const eyeRRect = eyeR.getBoundingClientRect();

    const maxPupilDist = 7.5; // max pixel shift inside eye socket

    // Left eye pupil
    const ldx = clientX - (eyeLRect.left + eyeLRect.width / 2);
    const ldy = clientY - (eyeLRect.top + eyeLRect.height / 2);
    const lDist = Math.hypot(ldx, ldy);
    const lAngle = Math.atan2(ldy, ldx);
    const lTravel = Math.min(maxPupilDist, lDist / 35);
    yetiState.targetPupilLX = Math.cos(lAngle) * lTravel;
    yetiState.targetPupilLY = Math.sin(lAngle) * lTravel;

    // Right eye pupil
    const rdx = clientX - (eyeRRect.left + eyeRRect.width / 2);
    const rdy = clientY - (eyeRRect.top + eyeRRect.height / 2);
    const rDist = Math.hypot(rdx, rdy);
    const rAngle = Math.atan2(rdy, rdx);
    const rTravel = Math.min(maxPupilDist, rDist / 35);
    yetiState.targetPupilRX = Math.cos(rAngle) * rTravel;
    yetiState.targetPupilRY = Math.sin(rAngle) * rTravel;
  }

  // Smooth lerp physics loop
  function yetiRenderLoop() {
    if (!isYetiAnimActive) return;

    const k = 0.12; // smoothing factor
    yetiState.currentRotY += (yetiState.targetRotY - yetiState.currentRotY) * k;
    yetiState.currentRotX += (yetiState.targetRotX - yetiState.currentRotX) * k;
    yetiState.currentTx += (yetiState.targetTx - yetiState.currentTx) * k;
    yetiState.currentTy += (yetiState.targetTy - yetiState.currentTy) * k;
    yetiState.currentPupilLX += (yetiState.targetPupilLX - yetiState.currentPupilLX) * k;
    yetiState.currentPupilLY += (yetiState.targetPupilLY - yetiState.currentPupilLY) * k;
    yetiState.currentPupilRX += (yetiState.targetPupilRX - yetiState.currentPupilRX) * k;
    yetiState.currentPupilRY += (yetiState.targetPupilRY - yetiState.currentPupilRY) * k;

    const headGroup = document.getElementById('yeti-head-group');
    const pupilL = document.getElementById('yeti-pupil-l');
    const pupilR = document.getElementById('yeti-pupil-r');

    if (headGroup) {
      headGroup.style.transform = `perspective(600px) rotateY(${yetiState.currentRotY.toFixed(2)}deg) rotateX(${yetiState.currentRotX.toFixed(2)}deg) translate(${yetiState.currentTx.toFixed(2)}px, ${yetiState.currentTy.toFixed(2)}px)`;
    }
    if (pupilL) {
      pupilL.style.transform = `translate(${yetiState.currentPupilLX.toFixed(2)}px, ${yetiState.currentPupilLY.toFixed(2)}px)`;
    }
    if (pupilR) {
      pupilR.style.transform = `translate(${yetiState.currentPupilRX.toFixed(2)}px, ${yetiState.currentPupilRY.toFixed(2)}px)`;
    }

    yetiAnimFrame = requestAnimationFrame(yetiRenderLoop);
  }

  // Blinking loop
  let blinkTimer = null;
  function scheduleNextBlink() {
    const nextBlinkDelay = 3000 + Math.random() * 3500;
    blinkTimer = setTimeout(() => {
      triggerYetiBlink();
      scheduleNextBlink();
    }, nextBlinkDelay);
  }

  function triggerYetiBlink() {
    const eyelidL = document.getElementById('yeti-eyelid-l');
    const eyelidR = document.getElementById('yeti-eyelid-r');
    if (!eyelidL || !eyelidR) return;

    eyelidL.setAttribute('ry', '18');
    eyelidR.setAttribute('ry', '18');

    setTimeout(() => {
      eyelidL.setAttribute('ry', '0');
      eyelidR.setAttribute('ry', '0');
    }, 160);
  }

  function startYetiAnimation() {
    if (isYetiAnimActive) return;
    isYetiAnimActive = true;
    yetiAnimFrame = requestAnimationFrame(yetiRenderLoop);
    scheduleNextBlink();

    // Trigger initial tracking centered
    updateYetiTargets(window.innerWidth / 2, window.innerHeight / 2);
  }

  function stopYetiAnimation() {
    isYetiAnimActive = false;
    if (yetiAnimFrame) cancelAnimationFrame(yetiAnimFrame);
    if (blinkTimer) clearTimeout(blinkTimer);
  }

  // Cursor movement tracking (mouse / pointer / touch)
  window.addEventListener('pointermove', (e) => {
    if (!isYetiAnimActive) return;
    updateYetiTargets(e.clientX, e.clientY);
  });

  // Scroll tracking: when user scrolls or uses wheel, update Yeti head & eyes
  window.addEventListener('scroll', () => {
    if (!isYetiAnimActive) return;
    updateYetiTargets(yetiState.cursorX, yetiState.cursorY);
  }, { passive: true });

  window.addEventListener('wheel', (e) => {
    if (!isYetiAnimActive) return;
    // Shift target slightly based on wheel direction
    updateYetiTargets(yetiState.cursorX, yetiState.cursorY + (e.deltaY > 0 ? 30 : -30));
  }, { passive: true });

  // Input focus behaviors
  const loginPass = document.getElementById('login-password');
  const regPass = document.getElementById('register-password');
  [loginPass, regPass].forEach((el) => {
    if (!el) return;
    el.addEventListener('focus', () => {
      isPasswordFocused = true;
      updateYetiTargets(yetiState.cursorX, yetiState.cursorY);
    });
    el.addEventListener('blur', () => {
      isPasswordFocused = false;
      updateYetiTargets(yetiState.cursorX, yetiState.cursorY);
    });
  });

  const loginEmail = document.getElementById('login-email');
  const regEmail = document.getElementById('register-email');
  [loginEmail, regEmail].forEach((el) => {
    if (!el) return;
    el.addEventListener('focus', () => {
      isEmailFocused = true;
      updateYetiTargets(yetiState.cursorX, yetiState.cursorY);
    });
    el.addEventListener('blur', () => {
      isEmailFocused = false;
      updateYetiTargets(yetiState.cursorX, yetiState.cursorY);
    });
  });

  // Handle Login submission
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email')?.value.trim();
      const password = document.getElementById('login-password')?.value;
      const submitBtn = document.getElementById('btn-login-submit');

      if (!email || !password) {
        showAuthAlert('Please enter both email and password.');
        return;
      }

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Signing In...</span>';
        }

        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to sign in');
        }

        state.token = data.token;
        state.user = data.user;
        localStorage.setItem('fastshot_token', data.token);
        localStorage.setItem('fastshot_user', JSON.stringify(data.user));

        updateAuthUI();
        closeAuthModal();
        showToast(`Welcome back, ${data.user.name || data.user.email}!`, 'success');

        fetchHistory();
        fetchBookmarks();
      } catch (err) {
        showAuthAlert(err.message, 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Sign In</span> <i class="fa-solid fa-arrow-right"></i>';
        }
      }
    });
  }

  // Handle Register submission
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('register-name')?.value.trim();
      const email = document.getElementById('register-email')?.value.trim();
      const password = document.getElementById('register-password')?.value;
      const submitBtn = document.getElementById('btn-register-submit');

      if (!name || !email || !password) {
        showAuthAlert('Please fill in all fields.');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showAuthAlert('Please enter a valid, fully qualified email address (e.g. user@domain.com).');
        return;
      }

      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(password)) {
        showAuthAlert('Password must be at least 8 characters long, and include at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&).');
        return;
      }

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Creating account...</span>';
        }

        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Registration failed');
        }

        state.token = data.token;
        state.user = data.user;
        localStorage.setItem('fastshot_token', data.token);
        localStorage.setItem('fastshot_user', JSON.stringify(data.user));

        updateAuthUI();
        closeAuthModal();
        showToast(`Account created! Welcome, ${data.user.name}!`, 'success');

        fetchHistory();
        fetchBookmarks();
      } catch (err) {
        showAuthAlert(err.message, 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Create Free Account</span> <i class="fa-solid fa-arrow-right"></i>';
        }
      }
    });
  }

  // Logout handler
  document.querySelectorAll('.user-logout-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        if (state.token) {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${state.token}` },
          });
        }
      } catch (e) {
        // Ignore network errors on logout
      }
      state.token = '';
      state.user = null;
      localStorage.removeItem('fastshot_token');
      localStorage.removeItem('fastshot_user');
      updateAuthUI();
      showToast('Signed out of session.', 'info');
      fetchHistory();
    });
  });

  // Verify stored token on boot
  async function verifySession() {
    if (!state.token) {
      updateAuthUI();
      return;
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${state.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        state.user = data.user;
        localStorage.setItem('fastshot_user', JSON.stringify(data.user));
        updateAuthUI();
      } else {
        // Expired token
        state.token = '';
        state.user = null;
        localStorage.removeItem('fastshot_token');
        localStorage.removeItem('fastshot_user');
        updateAuthUI();
      }
    } catch (e) {
      // Network offline, keep local user
      updateAuthUI();
    }
  }

  verifySession();

  // --------------------------------------------------------------------------
  // MODEL SELECTOR & ENGINE CONTROLS
  // --------------------------------------------------------------------------
  const modelDropdownBtn = document.getElementById('model-dropdown-btn');
  const modelDropdownMenu = document.getElementById('model-dropdown-menu');
  const selectedModelLabel = document.getElementById('selected-model-label');
  const modelOptions = document.querySelectorAll('.model-option');

  function closeAllPopovers() {
    if (modelDropdownMenu) {
      modelDropdownMenu.classList.add('hidden');
    }
    if (modelDropdownBtn) {
      modelDropdownBtn.setAttribute('aria-expanded', 'false');
    }
    const attMenu = document.getElementById('attachment-menu-popup');
    if (attMenu) attMenu.classList.add('hidden');
    const qpMenu = document.getElementById('quick-prompts-menu');
    if (qpMenu) qpMenu.classList.add('hidden');
  }

  function updateModelSelectionUI(engine, model) {
    state.engine = engine;
    state.model = model;

    modelOptions.forEach((opt) => {
      const optEngine = opt.getAttribute('data-engine');
      const optModel = opt.getAttribute('data-model');
      const check = opt.querySelector('.model-opt-check');
      const isMatch = (optEngine === engine && (!optModel || optModel === model));

      if (isMatch) {
        opt.classList.add('active');
        if (check) check.classList.remove('hidden');
      } else {
        opt.classList.remove('active');
        if (check) check.classList.add('hidden');
      }
    });

    if (selectedModelLabel) {
      if (model === 'gemini-3.8-flash' || (engine === 'gemini' && !model)) {
        selectedModelLabel.innerHTML = '<i class="fa-solid fa-bolt text-amber-400"></i> Gemini 3.8 Flash';
      } else if (model === 'gemini-3.1-flash-lite') {
        selectedModelLabel.innerHTML = '<i class="fa-solid fa-gauge-high text-amber-400"></i> Gemini 3.1 Flash Lite';
      } else if (model === 'gpt-4o') {
        selectedModelLabel.innerHTML = '<i class="fa-solid fa-brain text-emerald-400"></i> OpenAI GPT-4o';
      } else if (model === 'gpt-4o-mini') {
        selectedModelLabel.innerHTML = '<i class="fa-solid fa-microchip text-emerald-400"></i> GPT-4o Mini';
      }
    }
  }

  if (modelDropdownBtn && modelDropdownMenu) {
    modelDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = modelDropdownMenu.classList.contains('hidden');
      closeAllPopovers();
      if (isHidden) {
        modelDropdownMenu.classList.remove('hidden');
        modelDropdownBtn.setAttribute('aria-expanded', 'true');
      } else {
        modelDropdownMenu.classList.add('hidden');
        modelDropdownBtn.setAttribute('aria-expanded', 'false');
      }
    });

    modelDropdownBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        modelDropdownBtn.click();
      } else if (e.key === 'Escape') {
        closeAllPopovers();
      }
    });
  }

  modelOptions.forEach((option) => {
    const handleSelect = (e) => {
      e.stopPropagation();
      const engine = option.getAttribute('data-engine') || 'gemini';
      const model = option.getAttribute('data-model') || (engine === 'gemini' ? 'gemini-3.8-flash' : 'gpt-4o-mini');

      updateModelSelectionUI(engine, model);
      if (modelDropdownMenu) {
        modelDropdownMenu.classList.add('hidden');
      }
      if (modelDropdownBtn) {
        modelDropdownBtn.setAttribute('aria-expanded', 'false');
      }

      const modelDisplayNames = {
        'gemini-3.8-flash': 'Gemini 3.8 Flash (Google Grounded)',
        'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite (Ultra-fast)',
        'gpt-4o': 'OpenAI GPT-4o (Deep Reasoning)',
        'gpt-4o-mini': 'OpenAI GPT-4o Mini (Fast Reasoning)',
      };
      showToast(`Model set to ${modelDisplayNames[model] || model}`, 'info');
    };

    option.addEventListener('click', handleSelect);
    option.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSelect(e);
      }
    });
  });

  // Mode chips (Comprehensive, Concise, News)
  const modeChips = document.querySelectorAll('.chip-mode');
  modeChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const mode = chip.getAttribute('data-mode');
      if (!mode) return;
      state.mode = mode;

      modeChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');

      const modeNames = {
        comprehensive: 'Deep Web Search (Comprehensive Citations)',
        concise: 'Quick Fact (Fast direct synthesis)',
        news: 'Live News Grounding',
      };
      showToast(`Search mode: ${modeNames[mode] || mode}`, 'info');
    });
  });

  // --------------------------------------------------------------------------
  // ATTACHMENT SYSTEM: DOCUMENT, PICTURE, LINKS
  // --------------------------------------------------------------------------
  const btnAttachmentToggle = document.getElementById('btn-attachment-toggle');
  const attachmentMenuPopup = document.getElementById('attachment-menu-popup');
  const btnAttachDocAction = document.getElementById('btn-attach-doc-action');
  const btnAttachPicAction = document.getElementById('btn-attach-pic-action');
  const btnAttachLinkAction = document.getElementById('btn-attach-link-action');
  const fileInputDoc = document.getElementById('file-input-doc');
  const fileInputPic = document.getElementById('file-input-pic');
  const composerAttachmentsTray = document.getElementById('composer-attachments-tray');

  // Link Attachment Modal
  const linkAttachModal = document.getElementById('link-attach-modal');
  const formAttachLink = document.getElementById('form-attach-link');
  const inputAttachUrl = document.getElementById('input-attach-url');
  const inputAttachLabel = document.getElementById('input-attach-label');

  if (btnAttachmentToggle && attachmentMenuPopup) {
    btnAttachmentToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = attachmentMenuPopup.classList.contains('hidden');
      closeAllPopovers();
      if (isHidden) {
        attachmentMenuPopup.classList.remove('hidden');
      }
    });
  }

  // 1. Document File Picker Trigger
  if (btnAttachDocAction && fileInputDoc) {
    btnAttachDocAction.addEventListener('click', (e) => {
      e.stopPropagation();
      if (attachmentMenuPopup) attachmentMenuPopup.classList.add('hidden');
      fileInputDoc.value = '';
      fileInputDoc.click();
    });
  }

  // Handle Document Files Upload
  if (fileInputDoc) {
    fileInputDoc.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      for (const file of files) {
        try {
          const textContent = await readFileContentAsText(file);
          const base64Data = await readFileAsDataURL(file);
          state.attachments.push({
            id: 'att-' + Math.random().toString(36).substring(2, 9),
            type: 'document',
            name: file.name,
            size: file.size,
            mimeType: file.type || 'text/plain',
            textContent: textContent.slice(0, 40000), // safe char limit for search synthesis
            data: base64Data,
          });
          showToast(`Document attached: ${file.name}`, 'success');
        } catch (err) {
          showToast(`Failed to read ${file.name}`, 'error');
        }
      }
      renderAttachmentTray();
    });
  }

  // 2. Picture / Image File Picker Trigger
  if (btnAttachPicAction && fileInputPic) {
    btnAttachPicAction.addEventListener('click', (e) => {
      e.stopPropagation();
      if (attachmentMenuPopup) attachmentMenuPopup.classList.add('hidden');
      fileInputPic.value = '';
      fileInputPic.click();
    });
  }

  function resizeAndReadFileAsDataURL(file, maxWidth = 1200, maxHeight = 1200, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(readerEvent.target.result);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(readerEvent.target.result);
        img.src = readerEvent.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Handle Picture Files Upload
  if (fileInputPic) {
    fileInputPic.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      for (const file of files) {
        try {
          const dataUrl = await resizeAndReadFileAsDataURL(file);
          state.attachments.push({
            id: 'att-' + Math.random().toString(36).substring(2, 9),
            type: 'picture',
            name: file.name,
            size: file.size,
            mimeType: 'image/jpeg',
            data: dataUrl,
          });
          showToast(`Picture attached: ${file.name}`, 'success');
        } catch (err) {
          showToast(`Failed to load image ${file.name}`, 'error');
        }
      }
      renderAttachmentTray();
    });
  }

  // 3. Links Attachment Modal Trigger
  if (btnAttachLinkAction && linkAttachModal) {
    btnAttachLinkAction.addEventListener('click', (e) => {
      e.stopPropagation();
      if (attachmentMenuPopup) attachmentMenuPopup.classList.add('hidden');
      openLinkAttachModal();
    });
  }

  function openLinkAttachModal() {
    if (!linkAttachModal) return;
    linkAttachModal.classList.remove('hidden');
    if (inputAttachUrl) {
      inputAttachUrl.value = '';
      inputAttachUrl.focus();
    }
    if (inputAttachLabel) inputAttachLabel.value = '';
  }

  function closeLinkAttachModal() {
    if (!linkAttachModal) return;
    linkAttachModal.classList.add('hidden');
  }

  document.querySelectorAll('.close-link-modal-trigger').forEach((btn) => {
    btn.addEventListener('click', closeLinkAttachModal);
  });

  if (formAttachLink) {
    formAttachLink.addEventListener('submit', (e) => {
      e.preventDefault();
      const url = inputAttachUrl ? inputAttachUrl.value.trim() : '';
      const label = inputAttachLabel ? inputAttachLabel.value.trim() : '';

      if (!url) {
        showToast('Please enter a valid URL', 'info');
        return;
      }

      state.attachments.push({
        id: 'att-' + Math.random().toString(36).substring(2, 9),
        type: 'link',
        name: label || url,
        url: url.startsWith('http') ? url : `https://${url}`,
      });

      closeLinkAttachModal();
      renderAttachmentTray();
      showToast(`Link attached: ${label || url}`, 'success');
    });
  }

  function readFileContentAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result || '');
      reader.onerror = reject;
      // If it's a binary like pdf/docx, read partial text or summary description
      if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.json') || file.name.endsWith('.csv') || file.name.endsWith('.js') || file.name.endsWith('.ts') || file.name.endsWith('.py')) {
        reader.readAsText(file);
      } else {
        reader.readAsText(file.slice(0, 15000));
      }
    });
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Render Attached Items in Composer Tray
  function renderAttachmentTray() {
    if (!composerAttachmentsTray) return;

    if (state.attachments.length === 0) {
      composerAttachmentsTray.innerHTML = '';
      composerAttachmentsTray.classList.add('hidden');
      return;
    }

    composerAttachmentsTray.classList.remove('hidden');
    composerAttachmentsTray.innerHTML = state.attachments
      .map((att) => {
        if (att.type === 'picture') {
          return `
            <div class="att-chip pic-chip" data-id="${att.id}">
              ${att.data ? `<img src="${att.data}" alt="${att.name}" class="att-chip-thumb" />` : `<div class="att-chip-icon"><i class="fa-solid fa-image"></i></div>`}
              <span class="att-chip-name" title="${att.name}">${att.name}</span>
              <button type="button" class="att-chip-remove" data-remove-id="${att.id}" title="Remove attachment">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          `;
        } else if (att.type === 'document') {
          return `
            <div class="att-chip doc-chip" data-id="${att.id}">
              <div class="att-chip-icon"><i class="fa-solid fa-file-lines"></i></div>
              <span class="att-chip-name" title="${att.name}">${att.name}</span>
              <button type="button" class="att-chip-remove" data-remove-id="${att.id}" title="Remove attachment">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          `;
        } else {
          return `
            <div class="att-chip link-chip" data-id="${att.id}">
              <div class="att-chip-icon"><i class="fa-solid fa-link"></i></div>
              <span class="att-chip-name" title="${att.url || att.name}">${att.name}</span>
              <button type="button" class="att-chip-remove" data-remove-id="${att.id}" title="Remove attachment">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          `;
        }
      })
      .join('');

    // Bind remove buttons
    composerAttachmentsTray.querySelectorAll('.att-chip-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const removeId = btn.getAttribute('data-remove-id');
        state.attachments = state.attachments.filter((a) => a.id !== removeId);
        renderAttachmentTray();
      });
    });
  }

  // --------------------------------------------------------------------------
  // VOICE INSTRUCTIONS & SPEECH RECOGNITION
  // --------------------------------------------------------------------------
  const btnVoiceInput = document.getElementById('btn-voice-input');
  const voiceMicIcon = document.getElementById('voice-mic-icon');
  const voicePulseRing = document.getElementById('voice-pulse-ring');
  let speechRecognizer = null;

  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return null;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      state.isRecordingVoice = true;
      if (btnVoiceInput) {
        btnVoiceInput.classList.add('listening');
        btnVoiceInput.setAttribute('title', 'Listening... Speak your instruction or search query');
      }
      if (voicePulseRing) voicePulseRing.classList.remove('hidden');
      showToast('Listening... Speak your instruction now', 'info', 4000);
    };

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      const searchInput = document.getElementById('fastshot-search-input');
      if (searchInput && transcript) {
        searchInput.value = transcript;
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      stopVoiceRecognition();
      if (event.error === 'not-allowed') {
        showToast('Microphone access was denied. Please allow microphone permission.', 'error');
      } else if (event.error !== 'no-speech') {
        showToast(`Voice input error: ${event.error}`, 'error');
      }
    };

    recognition.onend = () => {
      stopVoiceRecognition();
      const searchInput = document.getElementById('fastshot-search-input');
      if (searchInput && searchInput.value.trim()) {
        showToast('Voice instruction captured! Press Enter or Send to search.', 'success');
        searchInput.focus();
      }
    };

    return recognition;
  }

  function startVoiceRecognition() {
    if (!speechRecognizer) {
      speechRecognizer = initSpeechRecognition();
    }
    if (!speechRecognizer) {
      showToast('Speech recognition is not supported in this browser.', 'info');
      return;
    }
    try {
      speechRecognizer.start();
    } catch (e) {
      console.warn('Speech recognizer already running:', e);
    }
  }

  function stopVoiceRecognition() {
    state.isRecordingVoice = false;
    if (btnVoiceInput) {
      btnVoiceInput.classList.remove('listening');
      btnVoiceInput.setAttribute('title', 'Click to speak your instruction or query');
    }
    if (voicePulseRing) voicePulseRing.classList.add('hidden');
    if (speechRecognizer) {
      try {
        speechRecognizer.stop();
      } catch (e) {}
    }
  }

  if (btnVoiceInput) {
    btnVoiceInput.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.isRecordingVoice) {
        stopVoiceRecognition();
      } else {
        startVoiceRecognition();
      }
    });
  }

  // Quick Prompts Popover (Trending queries)
  const quickPromptsBtn = document.getElementById('btn-quick-prompts');
  const quickPromptsMenu = document.getElementById('quick-prompts-menu');

  if (quickPromptsBtn && quickPromptsMenu) {
    quickPromptsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = quickPromptsMenu.classList.contains('hidden');
      closeAllPopovers();
      if (isHidden) {
        quickPromptsMenu.classList.remove('hidden');
      }
    });

    quickPromptsMenu.querySelectorAll('.qp-item').forEach((item) => {
      item.addEventListener('click', () => {
        const query = item.getAttribute('data-query');
        const input = document.getElementById('fastshot-search-input');
        if (input && query) {
          input.value = query;
          quickPromptsMenu.classList.add('hidden');
          executeSearch(query);
        }
      });
    });
  }

  // Global Outside Click to close floating menus
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#model-dropdown-btn') && !e.target.closest('#model-dropdown-menu')) {
      if (modelDropdownMenu) modelDropdownMenu.classList.add('hidden');
    }
    if (!e.target.closest('.attachment-btn-wrapper')) {
      if (attachmentMenuPopup) attachmentMenuPopup.classList.add('hidden');
    }
    if (!e.target.closest('#btn-quick-prompts') && !e.target.closest('#quick-prompts-menu')) {
      if (quickPromptsMenu) quickPromptsMenu.classList.add('hidden');
    }
  });

  // --------------------------------------------------------------------------
  // AI SEARCH EXECUTION & RESULTS OVERLAY
  // --------------------------------------------------------------------------
  const searchForm = document.getElementById('fastshot-search-form');
  const searchInput = document.getElementById('fastshot-search-input');
  const submitSearchBtn = document.getElementById('btn-submit-search');
  const sendArrowIcon = document.getElementById('send-arrow-icon');
  const sendSpinnerIcon = document.getElementById('send-spinner-icon');

  const resultsModal = document.getElementById('search-results-modal');
  const resultsQueryTitle = document.getElementById('results-query-title');
  const resultsEngineBadge = document.getElementById('results-engine-badge');
  const resultsEngineName = document.getElementById('results-engine-name');
  const resultsGroundingBadge = document.getElementById('results-grounding-badge');
  const resultsGroundingText = document.getElementById('results-grounding-text');
  const resultsTimeText = document.getElementById('results-time-text');
  const resultsLoadingState = document.getElementById('results-loading-state');
  const loadingStageTitle = document.getElementById('loading-stage-title');
  const loadingStageDesc = document.getElementById('loading-stage-desc');
  const resultsContentArea = document.getElementById('results-content-area');
  const resultsMarkdown = document.getElementById('results-markdown');
  const resultsImagesWrapper = document.getElementById('results-images-wrapper');
  const resultsImagesGrid = document.getElementById('results-images-grid');
  const resultsSourcesWrapper = document.getElementById('results-sources-wrapper');
  const resultsSourcesCount = document.getElementById('results-sources-count');
  const resultsSourcesGrid = document.getElementById('results-sources-grid');
  const resultsQueriesWrapper = document.getElementById('results-queries-wrapper');
  const resultsQueriesPills = document.getElementById('results-queries-pills');
  const resultsFollowupsWrapper = document.getElementById('results-followups-wrapper');
  const resultsFollowupsList = document.getElementById('results-followups-list');
  const btnCopyResult = document.getElementById('btn-copy-result');
  const btnBookmarkResult = document.getElementById('btn-bookmark-result');
  const btnSpeakResult = document.getElementById('btn-speak-result');
  const voiceSpeakIcon = document.getElementById('voice-speak-icon');
  const voiceSpeakTooltip = document.getElementById('voice-speak-tooltip');
  const voiceAssistantBanner = document.getElementById('voice-assistant-banner');
  const voiceBannerStatusText = document.getElementById('voice-banner-status-text');
  const voiceBannerSubText = document.getElementById('voice-banner-sub-text');
  const btnVoicePersonaBanner = document.getElementById('btn-voice-persona-banner');
  const voicePersonaIcon = document.getElementById('voice-persona-icon');
  const voicePersonaName = document.getElementById('voice-persona-name');
  const btnVoiceSpeed = document.getElementById('btn-voice-speed');
  const voiceSpeedLabel = document.getElementById('voice-speed-label');
  const btnVoiceSettingsToggle = document.getElementById('btn-voice-settings-toggle');
  const btnVoicePausePlay = document.getElementById('btn-voice-pause-play');
  const voicePausePlayIcon = document.getElementById('voice-pause-play-icon');
  const btnVoiceStop = document.getElementById('btn-voice-stop');
  const toggleAutoSpeak = document.getElementById('toggle-auto-speak');

  // AI Creator Workspace references
  const aiCreatorToolbar = document.getElementById('ai-creator-toolbar');
  const creatorPillBtns = document.querySelectorAll('.creator-pill-btn');
  const creatorTabPanels = document.querySelectorAll('.creator-tab-panel');

  // Image Gen references
  const imageGenForm = document.getElementById('image-gen-form');
  const imageGenInput = document.getElementById('image-gen-input');
  const imageGenStyle = document.getElementById('image-gen-style');
  const imageGenOutputContainer = document.getElementById('image-gen-output-container');
  const imageEditorContainer = document.getElementById('image-editor-container');
  const imageEditorCanvas = document.getElementById('image-editor-canvas');
  const btnEditorDraw = document.getElementById('btn-editor-draw');
  const btnEditorClear = document.getElementById('btn-editor-clear');
  const btnEditorSave = document.getElementById('btn-editor-save');
  const btnEditorCancel = document.getElementById('btn-editor-cancel');
  let isDrawing = false;
  let editedImageUrl = null;

  // Slides / PPT references
  const btnBuildSlides = document.getElementById('btn-build-slides');
  const btnDownloadSlidesHtml = document.getElementById('btn-download-slides-html');
  const btnPrintSlidesPdf = document.getElementById('btn-print-slides-pdf');
  const btnDownloadSlidesPptx = document.getElementById('btn-download-slides-pptx');
  const slideTheaterContainer = document.getElementById('slide-theater-container');
  const slideContentPane = document.getElementById('slide-content-pane');
  const slideCounterLabel = document.getElementById('slide-counter-label');
  const btnPrevSlide = document.getElementById('btn-prev-slide');
  const btnNextSlide = document.getElementById('btn-next-slide');
  const slidesLoadingIndicator = document.getElementById('slides-loading-indicator');
  const slidesPlaceholderBox = document.getElementById('slides-placeholder-box');

  // Docs / Word references
  const btnFormatDocs = document.getElementById('btn-format-docs');
  const btnDownloadWord = document.getElementById('btn-download-word');
  const docsPreviewArea = document.getElementById('docs-preview-area');
  const docsPlaceholderBox = document.getElementById('docs-placeholder-box');

  // App Sandbox references
  const appBuilderForm = document.getElementById('app-builder-form');
  const appBuilderInput = document.getElementById('app-builder-input');
  const sandboxLoadingIndicator = document.getElementById('sandbox-loading-indicator');
  const sandboxWorkspace = document.getElementById('sandbox-workspace');
  const sandboxTabBtns = document.querySelectorAll('.sandbox-tab-btn');
  const sandboxPanes = document.querySelectorAll('.sandbox-pane');
  const sandboxIframe = document.getElementById('sandbox-iframe');
  const sandboxCodeTextarea = document.getElementById('sandbox-code-textarea');
  const btnDownloadAppHtml = document.getElementById('btn-download-app-html');
  const sandboxPlaceholderBox = document.getElementById('sandbox-placeholder-box');

  // AI Creator State tracking
  let currentSlides = [];
  let currentSlideIndex = 0;
  let currentFormattedDocHtml = '';
  let currentSandboxCode = '';
  const btnOpenVoiceSettingsFooter = document.getElementById('btn-open-voice-settings-footer');
  const btnResultsNewSearch = document.getElementById('btn-results-new-search');

  // Live Chat Elements
  const resultsChatFeed = document.getElementById('results-chat-feed');
  const chatTypingIndicator = document.getElementById('chat-typing-indicator');
  const chatComposerForm = document.getElementById('chat-composer-form');
  const chatComposerInput = document.getElementById('chat-composer-input');

  // Voice Settings & Personas Modal DOM elements
  const voiceSettingsModal = document.getElementById('voice-settings-modal');
  const personaCardsGrid = document.getElementById('persona-cards-grid');
  const tuningSpeedDisplay = document.getElementById('tuning-speed-display');
  const tuningSpeedPills = document.getElementById('tuning-speed-pills');
  const tuningPitchSlider = document.getElementById('tuning-pitch-slider');
  const tuningPitchDisplay = document.getElementById('tuning-pitch-display');
  const btnResetPitch = document.getElementById('btn-reset-pitch');
  const tuningVoiceSelect = document.getElementById('tuning-voice-select');
  const btnTestCurrentVoice = document.getElementById('btn-test-current-voice');
  const testVoiceIcon = document.getElementById('test-voice-icon');
  const testVoiceLabel = document.getElementById('test-voice-label');

  // Multilingual translation DOM elements
  const resultsLanguageSelect = document.getElementById('results-language-select');
  const translationLoader = document.getElementById('translation-loader');
  const translationActiveBadge = document.getElementById('translation-active-badge');
  const translationLangName = document.getElementById('translation-lang-name');
  const btnRevertOriginal = document.getElementById('btn-revert-original');

  // Comprehensive Multilingual Catalog
  const languageCatalog = {
    en: { name: 'English', bcp47: 'en-US', native: 'English' },
    es: { name: 'Spanish', bcp47: 'es-ES', native: 'Español' },
    fr: { name: 'French', bcp47: 'fr-FR', native: 'Français' },
    de: { name: 'German', bcp47: 'de-DE', native: 'Deutsch' },
    hi: { name: 'Hindi', bcp47: 'hi-IN', native: 'हिन्दी' },
    bn: { name: 'Bengali', bcp47: 'bn-IN', native: 'বাংলা' },
    zh: { name: 'Chinese', bcp47: 'zh-CN', native: '中文' },
    ja: { name: 'Japanese', bcp47: 'ja-JP', native: '日本語' },
    ko: { name: 'Korean', bcp47: 'ko-KR', native: '한국어' },
    ar: { name: 'Arabic', bcp47: 'ar-SA', native: 'العربية' },
    pt: { name: 'Portuguese', bcp47: 'pt-BR', native: 'Português' },
    ru: { name: 'Russian', bcp47: 'ru-RU', native: 'Русский' },
    it: { name: 'Italian', bcp47: 'it-IT', native: 'Italiano' },
    nl: { name: 'Dutch', bcp47: 'nl-NL', native: 'Nederlands' },
    tr: { name: 'Turkish', bcp47: 'tr-TR', native: 'Türkçe' },
    id: { name: 'Indonesian', bcp47: 'id-ID', native: 'Bahasa Indonesia' },
    vi: { name: 'Vietnamese', bcp47: 'vi-VN', native: 'Tiếng Việt' },
    pl: { name: 'Polish', bcp47: 'pl-PL', native: 'Polski' },
    sv: { name: 'Swedish', bcp47: 'sv-SE', native: 'Svenska' },
    th: { name: 'Thai', bcp47: 'th-TH', native: 'ไทย' },
    ur: { name: 'Urdu', bcp47: 'ur-PK', native: 'اردو' },
    ta: { name: 'Tamil', bcp47: 'ta-IN', native: 'தமிழ்' },
    te: { name: 'Telugu', bcp47: 'te-IN', native: 'తెలుగు' },
    mr: { name: 'Marathi', bcp47: 'mr-IN', native: 'मराठी' },
    gu: { name: 'Gujarati', bcp47: 'gu-IN', native: 'ગુજરાતી' },
  };

  // Initialize Auto Speak toggle
  if (toggleAutoSpeak) {
    toggleAutoSpeak.checked = state.autoSpeakAnswers;
    toggleAutoSpeak.addEventListener('change', () => {
      state.autoSpeakAnswers = toggleAutoSpeak.checked;
      localStorage.setItem('fastshot_auto_speak', state.autoSpeakAnswers ? 'true' : 'false');
      if (state.autoSpeakAnswers) {
        showToast('Voice Assistant will automatically read future search results', 'info');
      } else {
        showToast('Auto-read disabled', 'info');
      }
    });
  }

  // Animated Markdown render helper
  function updateResultsMarkdown(markdownHTML) {
    if (!resultsMarkdown) return;
    resultsMarkdown.innerHTML = markdownHTML;
    
    // Select direct child paragraphs, headers, pre blocks, blockquotes, and all li elements inside lists
    const anims = resultsMarkdown.querySelectorAll(':scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > pre, :scope > blockquote, li');
    anims.forEach((el, index) => {
      const delay = Math.min(index * 0.04, 1.2);
      el.style.animationDelay = `${delay}s`;
    });
  }

  // Appends a single message bubble to the chat feed
  function appendChatMessage(role, content) {
    if (!resultsChatFeed) return;
    
    const row = document.createElement('div');
    row.className = `chat-msg-row ${role === 'user' ? 'user-row' : 'assistant-row'}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'chat-msg-bubble';
    
    if (role === 'user') {
      bubble.textContent = content;
    } else {
      bubble.innerHTML = renderMarkdownSafe(content);
      
      // Select direct child elements to stagger fade-in!
      const elements = bubble.querySelectorAll(':scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > pre, :scope > blockquote, li');
      elements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.animation = 'mdElementFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        el.style.animationDelay = `${Math.min(index * 0.04, 0.8)}s`;
      });
    }
    
    row.appendChild(bubble);
    resultsChatFeed.appendChild(row);
    
    // Auto scroll the results viewport down smoothly
    if (resultsContentArea) {
      setTimeout(() => {
        resultsContentArea.scrollTo({
          top: resultsContentArea.scrollHeight,
          behavior: 'smooth'
        });
      }, 50);
    }
  }

  // Sends the chat message to /api/chat
  async function submitContinuousChat(message) {
    if (!message || message.trim() === '') return;
    const cleanMsg = message.trim();
    
    // Show user query instantly in chat
    appendChatMessage('user', cleanMsg);
    
    // Add to local state history
    state.chatHistory.push({ role: 'user', content: cleanMsg });
    
    // Clear composer input and show typing indicator
    if (chatComposerInput) chatComposerInput.value = '';
    if (chatTypingIndicator) chatTypingIndicator.classList.remove('hidden');
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: cleanMsg,
          history: state.chatHistory,
          engine: state.currentResult?.engine || 'gemini',
          model: state.currentResult?.model
        }),
      });
      
      if (!response.ok) {
        throw new Error('Could not retrieve chat response.');
      }
      
      const data = await response.json();
      const answer = data.text || 'No response was returned.';
      
      if (chatTypingIndicator) chatTypingIndicator.classList.add('hidden');
      
      appendChatMessage('model', answer);
      state.chatHistory.push({ role: 'model', content: answer });
    } catch (err) {
      console.error('Continuous chat failure:', err);
      if (chatTypingIndicator) chatTypingIndicator.classList.add('hidden');
      appendChatMessage('model', `⚠️ Encountered an error: ${err.message || 'The AI service is temporarily unavailable.'}`);
    }
  }

  // Translation handler
  async function translateCurrentResult(targetCode) {
    if (!state.currentResult) return;
    const originalText = state.originalMarkdown;
    if (!originalText) return;

    if (targetCode === 'en') {
      state.currentLanguage = 'en';
      if (resultsLanguageSelect) resultsLanguageSelect.value = 'en';
      if (translationActiveBadge) translationActiveBadge.classList.add('hidden');
      if (resultsMarkdown) updateResultsMarkdown(renderMarkdownSafe(originalText));
      if (state.isSpeaking) {
        startSpeechAssistant();
      }
      return;
    }

    const langInfo = languageCatalog[targetCode] || { name: targetCode, bcp47: targetCode, native: targetCode };

    // Check cached translation
    if (state.translations && state.translations[targetCode]) {
      state.currentLanguage = targetCode;
      if (resultsLanguageSelect) resultsLanguageSelect.value = targetCode;
      if (translationActiveBadge) {
        translationActiveBadge.classList.remove('hidden');
        if (translationLangName) translationLangName.textContent = `${langInfo.native} (${langInfo.name})`;
      }
      if (resultsMarkdown) updateResultsMarkdown(renderMarkdownSafe(state.translations[targetCode]));
      if (state.isSpeaking) {
        startSpeechAssistant();
      }
      return;
    }

    // Call translation endpoint
    if (translationLoader) translationLoader.classList.remove('hidden');
    if (resultsLanguageSelect) resultsLanguageSelect.disabled = true;

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: originalText,
          targetLanguage: langInfo.name,
          targetCode: targetCode,
        }),
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const resData = await response.json();
      const translatedText = resData.translatedText || originalText;

      state.translations[targetCode] = translatedText;
      state.currentLanguage = targetCode;

      if (resultsMarkdown) {
        updateResultsMarkdown(renderMarkdownSafe(translatedText));
      }

      if (translationActiveBadge) {
        translationActiveBadge.classList.remove('hidden');
        if (translationLangName) translationLangName.textContent = `${langInfo.native} (${langInfo.name})`;
      }

      showToast(`Answer translated to ${langInfo.name}`, 'success');

      if (state.isSpeaking) {
        startSpeechAssistant();
      }
    } catch (err) {
      console.error('Translation error:', err);
      showToast('Could not translate answer. Please try again.', 'error');
      if (resultsLanguageSelect) resultsLanguageSelect.value = state.currentLanguage;
    } finally {
      if (translationLoader) translationLoader.classList.add('hidden');
      if (resultsLanguageSelect) resultsLanguageSelect.disabled = false;
    }
  }

  if (resultsLanguageSelect) {
    resultsLanguageSelect.addEventListener('change', () => {
      translateCurrentResult(resultsLanguageSelect.value);
    });
  }

  if (btnRevertOriginal) {
    btnRevertOriginal.addEventListener('click', () => {
      translateCurrentResult('en');
    });
  }

  function openResultsModal(query) {
    if (!resultsModal) return;
    resultsModal.classList.remove('hidden');
    if (resultsQueryTitle) resultsQueryTitle.textContent = query;
    if (resultsLoadingState) resultsLoadingState.classList.remove('hidden');
    if (resultsContentArea) resultsContentArea.classList.add('hidden');
  }

  function closeResultsModal() {
    if (!resultsModal) return;
    stopSpeechAssistant();
    resultsModal.classList.add('hidden');
  }

  document.querySelectorAll('.close-results-trigger').forEach((btn) => {
    btn.addEventListener('click', closeResultsModal);
  });

  if (btnResultsNewSearch) {
    btnResultsNewSearch.addEventListener('click', () => {
      closeResultsModal();
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    });
  }

  // Keydown shortcut for Enter inside search textarea
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        executeSearch();
      }
    });
  }

  // ==========================================================================
  // GEMINI AI PRODUCTIVITY SUITE
  // ==========================================================================

  // Reset AI Workspace Tabs & Content
  function resetAIWorkspace() {
    if (creatorPillBtns.length > 0) {
      creatorPillBtns.forEach(btn => {
        if (btn.getAttribute('data-target') === 'markdown-view') {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }
    if (creatorTabPanels.length > 0) {
      creatorTabPanels.forEach(panel => {
        if (panel.id === 'panel-markdown-view') {
          panel.classList.remove('hidden');
        } else {
          panel.classList.add('hidden');
        }
      });
    }

    // Reset Image Gen state
    if (imageGenInput) imageGenInput.value = '';
    if (imageGenOutputContainer) {
      imageGenOutputContainer.innerHTML = `
        <div class="image-gen-placeholder">
          <i class="fa-solid fa-image-portrait text-4xl text-gray-600 mb-2"></i>
          <span>Your generated image will appear here</span>
        </div>
      `;
    }

    // Reset Slides state
    currentSlides = [];
    currentSlideIndex = 0;
    if (slideTheaterContainer) slideTheaterContainer.classList.add('hidden');
    if (slidesPlaceholderBox) slidesPlaceholderBox.classList.remove('hidden');
    if (slidesLoadingIndicator) slidesLoadingIndicator.classList.add('hidden');
    if (btnDownloadSlidesHtml) btnDownloadSlidesHtml.classList.add('hidden');
    if (btnPrintSlidesPdf) btnPrintSlidesPdf.classList.add('hidden');

    // Reset Docs state
    currentFormattedDocHtml = '';
    if (docsPreviewArea) {
      docsPreviewArea.innerHTML = '';
      docsPreviewArea.classList.add('hidden');
    }
    if (docsPlaceholderBox) docsPlaceholderBox.classList.remove('hidden');
    if (btnDownloadWord) btnDownloadWord.classList.add('hidden');

    // Reset Sandbox App state
    currentSandboxCode = '';
    if (appBuilderInput) appBuilderInput.value = '';
    if (sandboxWorkspace) sandboxWorkspace.classList.add('hidden');
    if (sandboxPlaceholderBox) sandboxPlaceholderBox.classList.remove('hidden');
    if (sandboxLoadingIndicator) sandboxLoadingIndicator.classList.add('hidden');
    if (sandboxIframe) sandboxIframe.srcdoc = '';
    if (sandboxCodeTextarea) sandboxCodeTextarea.value = '';
  }

  // Trigger Local File Downloads
  function triggerFileDownload(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded: ${filename}`, 'success');
  }

  // Bind Workspace Tab Buttons
  if (creatorPillBtns.length > 0) {
    creatorPillBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        
        creatorPillBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        creatorTabPanels.forEach(panel => {
          if (panel.id === `panel-${target}`) {
            panel.classList.remove('hidden');
          } else {
            panel.classList.add('hidden');
          }
        });

        // Smart Prefill
        if (state.currentQuery) {
          if (target === 'image-view' && imageGenInput && !imageGenInput.value) {
            imageGenInput.value = `A stunning visual conceptualization of: ${state.currentQuery}`;
          }
          if (target === 'sandbox-view' && appBuilderInput && !appBuilderInput.value) {
            appBuilderInput.value = `${state.currentQuery} interactive explorer app`;
          }
        }
      });
    });
  }

  // Editor drawing logic
  let drawingCtx = null;
  
  if (btnEditorDraw) {
    btnEditorDraw.addEventListener('click', () => {
        isDrawing = !isDrawing;
        btnEditorDraw.classList.toggle('active');
        btnEditorDraw.innerHTML = isDrawing ? '<i class="fa-solid fa-pen"></i> Drawing...' : '<i class="fa-solid fa-pen"></i> Draw';
        
        const ctx = imageEditorCanvas.getContext('2d');
        ctx.strokeStyle = '#f87171'; // Red
        ctx.lineWidth = 5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
    });
  }

  if (imageEditorCanvas) {
      imageEditorCanvas.addEventListener('mousedown', (e) => {
          if (!isDrawing) return;
          const ctx = imageEditorCanvas.getContext('2d');
          const rect = imageEditorCanvas.getBoundingClientRect();
          ctx.beginPath();
          ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
      });
      imageEditorCanvas.addEventListener('mousemove', (e) => {
          if (!isDrawing || e.buttons !== 1) return;
          const ctx = imageEditorCanvas.getContext('2d');
          const rect = imageEditorCanvas.getBoundingClientRect();
          ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
          ctx.stroke();
      });
  }

  if (btnEditorClear) {
      btnEditorClear.addEventListener('click', () => {
          const ctx = imageEditorCanvas.getContext('2d');
          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.src = editedImageUrl;
          img.onload = () => {
              ctx.clearRect(0, 0, imageEditorCanvas.width, imageEditorCanvas.height);
              ctx.drawImage(img, 0, 0);
          };
      });
  }

  if (btnEditorSave) {
      btnEditorSave.addEventListener('click', () => {
          editedImageUrl = imageEditorCanvas.toDataURL('image/jpeg');
          imageGenOutputContainer.classList.remove('hidden');
          imageEditorContainer.classList.add('hidden');
          document.getElementById('gen-image-result').src = editedImageUrl;
          showToast('Annotations applied!', 'success');
      });
  }

  if (btnEditorCancel) {
      btnEditorCancel.addEventListener('click', () => {
          imageGenOutputContainer.classList.remove('hidden');
          imageEditorContainer.classList.add('hidden');
          isDrawing = false;
          btnEditorDraw.classList.remove('active');
          btnEditorDraw.innerHTML = '<i class="fa-solid fa-pen"></i> Draw';
      });
  }
  // 🎨 Image Generation submit form
  if (imageGenForm) {
    imageGenForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const promptText = imageGenInput.value.trim();
      const style = imageGenStyle.value;
      if (!promptText) return;

      imageGenOutputContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center p-8 text-slate-400">
          <i class="fa-solid fa-wand-magic-sparkles fa-spin text-3xl text-purple-400 mb-2"></i>
          <span>Gemini AI is painting your image...</span>
        </div>
      `;

      let enhancedPrompt = promptText;
      if (style === 'photorealistic') enhancedPrompt += ', photorealistic, ultra-high definition, 8k resolution, cinematic lighting, highly detailed';
      else if (style === 'cinematic') enhancedPrompt += ', cinematic atmosphere, dramatic shadows, volumetric lighting, photorealistic, depth of field';
      else if (style === 'digital-art') enhancedPrompt += ', stunning digital painting, vibrant colors, fantasy concept art style, masterwork';
      else if (style === 'anime') enhancedPrompt += ', gorgeous anime key visual style, manga style, beautiful cel shading, vivid colors';
      else if (style === 'minimalist-vector') enhancedPrompt += ', minimalist vector illustration, flat icon design, clean lines, SVG style, isolated background';
      else if (style === '3d-render') enhancedPrompt += ', spectacular 3D render, octanerender style, stylized clay material, playful lighting, raytraced';

      const seed = Math.floor(Math.random() * 1000000);
      const imageUrl = `https://image.pollinations.ai/p/${encodeURIComponent(enhancedPrompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;

      const img = new Image();
      img.src = imageUrl;
      img.referrerPolicy = 'no-referrer';
      img.onload = () => {
        editedImageUrl = imageUrl;
        imageGenOutputContainer.innerHTML = `
          <div class="relative group flex flex-col items-center p-4">
            <img src="${imageUrl}" class="max-w-full rounded-lg shadow-xl border border-slate-700" alt="${promptText}" referrerPolicy="no-referrer" id="gen-image-result" />
            <div class="mt-4 flex gap-4">
              <a href="${imageUrl}" target="_blank" download="gemini-ai-image.jpg" class="btn-creator-action">
                <i class="fa-solid fa-download"></i> Save Image
              </a>
              <button type="button" id="btn-edit-image" class="btn-creator-action secondary">
                <i class="fa-solid fa-pen"></i> Edit / Annotate
              </button>
            </div>
          </div>
        `;
        document.getElementById('btn-edit-image').addEventListener('click', () => {
            imageGenOutputContainer.classList.add('hidden');
            imageEditorContainer.classList.remove('hidden');
            const ctx = imageEditorCanvas.getContext('2d');
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = editedImageUrl;
            img.onload = () => {
                imageEditorCanvas.width = img.width;
                imageEditorCanvas.height = img.height;
                ctx.drawImage(img, 0, 0);
            };
        });
        showToast('Image generated successfully!', 'success');
      };
      img.onerror = () => {
        imageGenOutputContainer.innerHTML = `
          <div class="text-rose-400 flex flex-col items-center p-8">
            <i class="fa-solid fa-triangle-exclamation text-3xl mb-2"></i>
            <span>Failed to generate image. Please try again.</span>
          </div>
        `;
      };
    });
  }

  // 📊 Slides / PPT generation
  if (btnBuildSlides) {
    btnBuildSlides.addEventListener('click', async () => {
      const query = state.currentQuery || 'Project Work & Presentation';
      
      slidesPlaceholderBox.classList.add('hidden');
      slideTheaterContainer.classList.add('hidden');
      slidesLoadingIndicator.classList.remove('hidden');
      btnDownloadSlidesHtml.classList.add('hidden');
      btnPrintSlidesPdf.classList.add('hidden');

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Generate a structured PowerPoint / Presentation Slide Deck with exactly 5 slides for the topic: "${query}".
Return ONLY a valid JSON array of slide objects. Do not include any markdown format tags, backticks, or comments.
Each object must have exactly these keys:
- "title": string (the slide title)
- "bullets": string[] (array of 3 to 4 short bullet points for slide body)

Example format:
[
  { "title": "Introduction to React", "bullets": ["Component-based architecture", "Virtual DOM for fast rendering", "Uses JSX syntax"] }
]`,
            history: []
          })
        });

        if (!response.ok) {
           const errorData = await response.json().catch(() => ({}));
           throw new Error(errorData.error?.message || 'API Quota Exceeded. Please wait a moment.');
        }

        const data = await response.json();
        let cleanText = data.reply || '';
        cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        currentSlides = JSON.parse(cleanText);
        if (!Array.isArray(currentSlides) || currentSlides.length === 0) {
          throw new Error('Invalid slides format');
        }

        currentSlideIndex = 0;
        renderActiveSlide();

        slidesLoadingIndicator.classList.add('hidden');
        slideTheaterContainer.classList.remove('hidden');
        btnDownloadSlidesHtml.classList.remove('hidden');
        btnPrintSlidesPdf.classList.remove('hidden');
        btnDownloadSlidesPptx.classList.remove('hidden');
        showToast('Presentation slides modeled successfully!', 'success');
      } catch (err) {
        console.error(err);
        slidesLoadingIndicator.classList.add('hidden');
        slidesPlaceholderBox.classList.remove('hidden');
        showToast('Error building slides. Please try again.', 'error');
      }
    });
  }

  function renderActiveSlide() {
    if (!currentSlides || currentSlides.length === 0) return;
    const slide = currentSlides[currentSlideIndex];
    
    slideContentPane.innerHTML = `
      <h2>Slide ${currentSlideIndex + 1}: ${slide.title}</h2>
      <ul>
        ${slide.bullets.map(b => `<li>${b}</li>`).join('')}
      </ul>
    `;

    slideCounterLabel.textContent = `Slide ${currentSlideIndex + 1} of ${currentSlides.length}`;
  }

  if (btnPrevSlide) {
    btnPrevSlide.addEventListener('click', () => {
      if (currentSlideIndex > 0) {
        currentSlideIndex--;
        renderActiveSlide();
      }
    });
  }

  if (btnNextSlide) {
    btnNextSlide.addEventListener('click', () => {
      if (currentSlideIndex < currentSlides.length - 1) {
        currentSlideIndex++;
        renderActiveSlide();
      }
    });
  }

  if (btnDownloadSlidesHtml) {
    btnDownloadSlidesHtml.addEventListener('click', () => {
      if (currentSlides.length === 0) return;
      
      let slidePagesHtml = currentSlides.map((slide, idx) => `
        <div class="slide ${idx === 0 ? 'active' : ''}" id="slide-${idx}">
          <div class="slide-header">Slide ${idx + 1}</div>
          <h1 class="slide-title">${slide.title}</h1>
          <ul class="slide-bullets">
            ${slide.bullets.map(b => `<li>${b}</li>`).join('')}
          </ul>
        </div>
      `).join('');

      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Presentation - ${state.currentQuery || 'Presentation'}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: linear-gradient(135deg, #1e1b4b, #0f172a);
      color: #ffffff;
      font-family: system-ui, -apple-system, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .slide-container {
      width: 80%;
      max-width: 900px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 20px;
      padding: 50px;
      min-height: 400px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
    }
    .slide {
      display: none;
    }
    .slide.active {
      display: block;
      animation: fadeIn 0.5s ease forwards;
    }
    .slide-header {
      font-size: 14px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 20px;
    }
    .slide-title {
      font-size: 36px;
      color: #fbbf24;
      margin-top: 0;
      margin-bottom: 30px;
      border-bottom: 3px solid rgba(251,191,36,0.3);
      padding-bottom: 15px;
    }
    .slide-bullets {
      list-style-type: none;
      padding-left: 0;
    }
    .slide-bullets li {
      font-size: 20px;
      line-height: 1.8;
      position: relative;
      padding-left: 30px;
      margin-bottom: 15px;
    }
    .slide-bullets li::before {
      content: "✦";
      position: absolute;
      left: 0;
      color: #fbbf24;
    }
    .controls {
      margin-top: 30px;
      display: flex;
      align-items: center;
      gap: 20px;
    }
    button {
      background: #a855f7;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.2s;
    }
    button:hover {
      background: #9333ea;
    }
    .counter {
      color: #94a3b8;
      font-size: 16px;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <div class="slide-container">
    ${slidePagesHtml}
  </div>
  <div class="controls">
    <button onclick="prevSlide()">Previous</button>
    <span class="counter" id="counter">Slide 1 of ${currentSlides.length}</span>
    <button onclick="nextSlide()">Next</button>
  </div>
  <script>
    let currentIdx = 0;
    const totalSlides = ${currentSlides.length};
    function updateSlides() {
      for(let i=0; i<totalSlides; i++) {
        document.getElementById('slide-' + i).classList.remove('active');
      }
      document.getElementById('slide-' + currentIdx).classList.add('active');
      document.getElementById('counter').innerText = 'Slide ' + (currentIdx + 1) + ' of ' + totalSlides;
    }
    function nextSlide() {
      if(currentIdx < totalSlides - 1) {
        currentIdx++;
        updateSlides();
      }
    }
    function prevSlide() {
      if(currentIdx > 0) {
        currentIdx--;
        updateSlides();
      }
    }
    document.addEventListener('keydown', (e) => {
      if(e.key === 'ArrowRight' || e.key === ' ') nextSlide();
      if(e.key === 'ArrowLeft') prevSlide();
    });
  </script>
</body>
</html>`;

      triggerFileDownload(htmlContent, 'ai-presentation.html', 'text/html');
    });
  }

  if (btnDownloadSlidesPptx) {
    btnDownloadSlidesPptx.addEventListener('click', () => {
      if (currentSlides.length === 0) return;
      
      let pptxOutline = currentSlides.map((slide, idx) => {
        return `${slide.title}\n${slide.bullets.map(b => `  ${b}`).join('\n')}\n`;
      }).join('\n');

      triggerFileDownload(pptxOutline, 'presentation-outline.txt', 'text/plain');
      showToast('Downloaded PPTX outline (importable into PowerPoint)', 'success');
    });
  }

  if (btnPrintSlidesPdf) {
    btnPrintSlidesPdf.addEventListener('click', () => {
      window.print();
    });
  }

  // 📝 Docs Generation / Project Work
  if (btnFormatDocs) {
    btnFormatDocs.addEventListener('click', async () => {
      const resultsMarkdownElement = document.getElementById('results-markdown');
      const markdownContent = resultsMarkdownElement ? resultsMarkdownElement.innerText : '';
      const query = state.currentQuery || 'AI Research Report';

      docsPlaceholderBox.classList.add('hidden');
      docsPreviewArea.classList.add('hidden');
      btnDownloadWord.classList.add('hidden');
      
      docsPlaceholderBox.innerHTML = `
        <div class="flex flex-col items-center p-8">
          <i class="fa-solid fa-signature fa-spin text-3xl text-sky-400 mb-2"></i>
          <span>Gemini is formatting your professional report doc...</span>
        </div>
      `;
      docsPlaceholderBox.classList.remove('hidden');

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Convert and expand this markdown search data into a highly structured, professional project document with a cover title, executive summary, key findings, strategic recommendations, and a project execution timeline.
Output the document strictly in beautiful, clean HTML with standard h1, h2, h3, p, and ul/li elements. Do not wrap in backticks or markdown quotes.

Content to format:
${markdownContent || `Topic: ${query}`}`,
            history: []
          })
        });

        if (!response.ok) {
           const errorData = await response.json().catch(() => ({}));
           throw new Error(errorData.error?.message || 'API Quota Exceeded. Please wait a moment.');
        }

        const data = await response.json();
        let formattedHtml = data.reply || '';
        formattedHtml = formattedHtml.replace(/```html/g, '').replace(/```/g, '').trim();

        currentFormattedDocHtml = formattedHtml;
        docsPlaceholderBox.classList.add('hidden');
        
        docsPreviewArea.innerHTML = formattedHtml;
        docsPreviewArea.classList.remove('hidden');
        btnDownloadWord.classList.remove('hidden');
        showToast('Document formatted successfully!', 'success');
      } catch (err) {
        console.error(err);
        docsPlaceholderBox.classList.remove('hidden');
        docsPlaceholderBox.innerHTML = `
          <i class="fa-solid fa-file-circle-exclamation text-rose-400 text-3xl mb-2"></i>
          <span>Failed to format document. Please try again.</span>
        `;
      }
    });
  }

  if (btnDownloadWord) {
    btnDownloadWord.addEventListener('click', () => {
      if (!currentFormattedDocHtml) return;
      const wordDocContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><title>AI Project Document</title><style>body {font-family: Arial, sans-serif; line-height: 1.6; margin: 2in;}</style></head>
         <body>${currentFormattedDocHtml}</body>
         </html>
      `;
      triggerFileDownload(wordDocContent, 'ai-formatted-report.doc', 'application/msword');
    });
  }

  // 💻 AI App Sandbox (Build any Web App)
  if (appBuilderForm) {
    appBuilderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const appDesc = appBuilderInput.value.trim();
      if (!appDesc) return;

      sandboxPlaceholderBox.classList.add('hidden');
      sandboxWorkspace.classList.add('hidden');
      sandboxLoadingIndicator.classList.remove('hidden');

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Build a beautiful, interactive, fully functioning single-file HTML/CSS/JS web application for: "${appDesc}".
Guidelines:
- It must be fully self-contained in a single file with <style> block and inline JavaScript.
- Use Tailwind CSS by importing "<script src='https://cdn.tailwindcss.com'></script>" in the head.
- Ensure all interactive scripts work perfectly with self-contained logic.
- Output ONLY the raw HTML code. Do not wrap in markdown quotes, backticks, or comment wrappers.`,
            history: []
          })
        });

        if (!response.ok) {
           const errorData = await response.json().catch(() => ({}));
           throw new Error(errorData.error?.message || 'API Quota Exceeded. Please wait a moment.');
        }

        const data = await response.json();
        let code = data.reply || '';
        code = code.replace(/```html/g, '').replace(/```/g, '').trim();

        currentSandboxCode = code;
        sandboxCodeTextarea.value = code;
        sandboxIframe.srcdoc = code;

        sandboxLoadingIndicator.classList.add('hidden');
        sandboxWorkspace.classList.remove('hidden');
        showToast('Web app compiled & running successfully!', 'success');
      } catch (err) {
        console.error(err);
        sandboxLoadingIndicator.classList.add('hidden');
        sandboxPlaceholderBox.classList.remove('hidden');
        showToast('Error compiling applet. Please try again.', 'error');
      }
    });
  }

  if (sandboxTabBtns.length > 0) {
    sandboxTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        sandboxTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (tab === 'preview') {
          sandboxIframe.classList.remove('hidden');
          document.getElementById('sandbox-preview-pane').classList.remove('hidden');
          document.getElementById('sandbox-code-pane').classList.add('hidden');
          if (sandboxCodeTextarea) {
            sandboxIframe.srcdoc = sandboxCodeTextarea.value;
          }
        } else {
          document.getElementById('sandbox-preview-pane').classList.add('hidden');
          document.getElementById('sandbox-code-pane').classList.remove('hidden');
          sandboxCodeTextarea.removeAttribute('readonly');
        }
      });
    });
  }

  if (btnDownloadAppHtml) {
    btnDownloadAppHtml.addEventListener('click', () => {
      const finalCode = sandboxCodeTextarea ? sandboxCodeTextarea.value : currentSandboxCode;
      if (!finalCode) return;
      triggerFileDownload(finalCode, 'gemini-generated-app.html', 'text/html');
    });
  }

  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      executeSearch();
    });
  }

  if (submitSearchBtn) {
    submitSearchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      executeSearch();
    });
  }

  // Format and render markdown
  function renderMarkdownSafe(text) {
    if (window.marked && typeof window.marked.parse === 'function') {
      return window.marked.parse(text);
    }
    // Fallback simple parser
    return text
      .replace(/\n\n+/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  async function executeSearch(explicitQuery) {
    if (state.isSearching) return;

    const query = (explicitQuery || searchInput?.value || '').trim();
    if (!query) {
      if (searchInput) {
        searchInput.focus();
        searchInput.classList.add('pulse-error');
        setTimeout(() => searchInput.classList.remove('pulse-error'), 400);
      }
      showToast('Please type a search query or question.', 'info');
      return;
    }

    state.isSearching = true;
    resetAIWorkspace();

    // Loading UI
    if (sendArrowIcon) sendArrowIcon.classList.add('hidden');
    if (sendSpinnerIcon) sendSpinnerIcon.classList.remove('hidden');
    if (submitSearchBtn) submitSearchBtn.disabled = true;

    openResultsModal(query);

    // Dynamic loading stage ticker
    let stageInterval = null;
    const stages = [
      { title: 'Connecting to Google Search Grounding...', desc: 'Grounded web retrieval for real-time sources & attachments' },
      { title: 'Analyzing citations and device inputs...', desc: 'Verifying URLs, snippets, documents, and attached data' },
      { title: `Synthesizing with ${state.model.includes('gemini') ? 'Gemini' : 'OpenAI'} AI...`, desc: 'Compiling structured executive response and verified citations' },
    ];
    let stageIdx = 0;
    stageInterval = setInterval(() => {
      stageIdx = (stageIdx + 1) % stages.length;
      if (loadingStageTitle) loadingStageTitle.textContent = stages[stageIdx].title;
      if (loadingStageDesc) loadingStageDesc.textContent = stages[stageIdx].desc;
    }, 900);

    const startTime = performance.now();

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
      }

      const res = await fetch('/api/search', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          engine: state.engine,
          model: state.model,
          mode: state.mode,
          attachments: state.attachments,
        }),
      });

      const data = await res.json();
      clearInterval(stageInterval);

      if (!res.ok) {
        throw new Error(data.error || 'Search service encountered an error.');
      }

      state.currentResult = data;

      // Render search result
      displaySearchResult(data);

      // Refresh history & badge
      fetchHistory();
    } catch (err) {
      clearInterval(stageInterval);
      if (resultsLoadingState) resultsLoadingState.classList.add('hidden');
      if (resultsContentArea) resultsContentArea.classList.remove('hidden');

      if (resultsMarkdown) {
        resultsMarkdown.innerHTML = `
          <div class="auth-alert error">
            <strong><i class="fa-solid fa-triangle-exclamation"></i> Search Execution Error:</strong>
            <p style="margin-top: 6px;">${err.message}</p>
            <button type="button" class="btn-accent" style="margin-top: 10px;" id="btn-retry-search">Try Again</button>
          </div>
        `;
        document.getElementById('btn-retry-search')?.addEventListener('click', () => executeSearch(query));
      }

      if (resultsImagesWrapper) resultsImagesWrapper.classList.add('hidden');
      if (resultsSourcesWrapper) resultsSourcesWrapper.classList.add('hidden');
      if (resultsQueriesWrapper) resultsQueriesWrapper.classList.add('hidden');
      if (resultsFollowupsWrapper) resultsFollowupsWrapper.classList.add('hidden');

      showToast(`Search failed: ${err.message}`, 'error');
    } finally {
      state.isSearching = false;
      if (sendArrowIcon) sendArrowIcon.classList.remove('hidden');
      if (sendSpinnerIcon) sendSpinnerIcon.classList.add('hidden');
      if (submitSearchBtn) submitSearchBtn.disabled = false;
    }
  }

  function displaySearchResult(data) {
    if (resultsLoadingState) resultsLoadingState.classList.add('hidden');
    if (resultsContentArea) resultsContentArea.classList.remove('hidden');

    // Engine badge
    if (resultsEngineBadge) {
      resultsEngineBadge.className = `engine-pill ${data.engine === 'openai' ? 'badge-openai' : 'badge-gemini'}`;
    }
    if (resultsEngineName) {
      resultsEngineName.textContent = data.model || (data.engine === 'openai' ? 'GPT-4o Mini' : 'Gemini 3.8 Flash');
    }

    // Grounding badge
    if (resultsGroundingText) {
      resultsGroundingText.textContent = data.grounded ? 'Google Search Grounded' : 'Web Synthesized';
    }

    // Time badge
    if (resultsTimeText) {
      const timeMs = data.executionTimeMs || data.searchDurationMs || data.durationMs || 340;
      resultsTimeText.textContent = `${timeMs}ms`;
    }

    // Cache original Markdown content and initialize translation map
    state.originalMarkdown = data.content || data.text || 'No content returned.';
    state.translations = { en: state.originalMarkdown };
    state.currentLanguage = 'en';

    // Initialize continuous live chat session state
    state.chatHistory = [
      { role: 'model', content: state.originalMarkdown }
    ];
    if (resultsChatFeed) {
      resultsChatFeed.innerHTML = '';
    }

    if (resultsLanguageSelect) {
      resultsLanguageSelect.value = 'en';
      resultsLanguageSelect.disabled = false;
    }
    if (translationActiveBadge) translationActiveBadge.classList.add('hidden');
    if (translationLoader) translationLoader.classList.add('hidden');

    // Render Answer Markdown
    if (resultsMarkdown) {
      updateResultsMarkdown(renderMarkdownSafe(state.originalMarkdown));
    }

    // Render Grounding Images
    const images = Array.isArray(data.images) ? data.images : [];
    if (resultsImagesWrapper && resultsImagesGrid) {
      if (images.length > 0) {
        resultsImagesWrapper.classList.remove('hidden');
        resultsImagesGrid.innerHTML = images
          .map((img) => {
            return `
              <div class="yeti-image-card" data-url="${img.url}" data-title="${img.title}" data-source="${img.source}">
                <img src="${img.url}" alt="${img.title}" referrerPolicy="no-referrer" />
                <div class="yeti-image-meta">
                  <span class="yeti-image-source">${img.source}</span>
                  <span class="yeti-image-title">${img.title}</span>
                </div>
              </div>
            `;
          })
          .join('');

        const lightboxModal = document.getElementById('image-lightbox-modal');
        const lightboxImg = document.getElementById('lightbox-img');
        const lightboxCaption = document.getElementById('lightbox-caption');
        const btnCloseLightbox = document.getElementById('btn-close-lightbox');

        resultsImagesGrid.querySelectorAll('.yeti-image-card').forEach((card) => {
          card.addEventListener('click', () => {
            const url = card.getAttribute('data-url');
            const title = card.getAttribute('data-title');
            const source = card.getAttribute('data-source');
            if (lightboxModal && lightboxImg && lightboxCaption) {
              lightboxImg.src = url;
              lightboxCaption.textContent = `${title} (${source})`;
              lightboxModal.classList.remove('hidden');
            }
          });
        });

        if (btnCloseLightbox && lightboxModal) {
          btnCloseLightbox.onclick = () => lightboxModal.classList.add('hidden');
          lightboxModal.onclick = (e) => {
            if (e.target === lightboxModal) lightboxModal.classList.add('hidden');
          };
        }
      } else {
        resultsImagesWrapper.classList.add('hidden');
      }
    }

    // Render Sources
    const sources = Array.isArray(data.sources) ? data.sources : [];
    if (resultsSourcesWrapper && resultsSourcesGrid && resultsSourcesCount) {
      if (sources.length > 0) {
        resultsSourcesCount.textContent = sources.length;
        resultsSourcesWrapper.classList.remove('hidden');
        resultsSourcesGrid.innerHTML = sources
          .map((src) => {
            let domain = 'web source';
            const url = src.url || src.uri || '#';
            try {
              if (url && url !== '#') {
                const u = new URL(url);
                domain = u.hostname.replace(/^www\./, '');
              }
            } catch (e) {}

            return `
              <a href="${url}" target="_blank" rel="noopener noreferrer" class="source-card-item">
                <div class="source-domain-row">
                  <span class="source-domain-name"><i class="fa-solid fa-link text-xs"></i> ${domain}</span>
                  <i class="fa-solid fa-arrow-up-right-from-square text-xs opacity-50"></i>
                </div>
                <div class="source-card-title">${src.title || url || 'Web Citation'}</div>
                ${src.snippet ? `<div class="source-card-snippet">${src.snippet}</div>` : ''}
              </a>
            `;
          })
          .join('');
      } else {
        resultsSourcesWrapper.classList.add('hidden');
      }
    }

    // Render Grounding Queries
    const queries = Array.isArray(data.searchQueries) ? data.searchQueries : Array.isArray(data.groundingQueries) ? data.groundingQueries : [];
    if (resultsQueriesWrapper && resultsQueriesPills) {
      if (queries.length > 0) {
        resultsQueriesWrapper.classList.remove('hidden');
        resultsQueriesPills.innerHTML = queries
          .map((q) => `<span class="query-search-pill"><i class="fa-solid fa-magnifying-glass text-xs opacity-60"></i> ${q}</span>`)
          .join('');
      } else {
        resultsQueriesWrapper.classList.add('hidden');
      }
    }

    // Render Suggested Follow-ups
    const followups = Array.isArray(data.suggestedFollowUps) ? data.suggestedFollowUps : Array.isArray(data.suggestedFollowups) ? data.suggestedFollowups : [];
    if (resultsFollowupsWrapper && resultsFollowupsList) {
      if (followups.length > 0) {
        resultsFollowupsWrapper.classList.remove('hidden');
        resultsFollowupsList.innerHTML = followups
          .map(
            (f) => `
            <button type="button" class="followup-btn" data-query="${encodeURIComponent(f)}">
              <span>${f}</span>
              <i class="fa-solid fa-arrow-right text-xs opacity-50"></i>
            </button>
          `
          )
          .join('');

        resultsFollowupsList.querySelectorAll('.followup-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const followQuery = decodeURIComponent(btn.getAttribute('data-query'));
            submitContinuousChat(followQuery);
          });
        });
      } else {
        resultsFollowupsWrapper.classList.add('hidden');
      }
    }

    // Update Bookmark button state
    updateBookmarkBtnState();

    // Reset voice assistant UI
    resetVoiceAssistantUI();

    // Auto-read search result if preference is enabled
    if (state.autoSpeakAnswers && (data.content || data.text)) {
      setTimeout(() => {
        // Only start if results modal is still active
        if (resultsModal && !resultsModal.classList.contains('hidden')) {
          startSpeechAssistant();
        }
      }, 500);
    }
  }

  // --------------------------------------------------------------------------
  // AI VOICE ASSISTANT & PERSONA ENGINE (TEXT-TO-SPEECH)
  // --------------------------------------------------------------------------
  let currentUtterance = null;
  let testUtterance = null;
  const speedOptions = [0.8, 1.0, 1.25, 1.5, 2.0];

  // Comprehensive AI Voice Persona Catalog
  const personaCatalog = {
    professional: {
      id: 'professional',
      name: 'Professional',
      subtitle: 'Broadcast Clarity',
      icon: 'fa-solid fa-briefcase',
      iconColor: 'text-indigo-400',
      pitch: 1.0,
      rateModifier: 1.0,
      preferredVoiceKeywords: ['Daniel', 'Oliver', 'Alex', 'David', 'Google', 'Natural', 'Male', 'Neural'],
      sampleText: 'Here is your grounded research overview with verified live web sources and key factual citations.',
      statusDesc: 'Professional Broadcast Voice'
    },
    calm: {
      id: 'calm',
      name: 'Calm & Mindful',
      subtitle: 'Soothing Tone',
      icon: 'fa-solid fa-spa',
      iconColor: 'text-teal-400',
      pitch: 0.88,
      rateModifier: 0.9,
      preferredVoiceKeywords: ['Samantha', 'Serena', 'Karen', 'Victoria', 'Natural', 'Soft', 'Female', 'Google'],
      sampleText: 'Take a breath. Here is a peaceful, focused summary of your research inquiry.',
      statusDesc: 'Calm & Mindful Voice'
    },
    energetic: {
      id: 'energetic',
      name: 'Energetic & Upbeat',
      subtitle: 'Dynamic Momentum',
      icon: 'fa-solid fa-bolt',
      iconColor: 'text-amber-400',
      pitch: 1.15,
      rateModifier: 1.12,
      preferredVoiceKeywords: ['Victoria', 'Ava', 'Zira', 'Natural', 'Google', 'Neural', 'Siri'],
      sampleText: 'Let’s dive right in! Here are the most exciting highlights and latest breakthroughs.',
      statusDesc: 'Energetic & Upbeat Voice'
    },
    storyteller: {
      id: 'storyteller',
      name: 'Storyteller',
      subtitle: 'Warm Resonance',
      icon: 'fa-solid fa-book-open-reader',
      iconColor: 'text-purple-400',
      pitch: 0.94,
      rateModifier: 0.95,
      preferredVoiceKeywords: ['George', 'Moira', 'Fiona', 'Arthur', 'Natural', 'Premium'],
      sampleText: 'Imagine this perspective: here is the captivating narrative and context behind this topic.',
      statusDesc: 'Storyteller & Narrative Voice'
    },
    concise: {
      id: 'concise',
      name: 'Concise Executive',
      subtitle: 'Fast-Track Briefing',
      icon: 'fa-solid fa-stopwatch-20',
      iconColor: 'text-rose-400',
      pitch: 1.05,
      rateModifier: 1.25,
      preferredVoiceKeywords: ['Google', 'Alex', 'Tom', 'Natural', 'Neural'],
      sampleText: 'Executive briefing: Three main findings, verified data points, and immediate key takeaways.',
      statusDesc: 'Concise Executive Voice'
    }
  };

  function getActivePersona() {
    return personaCatalog[state.voicePersona] || personaCatalog.professional;
  }

  function getCurrentReadableText() {
    if (state.currentLanguage && state.currentLanguage !== 'en' && state.translations[state.currentLanguage]) {
      return state.translations[state.currentLanguage];
    }
    return state.originalMarkdown || state.currentResult?.content || state.currentResult?.text || '';
  }

  function cleanMarkdownForSpeech(md) {
    if (!md) return '';
    let text = md;
    // Remove markdown code blocks
    text = text.replace(/```[\s\S]*?```/g, ' [Code omitted] ');
    text = text.replace(/`([^`]+)`/g, '$1');
    // Remove links [text](url) -> text
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    // Remove markdown images
    text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
    // Remove markdown headings, bold, italic symbols
    text = text.replace(/#{1,6}\s*/g, '');
    text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
    text = text.replace(/(\*|_)(.*?)\1/g, '$2');
    text = text.replace(/~~(.*?)~~/g, '$1');
    // Remove blockquotes and bullet indicators
    text = text.replace(/^\s*>\s*/gm, '');
    text = text.replace(/^\s*[-*+]\s+/gm, '');
    text = text.replace(/^\s*\d+\.\s+/gm, '');
    // Normalize spaces and multiple newlines
    text = text.replace(/\n{2,}/g, '. ');
    text = text.replace(/\n/g, ' ');
    text = text.replace(/\s{2,}/g, ' ');
    return text.trim();
  }

  function getBestAvailableVoice(langPrefix = 'en', personaKey = null) {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;

    // Check if user selected a specific custom voice URI
    if (state.selectedVoiceURI && state.selectedVoiceURI !== 'auto') {
      const customChosen = voices.find((v) => v.voiceURI === state.selectedVoiceURI || v.name === state.selectedVoiceURI);
      if (customChosen) return customChosen;
    }

    const persona = personaCatalog[personaKey || state.voicePersona] || personaCatalog.professional;
    const langInfo = languageCatalog[langPrefix] || { name: langPrefix, bcp47: langPrefix };
    const prefix = langPrefix.toLowerCase();
    const bcp = (langInfo.bcp47 || langPrefix).toLowerCase();

    // 1. Language-matched pool
    let langPool = voices.filter((v) => v.lang.toLowerCase().replace('_', '-') === bcp);
    if (!langPool.length) {
      langPool = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
    }
    if (!langPool.length && langInfo.name) {
      langPool = voices.filter((v) => v.name.toLowerCase().includes(langInfo.name.toLowerCase()));
    }
    if (!langPool.length) {
      langPool = voices;
    }

    // 2. Look for persona preferred voice keywords
    if (persona && persona.preferredVoiceKeywords && persona.preferredVoiceKeywords.length) {
      for (const kw of persona.preferredVoiceKeywords) {
        const found = langPool.find((v) => v.name.toLowerCase().includes(kw.toLowerCase()));
        if (found) return found;
      }
    }

    // 3. Look for natural/neural indicators
    const natural = langPool.find(
      (v) =>
        v.name.includes('Natural') ||
        v.name.includes('Google') ||
        v.name.includes('Neural') ||
        v.name.includes('Premium') ||
        v.name.includes('Siri') ||
        v.name.includes('Samantha')
    );
    if (natural) return natural;

    // 4. Default in language pool or global default
    return langPool.find((v) => v.default) || langPool[0] || voices[0] || null;
  }

  function startSpeechAssistant() {
    if (!('speechSynthesis' in window)) {
      showToast('Text-to-speech is not supported by your browser.', 'info');
      return;
    }

    const rawText = getCurrentReadableText();
    if (!rawText) {
      showToast('No answer content to read.', 'info');
      return;
    }

    // Cancel any active speech or test speech
    window.speechSynthesis.cancel();

    const cleanText = cleanMarkdownForSpeech(rawText);
    if (!cleanText) {
      showToast('No readable text found in answer.', 'info');
      return;
    }

    const curLang = state.currentLanguage || 'en';
    const langInfo = languageCatalog[curLang] || { name: 'English', bcp47: 'en-US', native: 'English' };
    const persona = getActivePersona();

    currentUtterance = new SpeechSynthesisUtterance(cleanText);
    currentUtterance.lang = langInfo.bcp47;

    // Calculate effective pitch and rate based on Persona and fine-tuning
    const baseSpeed = state.speechSpeed || 1.0;
    const effectiveRate = Math.min(2.0, Math.max(0.5, baseSpeed * (persona.rateModifier || 1.0)));
    const basePitch = persona.pitch || 1.0;
    const effectivePitch = Math.min(1.8, Math.max(0.6, basePitch * (state.customVoicePitch || 1.0)));

    currentUtterance.rate = effectiveRate;
    currentUtterance.pitch = effectivePitch;

    const voice = getBestAvailableVoice(curLang, state.voicePersona);
    if (voice) {
      currentUtterance.voice = voice;
    }

    if (voiceBannerSubText) {
      const voiceDisplayName = voice ? voice.name.replace(/Google|Microsoft|Apple/gi, '').trim() : `${langInfo.native} Voice`;
      voiceBannerSubText.textContent = `${persona.name} • ${voiceDisplayName || 'Neural'} (${langInfo.name}) • ${effectiveRate.toFixed(1)}x`;
    }

    currentUtterance.onstart = () => {
      state.isSpeaking = true;
      state.isPausedSpeech = false;
      updateVoiceAssistantUI();
    };

    currentUtterance.onend = () => {
      state.isSpeaking = false;
      state.isPausedSpeech = false;
      updateVoiceAssistantUI();
    };

    currentUtterance.onerror = (e) => {
      if (e.error === 'canceled' || e.error === 'interrupted') return;
      console.warn('Speech synthesis error:', e);
      state.isSpeaking = false;
      state.isPausedSpeech = false;
      updateVoiceAssistantUI();
    };

    currentUtterance.onpause = () => {
      state.isPausedSpeech = true;
      updateVoiceAssistantUI();
    };

    currentUtterance.onresume = () => {
      state.isPausedSpeech = false;
      updateVoiceAssistantUI();
    };

    window.speechSynthesis.speak(currentUtterance);
  }

  function pauseOrResumeSpeechAssistant() {
    if (!('speechSynthesis' in window)) return;

    if (state.isSpeaking && !state.isPausedSpeech) {
      window.speechSynthesis.pause();
      state.isPausedSpeech = true;
      updateVoiceAssistantUI();
    } else if (state.isPausedSpeech) {
      window.speechSynthesis.resume();
      state.isPausedSpeech = false;
      updateVoiceAssistantUI();
    } else {
      startSpeechAssistant();
    }
  }

  function stopSpeechAssistant() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    state.isSpeaking = false;
    state.isPausedSpeech = false;
    currentUtterance = null;
    updateVoiceAssistantUI();
  }

  function resetVoiceAssistantUI() {
    stopSpeechAssistant();
    if (voiceAssistantBanner) voiceAssistantBanner.classList.add('hidden');
    if (btnSpeakResult) {
      btnSpeakResult.classList.remove('speaking');
      if (voiceSpeakIcon) voiceSpeakIcon.className = 'fa-solid fa-volume-high';
      if (voiceSpeakTooltip) voiceSpeakTooltip.textContent = 'Read Aloud';
    }
    updatePersonaVisuals();
  }

  function updatePersonaVisuals() {
    const persona = getActivePersona();
    if (voicePersonaName) {
      voicePersonaName.textContent = persona.name;
    }
    if (voicePersonaIcon) {
      voicePersonaIcon.className = `${persona.icon} ${persona.iconColor || 'text-indigo-400'}`;
    }

    // Update active state in persona cards grid inside modal
    if (personaCardsGrid) {
      personaCardsGrid.querySelectorAll('.persona-card').forEach((card) => {
        const cardPersona = card.getAttribute('data-persona');
        if (cardPersona === state.voicePersona) {
          card.classList.add('active');
        } else {
          card.classList.remove('active');
        }
      });
    }

    // Update speed pills in tuning panel
    if (tuningSpeedPills) {
      tuningSpeedPills.querySelectorAll('.speed-opt-btn').forEach((btn) => {
        const speedVal = parseFloat(btn.getAttribute('data-speed'));
        if (Math.abs(speedVal - state.speechSpeed) < 0.05) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    if (tuningSpeedDisplay) {
      tuningSpeedDisplay.textContent = `${state.speechSpeed.toFixed(1)}x`;
    }

    if (tuningPitchSlider) {
      tuningPitchSlider.value = state.customVoicePitch.toString();
    }

    if (tuningPitchDisplay) {
      const pitchVal = state.customVoicePitch;
      let label = '1.0 (Normal)';
      if (pitchVal < 0.9) label = `${pitchVal.toFixed(2)} (Lower / Warm)`;
      else if (pitchVal > 1.1) label = `${pitchVal.toFixed(2)} (Higher / Vibrant)`;
      else if (pitchVal !== 1.0) label = `${pitchVal.toFixed(2)}`;
      tuningPitchDisplay.textContent = label;
    }

    if (tuningVoiceSelect) {
      tuningVoiceSelect.value = state.selectedVoiceURI || 'auto';
    }
  }

  function updateVoiceAssistantUI() {
    const persona = getActivePersona();

    if (btnSpeakResult) {
      if (state.isSpeaking || state.isPausedSpeech) {
        btnSpeakResult.classList.add('speaking');
        if (voiceSpeakIcon) {
          voiceSpeakIcon.className = state.isPausedSpeech ? 'fa-solid fa-play text-amber-400' : 'fa-solid fa-volume-high';
        }
        if (voiceSpeakTooltip) {
          voiceSpeakTooltip.textContent = state.isPausedSpeech ? 'Resume Voice' : 'Pause/Stop Voice';
        }
      } else {
        btnSpeakResult.classList.remove('speaking');
        if (voiceSpeakIcon) voiceSpeakIcon.className = 'fa-solid fa-volume-high';
        if (voiceSpeakTooltip) voiceSpeakTooltip.textContent = 'Read Aloud';
      }
    }

    if (voiceAssistantBanner) {
      if (state.isSpeaking || state.isPausedSpeech) {
        voiceAssistantBanner.classList.remove('hidden');
        if (state.isSpeaking && !state.isPausedSpeech) {
          voiceAssistantBanner.classList.add('playing');
          if (voiceBannerStatusText) voiceBannerStatusText.textContent = `Reading AI Overview • ${persona.name}`;
          if (voicePausePlayIcon) voicePausePlayIcon.className = 'fa-solid fa-pause';
        } else {
          voiceAssistantBanner.classList.remove('playing');
          if (voiceBannerStatusText) voiceBannerStatusText.textContent = 'Voice Assistant Paused';
          if (voicePausePlayIcon) voicePausePlayIcon.className = 'fa-solid fa-play';
        }
      } else {
        voiceAssistantBanner.classList.add('hidden');
        voiceAssistantBanner.classList.remove('playing');
      }
    }

    if (voiceSpeedLabel) {
      voiceSpeedLabel.textContent = `${state.speechSpeed.toFixed(1)}x`;
    }

    updatePersonaVisuals();
  }

  function setVoicePersona(personaKey, restartIfSpeaking = true) {
    if (!personaCatalog[personaKey]) return;
    state.voicePersona = personaKey;
    localStorage.setItem('fastshot_voice_persona', personaKey);
    updatePersonaVisuals();

    const persona = personaCatalog[personaKey];
    showToast(`Voice Persona changed to ${persona.name}`, 'info');

    if (state.isSpeaking && restartIfSpeaking) {
      startSpeechAssistant();
    }
  }

  function populateSynthesisVoicesDropdown() {
    if (!('speechSynthesis' in window) || !tuningVoiceSelect) return;
    const voices = window.speechSynthesis.getVoices() || [];

    tuningVoiceSelect.innerHTML = '<option value="auto">✨ Smart Auto (Best match for Persona & Language)</option>';

    if (!voices.length) return;

    // Group voices by language tag
    const groups = {};
    voices.forEach((v) => {
      const langKey = v.lang || 'Other';
      if (!groups[langKey]) groups[langKey] = [];
      groups[langKey].push(v);
    });

    Object.keys(groups).sort().forEach((langKey) => {
      const optGroup = document.createElement('optgroup');
      optGroup.label = langKey;
      groups[langKey].forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v.voiceURI || v.name;
        opt.textContent = `${v.name} (${v.lang})${v.default ? ' [Default]' : ''}`;
        optGroup.appendChild(opt);
      });
      tuningVoiceSelect.appendChild(optGroup);
    });

    tuningVoiceSelect.value = state.selectedVoiceURI || 'auto';
  }

  function playPersonaSample(personaKey, previewBtn) {
    if (!('speechSynthesis' in window)) {
      showToast('Text-to-speech not supported.', 'info');
      return;
    }

    const persona = personaCatalog[personaKey];
    if (!persona) return;

    // Stop existing utterances
    window.speechSynthesis.cancel();
    if (state.isSpeaking) {
      state.isSpeaking = false;
      state.isPausedSpeech = false;
      updateVoiceAssistantUI();
    }

    // Reset preview button states
    document.querySelectorAll('.btn-persona-preview').forEach((b) => {
      b.classList.remove('playing');
      b.innerHTML = '<i class="fa-solid fa-play"></i> Sample';
    });

    if (previewBtn) {
      previewBtn.classList.add('playing');
      previewBtn.innerHTML = '<i class="fa-solid fa-volume-high fa-beat"></i> Playing';
    }

    testUtterance = new SpeechSynthesisUtterance(persona.sampleText);
    const baseSpeed = state.speechSpeed || 1.0;
    testUtterance.rate = Math.min(2.0, Math.max(0.5, baseSpeed * (persona.rateModifier || 1.0)));
    testUtterance.pitch = Math.min(1.8, Math.max(0.6, (persona.pitch || 1.0) * (state.customVoicePitch || 1.0)));

    const curLang = state.currentLanguage || 'en';
    const voice = getBestAvailableVoice(curLang, personaKey);
    if (voice) testUtterance.voice = voice;

    testUtterance.onend = () => {
      if (previewBtn) {
        previewBtn.classList.remove('playing');
        previewBtn.innerHTML = '<i class="fa-solid fa-play"></i> Sample';
      }
    };

    testUtterance.onerror = () => {
      if (previewBtn) {
        previewBtn.classList.remove('playing');
        previewBtn.innerHTML = '<i class="fa-solid fa-play"></i> Sample';
      }
    };

    window.speechSynthesis.speak(testUtterance);
  }

  function playCurrentVoiceTest() {
    if (!('speechSynthesis' in window)) {
      showToast('Text-to-speech not supported.', 'info');
      return;
    }

    window.speechSynthesis.cancel();

    if (btnTestCurrentVoice) {
      btnTestCurrentVoice.classList.add('testing');
      if (testVoiceIcon) testVoiceIcon.className = 'fa-solid fa-wave-square fa-beat';
      if (testVoiceLabel) testVoiceLabel.textContent = 'Speaking Audition...';
    }

    const persona = getActivePersona();
    const curLang = state.currentLanguage || 'en';
    const testPhrase = `Greetings! You are auditioning the ${persona.name} AI voice persona. It provides ${persona.subtitle.toLowerCase()} for all your search results.`;

    testUtterance = new SpeechSynthesisUtterance(testPhrase);
    const baseSpeed = state.speechSpeed || 1.0;
    testUtterance.rate = Math.min(2.0, Math.max(0.5, baseSpeed * (persona.rateModifier || 1.0)));
    testUtterance.pitch = Math.min(1.8, Math.max(0.6, (persona.pitch || 1.0) * (state.customVoicePitch || 1.0)));

    const voice = getBestAvailableVoice(curLang, state.voicePersona);
    if (voice) testUtterance.voice = voice;

    testUtterance.onend = () => {
      if (btnTestCurrentVoice) {
        btnTestCurrentVoice.classList.remove('testing');
        if (testVoiceIcon) testVoiceIcon.className = 'fa-solid fa-volume-high';
        if (testVoiceLabel) testVoiceLabel.textContent = 'Play Test Sample';
      }
    };

    testUtterance.onerror = () => {
      if (btnTestCurrentVoice) {
        btnTestCurrentVoice.classList.remove('testing');
        if (testVoiceIcon) testVoiceIcon.className = 'fa-solid fa-volume-high';
        if (testVoiceLabel) testVoiceLabel.textContent = 'Play Test Sample';
      }
    };

    window.speechSynthesis.speak(testUtterance);
  }

  function openVoiceSettingsModal() {
    if (!voiceSettingsModal) return;
    populateSynthesisVoicesDropdown();
    updatePersonaVisuals();
    voiceSettingsModal.classList.remove('hidden');
  }

  function closeVoiceSettingsModal() {
    if (!voiceSettingsModal) return;
    voiceSettingsModal.classList.add('hidden');
    // Stop any sample speech
    if (testUtterance) {
      window.speechSynthesis.cancel();
      testUtterance = null;
    }
    document.querySelectorAll('.btn-persona-preview').forEach((b) => {
      b.classList.remove('playing');
      b.innerHTML = '<i class="fa-solid fa-play"></i> Sample';
    });
    if (btnTestCurrentVoice) {
      btnTestCurrentVoice.classList.remove('testing');
      if (testVoiceIcon) testVoiceIcon.className = 'fa-solid fa-volume-high';
      if (testVoiceLabel) testVoiceLabel.textContent = 'Play Test Sample';
    }
  }

  // Voice Settings Event Listeners
  if (btnVoicePersonaBanner) {
    btnVoicePersonaBanner.addEventListener('click', () => {
      openVoiceSettingsModal();
    });
  }

  if (btnVoiceSettingsToggle) {
    btnVoiceSettingsToggle.addEventListener('click', () => {
      openVoiceSettingsModal();
    });
  }

  if (btnOpenVoiceSettingsFooter) {
    btnOpenVoiceSettingsFooter.addEventListener('click', () => {
      openVoiceSettingsModal();
    });
  }

  document.querySelectorAll('.close-voice-settings-trigger').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeVoiceSettingsModal();
    });
  });

  // Persona card clicks & sample audition clicks
  if (personaCardsGrid) {
    personaCardsGrid.addEventListener('click', (e) => {
      const sampleBtn = e.target.closest('.btn-persona-preview');
      if (sampleBtn) {
        e.stopPropagation();
        const pKey = sampleBtn.getAttribute('data-persona');
        playPersonaSample(pKey, sampleBtn);
        return;
      }

      const card = e.target.closest('.persona-card');
      if (card) {
        const personaKey = card.getAttribute('data-persona');
        if (personaKey) {
          setVoicePersona(personaKey);
        }
      }
    });
  }

  // Speed Pills in Tuning Card
  if (tuningSpeedPills) {
    tuningSpeedPills.addEventListener('click', (e) => {
      const btn = e.target.closest('.speed-opt-btn');
      if (btn) {
        const speedVal = parseFloat(btn.getAttribute('data-speed'));
        if (!isNaN(speedVal)) {
          state.speechSpeed = speedVal;
          localStorage.setItem('fastshot_speech_speed', state.speechSpeed.toString());
          updatePersonaVisuals();
          if (voiceSpeedLabel) voiceSpeedLabel.textContent = `${state.speechSpeed.toFixed(1)}x`;
          if (state.isSpeaking) startSpeechAssistant();
          showToast(`Speech speed set to ${state.speechSpeed.toFixed(1)}x`, 'info');
        }
      }
    });
  }

  // Pitch Slider
  if (tuningPitchSlider) {
    tuningPitchSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.customVoicePitch = val;
      localStorage.setItem('fastshot_voice_pitch', val.toString());
      updatePersonaVisuals();
    });

    tuningPitchSlider.addEventListener('change', () => {
      if (state.isSpeaking) startSpeechAssistant();
    });
  }

  if (btnResetPitch) {
    btnResetPitch.addEventListener('click', () => {
      state.customVoicePitch = 1.0;
      localStorage.setItem('fastshot_voice_pitch', '1.0');
      updatePersonaVisuals();
      if (state.isSpeaking) startSpeechAssistant();
      showToast('Voice pitch reset to default', 'info');
    });
  }

  // Tuning Voice Select
  if (tuningVoiceSelect) {
    tuningVoiceSelect.addEventListener('change', (e) => {
      state.selectedVoiceURI = e.target.value;
      localStorage.setItem('fastshot_voice_uri', state.selectedVoiceURI);
      if (state.isSpeaking) startSpeechAssistant();
      showToast('Preferred synthesis voice updated', 'info');
    });
  }

  // Test Current Voice Button
  if (btnTestCurrentVoice) {
    btnTestCurrentVoice.addEventListener('click', () => {
      playCurrentVoiceTest();
    });
  }

  // Banner Voice Assistant event listeners
  if (btnSpeakResult) {
    btnSpeakResult.addEventListener('click', () => {
      if (state.isSpeaking) {
        stopSpeechAssistant();
      } else {
        startSpeechAssistant();
      }
    });
  }

  if (btnVoicePausePlay) {
    btnVoicePausePlay.addEventListener('click', () => {
      pauseOrResumeSpeechAssistant();
    });
  }

  if (btnVoiceStop) {
    btnVoiceStop.addEventListener('click', () => {
      stopSpeechAssistant();
    });
  }

  if (btnVoiceSpeed) {
    btnVoiceSpeed.addEventListener('click', () => {
      const curIndex = speedOptions.indexOf(state.speechSpeed);
      const nextIndex = (curIndex + 1) % speedOptions.length;
      state.speechSpeed = speedOptions[nextIndex];
      localStorage.setItem('fastshot_speech_speed', state.speechSpeed.toString());
      if (voiceSpeedLabel) voiceSpeedLabel.textContent = `${state.speechSpeed.toFixed(1)}x`;
      updatePersonaVisuals();
      
      // If currently speaking, restart with new speed
      if (state.isSpeaking) {
        startSpeechAssistant();
      } else {
        showToast(`Voice speed set to ${state.speechSpeed.toFixed(1)}x`, 'info');
      }
    });
  }

  // Preload synthesis voices if available
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      getBestAvailableVoice();
      populateSynthesisVoicesDropdown();
    };
  }

  // Initialize persona visuals on boot
  updatePersonaVisuals();

  function updateBookmarkBtnState() {
    if (!btnBookmarkResult || !state.currentResult) return;
    const isBookmarked = state.bookmarks.some((b) => b.query === state.currentResult.query) ||
                         state.localBookmarks.some((b) => b.query === state.currentResult.query);
    if (isBookmarked) {
      btnBookmarkResult.innerHTML = '<i class="fa-solid fa-bookmark text-amber-400"></i>';
      btnBookmarkResult.title = 'Saved to bookmarks';
    } else {
      btnBookmarkResult.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
      btnBookmarkResult.title = 'Bookmark this search';
    }
  }

  // Copy Result to clipboard with bulletproof iframe-compatible fallback
  async function copyTextToClipboard(text) {
    if (!text) return false;
    
    // Attempt modern Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn('[Clipboard] Modern API failed, using fallback...');
      }
    }
    
    // Fallback: execCommand('copy') via textarea
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error('[Clipboard] Fallback failed:', err);
      return false;
    }
  }

  if (btnCopyResult) {
    btnCopyResult.addEventListener('click', async () => {
      const activeText = getCurrentReadableText();
      if (!activeText) return;
      
      const success = await copyTextToClipboard(activeText);
      if (success) {
        btnCopyResult.classList.add('copied');
        showToast('Answer copied to clipboard!', 'success');
        setTimeout(() => btnCopyResult.classList.remove('copied'), 2000);
      } else {
        showToast('Failed to copy to clipboard', 'error');
      }
    });
  }

  // Bookmark Toggle with Guest LocalStorage Fallback
  if (btnBookmarkResult) {
    btnBookmarkResult.addEventListener('click', async () => {
      if (!state.currentResult) return;

      // Guest User local storage fallback
      if (!state.user || !state.token) {
        const existingLocalIdx = state.localBookmarks.findIndex((b) => b.query === state.currentResult.query);
        if (existingLocalIdx > -1) {
          // Remove local bookmark
          state.localBookmarks.splice(existingLocalIdx, 1);
          localStorage.setItem('fastshot_local_bookmarks', JSON.stringify(state.localBookmarks));
          updateBookmarkBtnState();
          updateBookmarksBadges();
          renderBookmarksList();
          showToast('Removed from saved bookmarks.', 'info');
        } else {
          // Add local bookmark
          const b = {
            id: 'local_' + Date.now(),
            query: state.currentResult.query,
            title: state.currentResult.query,
            summary: state.originalMarkdown || state.currentResult.text || state.currentResult.content || '',
            engine: state.currentResult.engine || 'gemini',
            sources: state.currentResult.sources || [],
            images: state.currentResult.images || [],
            createdAt: new Date().toISOString()
          };
          state.localBookmarks.unshift(b);
          localStorage.setItem('fastshot_local_bookmarks', JSON.stringify(state.localBookmarks));
          updateBookmarkBtnState();
          updateBookmarksBadges();
          renderBookmarksList();
          showToast('Saved to local bookmarks!', 'success');
        }
        return;
      }

      // Authenticated User flow
      const existing = state.bookmarks.find((b) => b.query === state.currentResult.query);
      if (existing) {
        // Delete bookmark
        try {
          const res = await fetch(`/api/bookmarks/${existing.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${state.token}` },
          });
          if (res.ok) {
            state.bookmarks = state.bookmarks.filter((b) => b.id !== existing.id);
            updateBookmarkBtnState();
            updateBookmarksBadges();
            renderBookmarksList();
            showToast('Removed from saved bookmarks.', 'info');
          }
        } catch (e) {
          showToast('Error updating bookmark', 'error');
        }
      } else {
        // Add bookmark
        try {
          const res = await fetch('/api/bookmarks', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${state.token}`,
            },
            body: JSON.stringify({
              query: state.currentResult.query,
              title: state.currentResult.query,
              summary: state.originalMarkdown || state.currentResult.text || state.currentResult.content || '',
              engine: state.currentResult.engine || 'gemini',
              sources: state.currentResult.sources || [],
              images: state.currentResult.images || [],
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const b = data.bookmark || data;
            state.bookmarks.unshift(b);
            updateBookmarkBtnState();
            updateBookmarksBadges();
            renderBookmarksList();
            showToast('Saved to your bookmarks!', 'success');
          }
        } catch (e) {
          showToast('Error saving bookmark', 'error');
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // HISTORY & BOOKMARKS DRAWER
  // --------------------------------------------------------------------------
  const historyDrawerModal = document.getElementById('history-drawer-modal');
  const tabBtnHistory = document.getElementById('tab-btn-history');
  const tabBtnBookmarks = document.getElementById('tab-btn-bookmarks');
  const historyListView = document.getElementById('history-list-view');
  const bookmarksListView = document.getElementById('bookmarks-list-view');
  const drawerEmptyState = document.getElementById('drawer-empty-state');
  const emptyStateTitle = document.getElementById('empty-state-title');
  const emptyStateDesc = document.getElementById('empty-state-desc');
  const drawerFilterInput = document.getElementById('drawer-filter-input');
  const btnClearHistory = document.getElementById('btn-clear-history');

  function openHistoryDrawer(tab = 'history') {
    if (!historyDrawerModal) return;
    historyDrawerModal.classList.remove('hidden');
    switchDrawerTab(tab);
    fetchHistory();
    fetchBookmarks();
  }

  function closeHistoryDrawer() {
    if (!historyDrawerModal) return;
    historyDrawerModal.classList.add('hidden');
  }

  document.querySelectorAll('.open-history-trigger').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openHistoryDrawer('history');
    });
  });

  document.querySelectorAll('.open-bookmarks-trigger').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openHistoryDrawer('bookmarks');
    });
  });

  document.querySelectorAll('.close-history-trigger').forEach((btn) => {
    btn.addEventListener('click', closeHistoryDrawer);
  });

  function switchDrawerTab(tab) {
    state.activeDrawerTab = tab;
    if (tab === 'history') {
      tabBtnHistory?.classList.add('active');
      tabBtnBookmarks?.classList.remove('active');
      historyListView?.classList.remove('hidden');
      bookmarksListView?.classList.add('hidden');
      if (btnClearHistory) btnClearHistory.style.display = 'flex';
      renderHistoryList();
    } else {
      tabBtnBookmarks?.classList.add('active');
      tabBtnHistory?.classList.remove('active');
      bookmarksListView?.classList.remove('hidden');
      historyListView?.classList.add('hidden');
      if (btnClearHistory) btnClearHistory.style.display = 'none';
      renderBookmarksList();
    }
  }

  if (tabBtnHistory) tabBtnHistory.addEventListener('click', () => switchDrawerTab('history'));
  if (tabBtnBookmarks) tabBtnBookmarks.addEventListener('click', () => switchDrawerTab('bookmarks'));

  if (drawerFilterInput) {
    drawerFilterInput.addEventListener('input', () => {
      if (state.activeDrawerTab === 'history') {
        renderHistoryList(drawerFilterInput.value);
      } else {
        renderBookmarksList(drawerFilterInput.value);
      }
    });
  }

  // Clear All History
  if (btnClearHistory) {
    btnClearHistory.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to clear your search history?')) return;
      try {
        const headers = {};
        if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

        await fetch('/api/history', { method: 'DELETE', headers });
        state.history = [];
        updateHistoryBadges();
        renderHistoryList();
        showToast('Search history cleared.', 'info');
      } catch (e) {
        showToast('Error clearing history', 'error');
      }
    });
  }

  // Fetch History from backend
  async function fetchHistory() {
    try {
      const headers = {};
      if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

      const res = await fetch('/api/history', { headers });
      if (res.ok) {
        const data = await res.json();
        state.history = Array.isArray(data.history) ? data.history : (Array.isArray(data) ? data : []);
        updateHistoryBadges();
        if (state.activeDrawerTab === 'history') {
          renderHistoryList(drawerFilterInput?.value);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch history:', e);
    }
  }

  // Fetch Bookmarks from backend
  async function fetchBookmarks() {
    if (!state.token) {
      state.bookmarks = [];
      updateBookmarksBadges();
      return;
    }
    try {
      const res = await fetch('/api/bookmarks', {
        headers: { Authorization: `Bearer ${state.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        state.bookmarks = Array.isArray(data.bookmarks) ? data.bookmarks : (Array.isArray(data) ? data : []);
        updateBookmarksBadges();
        if (state.activeDrawerTab === 'bookmarks') {
          renderBookmarksList(drawerFilterInput?.value);
        }
        updateBookmarkBtnState();
      }
    } catch (e) {
      console.warn('Failed to fetch bookmarks:', e);
    }
  }

  function updateHistoryBadges() {
    const count = state.history.length;
    document.querySelectorAll('.history-count-badge').forEach((badge) => {
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
      badge.style.display = count === 0 ? 'none' : 'flex';
    });
    const tabCount = document.getElementById('history-tab-count');
    if (tabCount) tabCount.textContent = count;
  }

  function updateBookmarksBadges() {
    const count = (state.bookmarks || []).length + (state.localBookmarks || []).length;
    const tabCount = document.getElementById('bookmarks-tab-count');
    if (tabCount) tabCount.textContent = count;
  }

  function formatRelativeTime(timestamp) {
    if (!timestamp) return 'Just now';
    const elapsed = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(elapsed / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function renderHistoryList(filterQuery = '') {
    if (!historyListView) return;

    let items = state.history;
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      items = items.filter((h) => h.query.toLowerCase().includes(q) || ((h.summaryPreview || h.fullText || '') && (h.summaryPreview || h.fullText || '').toLowerCase().includes(q)));
    }

    if (items.length === 0) {
      historyListView.innerHTML = '';
      if (drawerEmptyState) {
        drawerEmptyState.classList.remove('hidden');
        if (emptyStateTitle) emptyStateTitle.textContent = filterQuery ? 'No matching history' : 'No search history yet';
        if (emptyStateDesc) emptyStateDesc.textContent = filterQuery ? 'Try another filter keyword.' : 'Ask Gemini or OpenAI anything to populate your history.';
      }
      return;
    }

    if (drawerEmptyState) drawerEmptyState.classList.add('hidden');

    historyListView.innerHTML = items
      .map((item) => {
        const engineClass = item.engine === 'openai' ? 'openai' : 'gemini';
        const engineLabel = item.engine === 'openai' ? 'OpenAI' : 'Gemini';
        const preview = item.summaryPreview || item.fullText || item.content || '';

        return `
        <div class="history-card-item" data-id="${item.id}">
          <div class="history-card-top">
            <span class="history-card-model ${engineClass}">${engineLabel}</span>
            <span class="history-card-time">${formatRelativeTime(item.timestamp || item.createdAt)}</span>
          </div>
          <div class="history-card-query">${item.query}</div>
          ${preview ? `<div class="history-card-snippet">${preview.slice(0, 130)}...</div>` : ''}
          <div class="history-card-actions">
            <button type="button" class="history-card-del" title="Delete from history" data-del-id="${item.id}">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
      `;
      })
      .join('');

    // Bind item clicks to view cached result or execute
    historyListView.querySelectorAll('.history-card-item').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.history-card-del')) return;
        const id = card.getAttribute('data-id');
        const item = state.history.find((h) => h.id === id);
        if (item) {
          closeHistoryDrawer();
          displaySearchResult({
            query: item.query,
            content: item.fullText || item.summaryPreview || item.content,
            text: item.fullText || item.summaryPreview || item.content,
            engine: item.engine,
            sources: item.sources || [],
            searchQueries: item.searchQueries || [],
            suggestedFollowUps: item.suggestedFollowUps || [],
            executionTimeMs: 280,
            grounded: true,
            images: item.images || [],
          });
          openResultsModal(item.query);
        }
      });
    });

    // Bind single delete
    historyListView.querySelectorAll('.history-card-del').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-del-id');
        try {
          const headers = {};
          if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
          await fetch(`/api/history/${id}`, { method: 'DELETE', headers });
          state.history = state.history.filter((h) => h.id !== id);
          updateHistoryBadges();
          renderHistoryList(drawerFilterInput?.value);
        } catch (e) {
          showToast('Failed to delete item', 'error');
        }
      });
    });
  }

  function renderBookmarksList(filterQuery = '') {
    if (!bookmarksListView) return;

    // Deduplicate bookmarks by query to prevent overlapping remote/local duplicates
    const uniqueItems = [];
    const queriesSeen = new Set();
    const allItems = [...(state.bookmarks || []), ...(state.localBookmarks || [])];
    for (const item of allItems) {
      if (!queriesSeen.has(item.query)) {
        queriesSeen.add(item.query);
        uniqueItems.push(item);
      }
    }

    let items = uniqueItems;
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      items = items.filter((b) => b.query.toLowerCase().includes(q) || ((b.summary || b.content || '') && (b.summary || b.content || '').toLowerCase().includes(q)));
    }

    if (items.length === 0) {
      bookmarksListView.innerHTML = '';
      if (drawerEmptyState) {
        drawerEmptyState.classList.remove('hidden');
        if (emptyStateTitle) emptyStateTitle.textContent = filterQuery ? 'No matching bookmarks' : 'No saved bookmarks yet';
        if (emptyStateDesc) emptyStateDesc.textContent = 'Click the bookmark icon on any search result to save it here.';
      }
      return;
    }

    if (drawerEmptyState) drawerEmptyState.classList.add('hidden');

    bookmarksListView.innerHTML = items
      .map((item) => {
        const engineClass = item.engine === 'openai' ? 'openai' : 'gemini';
        const engineLabel = item.engine === 'openai' ? 'OpenAI' : 'Gemini';
        const preview = item.summary || item.content || '';

        return `
        <div class="history-card-item" data-id="${item.id}">
          <div class="history-card-top">
            <span class="history-card-model ${engineClass}"><i class="fa-solid fa-bookmark text-amber-400"></i> ${engineLabel}</span>
            <span class="history-card-time">${formatRelativeTime(item.savedAt || item.createdAt)}</span>
          </div>
          <div class="history-card-query">${item.title || item.query}</div>
          ${preview ? `<div class="history-card-snippet">${preview.slice(0, 130)}...</div>` : ''}
          <div class="history-card-actions">
            <button type="button" class="history-card-del" title="Remove bookmark" data-del-id="${item.id}">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
      `;
      })
      .join('');

    // Bind item click
    bookmarksListView.querySelectorAll('.history-card-item').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.history-card-del')) return;
        const id = card.getAttribute('data-id');
        const item = state.bookmarks.find((b) => b.id === id) || state.localBookmarks.find((b) => b.id === id);
        if (item) {
          closeHistoryDrawer();
          displaySearchResult({
            query: item.query,
            content: item.summary || item.content,
            text: item.summary || item.content,
            engine: item.engine,
            sources: item.sources || [],
            grounded: true,
            images: item.images || [],
          });
          openResultsModal(item.query);
        }
      });
    });

    // Bind single bookmark delete
    bookmarksListView.querySelectorAll('.history-card-del').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-del-id');
        if (id && String(id).startsWith('local_')) {
          // Delete local guest bookmark
          state.localBookmarks = state.localBookmarks.filter((b) => b.id !== id);
          localStorage.setItem('fastshot_local_bookmarks', JSON.stringify(state.localBookmarks));
          updateBookmarksBadges();
          renderBookmarksList(drawerFilterInput?.value);
          updateBookmarkBtnState();
          showToast('Bookmark removed', 'info');
        } else {
          // Delete remote authenticated bookmark
          try {
            await fetch(`/api/bookmarks/${id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${state.token}` },
            });
            state.bookmarks = state.bookmarks.filter((b) => b.id !== id);
            updateBookmarksBadges();
            renderBookmarksList(drawerFilterInput?.value);
            updateBookmarkBtnState();
            showToast('Bookmark removed', 'info');
          } catch (e) {
            showToast('Failed to remove bookmark', 'error');
          }
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // MODELS SPEC & TELEMETRY MODAL
  // --------------------------------------------------------------------------
  const modelsModal = document.getElementById('models-modal');

  function openModelsModal() {
    if (!modelsModal) return;
    modelsModal.classList.remove('hidden');
    fetchServerStatus();
  }

  function closeModelsModal() {
    if (!modelsModal) return;
    modelsModal.classList.add('hidden');
  }

  document.querySelectorAll('.open-models-trigger').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openModelsModal();
    });
  });

  document.querySelectorAll('.close-models-trigger').forEach((btn) => {
    btn.addEventListener('click', closeModelsModal);
  });

  async function fetchServerStatus() {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        const system = data.system || {};
        const telemUsers = document.getElementById('telem-users');
        const telemHistory = document.getElementById('telem-history');
        const telemUptime = document.getElementById('telem-uptime');

        if (telemUsers) telemUsers.textContent = system.usersRegistered || '1';
        if (telemHistory) telemHistory.textContent = system.historyItemsStored || '0';
        if (telemUptime) telemUptime.textContent = '99.99%';

        // Grounding Metrics
        const telemP99 = document.getElementById('telem-p99');
        const telemAvg = document.getElementById('telem-avg');
        const telemRequests = document.getElementById('telem-requests');

        const p99Val = system.p99Latency || 1280;
        const avgVal = system.avgLatency || 1050;
        const reqsVal = system.totalRequests || 12;

        if (telemP99) telemP99.textContent = `${p99Val} ms`;
        if (telemAvg) telemAvg.textContent = `${avgVal} ms`;
        if (telemRequests) telemRequests.textContent = `${reqsVal} ops`;

        // Bar Visualizer
        const telemBarChart = document.getElementById('telem-bar-chart');
        if (telemBarChart && Array.isArray(system.recentLatencies)) {
          const latencies = system.recentLatencies;
          const maxVal = Math.max(...latencies, 2000); // Scale chart relative to maximum, min scale threshold 2000ms
          telemBarChart.innerHTML = latencies
            .map((lat) => {
              const pct = Math.min(100, Math.round((lat / maxVal) * 100));
              // Highlight bars close to or exceeding p99 threshold as peaks
              const isPeak = lat >= (p99Val * 0.95);
              const barClass = isPeak ? 'visualizer-bar p99-bar' : 'visualizer-bar';
              return `<div class="${barClass}" style="height: ${pct}%;" data-latency="${lat} ms"></div>`;
            })
            .join('');
        }

        // Check openai status pill
        const openaiPill = document.getElementById('openai-status-pill');
        if (openaiPill && data.services?.openai) {
          openaiPill.innerHTML = '<span class="pulse-dot"></span> Operational';
        }
      }
    } catch (e) {
      console.warn('Failed to fetch status:', e);
    }
  }

  // Live Chat composer form listener
  if (chatComposerForm) {
    chatComposerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!chatComposerInput) return;
      const msg = chatComposerInput.value;
      submitContinuousChat(msg);
    });
  }

  // Global ESC key to close all open modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeResultsModal();
      closeHistoryDrawer();
      closeAuthModal();
      closeModelsModal();
    }
  });

  // --------------------------------------------------------------------------
  // SYSTEM-WIDE HIGH-CONTRAST THEME TOGGLE
  // --------------------------------------------------------------------------
  function toggleTheme() {
    const isLight = document.documentElement.classList.toggle('light-mode');
    const newTheme = isLight ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    updateThemeToggleIcons(newTheme);
  }

  function updateThemeToggleIcons(currentTheme) {
    document.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
      if (currentTheme === 'light') {
        btn.innerHTML = '<i class="fa-solid fa-moon text-indigo-400"></i>';
        btn.title = 'Toggle Dark Mode';
        btn.setAttribute('aria-label', 'Toggle dark mode');
      } else {
        btn.innerHTML = '<i class="fa-solid fa-sun text-amber-400"></i>';
        btn.title = 'Toggle Light Mode';
        btn.setAttribute('aria-label', 'Toggle light mode');
      }
    });
  }

  // Register listeners for theme toggles
  document.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', toggleTheme);
  });

  // Initialize theme from local storage
  const savedTheme = localStorage.getItem('theme') || 'dark';
  if (savedTheme === 'light') {
    document.documentElement.classList.add('light-mode');
    updateThemeToggleIcons('light');
  } else {
    document.documentElement.classList.remove('light-mode');
    updateThemeToggleIcons('dark');
  }

  // Fetch initial history & status on load
  fetchHistory();
  fetchBookmarks();
  fetchServerStatus();
})();
