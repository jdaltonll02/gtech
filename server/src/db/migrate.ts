import {pool} from './pool.js';
import {runMigrations} from './migrationsRunner.js';

await runMigrations();
await pool.end();
