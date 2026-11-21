import { useEffect, useRef, useState } from 'react';
import { fileUrl, useDeleteAttachment, useUploadFiles } from '../api/attachments';
import { ApiError } from '../api/http';
import type { Attachment, Task } from '../api/types';
import { formatSize, MAX_FILES_PER_TASK } from '../lib/files';
import { FilePicker } from './FilePicker';
import { CloseIcon, FileIcon, TrashIcon } from './Icons';
import { useToast } from './Toast';

/** What is attached to a task: images (click to enlarge), videos (play right here), PDFs (open in a tab), plus adding more. */
export function AttachmentGallery({ task, canEdit = true }: { task: Task; canEdit?: boolean }) {
  const upload = useUploadFiles();
  const del = useDeleteAttachment();
  const { notify } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [viewing, setViewing] = useState<Attachment | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const send = () => {
    setProgress(0);
    upload.mutate(
      { taskId: task.id, files, onProgress: setProgress },
      {
        onSuccess: () => {
          notify('success', files.length === 1 ? 'File attached' : `${files.length} files attached`);
          setFiles([]);
        },
        onError: (e) => notify('error', e instanceof ApiError ? e.message : 'The upload failed. Please try again.'),
        onSettled: () => setProgress(null),
      },
    );
  };

  return (
    <section className="attachments" aria-label="Attachments">
      <h3>
        Attachments <span className="muted">({task.attachments.length}/{MAX_FILES_PER_TASK})</span>
      </h3>

      {task.attachments.length > 0 && (
        <ul className="att-grid">
          {task.attachments.map((a) => (
            <li key={a.id} className={`att att-${a.kind}`}>
              {a.kind === 'image' && (
                <button type="button" className="att-media" onClick={() => setViewing(a)} aria-label={`View ${a.name}`}>
                  <img src={fileUrl(task.id, a.id)} alt={a.name} loading="lazy" />
                </button>
              )}
              {a.kind === 'video' && <video className="att-media" src={fileUrl(task.id, a.id)} controls preload="metadata" aria-label={a.name} />}
              {a.kind === 'pdf' && (
                <a className="att-pdf" href={fileUrl(task.id, a.id)} target="_blank" rel="noopener noreferrer">
                  <FileIcon size={28} />
                  <span>Open PDF</span>
                </a>
              )}
              <div className="att-meta">
                <span className="att-name" title={a.name}>
                  {a.name}
                </span>
                <span className="muted">{formatSize(a.size)}</span>
                {canEdit &&
                  (removing === a.id ? (
                    <span className="att-confirm">
                      <button type="button" className="btn btn-danger btn-sm" disabled={del.isPending} onClick={() => del.mutate({ taskId: task.id, attachmentId: a.id }, { onSettled: () => setRemoving(null), onError: () => notify('error', 'Could not remove the file') })}>
                        Remove
                      </button>
                      <button type="button" className="btn btn-subtle btn-sm" onClick={() => setRemoving(null)}>
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="icon-btn" aria-label={`Remove ${a.name}`} onClick={() => setRemoving(a.id)}>
                      <TrashIcon size={14} />
                    </button>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <>
          <FilePicker files={files} onChange={setFiles} already={task.attachments.length} label="Add files" />
          {files.length > 0 && (
            <div className="upload-row">
              <button type="button" className="btn btn-primary" disabled={upload.isPending} onClick={send}>
                {upload.isPending ? 'Uploading…' : `Upload ${files.length} ${files.length === 1 ? 'file' : 'files'}`}
              </button>
              {progress !== null && (
                <div className="progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Lightbox taskId={task.id} attachment={viewing} onClose={() => setViewing(null)} />
    </section>
  );
}

function Lightbox({ taskId, attachment, onClose }: { taskId: string; attachment: Attachment | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const last = useRef(attachment);
  if (attachment) last.current = attachment;
  const shown = attachment ?? last.current;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (attachment && !el.open) el.showModal();
    if (!attachment && el.open) el.close();
  }, [attachment]);

  return (
    <dialog ref={ref} className="dialog lightbox" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <button type="button" className="icon-btn lightbox-close" aria-label="Close" onClick={onClose}>
        <CloseIcon />
      </button>
      {shown && <img src={fileUrl(taskId, shown.id)} alt={shown.name} />}
    </dialog>
  );
}
