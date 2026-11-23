import pg from 'pg';
import {config} from '../config.js';

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  options: '-c search_path=pepper,public',
});
