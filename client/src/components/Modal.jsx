import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';

/**
 * A centred modal dialog. Headless UI traps focus inside it, closes it on
 * Escape or a click outside, and returns focus to where it was when it closes.
 *
 * Render it only while it should be open (`{editing && <Modal …>}`), so its
 * contents start fresh each time.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {() => void} props.onClose called on Escape, a click outside, or Cancel
 * @param {(e: import('react').FormEvent) => void} [props.onSubmit] makes the
 *   panel a form, so Enter in a field submits it
 * @param {import('react').ReactNode} props.children the body
 * @param {import('react').ReactNode} props.actions buttons, right-aligned below the body
 */
export default function Modal({ title, onClose, onSubmit, children, actions }) {
  return (
    <Dialog open onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/30" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          as={onSubmit ? 'form' : 'div'}
          onSubmit={onSubmit}
          className="flex w-full max-w-sm flex-col gap-3 rounded-xl bg-white p-5 shadow-panel"
        >
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          {children}
          <div className="mt-1 flex justify-end gap-1.5">{actions}</div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

/** An error message inside a modal, announced to screen readers. */
export function ModalError({ children }) {
  return children ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{children}</p> : null;
}
