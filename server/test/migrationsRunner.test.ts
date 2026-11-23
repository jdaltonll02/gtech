import {beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  connect: vi.fn(),
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({readdir: mocks.readdir, readFile: mocks.readFile}));
vi.mock('../src/db/pool.js', () => ({pool: {connect: mocks.connect}}));

import {migrationsReady, runMigrations} from '../src/db/migrationsRunner.js';

describe('database migration runner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connect.mockResolvedValue({query: mocks.query, release: mocks.release});
    mocks.readdir.mockResolvedValue(['001_initial.sql']);
    mocks.readFile.mockResolvedValue('CREATE TABLE example(id uuid PRIMARY KEY);');
    mocks.query.mockImplementation((sql: string) => Promise.resolve(
      sql.startsWith('SELECT 1 FROM schema_migrations') ? {rowCount: 0} : {rowCount: 1},
    ));
  });

  it('isolates, locks and transactionally applies pending SQL migrations', async () => {
    await runMigrations();

    expect(mocks.query).toHaveBeenCalledWith('CREATE SCHEMA IF NOT EXISTS pepper');
    expect(mocks.query).toHaveBeenCalledWith('SET search_path TO pepper, public');
    expect(mocks.query).toHaveBeenCalledWith('SELECT pg_advisory_lock(hashtext($1))', ['pepper-schema-migrations']);
    expect(mocks.query).toHaveBeenCalledWith('BEGIN');
    expect(mocks.query).toHaveBeenCalledWith('CREATE TABLE example(id uuid PRIMARY KEY);');
    expect(mocks.query).toHaveBeenCalledWith('COMMIT');
    expect(mocks.query).toHaveBeenCalledWith('SELECT pg_advisory_unlock(hashtext($1))', ['pepper-schema-migrations']);
    expect(mocks.release).toHaveBeenCalledOnce();
    expect(migrationsReady()).toBe(true);
  });
});
