import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from 'react';
import { ACCEPT, formatSize, kindOf, MAX_FILES_PER_TASK, sortFiles } from '../lib/files';
import { CloseIcon, FileIcon, PlayIcon, UploadIcon } from './Icons';

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  /** How many attachments the task already has, so the 20-file limit counts them. */
  already?: number;
  label?: string;
}

/** Choose or drop images, videos and PDFs. Wrong or oversized files are explained straight away; nothing is uploaded here. */
export function FilePicker({ files, onChange, already = 0, label = 'Attach images, videos or PDFs' }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const previews = useMemo(() => files.map((f) => (kindOf(f) === 'image' ? URL.createObjectURL(f) : null)), [files]);
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);

  const add = (incoming: File[]) => {
    const { accepted, problems: found } = sortFiles(incoming, already + files.length, MAX_FILES_PER_TASK);
    setProblems(found);
    if (accepted.length) onChange([...files, ...accepted]);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    add([...e.dataTransfer.files]);
  };

  return (
    <div className="filepicker">
      <label
        htmlFor={id}
        className={`dropzone ${over ? 'is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <UploadIcon />
        <span>
          <strong>{label}</strong>
          <small className="muted">Drop files here or click to choose. Images up to 10 MB, PDFs 25 MB, videos 100 MB.</small>
        </span>
      </label>
      <input
        ref={input}
        id={id}
        type="file"
        className="sr-only"
        accept={ACCEPT}
        multiple
        onChange={(e) => {
          add([...(e.target.files ?? [])]);
          e.target.value = ''; // so choosing the same file again still fires
        }}
      />

      {problems.length > 0 && (
        <ul className="file-problems" role="alert">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="file-list">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`}>
              <span className="file-thumb">{previews[i] ? <img src={previews[i]!} alt="" /> : kindOf(f) === 'video' ? <PlayIcon /> : <FileIcon />}</span>
              <span className="file-name" title={f.name}>
                {f.name}
              </span>
              <span className="muted file-size">{formatSize(f.size)}</span>
              <button type="button" className="icon-btn" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))}>
                <CloseIcon size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
