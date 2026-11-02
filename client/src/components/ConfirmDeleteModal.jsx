import { useState } from 'react';
import Button from './Button.jsx';
import Modal, { ModalError } from './Modal.jsx';

export default function ConfirmDeleteModal({ title, children, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={busy ? () => {} : onClose}
      actions={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="danger" onClick={confirm} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</Button>
        </>
      }
    >
      <p className="text-gray-600">{children}</p>
      <ModalError>{error}</ModalError>
    </Modal>
  );
}
