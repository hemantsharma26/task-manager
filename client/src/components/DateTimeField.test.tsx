import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { DateTimeField, type DateTime } from './DateTimeField';

// "Today" is fixed so the calendar looks the same on every machine: Friday 20 November 2026.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 20, 10, 0));
});
afterEach(() => vi.useRealTimers());

function Harness({ initial = { date: null, time: null } as DateTime, onChange = vi.fn() }) {
  const [value, setValue] = useState(initial);
  return <DateTimeField label="Due date" value={value} onChange={(v) => { setValue(v); onChange(v); }} />;
}

const open = async () => userEvent.click(screen.getByRole('button', { name: /due date: /i }));

describe('DateTimeField', () => {
  it('says when nothing is set, and opens a calendar on the current month', async () => {
    render(<Harness />);
    expect(screen.getByText('Set due date')).toBeInTheDocument();
    await open();
    expect(screen.getByText('November 2026')).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: 'Friday, 20 November 2026' })).toHaveAttribute('aria-current', 'date');
  });

  it('picks a day and shows it on the button', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await open();
    await userEvent.click(screen.getByRole('gridcell', { name: 'Tuesday, 24 November 2026' }));
    expect(onChange).toHaveBeenLastCalledWith({ date: '2026-11-24', time: null });
    expect(screen.getByRole('button', { name: /due date: Tue, 24 Nov/i })).toBeInTheDocument();
  });

  it('moves between months, including across a year end', async () => {
    render(<Harness />);
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('January 2027')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('December 2026')).toBeInTheDocument();
  });

  it('offers quick picks that are correct for today (Friday 20 Nov 2026)', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await open();
    for (const [label, date] of [['Today', '2026-11-20'], ['Tomorrow', '2026-11-21'], ['Next Monday', '2026-11-23'], ['In a week', '2026-11-27']] as const) {
      await userEvent.click(screen.getByRole('button', { name: label }));
      expect(onChange).toHaveBeenLastCalledWith({ date, time: null });
    }
  });

  it('adds a time with a default, presets and a manual entry, and keeps it when the day changes', async () => {
    const onChange = vi.fn();
    render(<Harness initial={{ date: '2026-11-24', time: null }} onChange={onChange} />);
    await open();
    await userEvent.click(screen.getByRole('checkbox', { name: /add a time/i }));
    expect(onChange).toHaveBeenLastCalledWith({ date: '2026-11-24', time: '09:00' });
    await userEvent.click(screen.getByRole('button', { name: '5:00 PM' }));
    expect(onChange).toHaveBeenLastCalledWith({ date: '2026-11-24', time: '17:00' });
    await userEvent.click(screen.getByRole('gridcell', { name: 'Wednesday, 25 November 2026' }));
    expect(onChange).toHaveBeenLastCalledWith({ date: '2026-11-25', time: '17:00' });
    expect(screen.getByRole('button', { name: /due date: Wed, 25 Nov, 5:00 PM/i })).toBeInTheDocument();
  });

  it('cannot add a time before a date is chosen, and removing the time keeps the date', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await open();
    expect(screen.getByRole('checkbox', { name: /add a time/i })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Tomorrow' }));
    await userEvent.click(screen.getByRole('checkbox', { name: /add a time/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /add a time/i }));
    expect(onChange).toHaveBeenLastCalledWith({ date: '2026-11-21', time: null });
  });

  it('clears both date and time', async () => {
    const onChange = vi.fn();
    render(<Harness initial={{ date: '2026-11-24', time: '17:00' }} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /clear due date/i }));
    expect(onChange).toHaveBeenLastCalledWith({ date: null, time: null });
    expect(screen.getByText('Set due date')).toBeInTheDocument();
  });

  it('supports the keyboard: arrows move by day and week, Page Down by month, Enter picks, Escape closes', async () => {
    const onChange = vi.fn();
    render(<Harness initial={{ date: '2026-11-20', time: null }} onChange={onChange} />);
    await open();
    const day = (name: string) => screen.getByRole('gridcell', { name });
    expect(day('Friday, 20 November 2026')).toHaveFocus();

    await userEvent.keyboard('{ArrowRight}');
    expect(day('Saturday, 21 November 2026')).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(day('Saturday, 28 November 2026')).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}{ArrowUp}');
    expect(day('Friday, 20 November 2026')).toHaveFocus();
    await userEvent.keyboard('{PageDown}');
    expect(screen.getByText('December 2026')).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith({ date: '2026-12-20', time: null });

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('marks the selected day for assistive technology and shows a full six-week grid', async () => {
    render(<Harness initial={{ date: '2026-11-24', time: null }} />);
    await open();
    const grid = screen.getByRole('grid');
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(42);
    expect(screen.getByRole('gridcell', { name: 'Tuesday, 24 November 2026' })).toHaveAttribute('aria-selected', 'true');
    act(() => {});
  });
});
