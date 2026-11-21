import sanitizeHtml from 'sanitize-html';
import { RICH_TEXT } from '../../constants/index.js';
import { escapeHtml } from './text.js';

const HEX = /^#[0-9a-fA-F]{3,8}$/;
const RGB = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/;
const COLOR = [HEX, RGB];
const FONT_FAMILY = RICH_TEXT.FONT_FAMILIES.map((f) => new RegExp(`^${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));

/** A font size is only kept if it is a whole number of pixels within the range the editor offers. */
const FONT_SIZE = /^(\d{2})px$/;
const sizeOk = (value: string) => {
  const m = FONT_SIZE.exec(value);
  return !!m && Number(m[1]) >= RICH_TEXT.FONT_SIZE_MIN_PX && Number(m[1]) <= RICH_TEXT.FONT_SIZE_MAX_PX;
};

const options: sanitizeHtml.IOptions = {
  allowedTags: [...RICH_TEXT.ALLOWED_TAGS],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    span: ['style'],
    mark: ['style', 'data-color'],
    p: ['style'],
    h1: ['style'],
    h2: ['style'],
    h3: ['style'],
    li: ['data-checked', 'data-type'],
    ul: ['data-type'],
    input: ['type', 'checked', 'disabled'],
    label: [],
    div: [],
  },
  allowedSchemes: [...RICH_TEXT.ALLOWED_SCHEMES],
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  allowedStyles: {
    '*': {
      color: COLOR,
      'background-color': COLOR,
      'font-family': FONT_FAMILY,
      // Pixel sizes only here; the allowed range is enforced right after (dropBadFontSizes).
      'font-size': [/^\d{2}px$/],
      'text-align': [new RegExp(`^(${RICH_TEXT.TEXT_ALIGN.join('|')})$`)],
    },
  },
  // Checklist boxes: only a disabled checkbox is allowed, never a live form control.
  exclusiveFilter: (frame) => frame.tag === 'input' && frame.attribs.type !== 'checkbox',
  transformTags: {
    a: (_tag, attribs) => ({ tagName: 'a', attribs: { href: attribs.href ?? '', target: '_blank', rel: RICH_TEXT.LINK_REL } }),
    input: (_tag, attribs) => ({ tagName: 'input', attribs: { type: 'checkbox', disabled: 'disabled', ...(attribs.checked !== undefined ? { checked: 'checked' } : {}) } }),
  },
  // font-size is checked separately because sanitize-html compares styles as patterns only.
  parser: { lowerCaseTags: true },
};

/** Style values with a font-size that is out of range are removed after the main pass. */
function dropBadFontSizes(html: string) {
  return html.replace(/font-size:\s*([^;"]+);?/gi, (m, value: string) => (sizeOk(value.trim()) ? m : ''));
}

export const looksLikeHtml = (s: string) => /<[a-z][\s\S]*>/i.test(s);

/** Plain text (older notes, or API users) becomes paragraphs, with everything escaped. */
export const plainToHtml = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m);

/** Visible text of an HTML note, for searching and previews: block ends become spaces, tags disappear. */
export function htmlToText(html: string): string {
  const spaced = html.replace(/<\/(p|li|h[1-3]|blockquote|pre|div)>|<br\s*\/?>/gi, ' ');
  return decode(sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} })).replace(/\s+/g, ' ').trim();
}

export interface CleanNote {
  html: string;
  text: string;
}

/** The only way note HTML gets into the database: always run through here. */
export function cleanNote(input: string): CleanNote {
  if (input.trim() === '') return { html: '', text: '' };
  const source = looksLikeHtml(input) ? input : plainToHtml(input);
  const html = dropBadFontSizes(sanitizeHtml(source, options)).trim();
  return { html, text: htmlToText(html) };
}
