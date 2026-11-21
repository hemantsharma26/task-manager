import DOMPurify from 'dompurify';

// The fonts, sizes and colours the note editor offers. The server keeps exactly these (anything else in a note's styling is
// dropped), so this list and the server's allow-list in constants/richtext.ts must stay in step.
export const NOTE_FONTS = [
  { label: 'Default', value: 'system-ui, sans-serif' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Typewriter', value: '"Courier New", monospace' },
  { label: 'Friendly', value: '"Trebuchet MS", sans-serif' },
  { label: 'Handwritten', value: '"Comic Sans MS", cursive' },
  { label: 'Wide', value: 'Verdana, sans-serif' },
] as const;

export const NOTE_SIZES = ['12px', '14px', '16px', '20px', '24px', '32px'] as const;

export const NOTE_TEXT_COLORS = ['#172b4d', '#c9372c', '#e56910', '#cf9f02', '#22a06b', '#0c66e4', '#6e5dc6', '#ae4787', '#626f86'] as const;
export const NOTE_HIGHLIGHTS = ['#fff7d6', '#ffd5d2', '#dcfff1', '#cce0ff', '#dfd8fd', '#fdd0ec', '#ffe2bd'] as const;

const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'h1', 'h2', 'h3', 'hr', 'span', 'mark', 'a', 'label', 'input', 'div'];
const ALLOWED_ATTR = ['style', 'href', 'target', 'rel', 'type', 'checked', 'disabled', 'data-type', 'data-checked', 'data-color'];

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer nofollow');
  }
  // Only a disabled checkbox may be an input: never a live form control.
  if (node.tagName === 'INPUT') {
    node.setAttribute('type', 'checkbox');
    node.setAttribute('disabled', 'disabled');
  }
});

/**
 * The server already cleans every note before storing it. This is a second, independent clean on the way to the screen, so a
 * bug on either side cannot by itself put script in the page.
 */
export const safeNoteHtml = (html: string): string =>
  DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i, ALLOW_DATA_ATTR: false });

export const isEmptyNote = (html: string) => html.replace(/<[^>]*>/g, '').trim() === '' && !/<(hr|img|input)/i.test(html);
