import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter;
const configured = () => Boolean(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASSWORD);

export async function sendEmail(to, subject, html, text) {
  if (!configured()) return false;
  transporter ??= nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD },
  });
  await transporter.sendMail({ from: config.SMTP_FROM || config.SMTP_USER, to, subject, html, ...(text ? { text } : {}) });
  return true;
}

export const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);

// ── Branded layout ─────────────────────────────────────────────────────────
// Table-based with inline styles: the only approach Gmail, Outlook and Apple Mail all render
// consistently. The brand mark is styled text, since many clients block images by default.
const BRAND = '#8B1522';
const BRAND_DARK = '#5E0B15';
const GOLD = '#D6A84F';
const TEXT = '#14161A';
const MUTED = '#5B616B';
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const site = () => config.FRONTEND_URL.replace(/\/$/, '');
const siteLabel = () => site().replace(/^https?:\/\//, '');

const para = (html) => `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.6;color:${TEXT};">${html}</p>`;

function button(label, url) {
  const href = escapeHtml(url);
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
    <tr><td align="center" bgcolor="${BRAND}" style="border-radius:8px;">
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:8px;background:${BRAND};">${escapeHtml(label)}</a>
    </td></tr>
  </table>
  <p style="margin:0 0 16px;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">If the button doesn't work, copy and paste this link into your browser:<br><a href="${href}" style="color:${BRAND};word-break:break-all;">${href}</a></p>`;
}

const codeBox = (code) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
    <tr><td style="background:#FDF5F6;border:1px solid #FBEAEC;border-radius:8px;padding:16px 28px;font-family:'SFMono-Regular',Consolas,'Courier New',monospace;font-size:30px;font-weight:700;letter-spacing:8px;color:${BRAND};">${escapeHtml(code)}</td></tr>
  </table>`;

const quote = (text) => `<div style="margin:0 0 20px;padding:14px 18px;background:#FAF7F5;border-left:3px solid ${BRAND};border-radius:4px;font-family:${FONT};font-size:15px;line-height:1.6;color:${TEXT};white-space:pre-wrap;">${escapeHtml(text)}</div>`;

/**
 * @param {object} o
 * @param {string} o.preheader  Inbox preview text (hidden in the body)
 * @param {string} o.heading
 * @param {string} o.body       Trusted HTML built from para()/button()/etc. with escaped values
 * @param {string} o.reason     Why the recipient got this email (footer)
 */
function layout({ preheader, heading, body, reason }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F1EE;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F1EE;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
      <tr><td style="background:${BRAND_DARK};background-image:linear-gradient(135deg,${BRAND_DARK},${BRAND});border-radius:16px 16px 0 0;padding:24px 32px;">
        <a href="${escapeHtml(site())}" target="_blank" style="text-decoration:none;">
          <span style="font-family:${FONT};font-size:22px;font-weight:800;letter-spacing:-0.3px;color:#ffffff;">G&#8209;Tech</span>
        </a>
        <div style="font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:${GOLD};padding-top:4px;">STEM Education &middot; Applied Research &middot; Technology Ventures</div>
      </td></tr>
      <tr><td style="background:#ffffff;padding:36px 32px 20px;border-left:1px solid #E8E2DE;border-right:1px solid #E8E2DE;">
        <h1 style="margin:0 0 20px;font-family:${FONT};font-size:24px;line-height:1.3;font-weight:700;color:${TEXT};">${escapeHtml(heading)}</h1>
        ${body}
        ${para(`Best regards,<br>The <span style="white-space:nowrap;">G&#8209;Tech</span> Team`)}
      </td></tr>
      <tr><td style="background:#FAF7F5;border:1px solid #E8E2DE;border-top:0;border-radius:0 0 16px 16px;padding:20px 32px;">
        <p style="margin:0 0 8px;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">${escapeHtml(reason)}</p>
        <p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">Gibson Technologies (G&#8209;Tech) &middot; <a href="${escapeHtml(site())}" style="color:${BRAND};text-decoration:none;">${escapeHtml(siteLabel())}</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// Plain-text alternative: lines are joined; null/empty entries are skipped.
const plain = (...lines) => [...lines.filter((l) => l !== null && l !== undefined), '', 'Best regards,', 'The G-Tech Team', '', `Gibson Technologies (G-Tech) · ${site()}`].join('\n');

const greeting = (name) => (name ? `Hello ${escapeHtml(name)},` : 'Hello,');
const greetingText = (name) => (name ? `Hello ${name},` : 'Hello,');
const money = (value) => Number(value).toFixed(2);

// ── Messages ───────────────────────────────────────────────────────────────
export function sendVerificationEmail(to, fullName, token) {
  const url = `${site()}/verify-email?token=${encodeURIComponent(token)}`;
  return sendEmail(to, 'Verify your email address for G-Tech', layout({
    preheader: 'Confirm your email address to finish setting up your G-Tech account.',
    heading: 'Confirm your email address',
    body: para(greeting(fullName)) + para('Thanks for creating a G-Tech account. Please confirm that this is your email address so we can keep your account secure.') + button('Verify email address', url),
    reason: "You're receiving this because this address was used to create a G-Tech account. If that wasn't you, you can ignore this email.",
  }), plain(greetingText(fullName), '', 'Thanks for creating a G-Tech account. Confirm your email address here:', url, '', "If you didn't create an account, you can ignore this email."));
}

export function sendWelcomeEmail(to, fullName) {
  const url = `${site()}/courses`;
  return sendEmail(to, 'Welcome to G-Tech', layout({
    preheader: 'Your G-Tech account is ready.',
    heading: `Welcome${fullName ? `, ${fullName}` : ''}!`,
    body: para('Your account is ready. You can now explore our courses, follow your progress, and get in touch about research collaborations or partnerships.') + button('Explore courses', url),
    reason: "You're receiving this because you created a G-Tech account.",
  }), plain(greetingText(fullName), '', 'Your G-Tech account is ready. Explore our courses:', url));
}

export function sendPasswordResetEmail(to, fullName, url) {
  return sendEmail(to, 'Reset your G-Tech password', layout({
    preheader: 'Use this link to choose a new password. It expires in one hour.',
    heading: 'Reset your password',
    body: para(greeting(fullName)) + para('We received a request to reset the password for your G-Tech account. Click the button below to choose a new one.') + button('Reset password', url)
      + para(`<span style="color:${MUTED};">This link expires in <strong>one hour</strong> and can only be used once. If you didn't request a password reset, you can safely ignore this email; your password won't change.</span>`),
    reason: "You're receiving this because a password reset was requested for your G-Tech account.",
  }), plain(greetingText(fullName), '', 'We received a request to reset your G-Tech password. Choose a new one here:', url, '', 'This link expires in one hour and can only be used once.', "If you didn't request this, ignore this email; your password won't change."));
}

export function sendTwoFactorCode(to, fullName, code) {
  return sendEmail(to, `${code} is your G-Tech verification code`, layout({
    preheader: `Your verification code is ${code}. It expires in 10 minutes.`,
    heading: 'Your verification code',
    body: para(greeting(fullName)) + para('Enter this code to finish signing in:') + codeBox(code)
      + para(`<span style="color:${MUTED};">The code expires in <strong>10 minutes</strong>. If you didn't try to sign in, change your password, because someone may know it.</span>`),
    reason: "You're receiving this because someone signed in to your G-Tech account with two-factor authentication enabled.",
  }), plain(greetingText(fullName), '', `Your G-Tech verification code is: ${code}`, '', 'It expires in 10 minutes.', "If you didn't try to sign in, change your password."));
}

export function sendCourseCompletion(to, fullName, courseTitle, certNumber, certUrl) {
  return sendEmail(to, `Congratulations! You completed ${courseTitle}`, layout({
    preheader: `Your certificate for ${courseTitle} is ready.`,
    heading: 'Congratulations on completing your course!',
    body: para(greeting(fullName)) + para(`You've completed <strong>${escapeHtml(courseTitle)}</strong>. Well done!`)
      + para(`Your certificate number is <strong>${escapeHtml(certNumber)}</strong>.`) + button('View your certificate', certUrl),
    reason: "You're receiving this because you completed a course on G-Tech.",
  }), plain(greetingText(fullName), '', `You've completed ${courseTitle}. Well done!`, `Certificate number: ${certNumber}`, 'View your certificate:', certUrl));
}

export function sendOrderConfirmation(to, fullName, orderId, total, items) {
  const rows = items.map((item) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E8E2DE;font-family:${FONT};font-size:15px;color:${TEXT};">${escapeHtml(item.name)} <span style="color:${MUTED};">&times; ${Number(item.quantity)}</span></td>
      <td align="right" style="padding:10px 0;border-bottom:1px solid #E8E2DE;font-family:${FONT};font-size:15px;color:${TEXT};white-space:nowrap;">$${money(item.total)}</td>
    </tr>`).join('');
  const table = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;">
      ${rows}
      <tr>
        <td style="padding:14px 0 0;font-family:${FONT};font-size:16px;font-weight:700;color:${TEXT};">Total</td>
        <td align="right" style="padding:14px 0 0;font-family:${FONT};font-size:16px;font-weight:700;color:${BRAND};">$${money(total)}</td>
      </tr>
    </table>`;
  return sendEmail(to, `Order confirmed: ${orderId}`, layout({
    preheader: `Thanks for your order. Total paid: $${money(total)}.`,
    heading: 'Thank you for your order',
    body: para(greeting(fullName)) + para(`We've received your payment for order <strong>${escapeHtml(orderId)}</strong>.`) + table + button('View your orders', `${site()}/store/orders`),
    reason: "You're receiving this because you placed an order on G-Tech.",
  }), plain(greetingText(fullName), '', `We've received your payment for order ${orderId}.`, '', ...items.map((i) => `- ${i.name} x ${i.quantity}: $${money(i.total)}`), `Total: $${money(total)}`, '', `View your orders: ${site()}/store/orders`));
}

export async function sendTicketNotification(ticket, message) {
  const ticketsUrl = `${site()}/tickets`;
  await sendEmail(ticket.email, `[${ticket.ticket_number}] We received your support request`, layout({
    preheader: `Ticket ${ticket.ticket_number}: we'll get back to you soon.`,
    heading: "We've received your request",
    body: para(greeting(ticket.name)) + para(`Thanks for contacting us. Your ticket number is <strong>${escapeHtml(ticket.ticket_number)}</strong>, and our team will reply as soon as possible.`)
      + para('Your message:') + quote(message) + button('View your ticket', ticketsUrl),
    reason: "You're receiving this because you submitted a support request to G-Tech.",
  }), plain(greetingText(ticket.name), '', `Thanks for contacting us. Your ticket number is ${ticket.ticket_number}.`, '', 'Your message:', message, '', `View your ticket: ${ticketsUrl}`));
  if (config.FIRST_SUPERADMIN_EMAIL) {
    await sendEmail(config.FIRST_SUPERADMIN_EMAIL, `[New Ticket] ${ticket.ticket_number}: ${ticket.subject}`, layout({
      preheader: `${ticket.name} opened ${ticket.ticket_number}: ${ticket.subject}`,
      heading: 'New support ticket',
      body: para(`<strong>${escapeHtml(ticket.name)}</strong> &lt;${escapeHtml(ticket.email)}&gt; opened ticket <strong>${escapeHtml(ticket.ticket_number)}</strong>.`)
        + para(`<strong>Subject:</strong> ${escapeHtml(ticket.subject)}`) + quote(message) + button('Open in admin', `${site()}/admin`),
      reason: "You're receiving this because you're the site's support contact.",
    }), plain(`${ticket.name} <${ticket.email}> opened ticket ${ticket.ticket_number}.`, `Subject: ${ticket.subject}`, '', message));
  }
  return true;
}

export function sendTicketReply(ticket, content, isAdmin) {
  const ticketsUrl = `${site()}/tickets`;
  const intro = isAdmin ? 'Our support team replied to your ticket:' : 'The customer replied to the ticket:';
  return sendEmail(ticket.email, `Re: [${ticket.ticket_number}] ${ticket.subject}`, layout({
    preheader: intro,
    heading: `New reply on ${ticket.ticket_number}`,
    body: para(intro) + quote(content) + button('View the conversation', ticketsUrl),
    reason: `You're receiving this because of activity on support ticket ${ticket.ticket_number}.`,
  }), plain(intro, '', content, '', `View the conversation: ${ticketsUrl}`));
}
