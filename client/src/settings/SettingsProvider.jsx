import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { DEFAULT_THEME } from '../../../shared/themes.js';
import { SettingsContext } from './SettingsContext.js';
import { applyTheme } from './theme.js';

// What the app runs on if the settings can't be read, so it still works.
const FALLBACK = { theme: DEFAULT_THEME };

/**
 * Loads the settings and gives them to the app (see SettingsContext.js), and
 * keeps the page in the chosen theme.
 *
 * Nothing is drawn until the settings have loaded, because a map takes its
 * base style when it's created and won't change it later: drawing first could
 * start a map in the wrong theme. If they can't be loaded the app carries on
 * with the defaults, since a theme isn't worth blocking the app for.
 */
export default function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  // Mirrors `settings`, so `update` can undo a failed change without being
  // rebuilt, and with it every component that uses it, on each change.
  const saved = useRef(null);

  useEffect(() => {
    api.settings().then(
      (loaded) => { saved.current = loaded; setSettings(loaded); },
      (error) => {
        console.error("Couldn't load the settings, so using the defaults:", error);
        saved.current = FALLBACK;
        setSettings(FALLBACK);
      },
    );
  }, []);

  // Only when the theme itself changes, not every time the settings object does.
  const theme = settings?.theme;
  useEffect(() => {
    if (theme) applyTheme(theme);
  }, [theme]);

  const update = useCallback(async (changes) => {
    const before = saved.current;
    setSettings({ ...before, ...changes });
    try {
      saved.current = await api.saveSettings(changes);
      setSettings(saved.current);
    } catch (error) {
      setSettings(before);
      throw error;
    }
  }, []);

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  if (!settings) return null;
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
