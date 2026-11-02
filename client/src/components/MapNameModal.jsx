import { useState } from 'react';
import Button from './Button.jsx';
import Modal, { ModalError } from './Modal.jsx';

// Matches MAX_MAP_NAME in server/validation.js.
const MAX_LENGTH = 200;

export default function MapNameModal({ title, submitLabel, initialName = '', onSubmit, onClose }) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(name.trim());
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={busy ? () => {} : onClose}
      onSubmit={submit}
      actions={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy || !name.trim()}>{submitLabel}</Button>
        </>
      }
    >
      <label className="flex flex-col gap-1">
        <span>Name</span>
        <input
          autoFocus
          value={name}
          maxLength={MAX_LENGTH}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5"
        />
      </label>
      <ModalError>{error}</ModalError>
    </Modal>
  );
}
