import { spawnSync } from 'node:child_process';
export const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
export function query(sql) {
  const result = spawnSync('psql', [process.env.DATABASE_URL, '-X', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-F', '\t', '-c', sql], { encoding: 'utf8', env: process.env });
  if (result.status !== 0) throw new Error((result.stderr || 'PostgreSQL command failed').trim());
  return result.stdout.trim() ? result.stdout.trim().split('\n').map((line) => line.split('\t')) : [];
}
