// The notepad on a task is rich text (HTML). Anything a user types is cleaned on the server against this allow-list, no
// matter what the browser sent: only these tags, only these attributes, only these style properties and values survive.
export const RICH_TEXT = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'h1', 'h2', 'h3', 'hr', 'span', 'mark', 'a', 'label', 'input', 'div'],
  ALLOWED_SCHEMES: ['http', 'https', 'mailto'],
  /** Fonts a note may use. The editor offers exactly these; any other font-family is dropped. */
  FONT_FAMILIES: [
    'system-ui, sans-serif',
    'Georgia, serif',
    '"Courier New", monospace',
    '"Trebuchet MS", sans-serif',
    '"Comic Sans MS", cursive',
    'Verdana, sans-serif',
  ],
  FONT_SIZE_MIN_PX: 10,
  FONT_SIZE_MAX_PX: 48,
  TEXT_ALIGN: ['left', 'center', 'right', 'justify'],
  LINK_REL: 'noopener noreferrer nofollow',
} as const;

export const RICH_TEXT_LIMITS = { HTML_MAX: 20_000, TEXT_MAX: 5_000 } as const;
