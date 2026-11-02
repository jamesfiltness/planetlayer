/**
 * The status message at the top of the map ("Importing…", or an error), with
 * a button to dismiss it. Errors use role="alert" so they're read out.
 *
 * @param {object} props
 * @param {{ message: string, error?: boolean } | null} props.status from useStatus
 * @param {() => void} props.onDismiss
 */
export default function StatusBanner({ status, onDismiss }) {
  if (!status) return null;
  return (
    <div
      role={status.error ? 'alert' : 'status'}
      className={`absolute top-4 left-1/2 z-10 flex w-max max-w-[min(560px,calc(100vw-32px))] -translate-x-1/2 items-start gap-2 rounded-xl py-2 pr-2 pl-3.5 shadow-panel max-sm:top-20
        ${status.error ? 'bg-red-50 text-red-800' : 'bg-white'}`}
    >
      <span className="flex-1 py-1 wrap-anywhere">{status.message}</span>
      <button
        type="button"
        aria-label="Dismiss"
        title="Dismiss"
        onClick={onDismiss}
        className="flex-none cursor-pointer rounded-md px-2 py-1 text-lg leading-none opacity-60 hover:bg-black/5 hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
