import { z } from 'zod';

const MAX_DEPTH = 20;
const MAX_NODES = 5_000;
const MAX_TEXT_LENGTH = 200_000;
const MAX_TEXT_NODE_LENGTH = 50_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BLOCK_TYPES = new Set(['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', 'image']);
const INLINE_TYPES = new Set(['text', 'hardBreak', 'image']);

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function addIssue(context, path, message) {
  context.addIssue({ code: 'custom', path, message });
}

function hasOnlyKeys(value, allowed, context, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) addIssue(context, [...path, key], `Атрибут «${key}» не разрешён.`);
  }
}

function isSafeLink(href) {
  if (typeof href !== 'string' || href.length === 0 || href.length > 2_048 || /[\u0000-\u001f\u007f\\]/.test(href)) return false;
  if (href.startsWith('/')) return !href.startsWith('//');
  if (href.startsWith('https://')) {
    try {
      const url = new URL(href);
      return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
    } catch {
      return false;
    }
  }
  return /^mailto:[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i.test(href);
}

function validateMarks(marks, context, path) {
  if (!Array.isArray(marks) || marks.length > 8) {
    addIssue(context, path, 'Список форматирования некорректен или слишком велик.');
    return;
  }
  const seen = new Set();
  marks.forEach((mark, index) => {
    const markPath = [...path, index];
    if (!isPlainObject(mark) || typeof mark.type !== 'string') {
      addIssue(context, markPath, 'Некорректная отметка форматирования.');
      return;
    }
    if (!['bold', 'italic', 'link'].includes(mark.type)) {
      addIssue(context, [...markPath, 'type'], `Форматирование «${mark.type}» не разрешено.`);
      return;
    }
    if (seen.has(mark.type)) addIssue(context, [...markPath, 'type'], 'Форматирование не должно повторяться.');
    seen.add(mark.type);

    if (mark.type !== 'link') {
      hasOnlyKeys(mark, new Set(['type']), context, markPath);
      return;
    }

    hasOnlyKeys(mark, new Set(['type', 'attrs']), context, markPath);
    if (!isPlainObject(mark.attrs)) {
      addIssue(context, [...markPath, 'attrs'], 'Для ссылки нужны безопасные атрибуты.');
      return;
    }
    hasOnlyKeys(mark.attrs, new Set(['href', 'target', 'rel', 'class']), context, [...markPath, 'attrs']);
    if (!isSafeLink(mark.attrs.href)) addIssue(context, [...markPath, 'attrs', 'href'], 'Разрешены внутренние ссылки, HTTPS и mailto.');
    if (mark.attrs.target !== undefined && mark.attrs.target !== null && !['_self', '_blank'].includes(mark.attrs.target)) {
      addIssue(context, [...markPath, 'attrs', 'target'], 'Недопустимое значение target.');
    }
    if (mark.attrs.rel !== undefined && mark.attrs.rel !== null && (typeof mark.attrs.rel !== 'string' || !/^(?:(?:noopener|noreferrer|nofollow)(?:\s+|$))*$/.test(mark.attrs.rel))) {
      addIssue(context, [...markPath, 'attrs', 'rel'], 'Недопустимое значение rel.');
    }
    if (mark.attrs.class !== undefined && mark.attrs.class !== null) addIssue(context, [...markPath, 'attrs', 'class'], 'CSS-классы ссылок не разрешены.');
  });
}

function validateImageAttrs(attrs, context, path) {
  if (!isPlainObject(attrs)) {
    addIssue(context, path, 'Для изображения нужны атрибуты медиатеки.');
    return;
  }
  hasOnlyKeys(attrs, new Set(['mediaId', 'alt', 'title']), context, path);
  const mediaId = attrs.mediaId;
  if (typeof mediaId !== 'string' || !UUID_PATTERN.test(mediaId)) addIssue(context, [...path, 'mediaId'], 'Некорректный идентификатор медиафайла.');
  for (const key of ['alt', 'title']) {
    if (attrs[key] !== undefined && attrs[key] !== null && (typeof attrs[key] !== 'string' || attrs[key].length > 500)) {
      addIssue(context, [...path, key], `Поле ${key} должно быть строкой длиной до 500 символов.`);
    }
  }
}

function validateNode(node, context, path, state, depth, expected) {
  if (depth > MAX_DEPTH) {
    addIssue(context, path, `Максимальная глубина документа — ${MAX_DEPTH}.`);
    return;
  }
  state.nodes += 1;
  if (state.nodes > MAX_NODES) {
    if (!state.nodeLimitReported) addIssue(context, path, `Максимальное число узлов — ${MAX_NODES}.`);
    state.nodeLimitReported = true;
    return;
  }
  if (!isPlainObject(node) || typeof node.type !== 'string') {
    addIssue(context, path, 'Узел содержимого должен быть объектом с типом.');
    return;
  }
  const nodeType = node.type;
  if (expected === 'block' && !BLOCK_TYPES.has(nodeType)) addIssue(context, [...path, 'type'], `Узел «${nodeType}» недопустим в блочном содержимом.`);
  if (expected === 'inline' && !INLINE_TYPES.has(nodeType)) addIssue(context, [...path, 'type'], `Узел «${nodeType}» недопустим во встроенном содержимом.`);
  if (expected === 'listItem' && nodeType !== 'listItem') addIssue(context, [...path, 'type'], 'Список может содержать только listItem.');

  if (nodeType === 'text') {
    hasOnlyKeys(node, new Set(['type', 'text', 'marks']), context, path);
    if (typeof node.text !== 'string' || node.text.length > MAX_TEXT_NODE_LENGTH) {
      addIssue(context, [...path, 'text'], `Текстовый узел должен быть строкой длиной до ${MAX_TEXT_NODE_LENGTH} символов.`);
    } else {
      state.textLength += node.text.length;
      if (state.textLength > MAX_TEXT_LENGTH && !state.textLimitReported) addIssue(context, [...path, 'text'], `Максимальная длина текста — ${MAX_TEXT_LENGTH} символов.`);
      state.textLimitReported ||= state.textLength > MAX_TEXT_LENGTH;
    }
    if (node.marks !== undefined) validateMarks(node.marks, context, [...path, 'marks']);
    return;
  }

  if (nodeType === 'hardBreak') {
    hasOnlyKeys(node, new Set(['type']), context, path);
    return;
  }

  if (nodeType === 'image') {
    hasOnlyKeys(node, new Set(['type', 'attrs']), context, path);
    validateImageAttrs(node.attrs, context, [...path, 'attrs']);
    return;
  }

  if (nodeType === 'listItem') {
    hasOnlyKeys(node, new Set(['type', 'content']), context, path);
    validateChildren(node.content, context, [...path, 'content'], state, depth, 'block', true);
    return;
  }

  if (!BLOCK_TYPES.has(nodeType)) {
    addIssue(context, [...path, 'type'], `Тип узла «${nodeType}» не разрешён.`);
    return;
  }

  const allowedKeys = new Set(['type', 'content']);
  if (nodeType === 'heading' || nodeType === 'orderedList') allowedKeys.add('attrs');
  hasOnlyKeys(node, allowedKeys, context, path);

  if (nodeType === 'heading') {
    if (!isPlainObject(node.attrs)) addIssue(context, [...path, 'attrs'], 'Укажите уровень заголовка.');
    else {
      hasOnlyKeys(node.attrs, new Set(['level']), context, [...path, 'attrs']);
      if (!Number.isInteger(node.attrs.level) || node.attrs.level < 1 || node.attrs.level > 6) addIssue(context, [...path, 'attrs', 'level'], 'Уровень заголовка должен быть от 1 до 6.');
    }
  }
  if (nodeType === 'orderedList' && node.attrs !== undefined) {
    if (!isPlainObject(node.attrs)) addIssue(context, [...path, 'attrs'], 'Атрибуты списка некорректны.');
    else {
      hasOnlyKeys(node.attrs, new Set(['start']), context, [...path, 'attrs']);
      if (!Number.isInteger(node.attrs.start) || node.attrs.start < 1 || node.attrs.start > 1_000_000) addIssue(context, [...path, 'attrs', 'start'], 'Начальный номер списка некорректен.');
    }
  }

  const isContainer = nodeType === 'bulletList' || nodeType === 'orderedList' || nodeType === 'blockquote';
  const childType = nodeType === 'bulletList' || nodeType === 'orderedList' ? 'listItem' : nodeType === 'blockquote' ? 'block' : 'inline';
  validateChildren(node.content, context, [...path, 'content'], state, depth, childType, isContainer);
}

function validateChildren(content, context, path, state, depth, expected, requireContent) {
  if (content === undefined && !requireContent) return;
  if (!Array.isArray(content) || (requireContent && content.length === 0)) {
    addIssue(context, path, requireContent ? 'Содержимое не должно быть пустым.' : 'Содержимое должно быть массивом.');
    return;
  }
  content.forEach((node, index) => validateNode(node, context, [...path, index], state, depth + 1, expected));
}

function validateLegacyBody(value, context) {
  const state = { nodes: 0, textLength: 0, nodeLimitReported: false, textLimitReported: false };
  value.forEach((node, index) => {
    const path = [index];
    if (!isPlainObject(node)) {
      addIssue(context, path, 'Устаревший блок должен быть объектом.');
      return;
    }
    hasOnlyKeys(node, new Set(['type', 'text']), context, path);
    if (node.type !== 'paragraph') addIssue(context, [...path, 'type'], 'В устаревшем формате разрешены только абзацы.');
    if (typeof node.text !== 'string' || node.text.length > MAX_TEXT_NODE_LENGTH) addIssue(context, [...path, 'text'], `Текст абзаца должен быть строкой длиной до ${MAX_TEXT_NODE_LENGTH} символов.`);
    else state.textLength += node.text.length;
  });
  if (value.length > MAX_NODES) addIssue(context, [], `Максимальное число узлов — ${MAX_NODES}.`);
  if (state.textLength > MAX_TEXT_LENGTH) addIssue(context, [], `Максимальная длина текста — ${MAX_TEXT_LENGTH} символов.`);
}

export const structuredContentSchema = z.unknown().superRefine((value, context) => {
  if (Array.isArray(value)) {
    validateLegacyBody(value, context);
    return;
  }
  if (!isPlainObject(value)) {
    addIssue(context, [], 'Содержимое должно быть документом Tiptap.');
    return;
  }
  hasOnlyKeys(value, new Set(['type', 'content']), context, []);
  if (value.type !== 'doc') addIssue(context, ['type'], 'Корневой узел должен иметь тип doc.');
  const state = { nodes: 1, textLength: 0, nodeLimitReported: false, textLimitReported: false };
  validateChildren(value.content, context, ['content'], state, 0, 'block', false);
});

