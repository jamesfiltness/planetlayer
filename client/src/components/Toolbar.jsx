import { useEffect, useRef, useState } from 'react';
import { TOOLS } from '../../../shared/spec.js';
import Button from './Button.jsx';
import { ChevronIcon } from './icons.jsx';
import ToolDialog, { canRun } from './ToolDialog.jsx';

const PANEL = 'rounded-xl bg-white shadow-panel';
const MENU = `${PANEL} flex max-h-[calc(100vh_-_var(--spacing-map-top)_-_104px)] min-w-[260px] flex-col overflow-auto p-1.5`;

export default function Toolbar({ layers, onRun }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tool, setTool] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const ref = useRef(null);

  // A click outside the toolbar closes its menu.
  useEffect(() => {
    const close = (e) => ref.current?.contains(e.target) || setMenuOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={ref} className="absolute bottom-6 left-1/2 flex max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col items-center gap-2">
      {!collapsed && tool && <ToolDialog tool={tool} layers={layers} onRun={onRun} onClose={() => setTool(null)} />}

      {!collapsed && menuOpen && (
        <div className={MENU}>
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={!canRun(t, layers)}
              onClick={() => { setTool(t); setMenuOpen(false); }}
              className="flex cursor-pointer flex-col rounded-lg px-3 py-2 text-left hover:enabled:bg-hover disabled:cursor-default disabled:opacity-40"
            >
              <strong>{t.label}</strong>
              <small className="text-gray-500">{t.hint}</small>
            </button>
          ))}
        </div>
      )}

      <div className={`${PANEL} flex gap-1 p-1.5`}>
        {collapsed ? (
          <Button className="p-2 text-gray-600" title="Show the toolbar" aria-label="Show the toolbar" onClick={() => setCollapsed(false)}>
            <ChevronIcon up />
          </Button>
        ) : (
          <>
            <Button className={menuOpen ? 'bg-hover' : ''} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>Analyse</Button>
            <span className="mx-0.5 my-1.5 w-px bg-gray-200" />
            <Button className="p-2 text-gray-600" title="Hide the toolbar" aria-label="Hide the toolbar" onClick={() => { setCollapsed(true); setMenuOpen(false); }}>
              <ChevronIcon />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
