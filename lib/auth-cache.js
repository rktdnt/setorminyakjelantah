const AUTH_CACHE_KEY = 'smj_auth_cache';
const AUTH_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function saveAuthCache(user) {
  const payload = {
    user,
    expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
  };

  localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(payload));
  localStorage.setItem('user', JSON.stringify(user));
}

export function getAuthCache() {
  const raw = localStorage.getItem(AUTH_CACHE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);

    if (!parsed?.user || !parsed?.expiresAt) {
      localStorage.removeItem(AUTH_CACHE_KEY);
      return null;
    }

    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(AUTH_CACHE_KEY);
      localStorage.removeItem('user');
      return null;
    }

    return parsed.user;
  } catch {
    localStorage.removeItem(AUTH_CACHE_KEY);
    return null;
  }
}

export function clearAuthCache() {
  localStorage.removeItem(AUTH_CACHE_KEY);
  localStorage.removeItem('user');
}
