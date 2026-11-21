import { useState } from 'react';
import { MAX_LAYER_NAME } from '../../../shared/limits.js';
import Button from './Button.jsx';
import { FIELD } from './fieldClass.js';


/**
 * The foot of the Filter tab: copies the features the filter lets through
 * into a new layer, with an optional name.
 *
 * @param {object} props
 * @param {boolean} props.disabled true when there are no conditions, or nothing matches them
 * @param {(name: string) => Promise<boolean>} props.onSave resolves to whether it saved; the name is cleared if so
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
      <label className="flex flex-col gap-1">
        <span>New layer name</span>
        <input className={FIELD} value={name} maxLength={MAX_LAYER_NAME} onChange={(e) => setName(e.target.value)} placeholder="Automatic" />
      </label>
      <Button type="submit" variant="primary" className="justify-center" disabled={disabled || saving}>
        {saving ? 'Saving…' : 'Save as new layer'}
      </Button>
    </form>
  );
}
