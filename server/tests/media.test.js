import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const tmp = await mkdtemp(path.join(os.tmpdir(), 'gtech-media-'));
process.env.SECRET_KEY = 'test-secret-key-that-is-at-least-thirty-two-characters';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.ENVIRONMENT = 'test';
process.env.RATE_LIMIT_PER_MINUTE = '1000';
process.env.LOCAL_MEDIA_ROOT = tmp;

const db = vi.hoisted(() => ({ $queryRaw: vi.fn(), $queryRawUnsafe: vi.fn(), $executeRaw: vi.fn(), $executeRawUnsafe: vi.fn(), $transaction: vi.fn() }));
vi.mock('../src/lib/prisma.js', () => ({ prisma: db, disconnectPrisma: vi.fn() }));

let createApp, cleanupOrphanedMedia, storage;
beforeAll(async () => {
  ({ createApp } = await import('../src/app.js'));
  ({ cleanupOrphanedMedia } = await import('../src/jobs/media.js'));
  storage = await import('../src/services/storage.js');
});
afterAll(() => rm(tmp, { recursive: true, force: true }));

describe('media storage', () => {
  it('resolves the project root to the repository root', () => {
    expect(path.basename(storage.projectRoot)).not.toBe('server');
    expect(storage.projectRoot).toBe(path.resolve(import.meta.dirname, '../..'));
  });

  it('serves a stored upload from /media', async () => {
    await storage.store('uploads', 'served.txt', Buffer.from('hello'));
    const response = await request(createApp()).get('/media/uploads/served.txt').expect(200);
    expect(response.text).toBe('hello');
    await storage.remove(path.join(tmp, 'uploads', 'served.txt'));
  });
});

describe('cleanupOrphanedMedia', () => {
  it('keeps rows with missing files and only removes unreferenced files', async () => {
    await mkdir(path.join(tmp, 'gallery'), { recursive: true });
    await writeFile(path.join(tmp, 'gallery', 'kept.png'), 'x');
    await writeFile(path.join(tmp, 'gallery', 'orphan.png'), 'x');
    db.$queryRawUnsafe.mockResolvedValue([
      // legacy row: stale absolute Python path, but the file exists where its url points
      { id: '1', url: '/media/gallery/kept.png', local_path: '/app/media/gallery/kept.png' },
      // row whose file is gone entirely
      { id: '2', url: '/media/gallery/gone.png', local_path: '/app/media/gallery/gone.png' },
    ]);

    const result = await cleanupOrphanedMedia();

    expect(result).toEqual({ missing_files: 1, removed_files: 1 });
    expect(db.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(await storage.exists(path.join(tmp, 'gallery', 'kept.png'))).toBe(true);
    expect(await storage.exists(path.join(tmp, 'gallery', 'orphan.png'))).toBe(false);
  });

  it('deletes nothing when the media table is empty', async () => {
    await writeFile(path.join(tmp, 'gallery', 'lonely.png'), 'x');
    db.$queryRawUnsafe.mockResolvedValue([]);
    const result = await cleanupOrphanedMedia();
    expect(result.removed_files).toBe(0);
    expect(await storage.exists(path.join(tmp, 'gallery', 'lonely.png'))).toBe(true);
  });
});
