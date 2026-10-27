export const contactTypes = {
  PHONE: 'Телефон', EMAIL: 'Электронная почта', ADDRESS: 'Адрес', HOURS: 'Часы работы', SOCIAL: 'Социальная сеть', OTHER: 'Другое',
};

export const blockDefinitions = [
  { key: 'children', title: 'Дети' },
  { key: 'help', title: 'Как помочь' },
  { key: 'projects', title: 'Проекты' },
  { key: 'publications', title: 'Публикации' },
  { key: 'friends', title: 'Друзья фонда' },
];

export const emptyContact = { type: 'PHONE', label: '', value: '', href: '', isPublic: true, sortOrder: 0 };

export const isSafeContactHref = value => !value || /^(https?:\/\/|mailto:|tel:|\/)/i.test(value);

export const textToDocument = text => ({
  type: 'doc',
  content: String(text || '').split(/\n+/).filter(Boolean).map(value => ({ type: 'paragraph', content: [{ type: 'text', text: value }] })),
});

export const documentToText = document => {
  if (!document || typeof document !== 'object') return '';
  const read = node => {
    if (!node || typeof node !== 'object') return '';
    if (node.type === 'text') return typeof node.text === 'string' ? node.text : '';
    return Array.isArray(node.content) ? node.content.map(read).join(node.type === 'doc' ? '\n' : '') : '';
  };
  return read(document);
};
