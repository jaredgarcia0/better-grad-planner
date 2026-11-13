import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

// Keep in sync with the inline script in index.html that applies the theme before first paint.
const STORAGE_KEY = "bgp-theme";
const darkQuery = "(prefers-color-scheme: dark)";

function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia?.(darkQuery).matches ? "dark" : "light";
}

/**
 * Follows the OS color scheme until the user picks a theme, then remembers
 * that choice. The choice is applied as data-theme on <html>, which theme.css reads.
 */
export function useTheme() {
  const [stored, setStored] = useState<Theme | null>(readStoredTheme);
  const [system, setSystem] = useState<Theme>(systemTheme);

  useEffect(() => {
    const media = window.matchMedia?.(darkQuery);
    if (!media) return;
    const onChange = () => setSystem(media.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (stored) root.dataset.theme = stored;
    else delete root.dataset.theme;
  }, [stored]);

  const theme = stored ?? system;

  const setTheme = useCallback((next: Theme) => {
    setStored(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode); the choice still applies for this visit.
    }
  }, []);

  const toggleTheme = useCallback(
    () => setTheme(theme === "dark" ? "light" : "dark"),
    [setTheme, theme],
  );

  return { theme, setTheme, toggleTheme };
}
