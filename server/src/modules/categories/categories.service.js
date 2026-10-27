import { prisma } from '../../db/prisma.js';
import { errors } from '../../lib/api-error.js';

const select = { id: true, slug: true, name: true, createdAt: true, updatedAt: true };

export async function adminList(query = {}) {
  const q = String(query.q || '').trim().slice(0, 120);
  const items = await prisma.category.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }] } : {},
    select: { ...select, _count: { select: { publications: true } } },
    orderBy: { name: 'asc' },
  });
  return { items: items.map(({ _count, ...item }) => ({ ...item, publicationCount: _count.publications })) };
}

export async function create(input) {
  try { return await prisma.category.create({ data: input, select }); }
  catch (error) { if (error.code === 'P2002') throw errors.conflict('CATEGORY_SLUG_EXISTS', 'Категория с таким slug уже существует.'); throw error; }
}

export async function update(id, input) {
  try { return await prisma.category.update({ where: { id }, data: input, select }); }
  catch (error) {
    if (error.code === 'P2002') throw errors.conflict('CATEGORY_SLUG_EXISTS', 'Категория с таким slug уже существует.');
    if (error.code === 'P2025') throw errors.notFound();
    throw error;
  }
}

export async function remove(id) {
  try {
    await prisma.$transaction(async tx => {
      // Lock the parent row so relation creation and deletion serialize around the FK.
      const found = await tx.$queryRaw`SELECT "id" FROM "Category" WHERE "id" = ${id}::uuid FOR UPDATE`;
      if (!found.length) throw errors.notFound();
      if (await tx.publicationCategory.count({ where: { categoryId: id } })) {
        throw errors.conflict('CATEGORY_IN_USE', 'Категория используется публикациями и не может быть удалена.');
      }
      await tx.category.delete({ where: { id } });
    });
  } catch (error) {
    if (error.code === 'P2003' || error.code === 'P2025') throw errors.conflict('CATEGORY_IN_USE', 'Категория используется публикациями и не может быть удалена.');
    throw error;
  }
}

export async function publicList(kind) {
  const now = new Date();
  const items = await prisma.category.findMany({
    where: { publications: { some: { publication: { kind, status: 'PUBLISHED', deletedAt: null, publishedAt: { lte: now } } } } },
    select: { id: true, slug: true, name: true },
    orderBy: { name: 'asc' },
  });
  return { items };
}
