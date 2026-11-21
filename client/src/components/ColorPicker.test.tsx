import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorPicker } from './ColorPicker';

describe('ColorPicker', () => {
  it('picks a ready-made colour and marks it as chosen', async () => {
    const onChange = vi.fn();
    render(<ColorPicker label="Priority colour" value="#0c66e4" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Colour #0c66e4' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Colour #c9372c' }));
    expect(onChange).toHaveBeenCalledWith('#c9372c');
  });

  it('accepts a typed colour code (with or without #, any case) and rejects nonsense', async () => {
    const onChange = vi.fn();
    render(<ColorPicker label="c" value="#0c66e4" onChange={onChange} />);
    const input = screen.getByLabelText('Colour code');
    await userEvent.clear(input);
    await userEvent.type(input, 'FF00AA{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('#ff00aa');

    await userEvent.clear(input);
    await userEvent.type(input, 'blue{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent(/colour code/i);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('can offer "default" for things that have a built-in look, and clearing the box chooses it', async () => {
    const onChange = vi.fn();
    render(<ColorPicker label="c" value="#0c66e4" allowDefault onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Default colour' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    const input = screen.getByLabelText('Colour code');
    await userEvent.clear(input);
    await userEvent.tab();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('never offers "default" when a colour is required', () => {
    render(<ColorPicker label="c" value="#0c66e4" onChange={() => {}} />);
    expect(screen.queryByRole('radio', { name: 'Default colour' })).not.toBeInTheDocument();
  });
});
