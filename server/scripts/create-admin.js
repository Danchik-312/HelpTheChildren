import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { prisma } from '../src/db/prisma.js';
import { hashPassword } from '../src/lib/crypto.js';

const args = Object.fromEntries(process.argv.slice(2).map(value => value.split('=', 2)));
const interactive = createInterface({ input: stdin, output: stdout });

try {
  const email = String(args['--email'] || await interactive.question('Admin email: ')).trim().toLowerCase();
  const displayName = String(args['--name'] || await interactive.question('Display name: ')).trim();
  const password = process.env.INITIAL_ADMIN_PASSWORD || await interactive.question('Password (input may be visible): ');
  if (!/^\S+@\S+\.\S+$/.test(email) || displayName.length < 2 || password.length < 12) throw new Error('Email/name/password do not meet requirements');
  const existingAdmin = await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
  if (existingAdmin) throw new Error('An active administrator already exists; use the protected users API');
  const user = await prisma.user.create({ data: { email, displayName, passwordHash: await hashPassword(password), role: 'ADMIN' }, select: { id: true, email: true } });
  console.info(`Administrator created: ${user.email} (${user.id})`);
} finally {
  interactive.close();
  await prisma.$disconnect();
}
