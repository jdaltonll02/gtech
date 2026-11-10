import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.DEBUG === 'true' ? ['warn', 'error'] : ['error'],
});

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
