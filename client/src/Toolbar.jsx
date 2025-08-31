import { useEffect, useRef, useState } from 'react';
import ToolDialog, { TOOLS, canRun } from './ToolDialog.jsx';

const ACCEPT = '.geojson,.json,.zip,.kml,.kmz,.gpx,.gpkg,.fgb,.topojson';

const Chevron = ({ up }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d={up ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
  </svg>
);

export default function Toolbar({ layers, hidden, onToggle, onDelete, onImport, onRun }) {
  const [menu, setMenu] = useState(null);
  const [tool, setTool] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const ref = useRef(null);
  const fileInput = useRef(null);

  useEffect(() => {
    const close = (e) => ref.current?.contains(e.target) || setMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const toggle = (name) => setMenu((m) => (m === name ? null : name));

  if (collapsed) {
    return (
      <div className="toolbar">
        <div className="bar">
          <button className="icon" title="Show the toolbar" onClick={() => setCollapsed(false)}><Chevron up /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="toolbar" ref={ref}>
      {tool && <ToolDialog tool={tool} layers={layers} onRun={onRun} onClose={() => setTool(null)} />}

      {menu === 'layers' && (
        <div className="menu">
          {layers.length === 0 && <div className="empty">No layers yet</div>}
          {layers.map((l) => (
            <div key={l.id} className="row">
              <input type="checkbox" checked={!hidden.has(l.id)} onChange={() => onToggle(l.id)} />
              <span className="swatch" style={{ background: l.color }} />
              <span className="name" title={l.name}>{l.name}</span>
              <span className="count">{l.count}</span>
              <button title="Delete layer" onClick={() => confirm(`Delete "${l.name}"?`) && onDelete(l)}>×</button>
            </div>
          ))}
        </div>
      )}

      {menu === 'analyse' && (
        <div className="menu">
          {TOOLS.map((t) => (
            <button key={t.id} disabled={!canRun(t, layers)} onClick={() => { setTool(t); setMenu(null); }}>
              <strong>{t.label}</strong>
              <small>{t.hint}</small>
            </button>
          ))}
        </div>
      )}

      <div className="bar">
        <button className={menu === 'layers' ? 'active' : ''} onClick={() => toggle('layers')}>Layers</button>
        <button onClick={() => { fileInput.current.click(); setMenu(null); }}>Add layer</button>
        <button className={menu === 'analyse' ? 'active' : ''} onClick={() => toggle('analyse')}>Analyse</button>
        <span className="divider" />
        <button className="icon" title="Hide the toolbar" onClick={() => { setCollapsed(true); setMenu(null); }}><Chevron /></button>
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

