import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'yetinel:theme';

/** Stored preference, else the OS setting. */
const initialTheme = () => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage can throw in private mode or when site data is blocked —
    // fall through to the OS preference rather than failing to render.
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

export const useTheme = () => {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Persisting is best-effort; the theme still applies for this session.
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggle };
};

export default useTheme;
