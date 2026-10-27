import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

const globalKey = '__detkiCmsPrisma';
export const prisma = globalThis[globalKey] || new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

if (env.NODE_ENV !== 'production') globalThis[globalKey] = prisma;
