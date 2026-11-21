import { useRef } from 'react';
import { FORMATS } from '../../../shared/spec.js';
import { PlusIcon } from './icons.jsx';

const ACCEPT = Object.keys(FORMATS).join(',');

/**
 * A plus button that opens the file picker, limited to the formats the server
 * can import.
 *
 * @param {object} props
 * @param {(files: File[]) => void} props.onImport called with the files picked
 */
export default function AddLayerButton({ onImport }) {
  const fileInput = useRef(null);

  return (
    <>
      <button
        type="button"
        title="Add layer"
        aria-label="Add layer"
        onClick={() => fileInput.current.click()}
        className="flex-none cursor-pointer rounded-lg p-1.5 text-ink-muted hover:bg-hover"
      >
        <PlusIcon />
      </button>
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          onImport([...e.target.files]);
          // Cleared so picking the same file again still fires a change.
          e.target.value = '';
        }}
      />
    </>
  );
}
