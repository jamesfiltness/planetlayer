import { createContext, useContext } from 'react';

/**
 * The app's settings, as `{ settings, update }`, provided by SettingsProvider.
 *
 * `settings` is the saved object, such as `{ theme: 'positron' }`. `update`
 * takes the settings to change, shows the change straight away, saves it, and
 * undoes it if the save fails; it returns the save's promise so a caller can
 * report the failure.
 *
 * Kept apart from the provider so this file exports no component, which keeps
 * React's fast refresh working for both.
 */
export const SettingsContext = createContext(null);

export const useSettings = () => useContext(SettingsContext);
