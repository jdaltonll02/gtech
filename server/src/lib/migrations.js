import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from './prisma.js';

const migrationsDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../migrations');

// Migrations in this project are deliberately plain DDL files. Prisma's
// PostgreSQL driver accepts one prepared statement at a time, so execute each
// statement separately while keeping the complete file atomic.
const sqlStatements=(sql)=>sql.split(';').map((statement)=>statement.trim()).filter(Boolean);

export async function runSqlMigrations(){
  await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  const files=(await readdir(migrationsDir)).filter((name)=>/^\d+.*\.sql$/.test(name)).sort();
  const applied=new Set((await prisma.$queryRawUnsafe('SELECT name FROM schema_migrations')).map((row)=>row.name));
  for(const name of files){
    if(applied.has(name))continue;
    const sql=await readFile(path.join(migrationsDir,name),'utf8');
    await prisma.$transaction(async(tx)=>{
      await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('gtech_sql_migrations'))");
      const exists=await tx.$queryRawUnsafe('SELECT 1 FROM schema_migrations WHERE name=$1',name);
      if(exists.length)return;
      for(const statement of sqlStatements(sql))await tx.$executeRawUnsafe(statement);
      await tx.$executeRawUnsafe('INSERT INTO schema_migrations(name) VALUES($1)',name);
    });
  }
}
