import { useId, useState } from 'react';
import { passwordRules, passwordStrength, STRENGTH_LABEL } from '../lib/password';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  /** Show the live checklist and strength bar (for choosing a new password). */
  showRules?: boolean;
  error?: string;
  required?: boolean;
  autoFocus?: boolean;
}

/** A password box with a show/hide button and, when choosing a password, a live checklist. */
export function PasswordField({ label, value, onChange, autoComplete, showRules, error, required = true, autoFocus }: Props) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  // A server complaint (too common, contains your name) outranks what the length and variety alone suggest.
  const strength = error ? 1 : passwordStrength(value);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-box">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required={required}
          autoFocus={autoFocus}
          maxLength={256}
          aria-invalid={!!error}
          aria-describedby={showRules ? `${id}-rules` : undefined}
        />
        <button type="button" className="password-toggle" onClick={() => setVisible((v) => !v)} aria-pressed={visible} aria-label={visible ? 'Hide password' : 'Show password'}>
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>

      {showRules && (
        <div id={`${id}-rules`} className="password-rules" aria-live="polite">
          <div className="strength" aria-hidden="true">
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className={`strength-bar ${strength >= n ? `on on-${strength}` : ''}`} />
            ))}
          </div>
          <span className="strength-label">{value ? STRENGTH_LABEL[strength] : 'Choose a password'}</span>
          <ul>
            {passwordRules(value).map((r) => (
              <li key={r.id} className={r.ok ? 'rule-ok' : ''}>
                <span aria-hidden="true">{r.ok ? '✓' : '○'}</span> {r.label}
                <span className="sr-only">{r.ok ? ' (met)' : ' (not met yet)'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <small className="field-error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
