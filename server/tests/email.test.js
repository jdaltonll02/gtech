import { beforeAll, describe, expect, it, vi } from 'vitest';

process.env.SECRET_KEY = 'test-secret-key-that-is-at-least-thirty-two-characters';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.ENVIRONMENT = 'test';
process.env.FRONTEND_URL = 'https://gibtechs.com';
process.env.SMTP_HOST = 'smtp.example.com';
process.env.SMTP_PORT = '465';
process.env.SMTP_USER = 'admin@gibtechs.com';
process.env.SMTP_PASSWORD = 'secret';
process.env.SMTP_FROM = 'G-Tech <admin@gibtechs.com>';
process.env.REDIS_URL = '';

const mail = vi.hoisted(() => ({ sendMail: vi.fn(async () => ({})) }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: mail.sendMail }) } }));
const db = vi.hoisted(() => ({ $executeRawUnsafe: vi.fn(async () => 0) }));
vi.mock('../src/lib/prisma.js', () => ({ prisma: db, disconnectPrisma: vi.fn() }));

let email, kv;
beforeAll(async () => {
  email = await import('../src/services/email.js');
  kv = await import('../src/lib/kv.js');
});

const lastMail = () => mail.sendMail.mock.calls.at(-1)[0];

describe('branded emails', () => {
  it('sends the password reset with a button, fallback link and plain-text part', async () => {
    const url = 'https://gibtechs.com/reset-password?token=abc123';
    await email.sendPasswordResetEmail('user@example.com', 'Ada Lovelace', url);
    const m = lastMail();
    expect(m.from).toBe('G-Tech <admin@gibtechs.com>');
    expect(m.subject).toBe('Reset your G-Tech password');
    expect(m.html).toContain('Hello Ada Lovelace,');
    expect(m.html.match(new RegExp(url.replace(/[?]/g, '\\?'), 'g')).length).toBeGreaterThanOrEqual(2); // button + fallback
    expect(m.html).toContain('one hour');
    expect(m.text).toContain(url);
    expect(m.text).not.toContain('<');
  });

  it('escapes user-supplied values in the HTML', async () => {
    await email.sendPasswordResetEmail('user@example.com', '<script>alert(1)</script>', 'https://gibtechs.com/reset-password?token=x');
    expect(lastMail().html).not.toContain('<script>alert(1)</script>');
    expect(lastMail().html).toContain('&lt;script&gt;');
  });

  it('renders order totals and the 2FA code', async () => {
    await email.sendOrderConfirmation('u@example.com', 'Ada', 'ORD-1', 25, [{ name: 'Kit', quantity: 2, total: 25 }]);
    expect(lastMail().html).toContain('$25.00');
    await email.sendTwoFactorCode('u@example.com', 'Ada', '482913');
    expect(lastMail().subject).toBe('482913 is your G-Tech verification code');
    expect(lastMail().html).toContain('482913');
  });
});

describe('ensureKvTable', () => {
  it('creates the table and index idempotently', async () => {
    await kv.ensureKvTable();
    const sql = db.$executeRawUnsafe.mock.calls.map((c) => c[0]).join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "kv_store"');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "ix_kv_store_expires_at"');
  });
});
