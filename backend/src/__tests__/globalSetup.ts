import { execSync } from 'node:child_process';
import path from 'node:path';

const ensureDatabaseUrl = () => {
  const defaultUrl = 'file:./test.db';
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim().length === 0) {
    process.env.DATABASE_URL = defaultUrl;
  }
  return process.env.DATABASE_URL;
};

export default async function globalSetup(): Promise<void> {
  const backendRoot = path.resolve(__dirname, '..', '..');
  const databaseUrl = ensureDatabaseUrl();

  execSync('npx prisma db push --skip-generate --force-reset', {
    cwd: backendRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });
}
