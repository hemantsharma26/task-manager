import { addDays, addMonths, formatLongDate, formatMonthTitle, monthGrid, nextMonday, weekdayMonFirst } from './calendar';

describe('calendar arithmetic', () => {
  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2026-11-20', -20)).toBe('2026-10-31');
  });

  it('is not thrown off by daylight-saving changes', () => {
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });

  it('moves by months and clamps the day (31 Jan + 1 month = 28 Feb)', () => {
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
  });

  it('knows the weekday, Monday first', () => {
    expect(weekdayMonFirst('2026-11-20')).toBe(4); // a Friday
    expect(weekdayMonFirst('2026-11-23')).toBe(0); // a Monday
    expect(weekdayMonFirst('2026-11-22')).toBe(6); // a Sunday
  });

  it('builds a six-week grid that starts on a Monday and contains the whole month', () => {
    const grid = monthGrid(2026, 11);
    expect(grid).toHaveLength(42);
    expect(weekdayMonFirst(grid[0]!)).toBe(0);
    expect(grid).toContain('2026-11-01');
    expect(grid).toContain('2026-11-30');
    expect(grid.filter((d) => d.startsWith('2026-11'))).toHaveLength(30);
    expect(grid[0]).toBe('2026-10-26'); // 1 Nov 2026 is a Sunday, so the grid starts on the Monday before it
  });

  it('builds a correct grid for a month that starts on a Monday, and for February in a leap year', () => {
    expect(monthGrid(2026, 6)[0]).toBe('2026-06-01');
    expect(monthGrid(2028, 2).filter((d) => d.startsWith('2028-02'))).toHaveLength(29);
  });

  it('finds the next Monday strictly after a date', () => {
    expect(nextMonday('2026-11-20')).toBe('2026-11-23');
    expect(nextMonday('2026-11-23')).toBe('2026-11-30');
    expect(nextMonday('2026-11-22')).toBe('2026-11-23');
  });

  it('formats titles', () => {
    expect(formatMonthTitle('2026-11-20')).toBe('November 2026');
    expect(formatLongDate('2026-11-20')).toBe('Friday, 20 November 2026');
  });
});
