import { prisma } from '../../db/prisma.js';
import { writeAudit } from '../audit/audit.service.js';
import { structuredContentSchema } from '../content/structured-content.validation.js';
import { isSafeContactHref } from './site.validation.js';

export function sanitizePublicSiteData({ organization, contacts, blocks }) {
  const safeOrganization = organization && {
    ...organization,
    description: organization.description == null || structuredContentSchema.safeParse(organization.description).success
      ? organization.description
      : null,
  };
  const safeContacts = contacts.map(contact => ({
    ...contact,
    href: contact.href == null || isSafeContactHref(contact.href) ? contact.href : null,
  }));
  return { organization: safeOrganization, contacts: safeContacts, blocks };
}

export async function adminGet() {
  const [organization, contacts, blocks] = await prisma.$transaction([
    prisma.organizationProfile.findUnique({ where: { id: 'main' } }),
    prisma.contactEntry.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.homeBlock.findMany({ orderBy: { position: 'asc' } }),
  ]);
  return { organization, contacts, blocks };
}

export async function updateOrganization(input, user, requestId) {
  return prisma.$transaction(async tx => {
    const item = await tx.organizationProfile.upsert({ where: { id: 'main' }, create: { id: 'main', ...input, logoPath: null, updatedById: user.id }, update: { ...input, updatedById: user.id } });
    await writeAudit(tx, { actorId: user.id, action: 'UPDATE', entityType: 'OrganizationProfile', entityId: 'main', requestId });
    return item;
  });
}

export async function createContact(input, user, requestId) {
  return prisma.$transaction(async tx => {
    const item = await tx.contactEntry.create({ data: { ...input, updatedById: user.id } });
    await writeAudit(tx, { actorId: user.id, action: 'CREATE', entityType: 'ContactEntry', entityId: item.id, requestId });
    return item;
  });
}

export async function updateContact(id, input, user, requestId) {
  return prisma.$transaction(async tx => {
    const item = await tx.contactEntry.update({ where: { id }, data: { ...input, updatedById: user.id } });
    await writeAudit(tx, { actorId: user.id, action: 'UPDATE', entityType: 'ContactEntry', entityId: id, requestId });
    return item;
  });
}

export async function deleteContact(id, user, requestId) {
  await prisma.$transaction(async tx => {
    await tx.contactEntry.delete({ where: { id } });
    await writeAudit(tx, { actorId: user.id, action: 'DELETE', entityType: 'ContactEntry', entityId: id, requestId });
  });
}

export async function upsertBlock(input, user, requestId) {
  return prisma.$transaction(async tx => {
    const item = await tx.homeBlock.upsert({ where: { key: input.key }, create: { ...input, updatedById: user.id }, update: { ...input, updatedById: user.id } });
    await writeAudit(tx, { actorId: user.id, action: 'UPDATE', entityType: 'HomeBlock', entityId: item.id, requestId });
    return item;
  });
}

export async function publicGet() {
  const [organization, contacts, blocks] = await prisma.$transaction([
    prisma.organizationProfile.findUnique({ where: { id: 'main' }, select: { displayName: true, shortDescription: true, description: true, logoPath: true } }),
    prisma.contactEntry.findMany({ where: { isPublic: true }, select: { id: true, type: true, label: true, value: true, href: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.homeBlock.findMany({ where: { enabled: true }, select: { key: true, enabled: true, position: true, itemLimit: true, heading: true, description: true, config: true }, orderBy: { position: 'asc' } }),
  ]);
  return sanitizePublicSiteData({ organization, contacts, blocks });
}
