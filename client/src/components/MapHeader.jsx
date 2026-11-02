import { Link } from 'react-router';
import { BackIcon } from './icons.jsx';

/**
 * The panel in the map's top-left corner: a link back to the list of maps
 * and the map's name.
 *
 * @param {{ name: string | undefined }} props undefined while loading
 */
export default function MapHeader({ name }) {
  return (
    <header className="absolute top-4 left-4 z-10 flex max-w-[calc(100vw-32px)] items-center gap-1 rounded-xl bg-white p-1.5 shadow-panel">
      <Link to="/" className="flex items-center gap-1 rounded-lg py-2 pr-3 pl-2 hover:bg-hover">
        <BackIcon />
        Maps
      </Link>
      <span className="mx-0.5 my-1.5 w-px self-stretch bg-gray-200" />
      <h1 className="truncate px-2 font-semibold" title={name}>{name ?? '…'}</h1>
    </header>
  );
}
