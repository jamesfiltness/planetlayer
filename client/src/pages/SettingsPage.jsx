import { useEffect } from 'react';
import ThemePicker from '../components/ThemePicker.jsx';

/**
 * The app's settings. Each one saves as soon as it's changed, so there's no
 * save button. For now there's one setting, the theme.
 */
export default function SettingsPage() {
  useEffect(() => {
    document.title = 'Settings · Spatial Analysis';
  }, []);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <ThemePicker />
    </div>
  );
}
