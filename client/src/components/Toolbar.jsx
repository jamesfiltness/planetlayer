import { useEffect, useRef, useState } from 'react';
import { FORMATS, TOOLS } from '../../../shared/spec.js';
import Button from './Button.jsx';
import { ChevronIcon } from './icons.jsx';
import LayerList from './LayerList.jsx';
import ToolDialog, { canRun } from './ToolDialog.jsx';

const ACCEPT = Object.keys(FORMATS).join(',');

const PANEL = 'rounded-xl bg-white shadow-panel';
const MENU = `${PANEL} flex max-h-[calc(100vh-120px)] min-w-[260px] flex-col overflow-auto p-1.5`;

export default function Toolbar({ layers, hidden, onToggle, onDelete, onImport, onRun }) {
  const [menu, setMenu] = useState(null);
  const [tool, setTool] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const ref = useRef(null);
  const fileInput = useRef(null);

  // A click outside the toolbar closes its menu. Modals render elsewhere in
  // the page, so this ignores clicks inside one (e.g. confirming a delete).
  useEffect(() => {
    const close = (e) => ref.current?.contains(e.target) || e.target.closest?.('[role="dialog"]') || setMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const toggle = (name) => setMenu((m) => (m === name ? null : name));
  const barButton = (name) => (menu === name ? 'bg-hover' : '');

  return (
    <div ref={ref} className="absolute bottom-6 left-1/2 flex max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col items-center gap-2">
      {!collapsed && tool && <ToolDialog tool={tool} layers={layers} onRun={onRun} onClose={() => setTool(null)} />}

      {!collapsed && menu === 'layers' && (
        <div className={MENU}>
          <LayerList layers={layers} hidden={hidden} onToggle={onToggle} onDelete={onDelete} />
        </div>
      )}

      {!collapsed && menu === 'analyse' && (
        <div className={MENU}>
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={!canRun(t, layers)}
              onClick={() => { setTool(t); setMenu(null); }}
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
            <Button className={barButton('layers')} aria-expanded={menu === 'layers'} onClick={() => toggle('layers')}>Layers</Button>
            <Button onClick={() => { fileInput.current.click(); setMenu(null); }}>Add layer</Button>
            <Button className={barButton('analyse')} aria-expanded={menu === 'analyse'} onClick={() => toggle('analyse')}>Analyse</Button>
            <span className="mx-0.5 my-1.5 w-px bg-gray-200" />
            <Button className="p-2 text-gray-600" title="Hide the toolbar" aria-label="Hide the toolbar" onClick={() => { setCollapsed(true); setMenu(null); }}>
              <ChevronIcon />
            </Button>
          </>
        )}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          onImport([...e.target.files]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
