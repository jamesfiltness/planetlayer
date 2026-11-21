export default function StatusBanner({ status, onDismiss }) {
  if (!status) return null;
  return (
    <div
      role={status.error ? 'alert' : 'status'}
      className={`absolute top-map-top left-1/2 z-10 flex w-max max-w-[min(560px,calc(100vw-32px))] -translate-x-1/2 items-start gap-2 rounded-xl py-2 pr-2 pl-3.5 shadow-panel
        ${status.error ? 'bg-danger-wash text-danger-text' : 'bg-surface'}`}
    >
      <span className="flex-1 py-1 wrap-anywhere">{status.message}</span>
      <button
        type="button"
        aria-label="Dismiss"
        title="Dismiss"
        onClick={onDismiss}
        className="flex-none cursor-pointer rounded-md px-2 py-1 text-lg leading-none opacity-60 hover:bg-hover hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
