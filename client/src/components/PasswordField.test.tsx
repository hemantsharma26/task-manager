import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { PasswordField } from './PasswordField';

function Harness({ rules }: { rules?: boolean }) {
  const [value, setValue] = useState('');
  return <PasswordField label="Password" value={value} onChange={setValue} autoComplete="new-password" showRules={rules} />;
}

describe('PasswordField', () => {
  it('hides the password by default and can show it', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(input).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('asks the browser and password managers to behave: no capitalising, no autocorrect, no spellcheck', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('autocomplete', 'new-password');
    expect(input).toHaveAttribute('autocapitalize', 'none');
    expect(input).toHaveAttribute('spellcheck', 'false');
  });

  it('ticks the checklist off as the password improves', async () => {
    render(<Harness rules />);
    expect(screen.getAllByText(/\(not met yet\)/)).toHaveLength(2);
    await userEvent.type(screen.getByLabelText('Password'), 'Tr1cky-Harbor!');
    expect(screen.getAllByText(/\(met\)/)).toHaveLength(2);
  });
});
