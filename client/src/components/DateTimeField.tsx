import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { addDays, addMonths, formatLongDate, formatMonthTitle, monthGrid, monthOf, nextMonday, parseDate, WEEKDAYS_MON_FIRST } from '../lib/calendar';
import { addMinutes, durationMinutes, formatDuration, formatTime, formatTimeRange, todayLocal } from '../lib/dates';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, CloseIcon } from './Icons';

export interface DateTime {
  date: string | null;
  /** Start of the window (HH:MM), or null when there is only a deadline time. */
  startTime: string | null;
  /** End of the window, i.e. the time the task is due by. The task turns red after it. */
  time: string | null;
}

interface Props {
  value: DateTime;
  onChange: (next: DateTime) => void;
  label: string;
  /** Which edge of the field the pop-up lines up with (use "right" next to the window edge). */
  align?: 'left' | 'right';
}

const TIME_PRESETS = ['09:00', '12:00', '17:00', '18:00'] as const;
const DEFAULT_END = '17:00';
const DURATIONS = [
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '4 hours', minutes: 240 },
] as const;

function summary(value: DateTime, today: string) {
  if (!value.date) return null;
  const { y, m, d } = parseDate(value.date);
  const day = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', ...(value.date.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }) }).format(new Date(y, m - 1, d));
  return value.time ? `${day}, ${formatTimeRange(value.startTime, value.time)}` : day;
}

/**
 * Due date and time in one field. Opens a calendar (Monday first) with quick picks, month navigation, a time row with
 * presets, and full keyboard support: arrows move by day and week, Page Up / Page Down by month, Enter picks, Escape closes.
 */
export function DateTimeField({ value, onChange, label, align = 'left' }: Props) {
  const today = todayLocal();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  // The day the keyboard is on. It decides which month is shown.
  const [focusDay, setFocusDay] = useState(value.date ?? today);
  const [wantFocus, setWantFocus] = useState(false);
  const [timeError, setTimeError] = useState('');
  const pop = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // The pop-up is positioned against the window (not inside its dialog), so a dialog's edges can never clip it. It sits
  // below the field when there is room, otherwise it is moved up, and it is always kept fully on screen.
  useLayoutEffect(() => {
    if (!open) return setPos(null);
    const place = () => {
      const field = trigger.current?.getBoundingClientRect();
      const box = pop.current;
      if (!field || !box) return;
      const margin = 8;
      const left = align === 'right' ? field.right - box.offsetWidth : field.left;
      const below = field.bottom + 6;
      const top = below + box.offsetHeight + margin > window.innerHeight ? Math.max(margin, window.innerHeight - box.offsetHeight - margin) : below;
      setPos({ top, left: Math.min(Math.max(margin, left), window.innerWidth - box.offsetWidth - margin) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align, value.time, focusDay]);

  const { y, m } = parseDate(focusDay);
  const days = useMemo(() => monthGrid(y, m), [y, m]);

  useEffect(() => {
    if (open) {
      setFocusDay(value.date ?? today);
      setWantFocus(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Move real focus to the day the keyboard is on (after the grid has re-rendered).
  useEffect(() => {
    if (!open || !wantFocus) return;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus();
    setWantFocus(false);
  }, [open, wantFocus, focusDay]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) {
        setOpen(false);
        if (e instanceof KeyboardEvent) trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close as (e: globalThis.KeyboardEvent) => void);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close as (e: globalThis.KeyboardEvent) => void);
    };
  }, [open]);

  const pick = (date: string) => onChange({ date, startTime: value.startTime, time: value.time });

  // The window must always be valid: moving the start past the end drags the end along, and an end before the start is refused.
  const changeStart = (start: string) => {
    if (!value.time) return;
    const end = start >= value.time ? addMinutes(start, 60) : value.time;
    if (end <= start) return setTimeError('There is no room for an end time after that start');
    setTimeError('');
    onChange({ date: value.date, startTime: start, time: end });
  };
  const changeEnd = (end: string) => {
    if (value.startTime && end <= value.startTime) return setTimeError('The end time must be after the start time');
    setTimeError('');
    onChange({ date: value.date, startTime: value.startTime, time: end });
  };
  const move = (to: string) => {
    setFocusDay(to);
    setWantFocus(true);
  };

  const onGridKey = (e: KeyboardEvent) => {
    const step: Record<string, string> = {
      ArrowLeft: addDays(focusDay, -1),
      ArrowRight: addDays(focusDay, 1),
      ArrowUp: addDays(focusDay, -7),
      ArrowDown: addDays(focusDay, 7),
      PageUp: addMonths(focusDay, -1),
      PageDown: addMonths(focusDay, 1),
      Home: addDays(focusDay, -((new Date(`${focusDay}T00:00:00Z`).getUTCDay() + 6) % 7)),
      End: addDays(focusDay, 6 - ((new Date(`${focusDay}T00:00:00Z`).getUTCDay() + 6) % 7)),
    };
    const to = step[e.key];
    if (to) {
      e.preventDefault();
      move(to);
    }
  };

  const text = summary(value, today);
  const quick: { label: string; date: string }[] = [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: addDays(today, 1) },
    { label: 'Next Monday', date: nextMonday(today) },
    { label: 'In a week', date: addDays(today, 7) },
  ];

  return (
    <div className="datefield" ref={root}>
      <div className="datefield-bar">
        <button ref={trigger} type="button" className={`datefield-trigger ${text ? '' : 'is-empty'}`} aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}: ${text ?? 'not set'}`} onClick={() => setOpen((o) => !o)}>
          <CalendarIcon />
          <span>{text ?? 'Set due date'}</span>
        </button>
        {value.date && (
          <button type="button" className="icon-btn datefield-clear" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => onChange({ date: null, startTime: null, time: null })}>
            <CloseIcon size={14} />
          </button>
        )}
      </div>

      {open && (
        <div ref={pop} className="datepop" style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }} role="dialog" aria-label={`Choose ${label.toLowerCase()}`}>
          <div className="quick-dates">
            {quick.map((q) => (
              <button key={q.label} type="button" className={`chip ${value.date === q.date ? 'is-on' : ''}`} onClick={() => { pick(q.date); setFocusDay(q.date); }}>
                {q.label}
              </button>
            ))}
          </div>

          <div className="cal-head">
            <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => setFocusDay(addMonths(focusDay, -1))}>
              <ChevronLeftIcon />
            </button>
            <strong aria-live="polite">{formatMonthTitle(focusDay)}</strong>
            <button type="button" className="icon-btn" aria-label="Next month" onClick={() => setFocusDay(addMonths(focusDay, 1))}>
              <ChevronRightIcon />
            </button>
          </div>

          <div ref={grid} className="cal-grid" role="grid" aria-label={formatMonthTitle(focusDay)} onKeyDown={onGridKey}>
            <div className="cal-row" role="row">
              {WEEKDAYS_MON_FIRST.map((w) => (
                <span key={w} role="columnheader" className="cal-dow">
                  {w}
                </span>
              ))}
            </div>
            {Array.from({ length: 6 }, (_, week) => (
              <div key={week} className="cal-row" role="row">
                {days.slice(week * 7, week * 7 + 7).map((d) => {
                  const selected = d === value.date;
                  const other = monthOf(d) !== monthOf(focusDay);
                  return (
                    <button
                      key={d}
                      type="button"
                      role="gridcell"
                      data-day={d}
                      tabIndex={d === focusDay ? 0 : -1}
                      aria-label={formatLongDate(d)}
                      aria-selected={selected}
                      aria-current={d === today ? 'date' : undefined}
                      className={`cal-day ${selected ? 'is-selected' : ''} ${d === today ? 'is-today' : ''} ${other ? 'is-other' : ''} ${d < today ? 'is-past' : ''}`}
                      onClick={() => {
                        pick(d);
                        setFocusDay(d);
                      }}
                    >
                      {parseDate(d).d}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="time-row">
            <label className="check" htmlFor={`${id}-time-on`}>
              <input id={`${id}-time-on`} type="checkbox" checked={value.time !== null} disabled={!value.date} onChange={(e) => { setTimeError(''); onChange({ date: value.date, startTime: null, time: e.target.checked ? DEFAULT_END : null }); }} />
              <ClockIcon />
              <span>Add a time</span>
            </label>

            {value.time !== null && (
              <div className="window">
                <label className="check">
                  <input type="checkbox" checked={value.startTime !== null} onChange={(e) => { setTimeError(''); onChange({ date: value.date, startTime: e.target.checked ? addMinutes(value.time!, -60) : null, time: value.time }); }} />
                  <span>It has a start time too (a time window)</span>
                </label>

                <div className="window-inputs">
                  {value.startTime !== null && (
                    <label>
                      <span>From</span>
                      <input type="time" className="time-input" aria-label="Start time" value={value.startTime} onChange={(e) => e.target.value && changeStart(e.target.value)} />
                    </label>
                  )}
                  <label>
                    <span>{value.startTime !== null ? 'Until' : 'Due by'}</span>
                    <input type="time" className="time-input" aria-label="End time" value={value.time} onChange={(e) => e.target.value && changeEnd(e.target.value)} />
                  </label>
                </div>

                {timeError && (
                  <small className="field-error" role="alert">
                    {timeError}
                  </small>
                )}

                {value.startTime !== null ? (
                  <>
                    <p className="muted duration">
                      Takes <strong>{formatDuration(durationMinutes(value.startTime, value.time))}</strong>. It turns red if it is not done by {formatTime(value.time)}.
                    </p>
                    <div className="quick-dates" role="group" aria-label="Length">
                      {DURATIONS.map((d) => (
                        <button key={d.label} type="button" className={`chip ${durationMinutes(value.startTime!, value.time!) === d.minutes ? 'is-on' : ''}`} onClick={() => { setTimeError(''); onChange({ date: value.date, startTime: value.startTime, time: addMinutes(value.startTime!, d.minutes) }); }}>
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="quick-dates" role="group" aria-label="Due by">
                    {TIME_PRESETS.map((t) => (
                      <button key={t} type="button" className={`chip ${value.time === t ? 'is-on' : ''}`} onClick={() => changeEnd(t)}>
                        {formatTime(t)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pop-actions">
            <button type="button" className="btn btn-subtle btn-sm" onClick={() => { onChange({ date: null, startTime: null, time: null }); setOpen(false); }}>
              Clear
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => { setOpen(false); trigger.current?.focus(); }}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

