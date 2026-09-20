import {PrismaClient} from '@prisma/client';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const schema = `${root}apps/api/prisma/schema.prisma`;
function prisma(args) {
  const result = spawnSync(process.execPath, [`${root}node_modules/prisma/build/index.js`, ...args], {stdio:'inherit', env:process.env});
  if (result.status !== 0) throw new Error('Database migration command failed');
}
const client = new PrismaClient();
try {
  const tables = await client.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
  // Historical crew migration predates init. Bootstrap only genuinely empty databases;
  // preserve all applied migration names/checksums on existing installations.
  if (tables.length === 0) {
    prisma(['db','execute','--schema',schema,'--file',`${root}apps/api/prisma/migrations/20260529011124_init/migration.sql`]);
    prisma(['migrate','resolve','--schema',schema,'--applied','20260529011124_init']);
  }
} finally { await client.$disconnect(); }
prisma(['migrate','deploy','--schema',schema]);
