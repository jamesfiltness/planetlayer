import { Field, Label, Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { FIELD } from './fieldClass.js';
import { CheckIcon, ChevronIcon } from './icons.jsx';

/**
 * A labelled dropdown whose options can carry a picture, used where a plain
 * <select> can't show one (such as the Style tab's style types and colour
 * ramps). The chosen option has a tick. An option can be disabled, with a
 * hint under its label saying why.
 *
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.value the chosen option's value
 * @param {Array<{ value: string, label: string, picture?: import('react').ReactNode, disabled?: boolean, hint?: string }>} props.options
 * @param {(value: string) => void} props.onChange
 */
export default function Dropdown({ label, value, options, onChange }) {
  const current = options.find((o) => o.value === value);
  return (
    <Field className="flex flex-col gap-1">
      <Label>{label}</Label>
      <Listbox value={value} onChange={onChange}>
        <ListboxButton className={`${FIELD} flex cursor-pointer items-center gap-2 text-left data-open:border-accent`}>
          {current?.picture}
          <span className="flex-1 truncate">{current?.label ?? value}</span>
          <span className="text-ink-faint"><ChevronIcon /></span>
        </ListboxButton>
        <ListboxOptions
          anchor={{ to: 'bottom start', gap: 4 }}
          className="z-40 w-(--button-width) rounded-xl bg-surface p-1.5 shadow-panel outline-none"
        >
          {options.map((option) => (
            <ListboxOption
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className="group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 data-disabled:cursor-default data-disabled:opacity-50 data-focus:bg-hover"
            >
              {option.picture}
              <span className="flex flex-1 flex-col">
                {option.label}
                {option.hint && <span className="text-xs text-ink-faint">{option.hint}</span>}
              </span>
              <span className="invisible group-data-selected:visible"><CheckIcon /></span>
            </ListboxOption>
          ))}
        </ListboxOptions>
      </Listbox>
    </Field>
  );
}
