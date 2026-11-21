import { describe, expect, it } from 'vitest';
import { cleanNote, htmlToText, plainToHtml } from '../src/shared/utils/html.js';

const clean = (html: string) => cleanNote(html).html;

describe('note sanitiser', () => {
  it('keeps the formatting the editor produces', () => {
    const html = '<h2>Plan</h2><p>Some <strong>bold</strong>, <em>italic</em>, <u>underlined</u> and <s>struck</s> text</p><ul><li>one</li></ul><ol><li>two</li></ol><blockquote>quote</blockquote><pre>code</pre>';
    expect(clean(html)).toBe(html);
  });

  it('keeps colours, highlights, alignment and the offered fonts and sizes', () => {
    const html = '<p style="text-align:center"><span style="color:#c9372c">red</span> <mark style="background-color:#fff7d6">marked</mark> <span style="font-family:Georgia, serif;font-size:24px">serif</span></p>';
    const out = clean(html);
    expect(out).toContain('color:#c9372c');
    expect(out).toContain('background-color:#fff7d6');
    expect(out).toContain('text-align:center');
    expect(out).toContain('font-family:Georgia, serif');
    expect(out).toContain('font-size:24px');
  });

  it.each([
    ['a script tag', '<p>hi</p><script>alert(1)</script>'],
    ['an inline event handler', '<p onclick="alert(1)">hi</p>'],
    ['an image with onerror', '<img src=x onerror=alert(1)>'],
    ['an svg with onload', '<svg onload=alert(1)><circle/></svg>'],
    ['an iframe', '<iframe src="https://evil.example"></iframe>'],
    ['an object / embed', '<object data="x.swf"></object><embed src="x.swf">'],
    ['a javascript: link', '<a href="javascript:alert(1)">click</a>'],
    ['an obfuscated javascript: link', '<a href="jav&#x09;ascript:alert(1)">click</a>'],
    ['a data: link', '<a href="data:text/html,<script>alert(1)</script>">click</a>'],
    ['a style tag', '<style>body{display:none}</style><p>x</p>'],
    ['a form', '<form action="https://evil.example"><input name="password"></form>'],
    ['a meta refresh', '<meta http-equiv="refresh" content="0;url=https://evil.example">'],
    ['a base tag', '<base href="https://evil.example/">'],
  ])('removes %s', (_name, html) => {
    const out = clean(html).toLowerCase();
    expect(out).not.toMatch(/<script|onerror|onload|onclick|<iframe|<object|<embed|javascript:|data:text|<style|<form|<meta|<base|<svg/);
  });

  it('drops style values that could do more than style: urls, expressions, unknown fonts, huge sizes', () => {
    const out = clean('<p style="background-image:url(https://evil.example/x);color:expression(alert(1))">a</p><span style="font-family:Impact;font-size:900px;position:fixed;color:#000">b</span>');
    expect(out).not.toMatch(/url\(|expression|Impact|900px|position/);
    expect(out).toContain('color:#000');
  });

  it('keeps only safe links, and makes them open safely', () => {
    const out = clean('<a href="https://example.com/x?y=1" onclick="x()">ok</a> <a href="mailto:a@b.co">mail</a> <a href="//evil.example">proto</a>');
    expect(out).toContain('href="https://example.com/x?y=1"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('href="mailto:a@b.co"');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('//evil.example');
  });

  it('only lets a disabled checkbox through as a form control (checklists)', () => {
    const out = clean('<ul data-type="taskList"><li data-checked="true"><label><input type="checkbox" checked></label>done</li></ul><input type="text" value="x"><input type="password">');
    expect(out).toContain('type="checkbox"');
    expect(out).toContain('disabled');
    expect(out).not.toMatch(/type="text"|type="password"/);
  });

  it('survives nested and malformed input without throwing', () => {
    expect(() => clean('<p><b><i>unclosed <p>nested</b></i>')).not.toThrow();
    expect(() => clean('<<script>script>alert(1)<</script>/script>')).not.toThrow();
    expect(clean('<<script>script>alert(1)<</script>/script>').toLowerCase()).not.toContain('<script');
    expect(() => clean('<p>' + '<b>'.repeat(5000) + 'x')).not.toThrow();
  });

  it('turns plain text into escaped paragraphs, one per line', () => {
    expect(plainToHtml('line one\nline <two>')).toBe('<p>line one</p><p>line &lt;two&gt;</p>');
    expect(clean('just text & <b>')).toContain('&amp;');
  });

  it('leaves an empty note empty (not an empty paragraph)', () => {
    expect(cleanNote('')).toEqual({ html: '', text: '' });
    expect(cleanNote('   \n ')).toEqual({ html: '', text: '' });
  });

  it('extracts the visible text for searching, with spaces between blocks', () => {
    expect(htmlToText('<p>Pay <strong>rent</strong></p><ul><li>one</li><li>two</li></ul>')).toBe('Pay rent one two');
    expect(htmlToText('<p>Fish &amp; chips &lt;3</p>')).toBe('Fish & chips <3');
    expect(cleanNote('<p style="color:#ff0000">hello</p>').text).toBe('hello');
  });
});
