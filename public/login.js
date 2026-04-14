const THEME_MODE_KEY = 'projection_theme_mode';
const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
const THEME_TOGGLE_ICON = '<svg class="theme-toggle-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="theme-sun" cx="12" cy="12" r="4"></circle><path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke-width="1.7" stroke-linecap="round"/></svg>';

const el = {
  loginGoogleButton: document.querySelector('#loginGoogleButton'),
  loginStatus: document.querySelector('#loginStatus'),
  themeToggle: document.querySelector('#themeToggle')
};

const normalizeThemeMode = (value) => (value === 'light' || value === 'dark' || value === 'system' ? value : 'system');
const resolvedTheme = (mode) => (mode === 'system' ? (darkModeQuery.matches ? 'dark' : 'light') : mode);

const refreshThemeToggle = () => {
  if (!el.themeToggle) {
    return;
  }

  const mode = normalizeThemeMode(localStorage.getItem(THEME_MODE_KEY));
  const activeTheme = document.documentElement.dataset.theme || resolvedTheme(mode);
  el.themeToggle.dataset.theme = activeTheme;
  el.themeToggle.innerHTML = THEME_TOGGLE_ICON;
  el.themeToggle.setAttribute('aria-label', activeTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  el.themeToggle.title = activeTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
};

const applyThemeMode = (mode) => {
  const nextMode = normalizeThemeMode(mode);
  document.documentElement.dataset.themeMode = nextMode;
  document.documentElement.dataset.theme = resolvedTheme(nextMode);
  localStorage.setItem(THEME_MODE_KEY, nextMode);
  refreshThemeToggle();
};

const initializeThemeMode = () => {
  applyThemeMode(localStorage.getItem(THEME_MODE_KEY));

  const handleSystemThemeChange = () => {
    if (normalizeThemeMode(localStorage.getItem(THEME_MODE_KEY)) === 'system') {
      applyThemeMode('system');
    }
  };

  if (typeof darkModeQuery.addEventListener === 'function') {
    darkModeQuery.addEventListener('change', handleSystemThemeChange);
  } else if (typeof darkModeQuery.addListener === 'function') {
    darkModeQuery.addListener(handleSystemThemeChange);
  }

  if (el.themeToggle) {
    el.themeToggle.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme || resolvedTheme(normalizeThemeMode(localStorage.getItem(THEME_MODE_KEY)));
      applyThemeMode(current === 'dark' ? 'light' : 'dark');
    });
  }
};

const setStatus = (message) => {
  el.loginStatus.textContent = message;
};

const hasActiveSession = async () => {
  const response = await fetch('/api/v1/auth/session', {
    method: 'GET',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    return false;
  }

  const body = await response.json();
  return Boolean(body?.authenticated);
};

const waitForGoogleIdentity = async (timeoutMs = 8000, pollIntervalMs = 100) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (window.google?.accounts?.id) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  return Boolean(window.google?.accounts?.id);
};

const REASON_MESSAGES = {
  expired: 'Your session expired. Please sign in again.',
  signedout: 'You have been signed out.',
  required: 'Sign in to access the workspace.',
};

const startLogin = async () => {
  const params = new URLSearchParams(window.location.search);
  const reason = params.get('reason') || '';
  const reasonMessage = REASON_MESSAGES[reason] || '';

  if (await hasActiveSession()) {
    window.location.href = '/';
    return;
  }

  const configResponse = await fetch('/api/v1/auth/google/config');
  const config = await configResponse.json();

  if (!config.enabled && !config.devBypassEnabled) {
    setStatus('Google login is not configured on this server.');
    return;
  }

  if (config.devBypassEnabled) {
    const btn = document.createElement('button');
    btn.id = 'devBypassButton';
    btn.textContent = 'Dev Login (bypass)';
    btn.style.cssText = 'margin: 0.8rem 0; padding: 0.5rem 1.2rem; cursor: pointer; font-size: 0.95rem; border: 2px dashed #f90; background: transparent; color: inherit; border-radius: 4px;';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      setStatus('Signing in via dev bypass...');
      try {
        const r = await fetch('/api/v1/auth/dev-bypass', { method: 'POST', credentials: 'same-origin' });
        if (!r.ok) {
          setStatus('Dev bypass failed.');
          btn.disabled = false;
          return;
        }
        window.location.href = '/';
      } catch {
        setStatus('Dev bypass request failed.');
        btn.disabled = false;
      }
    });
    el.loginGoogleButton.appendChild(btn);
    setStatus(reasonMessage || 'Dev mode: use the bypass button to sign in.');
    return;
  }

  const googleLoaded = await waitForGoogleIdentity();
  if (!googleLoaded) {
    setStatus('Google login script failed to load.');
    return;
  }

  // eslint-disable-next-line no-console
  console.log('[Projection] Initialising Google Sign-In', { origin: window.location.origin, clientId: config.clientId });

  const domainLine = `Sign in with your @${config.allowedEmailDomain} account.`;
  setStatus(reasonMessage ? `${reasonMessage} ${domainLine}` : domainLine);

  window.google.accounts.id.initialize({
    client_id: config.clientId,
    // Disable FedCM so the classic GSI button flow is used; FedCM has
    // stricter origin enforcement that can lag behind Console changes.
    use_fedcm_for_prompt: false,
    callback: async (response) => {
      const idToken = response.credential;
      const sessionResponse = await fetch('/api/v1/auth/google/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ idToken })
      });

      if (!sessionResponse.ok) {
        setStatus(`Sign-in failed. Use a valid @${config.allowedEmailDomain} account.`);
        return;
      }

      window.location.href = '/';
    }
  });

  window.google.accounts.id.renderButton(el.loginGoogleButton, {
    theme: 'outline',
    size: 'large',
    text: 'signin_with'
  });

  // If Google rejects the current origin/client pairing, the button often never renders.
  window.setTimeout(() => {
    if (!el.loginGoogleButton?.children?.length) {
      // eslint-disable-next-line no-console
      console.error('[Projection] renderButton produced no children after 500ms — Google likely rejected the origin.');
      const origin = window.location.origin;
      setStatus(
        `Google Sign-In could not render. Verify OAuth Web client ${config.clientId} allows origin ${origin} in Authorized JavaScript origins.`
      );
      // eslint-disable-next-line no-console
      console.error(
        '[Projection] Google Sign-In blocked — OAuth origin not allowed.\n\n' +
        `  Current origin : ${origin}\n` +
        `  OAuth client ID: ${config.clientId}\n\n` +
        '  Fix: Google Cloud Console → Credentials → open that client ID\n' +
        `  → Authorized JavaScript origins → add exactly: ${origin}`
      );
    }
  }, 500);
};

startLogin().catch((error) => {
  setStatus('Login initialization failed.');
  // eslint-disable-next-line no-console
  console.error(error);
});

initializeThemeMode();
