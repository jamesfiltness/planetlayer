import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';

// Render it only while open, so its contents start fresh each time.
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

export function ModalError({ children }) {
  return children ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{children}</p> : null;
}
