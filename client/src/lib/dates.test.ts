import { daysBetween, describeDue, isOverdue, todayLocal } from './dates';

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
