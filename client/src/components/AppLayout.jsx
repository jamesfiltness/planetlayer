import { useMemo, useState } from 'react';
import { Outlet, useMatch } from 'react-router';
import AppHeader from './AppHeader.jsx';

/**
 * The frame every page is drawn in: the header, then the page.
 *
 * On a map the header floats over the page, so the map runs behind it to the
 * top of the window; everywhere else it takes up room above the page.
 *
 * Pages reach the header through the outlet context: `setMapName` puts the
 * open map's name on the bar (null takes it off again).
 */
export default function AppLayout() {
  const onMap = Boolean(useMatch('/maps/:mapId'));
  const [mapName, setMapName] = useState(null);
  const context = useMemo(() => ({ setMapName }), []);

  return (
    // `isolate` keeps the header's z-index inside this frame. Without it the
    // header would also sit above modals and menus, which are added to the end
    // of the body with no z-index of their own.
    <div className="relative isolate flex h-full flex-col bg-gray-50">
      <AppHeader floating={onMap} mapName={mapName} />
      <main className="min-h-0 flex-1 overflow-auto">
        <Outlet context={context} />
      </main>
    </div>
  );
}
