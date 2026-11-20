import { daysBetween, describeDue, formatTime, isOverdue, nowTimeLocal, todayLocal } from './dates';

describe('todayLocal', () => {
  it('uses the local calendar date, zero-padded', () => {
    expect(todayLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(todayLocal(new Date(2026, 10, 20, 0, 1))).toBe('2026-11-20');
  });
});

describe('daysBetween', () => {
  it('counts whole days across month and year ends', () => {
    expect(daysBetween('2026-11-20', '2026-11-23')).toBe(3);
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
    expect(daysBetween('2026-11-20', '2026-11-18')).toBe(-2);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });
});

describe('isOverdue', () => {
  it('is only true for unfinished tasks whose date has passed', () => {
    expect(isOverdue('2026-11-19', false, '2026-11-20')).toBe(true);
    expect(isOverdue('2026-11-20', false, '2026-11-20')).toBe(false);
    expect(isOverdue('2026-11-19', true, '2026-11-20')).toBe(false);
    expect(isOverdue(null, false, '2026-11-20')).toBe(false);
  });
});

describe('describeDue', () => {
  const today = '2026-11-20';
  it('uses friendly wording near today', () => {
    expect(describeDue('2026-11-20', false, today)).toBe('Due today');
    expect(describeDue('2026-11-21', false, today)).toBe('Due tomorrow');
    expect(describeDue('2026-11-19', false, today)).toBe('Overdue by 1 day');
    expect(describeDue('2026-11-17', false, today)).toBe('Overdue by 3 days');
  });
  it('does not call finished tasks overdue', () => {
    expect(describeDue('2026-11-10', true, today)).toMatch(/^Was due /);
  });
});

describe('time of day', () => {
  it('formats 24 hour times the way people say them', () => {
    expect(formatTime('00:00')).toBe('12:00 AM');
    expect(formatTime('09:05')).toBe('9:05 AM');
    expect(formatTime('12:00')).toBe('12:00 PM');
    expect(formatTime('17:30')).toBe('5:30 PM');
    expect(formatTime('23:59')).toBe('11:59 PM');
  });

  it('reads the current local time as HH:MM', () => {
    expect(nowTimeLocal(new Date(2026, 10, 20, 7, 5))).toBe('07:05');
    expect(nowTimeLocal(new Date(2026, 10, 20, 23, 59))).toBe('23:59');
  });

  it('calls a task overdue once its time has passed today, and not before', () => {
    expect(isOverdue('2026-11-20', false, '2026-11-20', '09:00', '09:01')).toBe(true);
    expect(isOverdue('2026-11-20', false, '2026-11-20', '09:00', '09:00')).toBe(false);
    expect(isOverdue('2026-11-20', false, '2026-11-20', '09:00', '08:00')).toBe(false);
    expect(isOverdue('2026-11-20', false, '2026-11-20', null, '23:59')).toBe(false);
    expect(isOverdue('2026-11-19', false, '2026-11-20', '23:59', '00:00')).toBe(true);
    expect(isOverdue('2026-11-20', true, '2026-11-20', '01:00', '23:00')).toBe(false);
  });

  it('describes due dates with their time', () => {
    expect(describeDue('2026-11-20', false, '2026-11-20', '17:30', '09:00')).toBe('Due today, 5:30 PM');
    expect(describeDue('2026-11-20', false, '2026-11-20', '09:00', '10:00')).toBe('Overdue since 9:00 AM');
    expect(describeDue('2026-11-21', false, '2026-11-20', '08:00', '10:00')).toBe('Due tomorrow, 8:00 AM');
    expect(describeDue('2026-11-25', false, '2026-11-20', '08:00', '10:00')).toMatch(/^Due .*8:00 AM$/);
    expect(describeDue('2026-11-17', false, '2026-11-20', '08:00', '10:00')).toBe('Overdue by 3 days');
    expect(describeDue('2026-11-10', true, '2026-11-20', '08:00', '10:00')).toMatch(/^Was due .*8:00 AM$/);
  });
});
