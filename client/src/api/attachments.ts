import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchTaskInCaches } from './cache';
import { ApiError, getActiveWorkspace, http, refreshAccess } from './http';
import type { Task } from './types';

/** Images and videos are loaded by the browser itself, which cannot send headers, so the board goes in the URL. */
export const fileUrl = (taskId: string, attachmentId: string) => {
  const board = getActiveWorkspace();
  return `/api/tasks/${taskId}/attachments/${attachmentId}${board ? `?workspace=${board}` : ''}`;
};

/**
 * Uploads files to a task. XMLHttpRequest rather than fetch, because it reports how much has been sent, which a progress bar
 * needs for a video. A 401 (the short-lived access token ran out) refreshes quietly and tries once more, like every other call.
 */
export function uploadFiles(taskId: string, files: File[], onProgress?: (fraction: number) => void, retried = false): Promise<Task> {
  return new Promise<Task>((resolve, reject) => {
    const form = new FormData();
    for (const file of files) form.append('files', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/tasks/${taskId}/attachments`);
    xhr.withCredentials = true;
    const board = getActiveWorkspace();
    if (board) xhr.setRequestHeader('X-Workspace-Id', board);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK', 'Upload failed. Check your connection and try again.'));
    xhr.onabort = () => reject(new ApiError(0, 'ABORTED', 'Upload cancelled.'));
    xhr.onload = () => {
      if (xhr.status === 401 && !retried) {
        void refreshAccess().then((ok) => (ok ? uploadFiles(taskId, files, onProgress, true).then(resolve, reject) : reject(new ApiError(401, 'UNAUTHORIZED', 'Your session has ended. Sign in again.'))));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve((xhr.response as { task: Task }).task);
      const e = (xhr.response as { error?: { code?: string; message?: string } } | null)?.error;
      reject(new ApiError(xhr.status, e?.code ?? 'ERROR', e?.message ?? 'The upload failed. Please try again.'));
    };
    xhr.send(form);
  });
}

export function useUploadFiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { taskId: string; files: File[]; onProgress?: (fraction: number) => void }) => uploadFiles(v.taskId, v.files, v.onProgress),
    // The server's answer is the task with its new attachments: put it straight into every cache.
    onSuccess: (task) => patchTaskInCaches(qc, task.id, task),
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { taskId: string; attachmentId: string }) => http<{ task: Task }>(`/tasks/${v.taskId}/attachments/${v.attachmentId}`, { method: 'DELETE' }),
    onSuccess: ({ task }) => patchTaskInCaches(qc, task.id, task),
  });
}
