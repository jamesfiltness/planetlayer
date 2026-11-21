import { Link, useLocation } from 'react-router';

const NAV_LINK = 'rounded-lg py-1 text-[14px] font-medium text-ink-faint hover:text-ink aria-[current=page]:text-ink';

/**
 * The bar across the top of every page: the PlanetLayer wordmark, the places to go, and
 * the open map's name.
 *
 * It's made of `chrome-float`, the same translucent material as the map's side
 * panels (see style.css), so over a map the header and the panels read as one
 * set of controls.
 *
 * @param {object} props
 * @param {boolean} props.floating lies over the page (a map) instead of taking up room above it
 * @param {string | null} props.mapName the open map's name, once it has loaded
 */
export default function AppHeader({ floating, mapName }) {
  const { pathname } = useLocation();
  // A map is one of your maps, so Maps stays lit while one is open.
  const onMaps = pathname === '/' || pathname.startsWith('/maps/');
  const onSettings = pathname === '/settings';

  return (
    <header
      // Above the map's panels (z-10), which would otherwise slide over it on a short window.
      className={`chrome-float z-20 flex h-header flex-none items-center gap-7 border-b border-hairline px-5 font-brand ${
        floating ? 'absolute inset-x-0 top-0' : 'relative'
      }`}
    >
      {/* The wordmark and the links don't shrink: the map's name is what gives,
          by truncating. The wordmark is lowercase Manrope, "planet" in bold
          and "layer" in regular, so the link's label carries the properly cased name. */}
      <Link
        to="/"
        aria-label="PlanetLayer home"
        className="flex-none text-[18px] leading-none font-bold tracking-[-0.03em] whitespace-nowrap text-brand"
      >
        planet<span className="font-normal">layer</span>
      </Link>
      <nav aria-label="Main" className="flex flex-none items-center gap-5">
        <Link to="/" aria-current={onMaps ? 'page' : undefined} className={NAV_LINK}>Maps</Link>
        <Link to="/settings" aria-current={onSettings ? 'page' : undefined} className={NAV_LINK}>Settings</Link>
      </nav>
      {mapName && (
        <>
          <span className="-mx-2 h-5 w-px flex-none bg-edge" />
          <h1 className="min-w-0 truncate font-semibold" title={mapName}>{mapName}</h1>
        </>
      )}
    </header>
  );
}
