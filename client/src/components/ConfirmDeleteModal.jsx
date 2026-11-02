import { useState } from 'react';
import Button from './Button.jsx';
import Modal, { ModalError } from './Modal.jsx';

/**
 * Asks before deleting something. While the delete runs the buttons are
 * disabled and the modal can't be dismissed; if it fails, the error shows here
 * and the modal stays open to try again or cancel.
 *
 * @param {object} props
 * @param {string} props.title e.g. `Delete "Survey"?`
 * @param {import('react').ReactNode} props.children what will be lost
 * @param {() => Promise<void>} props.onConfirm does the delete; throw to show an error
 * @param {() => void} props.onClose
 */
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
