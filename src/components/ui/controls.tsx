import { useEffect, useId, useState, type ReactNode } from 'react';
import { formatPrecise, parseTime } from '../../lib/time';
import { Icon } from './Icon';

/** Interruptor acessível. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition ${
        checked ? 'border-brand-500 bg-brand-500' : 'border-ink-500 bg-ink-700'
      } disabled:opacity-40`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full transition-all ${checked ? 'left-[1.5rem] bg-ink-950' : 'left-0.5 bg-ink-200'}`}
      />
    </button>
  );
}

/** Campo de tempo editável (m:ss.cc). Confirma ao sair do campo ou com Enter. */
export function TimeField({
  value,
  onCommit,
  disabled,
  label,
  placeholder = '—',
}: {
  value: number | null;
  onCommit: (v: number | null) => boolean | void;
  disabled?: boolean;
  label: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value === null ? '' : formatPrecise(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(value === null ? '' : formatPrecise(value));
    setInvalid(false);
  }, [value]);

  const commit = () => {
    if (text.trim() === '') {
      if (value !== null) onCommit(null);
      return;
    }
    const parsed = parseTime(text);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    const ok = onCommit(parsed);
    if (ok === false) setText(value === null ? '' : formatPrecise(value));
  };

  return (
    <input
      aria-label={label}
      inputMode="decimal"
      disabled={disabled}
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setText(value === null ? '' : formatPrecise(value));
          setInvalid(false);
        }
      }}
      className={`field tabular text-center text-base font-semibold ${invalid ? '!border-danger' : ''}`}
    />
  );
}

/** Campo numérico com limites. */
export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  disabled,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  disabled?: boolean;
  suffix?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = parseFloat(text.replace(',', '.'));
    if (!Number.isFinite(n)) return setText(String(value));
    const clamped = Math.min(max, Math.max(min, n));
    onChange(clamped);
    setText(String(clamped));
  };
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="icon-btn !size-9 border border-ink-600" aria-label={`Diminuir ${label}`} disabled={disabled || value <= min} onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}>
        <Icon name="minus" size={16} />
      </button>
      <input
        aria-label={label}
        inputMode="decimal"
        disabled={disabled}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="field tabular w-16 text-center"
      />
      <button type="button" className="icon-btn !size-9 border border-ink-600" aria-label={`Aumentar ${label}`} disabled={disabled || value >= max} onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))}>
        <Icon name="plus" size={16} />
      </button>
      {suffix && <span className="text-sm text-ink-300">{suffix}</span>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const id = useId();
  return (
    <div className="space-y-1.5" aria-labelledby={id}>
      <div id={id} className="label">
        {label}
      </div>
      {children}
      {hint && <p className="text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

export interface ToastMessage {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'success';
}

export function Toasts({ items, onDismiss }: { items: ToastMessage[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex max-w-md animate-fade-in items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl shadow-black/40 ${
            t.kind === 'error'
              ? 'border-danger/50 bg-ink-800 text-ink-100'
              : t.kind === 'success'
                ? 'border-brand-500/60 bg-ink-800 text-ink-100'
                : 'border-ink-600 bg-ink-800 text-ink-100'
          }`}
        >
          <Icon name={t.kind === 'error' ? 'alert' : t.kind === 'success' ? 'check' : 'headphones'} size={18} className={t.kind === 'error' ? 'mt-0.5 text-danger' : 'mt-0.5 text-brand-400'} />
          <span className="flex-1">{t.text}</span>
          <button className="text-ink-300 hover:text-ink-100" onClick={() => onDismiss(t.id)} aria-label="Fechar aviso">
            <Icon name="x" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
