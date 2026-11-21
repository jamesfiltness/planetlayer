import { useState } from 'react';
import { THEMES } from '../../../shared/themes.js';
import { useSettings } from '../settings/SettingsContext.js';

/**
 * The theme setting: one card per theme, each a radio button, with a small
 * preview of its base map. Choosing one applies it straight away and saves it;
 * if the save fails the old theme comes back and the error is shown.
 */
export default function ThemePicker() {
  const { settings, update } = useSettings();
  const [error, setError] = useState(null);

  const choose = (theme) => {
    setError(null);
    update({ theme }).catch((e) => setError(e.message));
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-lg font-semibold">Theme</legend>
      <p className="-mt-2 text-ink-muted">The base map under your layers. Dark maps make the rest of the app dark too.</p>
      {error && (
        <p role="alert" className="rounded-lg bg-danger-wash px-3 py-2 text-danger-text">Couldn't save the theme: {error}</p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {THEMES.map((theme) => (
          <ThemeOption key={theme.id} theme={theme} checked={settings.theme === theme.id} onChoose={() => choose(theme.id)} />
        ))}
      </div>
    </fieldset>
  );
}

function ThemeOption({ theme, checked, onChoose }) {
  return (
    // The radio itself is hidden: the card is the control, and shows its
    // focus and checked state with a ring.
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl bg-surface p-2.5 ring-1 has-focus-visible:ring-2 has-focus-visible:ring-accent ${
        checked ? 'ring-2 ring-accent' : 'ring-hairline hover:ring-edge'
      }`}
    >
      <input type="radio" name="theme" value={theme.id} checked={checked} onChange={onChoose} className="sr-only" />
      <MapPreview land={theme.land} water={theme.water} />
      <span className="flex min-w-0 flex-col">
        <span className="font-medium">{theme.label}</span>
        <span className="text-[13px] text-ink-faint">{theme.hint}</span>
      </span>
    </label>
  );
}

// A thumbnail of the base map: its land colour, with a bay of its water.
function MapPreview({ land, water }) {
  return (
    <svg viewBox="0 0 64 44" aria-hidden="true" className="h-11 w-16 flex-none overflow-hidden rounded-lg ring-1 ring-hairline">
      <rect width="64" height="44" fill={land} />
      <path d="M64 10C50 12 44 22 40 30S30 40 26 44H64Z" fill={water} />
    </svg>
  );
}
