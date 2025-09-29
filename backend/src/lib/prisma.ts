import path from 'node:path';
import { PrismaBetterSQLite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client';

const resolveSqliteUrl = (databaseUrl: string): string => {
  if (!databaseUrl.startsWith('file:')) {
    return databaseUrl;
  }

  const rawPath = databaseUrl.slice('file:'.length);

  if (rawPath.startsWith('/')) {
    return databaseUrl;
  }

  const [relativePathCandidate, queryFragment] = rawPath.split('?', 2);
  const relativePath = relativePathCandidate ?? '';
  const defaultBaseDir = path.resolve(__dirname, '../../prisma');
  const baseDir = process.env.PRISMA_SQLITE_BASE_DIR
    ? path.resolve(process.env.PRISMA_SQLITE_BASE_DIR)
    : defaultBaseDir;
  const absolutePath = path.resolve(baseDir, relativePath);
  const normalizedPath = absolutePath.replace(/\\/g, '/');

  return queryFragment ? `file:${normalizedPath}?${queryFragment}` : `file:${normalizedPath}`;
};

export const createPrismaClient = (databaseUrl?: string) => {
  const url = databaseUrl ?? process.env.DATABASE_URL ?? 'file:./prisma/dev.db';
  const resolvedUrl = resolveSqliteUrl(url);
  if (resolvedUrl.startsWith('file:')) {
    const adapter = new PrismaBetterSQLite3({ url: resolvedUrl });
    return new PrismaClient({ adapter });
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: resolvedUrl,
      },
    },
  });
};

let prisma: PrismaClient;

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

if (process.env.NODE_ENV === 'production') {
  prisma = createPrismaClient();
} else {
  if (!global.__prisma) {
    global.__prisma = createPrismaClient();
  }
  prisma = global.__prisma;
}

export { PrismaClient };
export default prisma;
