const AUTH_TOKEN_KEY = 'projection_google_id_token';
const AUTH_EMAIL_KEY = 'projection_google_email';
const THEME_MODE_KEY = 'projection_theme_mode';
const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

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
  el.themeToggle.textContent = '◐';
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

const decodeJwtEmail = (token) => {
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized));
    return decoded.email || null;
  } catch {
    return null;
  }
};

const verifyToken = async (token) => {
  const response = await fetch('/api/v1/projects', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return response.ok;
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

  const existingToken = sessionStorage.getItem(AUTH_TOKEN_KEY);
  if (existingToken) {
    const ok = await verifyToken(existingToken);
    if (ok) {
      window.location.href = '/';
      return;
    }
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_EMAIL_KEY);
  }

  const configResponse = await fetch('/api/v1/auth/google/config');
  const config = await configResponse.json();

  if (!config.enabled) {
    setStatus('Google login is not configured on this server.');
    return;
  }

  const googleLoaded = await waitForGoogleIdentity();
  if (!googleLoaded) {
    setStatus('Google login script failed to load.');
    return;
  }

  const domainLine = `Sign in with your @${config.allowedEmailDomain} account.`;
  setStatus(reasonMessage ? `${reasonMessage} ${domainLine}` : domainLine);

  window.google.accounts.id.initialize({
    client_id: config.clientId,
    callback: async (response) => {
      const token = response.credential;
      const ok = await verifyToken(token);
      if (!ok) {
        setStatus(`Sign-in failed. Use a valid @${config.allowedEmailDomain} account.`);
        return;
      }

      sessionStorage.setItem(AUTH_TOKEN_KEY, token);
      const email = decodeJwtEmail(token);
      if (email) {
        sessionStorage.setItem(AUTH_EMAIL_KEY, email);
      }
      window.location.href = '/';
    }
  });

  window.google.accounts.id.renderButton(el.loginGoogleButton, {
    theme: 'outline',
    size: 'large',
    text: 'signin_with'
  });
};

startLogin().catch((error) => {
  setStatus('Login initialization failed.');
  // eslint-disable-next-line no-console
  console.error(error);
});

initializeThemeMode();
