import { beforeAll, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ $queryRawUnsafe: vi.fn(), $executeRawUnsafe: vi.fn() }));
vi.mock('../src/lib/prisma.js', () => ({ prisma: db, disconnectPrisma: vi.fn() }));

let ensureEnumCasts;
beforeAll(async () => { ({ ensureEnumCasts } = await import('../src/lib/enum-casts.js')); });

const quietLogger = { log: vi.fn(), error: vi.fn() };

describe('ensureEnumCasts', () => {
  it('creates an implicit text cast for each enum that lacks one', async () => {
    db.$queryRawUnsafe.mockResolvedValue([{ name: 'documentscope' }, { name: 'orderstatus' }]);
    db.$executeRawUnsafe.mockResolvedValue(0);
    const result = await ensureEnumCasts(quietLogger);
    expect(result).toEqual({ created: ['documentscope', 'orderstatus'], failed: [] });
    expect(db.$executeRawUnsafe).toHaveBeenCalledWith('CREATE CAST (text AS "documentscope") WITH INOUT AS IMPLICIT');
    expect(db.$executeRawUnsafe).toHaveBeenCalledWith('CREATE CAST (text AS "orderstatus") WITH INOUT AS IMPLICIT');
  });

  it('does nothing when every enum already has a cast', async () => {
    db.$queryRawUnsafe.mockResolvedValue([]);
    expect(await ensureEnumCasts(quietLogger)).toEqual({ created: [], failed: [] });
    expect(db.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('reports a permission failure without throwing, and never interpolates odd type names', async () => {
    db.$queryRawUnsafe.mockResolvedValue([{ name: 'userrole' }, { name: 'bad"; DROP TABLE users; --' }]);
    db.$executeRawUnsafe.mockRejectedValue(new Error('must be owner of type userrole'));
    const result = await ensureEnumCasts(quietLogger);
    expect(result.created).toEqual([]);
    expect(result.failed).toEqual(['userrole', 'bad"; DROP TABLE users; --']);
    expect(db.$executeRawUnsafe).toHaveBeenCalledTimes(1);
  });
});
