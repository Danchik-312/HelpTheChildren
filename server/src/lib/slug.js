export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const normalizeSlug = value => String(value || '').trim().toLowerCase();
