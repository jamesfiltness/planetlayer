import { Field, Label, Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { symbologyType, symbologyTypesFor } from '../../../shared/symbology.js';
import { FIELD } from './fieldClass.js';
import { CheckIcon, ChevronIcon } from './icons.jsx';
import SymbologyIcon from './SymbologyIcon.jsx';

/**
 * The Style tab's menu of symbology types: how the layer's features are
 * coloured and sized from their data. Only the types the layer's shape can
 * use are offered (see shared/symbology.js), each with a small picture.
 *
 * @param {object} props
 * @param {string} props.shape the layer's shape: point, line or polygon
 * @param {string} props.value the current symbology type
 * @param {(type: string) => void} props.onChange called with the chosen type
 */
export default function StyleTypePicker({ shape, value, onChange }) {
  const current = symbologyType(value);
  return (
    <Field className="flex flex-col gap-1">
      <Label>Style</Label>
      <Listbox value={value} onChange={onChange}>
        <ListboxButton className={`${FIELD} flex cursor-pointer items-center gap-2 text-left data-open:border-accent`}>
          <SymbologyIcon type={value} />
          <span className="flex-1 truncate">{current?.label ?? value}</span>
          <span className="text-ink-faint"><ChevronIcon /></span>
        </ListboxButton>
        <ListboxOptions
          anchor={{ to: 'bottom start', gap: 4 }}
          className="z-40 w-(--button-width) rounded-xl bg-surface p-1.5 shadow-panel outline-none"
        >
          {symbologyTypesFor(shape).map(({ type, label }) => (
            <ListboxOption
              key={type}
              value={type}
              className="group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 data-focus:bg-hover"
            >
              <SymbologyIcon type={type} />
              <span className="flex-1">{label}</span>
              <span className="invisible group-data-selected:visible"><CheckIcon /></span>
            </ListboxOption>
          ))}
        </ListboxOptions>
      </Listbox>
    </Field>
  );
}
