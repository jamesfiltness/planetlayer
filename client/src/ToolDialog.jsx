import { useState } from 'react';

export const canRun = (tool, layers) =>
  tool.fields.every((f) => !f.shapes || layers.some((l) => f.shapes.includes(l.shape)));

export default function ToolDialog({ tool, layers, onRun, onClose }) {
  const [params, setParams] = useState(() => {
    const initial = { name: '' };
    for (const f of tool.fields) initial[f.key] = 'initial' in f ? f.initial : '';
    return initial;
  });
  const [running, setRunning] = useState(false);
  const layerById = (id) => layers.find((l) => l.id === Number(id));

  const candidates = (f, p) => {
    if (f.sameShapeAs) {
      const first = layerById(p[f.sameShapeAs]);
      return first ? layers.filter((l) => l.shape === first.shape && l.id !== first.id) : [];
    }
    return layers.filter((l) => f.shapes.includes(l.shape));
  };
  const properties = (f, p) => layerById(p[f.fieldOf])?.fields ?? [];

  // Changing a layer clears any field that depends on it and no longer fits,
  // so a hidden stale value is never sent.
  const set = (key, value) =>
    setParams((p) => {
      const next = { ...p, [key]: value };
      for (const f of tool.fields) {
        if (f.sameShapeAs === key && !candidates(f, next).some((l) => String(l.id) === String(next[f.key]))) next[f.key] = '';
        if (f.fieldOf === key && !properties(f, next).includes(next[f.key])) next[f.key] = '';
      }
      return next;
    });

  const input = (f) => {
    const value = params[f.key];
    if (f.shapes || f.sameShapeAs) {
      return (
        <select value={value} onChange={(e) => set(f.key, e.target.value)} required>
          <option value="">Choose…</option>
          {candidates(f, params).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      );
    }
    if (f.fieldOf) {
      return (
        <select value={value} onChange={(e) => set(f.key, e.target.value)}>
          <option value="">Everything</option>
          {properties(f, params).map((k) => <option key={k}>{k}</option>)}
        </select>
      );
    }
    if (f.options) {
      return (
        <select value={value} onChange={(e) => set(f.key, e.target.value)}>
          {f.options.map((o) => <option key={o}>{o}</option>)}
        </select>
      );
    }
    if (f.type === 'checkbox') return <input type="checkbox" checked={value} onChange={(e) => set(f.key, e.target.checked)} />;
    return <input type="number" step="any" value={value} onChange={(e) => set(f.key, e.target.value)} required />;
  };

  const submit = async (e) => {
    e.preventDefault();
    setRunning(true);
    if (await onRun(tool.id, params)) onClose();
    setRunning(false);
  };

  return (
    <form className="dialog" onSubmit={submit}>
      <h3>{tool.label}</h3>
      <p>{tool.hint}</p>
      {tool.fields.map((f) => (
        <label key={f.key} className={f.type === 'checkbox' ? 'inline' : ''}>
          <span>{f.label}</span>
          {input(f)}
        </label>
      ))}
      <label>
        <span>New layer name</span>
        <input value={params.name} onChange={(e) => set('name', e.target.value)} placeholder="Automatic" />
      </label>
      <div className="actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" className="primary" disabled={running}>{running ? 'Running…' : 'Run'}</button>
      </div>
    </form>
  );
}
