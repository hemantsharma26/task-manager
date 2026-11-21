import type { OutgoingMail } from './mailer.js';

// Everything that comes from a user (names, task titles, group names) goes through escapeHtml before it is placed in an
// email, so a task called "<script>" or a name with a link in it cannot turn into markup in somebody's inbox.
export const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const oneLine = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();

function layout(title: string, bodyHtml: string, button: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f7f8f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#172b4d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:6px;padding:28px">
<tr><td style="font-size:18px;font-weight:600;padding-bottom:12px">${escapeHtml(title)}</td></tr>
<tr><td style="font-size:14px;line-height:1.5;padding-bottom:20px">${bodyHtml}</td></tr>
<tr><td><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#0c66e4;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:3px;font-weight:600">${escapeHtml(button.label)}</a></td></tr>
<tr><td style="font-size:12px;color:#626f86;padding-top:20px">If the button does not work, copy this link into your browser:<br>${escapeHtml(button.url)}</td></tr>
</table></td></tr></table></body></html>`;
}

export function invitationMail(input: { to: string; inviterName: string; groupName: string; roleName: string; url: string; expiresInDays: number }): OutgoingMail {
  const inviter = oneLine(input.inviterName);
  const group = oneLine(input.groupName);
  return {
    to: input.to,
    subject: `${inviter} invited you to join ${group}`.slice(0, 150),
    html: layout(
      `Join ${group}`,
      `<strong>${escapeHtml(inviter)}</strong> invited you to the group <strong>${escapeHtml(group)}</strong> as <strong>${escapeHtml(input.roleName)}</strong>.<br>The link works for ${input.expiresInDays} days and only for this email address.`,
      { label: 'Accept invitation', url: input.url },
    ),
    text: `${inviter} invited you to join ${group} as ${input.roleName}.\n\nAccept: ${input.url}\n\nThe link works for ${input.expiresInDays} days and only for this email address.`,
  };
}

export function assignmentMail(input: { to: string; assignerName: string; taskKey: string; taskTitle: string; projectName: string; dueText: string | null; url: string }): OutgoingMail {
  const title = oneLine(input.taskTitle);
  const assigner = oneLine(input.assignerName);
  return {
    to: input.to,
    subject: `${input.taskKey}: ${assigner} assigned you "${title}"`.slice(0, 150),
    html: layout(
      `${input.taskKey} was assigned to you`,
      `<strong>${escapeHtml(assigner)}</strong> assigned you a task in <strong>${escapeHtml(input.projectName)}</strong>:<br><br><span style="font-size:16px"><strong>${escapeHtml(input.taskKey)}</strong> ${escapeHtml(title)}</span>${input.dueText ? `<br><br>Due: ${escapeHtml(input.dueText)}` : ''}`,
      { label: 'Open task', url: input.url },
    ),
    text: `${assigner} assigned you ${input.taskKey} "${title}" in ${input.projectName}.${input.dueText ? `\nDue: ${input.dueText}` : ''}\n\nOpen: ${input.url}`,
  };
}

export function passwordResetMail(input: { to: string; name: string; url: string; expiresInMinutes: number }): OutgoingMail {
  const name = oneLine(input.name);
  return {
    to: input.to,
    subject: 'Reset your Task Manager password',
    html: layout(
      'Reset your password',
      `Hi <strong>${escapeHtml(name)}</strong>, we got a request to reset the password of your account.<br>The link works once and for ${input.expiresInMinutes} minutes.<br><br>If it was not you, ignore this email: your password stays as it is.`,
      { label: 'Choose a new password', url: input.url },
    ),
    text: `Hi ${name},\n\nWe got a request to reset your Task Manager password.\n\nChoose a new one: ${input.url}\n\nThe link works once and for ${input.expiresInMinutes} minutes. If it was not you, ignore this email: your password stays as it is.`,
  };
}
