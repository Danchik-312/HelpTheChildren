const fieldNames = {
  title: 'Заголовок',
  slug: 'Slug',
  group: 'Группа',
  description: 'Описание',
  excerpt: 'Краткое описание',
  summary: 'Краткое описание',
  body: 'Содержание',
  storyBody: 'История ребёнка',
  sortOrder: 'Порядок',
  publicDisplayName: 'Публичное имя',
  supportReason: 'Причина поддержки',
  sidePhotos: 'Фотографии слева от текста',
};

export function contentFormError(error) {
  if (error.code !== 'VALIDATION_ERROR') return error.message;
  const messages = Object.entries(error.fields ?? {}).map(([path, message]) => {
    const [field] = path.split('.');
    return (Object.hasOwn(fieldNames, field) ? fieldNames[field] : path) + ' — ' + message;
  });
  return messages.length ? [...new Set(messages)].join(' ') : error.message;
}
