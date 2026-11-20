import { isHex, mix, PALETTE, readableOn } from './color';
import { toneFor, toneFromColor } from './tone';

describe('colour helpers', () => {
  it('accepts only #rrggbb', () => {
    expect(isHex('#0c66e4')).toBe(true);
    expect(isHex('#0C66E4')).toBe(true);
    for (const bad of ['0c66e4', '#0c66e', '#0c66e44', 'red', 'javascript:alert(1)', '#gggggg', '']) expect(isHex(bad)).toBe(false);
  });

  it('mixes towards white and black', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#ff0000', '#ffffff', 0)).toBe('#ff0000');
    expect(mix('#ff0000', '#000000', 1)).toBe('#000000');
  });

  it('picks readable text for light and dark colours', () => {
    expect(readableOn('#ffffff')).toBe('#172b4d');
    expect(readableOn('#fce4a6')).toBe('#172b4d');
    expect(readableOn('#0c66e4')).toBe('#ffffff');
    expect(readableOn('#000000')).toBe('#ffffff');
  });

  it('has a palette of valid colours without duplicates', () => {
    expect(PALETTE.every(isHex)).toBe(true);
    expect(new Set(PALETTE).size).toBe(PALETTE.length);
  });
});

describe('tones', () => {
  it('derives a pale background, a deep text colour and an accent from one chosen colour', () => {
    const t = toneFromColor('#0c66e4');
    expect(t.accent).toBe('#0c66e4');
    expect(t.bg).not.toBe(t.fg);
    expect(readableOn(t.bg)).toBe('#172b4d'); // dark text on the pale tint
  });

  it('lets a colour the user picked win over the built-in look', () => {
    expect(toneFor('todo', false, '#ff00aa').accent).toBe('#ff00aa');
    expect(toneFor('todo', false, null).accent).toBeUndefined();
    expect(toneFor('issue', false, null).accent).toBe('#e2483d');
  });
});
