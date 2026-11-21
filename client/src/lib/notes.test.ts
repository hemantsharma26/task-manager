import { isEmptyNote, NOTE_FONTS, NOTE_SIZES, safeNoteHtml } from './notes';

describe('note rendering', () => {
  it('keeps formatting', () => {
    const html = '<h2>Title</h2><p>Some <strong>bold</strong> and <span style="color:#c9372c">red</span></p><ul><li>a</li></ul>';
    expect(safeNoteHtml(html)).toBe(html);
  });

  it.each([
    '<p>x</p><script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<p onclick="alert(1)">x</p>',
    '<a href="javascript:alert(1)">x</a>',
    '<iframe src="https://evil.example"></iframe>',
    '<svg onload=alert(1)></svg>',
    '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
  ])('strips %s', (html) => {
    expect(safeNoteHtml(html)).not.toMatch(/<script|onerror|onclick|javascript:|<iframe|<svg|data:text/i);
  });

  it('makes links open in a new tab without handing over the opener', () => {
    const out = safeNoteHtml('<a href="https://example.com">x</a>');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('noopener');
  });

  it('turns any input into a disabled checkbox', () => {
    const out = safeNoteHtml('<input type="text" value="x">');
    expect(out).toContain('type="checkbox"');
    expect(out).toContain('disabled');
  });

  it('knows an empty note', () => {
    expect(isEmptyNote('')).toBe(true);
    expect(isEmptyNote('<p></p>')).toBe(true);
    expect(isEmptyNote('<p> </p>')).toBe(true);
    expect(isEmptyNote('<p>hi</p>')).toBe(false);
    expect(isEmptyNote('<hr>')).toBe(false);
  });

  it('offers fonts and sizes the server accepts', () => {
    expect(NOTE_FONTS.every((f) => !/[;<>]/.test(f.value))).toBe(true);
    expect(NOTE_SIZES.every((s) => /^\d{2}px$/.test(s) && Number.parseInt(s, 10) >= 10 && Number.parseInt(s, 10) <= 48)).toBe(true);
  });
});
