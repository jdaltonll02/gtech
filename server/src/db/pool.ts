import pg from 'pg';
import {config} from '../config.js';

const databaseUrl = new URL(config.DATABASE_URL);
if (databaseUrl.hostname.endsWith('.neon.tech')) {
  databaseUrl.hostname = databaseUrl.hostname.replace('-pooler.', '.');
}

export const pool = new pg.Pool({
  connectionString: databaseUrl.toString(),
  max: 20,
  options: '-c search_path=pepper,public',
});
