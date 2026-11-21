import { useEffect, useId, useState } from 'react';
import { isHex, PALETTE, readableOn } from '../lib/color';
import { CheckIcon } from './Icons';

interface Props {
  value: string | null;
  onChange: (color: string | null) => void;
  label: string;
  /** Offer a "default" choice that clears the colour (columns have a built-in look; priorities always need one). */
  allowDefault?: boolean;
}

/** A row of ready-made colours plus a custom one. The value is always a #rrggbb string (or null for "default"). */
export function ColorPicker({ value, onChange, label, allowDefault }: Props) {
  const id = useId();
  const [text, setText] = useState(value ?? '');
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(value ?? '');
    setInvalid(false);
  }, [value]);

  const commitText = () => {
    const t = text.trim().startsWith('#') ? text.trim() : `#${text.trim()}`;
    if (text.trim() === '') return allowDefault ? onChange(null) : setText(value ?? '');
    if (isHex(t)) {
      setInvalid(false);
      onChange(t.toLowerCase());
    } else setInvalid(true);
  };

  return (
    <div className="colorpicker" role="radiogroup" aria-label={label}>
      <div className="swatches">
        {allowDefault && (
          <button type="button" role="radio" aria-checked={value === null} className={`swatch swatch-none ${value === null ? 'is-on' : ''}`} title="Default" aria-label="Default colour" onClick={() => onChange(null)}>
            {value === null ? <CheckIcon size={12} /> : null}
          </button>
        )}
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value?.toLowerCase() === c}
            className={`swatch ${value?.toLowerCase() === c ? 'is-on' : ''}`}
            style={{ background: c, color: readableOn(c) }}
            title={c}
            aria-label={`Colour ${c}`}
            onClick={() => onChange(c)}
          >
            {value?.toLowerCase() === c ? <CheckIcon size={12} /> : null}
          </button>
        ))}
      </div>
      <div className="color-custom">
        <input type="color" aria-label={`${label}: pick any colour`} value={value && isHex(value) ? value : '#0c66e4'} onChange={(e) => onChange(e.target.value.toLowerCase())} />
        <label htmlFor={`${id}-hex`} className="sr-only">
          Colour code
        </label>
        <input
          id={`${id}-hex`}
          className="hex-input"
          value={text}
          placeholder={allowDefault ? 'Default' : '#0c66e4'}
          maxLength={7}
          spellCheck={false}
          aria-invalid={invalid}
          onChange={(e) => {
            setText(e.target.value);
            setInvalid(false);
          }}
          onBlur={commitText}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commitText())}
        />
      </div>
      {invalid && (
        <small className="field-error" role="alert">
          Use a colour code like #0c66e4
        </small>
      )}
    </div>
  );
}
