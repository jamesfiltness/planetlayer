import { useState } from 'react';
import Button from './Button.jsx';

const FIELD = 'rounded-md border border-gray-300 px-2 py-1.5';

/**
 * The foot of the Filter tab: copies the features the filter lets through
 * into a new layer, with an optional name.
 *
 * @param {object} props
 * @param {boolean} props.disabled true when there's no filter, or nothing matches it
 * @param {(name: string) => Promise<boolean>} props.onSave resolves to whether it worked; the name is cleared if so
 */
export default function SaveAsLayerForm({ disabled, onSave }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    if (await onSave(name)) setName('');
    setSaving(false);
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={submit}>
      <h3 className="font-semibold">Save as a new layer</h3>
      <p className="text-gray-500">Copies the features shown into a layer of their own. This layer keeps all of its features.</p>
      <label className="flex flex-col gap-1">
        <span>New layer name</span>
        <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} placeholder="Automatic" />
      </label>
      <Button type="submit" variant="primary" className="justify-center" disabled={disabled || saving}>
        {saving ? 'Saving…' : 'Save as new layer'}
      </Button>
    </form>
  );
}
