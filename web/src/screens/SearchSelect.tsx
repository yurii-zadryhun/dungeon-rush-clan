import React from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import './SearchSelect.css';

export interface SelectChoice {
  value: number | null;
  label: string;
  hint?: string;
}

export function SearchSelect({
  value,
  choices,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: number | null;
  choices: SelectChoice[];
  onChange: (id: number | null) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [focusIndex, setFocusIndex] = React.useState(0);
  const input = React.useRef<HTMLInputElement>(null);
  const listId = React.useId();
  const selected = choices.find((choice) => choice.value === value);
  const filtered = React.useMemo(
    () =>
      choices.filter(
        (choice) =>
          choice.value === null || choice.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
      ),
    [choices, query],
  );

  function choose(option: SelectChoice) {
    onChange(option.value);
    setOpen(false);
    setQuery('');
  }

  function start() {
    setOpen(true);
    setQuery('');
    setFocusIndex(0);
  }

  React.useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  return (
    <div
      className="search-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      {!open ? (
        <button
          type="button"
          className="search-select-trigger"
          aria-label={ariaLabel}
          aria-expanded={false}
          onClick={start}
        >
          <span>{selected?.label ?? placeholder}</span>
          <ChevronsUpDown size={14} />
        </button>
      ) : (
        <div className="search-select-popup">
          <div className="search-select-search">
            <Search size={14} />
            <input
              ref={input}
              role="combobox"
              aria-label={ariaLabel}
              aria-autocomplete="list"
              aria-expanded={true}
              aria-controls={listId}
              value={query}
              placeholder={placeholder}
              onChange={(event) => {
                setQuery(event.target.value);
                setFocusIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setOpen(false);
                }
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setFocusIndex((i) => Math.min(i + 1, filtered.length - 1));
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setFocusIndex((i) => Math.max(i - 1, 0));
                }
                if (event.key === 'Enter' && filtered[focusIndex]) {
                  event.preventDefault();
                  choose(filtered[focusIndex]);
                }
              }}
            />
          </div>
          <div className="search-select-list" id={listId} role="listbox">
            {filtered.map((choice, index) => (
              <button
                type="button"
                role="option"
                key={choice.value ?? 'new'}
                aria-selected={choice.value === value}
                className={focusIndex === index ? 'focused' : ''}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(choice)}
              >
                <span>
                  {choice.label}
                  {choice.hint && <small>{choice.hint}</small>}
                </span>
                {choice.value === value && <Check size={14} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
