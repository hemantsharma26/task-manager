import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { NOTE_FONTS, NOTE_HIGHLIGHTS, NOTE_SIZES, NOTE_TEXT_COLORS, safeNoteHtml } from '../lib/notes';

interface Props {
  /** The note as HTML. */
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  label: string;
  minHeight?: number;
}

const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

function Btn({ label, active, onClick, children, disabled }: { label: string; active?: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      className={`tb-btn ${active ? 'is-on' : ''}`}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the text selection: clicking a toolbar button must not steal focus from the note.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * The notepad of a task: a small word processor (headings, bold, italic, underline, strike, lists, quotes, code, links, text and
 * highlight colours, fonts, sizes, alignment). It produces HTML, which the server cleans again before storing.
 */
export function NoteEditor({ value, onChange, onBlur, placeholder = 'Write your notes here…', label, minHeight = 160 }: Props) {
  const lastEmitted = useRef(value);
  const [palette, setPalette] = useState<'color' | 'highlight' | 'link' | null>(null);
  const [link, setLink] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' } } }),
      TextStyleKit.configure({ backgroundColor: false, lineHeight: false }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    content: safeNoteHtml(value),
    editorProps: { attributes: { class: 'note-content', role: 'textbox', 'aria-multiline': 'true', 'aria-label': label } },
    onUpdate: ({ editor: ed }) => {
      const html = ed.isEmpty ? '' : ed.getHTML();
      lastEmitted.current = html;
      onChange(html);
    },
    onBlur: () => onBlur?.(),
  });

  // A note that changes from outside (another task opened, a refetch) is loaded, but never while the user is typing in it.
  useEffect(() => {
    if (!editor || editor.isFocused || value === lastEmitted.current) return;
    lastEmitted.current = value;
    editor.commands.setContent(safeNoteHtml(value), { emitUpdate: false });
  }, [editor, value]);

  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed && {
        bold: ed.isActive('bold'),
        italic: ed.isActive('italic'),
        underline: ed.isActive('underline'),
        strike: ed.isActive('strike'),
        bullet: ed.isActive('bulletList'),
        ordered: ed.isActive('orderedList'),
        quote: ed.isActive('blockquote'),
        code: ed.isActive('codeBlock'),
        link: ed.isActive('link'),
        heading: ([1, 2, 3] as const).find((l) => ed.isActive('heading', { level: l })) ?? 0,
        font: (ed.getAttributes('textStyle').fontFamily as string | undefined) ?? '',
        size: (ed.getAttributes('textStyle').fontSize as string | undefined) ?? '',
        align: (['left', 'center', 'right', 'justify'] as const).find((a) => ed.isActive({ textAlign: a })) ?? 'left',
        canUndo: ed.can().undo(),
        canRedo: ed.can().redo(),
      },
  });

  if (!editor || !state) return <div className="note note-paper" style={{ minHeight }} aria-busy="true" />;
  const run = (fn: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => fn(editor.chain().focus()).run();

  const applyLink = () => {
    const url = link.trim();
    if (!url) run((c) => c.unsetLink());
    else if (SAFE_LINK.test(url)) run((c) => c.extendMarkRange('link').setLink({ href: url }));
    else if (/^[\w.-]+\.[a-z]{2,}/i.test(url)) run((c) => c.extendMarkRange('link').setLink({ href: `https://${url}` }));
    else return;
    setPalette(null);
    setLink('');
  };

  return (
    <div className="note">
      <div className="note-toolbar" role="toolbar" aria-label={`${label} formatting`}>
        <select className="tb-select" aria-label="Text style" value={state.heading} onChange={(e) => run((c) => (Number(e.target.value) ? c.setHeading({ level: Number(e.target.value) as 1 | 2 | 3 }) : c.setParagraph()))}>
          <option value={0}>Normal</option>
          <option value={1}>Heading 1</option>
          <option value={2}>Heading 2</option>
          <option value={3}>Heading 3</option>
        </select>
        <select className="tb-select" aria-label="Font" value={state.font} onChange={(e) => run((c) => (e.target.value ? c.setFontFamily(e.target.value) : c.unsetFontFamily()))}>
          <option value="">Font</option>
          {NOTE_FONTS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select className="tb-select tb-narrow" aria-label="Font size" value={state.size} onChange={(e) => run((c) => (e.target.value ? c.setFontSize(e.target.value) : c.unsetFontSize()))}>
          <option value="">Size</option>
          {NOTE_SIZES.map((s) => (
            <option key={s} value={s}>
              {s.replace('px', '')}
            </option>
          ))}
        </select>
        <span className="tb-sep" />
        <Btn label="Bold" active={state.bold} onClick={() => run((c) => c.toggleBold())}><b>B</b></Btn>
        <Btn label="Italic" active={state.italic} onClick={() => run((c) => c.toggleItalic())}><i>I</i></Btn>
        <Btn label="Underline" active={state.underline} onClick={() => run((c) => c.toggleUnderline())}><u>U</u></Btn>
        <Btn label="Strikethrough" active={state.strike} onClick={() => run((c) => c.toggleStrike())}><s>S</s></Btn>
        <span className="tb-sep" />
        <Btn label="Text colour" active={palette === 'color'} onClick={() => setPalette(palette === 'color' ? null : 'color')}><span className="tb-a" style={{ borderBottomColor: (editor.getAttributes('textStyle').color as string | undefined) ?? '#172b4d' }}>A</span></Btn>
        <Btn label="Highlight" active={palette === 'highlight'} onClick={() => setPalette(palette === 'highlight' ? null : 'highlight')}><span className="tb-hl">ab</span></Btn>
        <span className="tb-sep" />
        <Btn label="Bulleted list" active={state.bullet} onClick={() => run((c) => c.toggleBulletList())}>•≡</Btn>
        <Btn label="Numbered list" active={state.ordered} onClick={() => run((c) => c.toggleOrderedList())}>1.</Btn>
        <Btn label="Quote" active={state.quote} onClick={() => run((c) => c.toggleBlockquote())}>❝</Btn>
        <Btn label="Code block" active={state.code} onClick={() => run((c) => c.toggleCodeBlock())}>{'</>'}</Btn>
        <Btn label="Link" active={state.link || palette === 'link'} onClick={() => { setLink((editor.getAttributes('link').href as string | undefined) ?? ''); setPalette(palette === 'link' ? null : 'link'); }}>🔗</Btn>
        <span className="tb-sep" />
        <Btn label="Align left" active={state.align === 'left'} onClick={() => run((c) => c.setTextAlign('left'))}>⇤</Btn>
        <Btn label="Align centre" active={state.align === 'center'} onClick={() => run((c) => c.setTextAlign('center'))}>↔</Btn>
        <Btn label="Align right" active={state.align === 'right'} onClick={() => run((c) => c.setTextAlign('right'))}>⇥</Btn>
        <span className="tb-sep" />
        <Btn label="Undo" disabled={!state.canUndo} onClick={() => run((c) => c.undo())}>↶</Btn>
        <Btn label="Redo" disabled={!state.canRedo} onClick={() => run((c) => c.redo())}>↷</Btn>
        <Btn label="Clear formatting" onClick={() => run((c) => c.unsetAllMarks().clearNodes())}>Tx</Btn>
      </div>

      {palette === 'color' && (
        <div className="tb-pop" role="group" aria-label="Text colour">
          {NOTE_TEXT_COLORS.map((c) => (
            <button key={c} type="button" className="swatch" style={{ background: c }} aria-label={`Text colour ${c}`} onMouseDown={(e) => e.preventDefault()} onClick={() => { run((ch) => ch.setColor(c)); setPalette(null); }} />
          ))}
          <button type="button" className="chip" onMouseDown={(e) => e.preventDefault()} onClick={() => { run((c) => c.unsetColor()); setPalette(null); }}>Default</button>
        </div>
      )}
      {palette === 'highlight' && (
        <div className="tb-pop" role="group" aria-label="Highlight colour">
          {NOTE_HIGHLIGHTS.map((c) => (
            <button key={c} type="button" className="swatch" style={{ background: c, borderColor: '#b3b9c4' }} aria-label={`Highlight ${c}`} onMouseDown={(e) => e.preventDefault()} onClick={() => { run((ch) => ch.setHighlight({ color: c })); setPalette(null); }} />
          ))}
          <button type="button" className="chip" onMouseDown={(e) => e.preventDefault()} onClick={() => { run((c) => c.unsetHighlight()); setPalette(null); }}>None</button>
        </div>
      )}
      {palette === 'link' && (
        <form className="tb-pop" onSubmit={(e) => { e.preventDefault(); applyLink(); }}>
          <input aria-label="Link address" placeholder="https://example.com" value={link} onChange={(e) => setLink(e.target.value)} autoFocus />
          <button type="submit" className="btn btn-primary btn-sm">{link.trim() ? 'Apply' : 'Remove link'}</button>
        </form>
      )}

      <div className="note-paper" style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

/** A saved note, shown as the paper it was written on. Cleaned once more on the way to the screen. */
export function NoteView({ html, onClick }: { html: string; onClick?: () => void }) {
  return <div className={`note-paper note-view ${onClick ? 'is-clickable' : ''}`} onClick={onClick} dangerouslySetInnerHTML={{ __html: safeNoteHtml(html) }} />;
}
