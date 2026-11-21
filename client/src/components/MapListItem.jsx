import { Link } from 'react-router';
import ActionsMenu from './ActionsMenu.jsx';

export default function MapListItem({ map, onRename, onDelete }) {
  const layers = `${map.layer_count} ${map.layer_count === 1 ? 'layer' : 'layers'}`;
  return (
    <li className="flex items-center gap-2 py-1 pr-2 pl-1 hover:bg-hover">
      <Link to={`/maps/${map.id}`} className="min-w-0 flex-1 rounded-lg px-3 py-2">
        <span className="block truncate font-medium">{map.name}</span>
        <span className="text-[13px] text-ink-faint">
          {layers} · Edited <time dateTime={map.updated_at}>{formatEdited(new Date(map.updated_at))}</time>
        </span>
      </Link>
      <ActionsMenu
        label={`Actions for ${map.name}`}
        items={[{ label: 'Rename', onSelect: onRename }, { label: 'Delete', danger: true, onSelect: onDelete }]}
      />
    </li>
  );
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const absolute = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

// "just now", "5 minutes ago", "yesterday"… for the last week, then a date.
function formatEdited(date) {
  const seconds = (date - Date.now()) / 1000;
  for (const [unit, size] of [['day', 86400], ['hour', 3600], ['minute', 60]]) {
    if (Math.abs(seconds) >= size) {
      return unit === 'day' && Math.abs(seconds) >= 7 * size ? absolute.format(date) : relative.format(Math.round(seconds / size), unit);
    }
  }
  return 'just now';
}
