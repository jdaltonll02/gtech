import { prisma } from './prisma.js';

// Prisma sends every JS string parameter typed as `text`. Postgres has no implicit
// text -> enum cast, so `enum_col = $1` and `SET enum_col = $1` fail (42883 / 42804) for every
// enum column the Alembic schema created (userrole, orderstatus, documentscope, ...). The old
// Python driver let Postgres infer parameter types, so it never hit this.
//
// Registering an implicit INOUT cast per enum makes text parameters work for comparisons and
// writes without touching ~240 raw queries. Invalid values still fail the enum's own validation.
// Idempotent; types are read from the database so new enums are covered automatically.
export async function ensureEnumCasts(logger = console) {
  const missing = await prisma.$queryRawUnsafe(`
    SELECT t.typname AS name
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typtype = 'e'
      AND n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_cast c
        WHERE c.castsource = 'text'::regtype AND c.casttarget = t.oid
      )
    ORDER BY t.typname`);

  const created = [];
  const failed = [];
  for (const { name } of missing) {
    if (!/^[a-z_][a-z0-9_]*$/.test(name)) { failed.push(name); continue; }
    try {
      await prisma.$executeRawUnsafe(`CREATE CAST (text AS "${name}") WITH INOUT AS IMPLICIT`);
      created.push(name);
    } catch (error) {
      failed.push(name);
      logger.error(`Could not create text -> ${name} cast; queries using that enum with parameters will fail`, error.message);
    }
  }
  if (created.length) logger.log(`Created implicit text casts for enums: ${created.join(', ')}`);
  return { created, failed };
}
