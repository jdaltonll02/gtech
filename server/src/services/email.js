import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter;
const configured = () => Boolean(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASSWORD);

export async function sendEmail(to, subject, html) {
  if (!configured()) return false;
  transporter ??= nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD },
  });
  await transporter.sendMail({ from: config.SMTP_FROM || config.SMTP_USER, to, subject, html });
  return true;
}

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);

export const sendVerificationEmail = (to, fullName, token) => sendEmail(
  to,
  'Verify your email address',
  `<p>Hello ${escapeHtml(fullName)},</p><p>Please verify your email address:</p><p><a href="${config.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}">Verify email</a></p>`,
);
export const sendWelcomeEmail = (to, fullName) => sendEmail(to, 'Welcome!', `<p>Welcome, ${escapeHtml(fullName)}!</p>`);
export const sendCourseCompletion=(to,fullName,courseTitle,certNumber,certUrl)=>sendEmail(to,`Course completed: ${courseTitle}`,`<p>Congratulations ${escapeHtml(fullName)}!</p><p>You completed <strong>${escapeHtml(courseTitle)}</strong>.</p><p>Certificate ${escapeHtml(certNumber)}: <a href="${certUrl}">view certificate</a></p>`);
export const sendPasswordResetEmail = (to, fullName, url) => sendEmail(to, 'Reset your password', `<p>Hello ${escapeHtml(fullName)},</p><p><a href="${url}">Reset your password</a></p><p>This link expires in one hour.</p>`);
export const sendTwoFactorCode = (to, fullName, code) => sendEmail(to, 'Your verification code', `<p>Hello ${escapeHtml(fullName)},</p><p>Your verification code is <strong>${escapeHtml(code)}</strong>.</p><p>It expires in 10 minutes.</p>`);
export const sendOrderConfirmation = (to, fullName, orderId, total, items) => sendEmail(to, `Order confirmation ${orderId}`, `<p>Hello ${escapeHtml(fullName)},</p><p>Your order <strong>${escapeHtml(orderId)}</strong> has been paid.</p><ul>${items.map((item)=>`<li>${escapeHtml(item.name)} × ${item.quantity}: ${Number(item.total).toFixed(2)}</li>`).join('')}</ul><p>Total: ${Number(total).toFixed(2)}</p>`);
export async function sendTicketNotification(ticket,message){await sendEmail(ticket.email,`[${ticket.ticket_number}] Support ticket received`,`<p>Hi ${escapeHtml(ticket.name)},</p><p>We received ticket ${escapeHtml(ticket.ticket_number)}.</p><blockquote>${escapeHtml(message)}</blockquote>`);if(config.FIRST_SUPERADMIN_EMAIL)await sendEmail(config.FIRST_SUPERADMIN_EMAIL,`[New Ticket] ${ticket.ticket_number}: ${ticket.subject}`,`<p>${escapeHtml(ticket.name)} &lt;${escapeHtml(ticket.email)}&gt;</p><blockquote>${escapeHtml(message)}</blockquote>`);return true;}
export const sendTicketReply=(ticket,content,isAdmin)=>sendEmail(ticket.email,`Re: [${ticket.ticket_number}] ${ticket.subject}`,`<p>${isAdmin?'You have a reply from our support team':'Your customer replied'}:</p><blockquote>${escapeHtml(content)}</blockquote><p><a href="${config.FRONTEND_URL}/tickets">View ticket thread</a></p>`);
