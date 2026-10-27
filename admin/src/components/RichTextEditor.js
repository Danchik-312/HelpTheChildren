import { useEffect, useState } from 'react';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import MediaPicker from './MediaPicker';
import PrivateMediaPreview from './PrivateMediaPreview';
import { safeLinkHref } from './contentSafety';
import styles from './RichTextEditor.module.css';

function comparableDocument(value) {
  const normalize = (item, key = '') => {
    if (Array.isArray(item)) {
      const result = item.map(child => normalize(child));
      return (key === 'content' || key === 'marks') && result.length === 0 ? undefined : result;
    }
    if (!item || typeof item !== 'object') return item;
    const result = {};
    Object.keys(item).sort().forEach(childKey => {
      const child = normalize(item[childKey], childKey);
      if (child === undefined || child === null) return;
      if (childKey === 'attrs' && Object.keys(child).length === 0) return;
      result[childKey] = child;
    });
    return result;
  };
  return JSON.stringify(normalize(value));
}

function MediaImageView({ node }) {
  return <NodeViewWrapper className={styles.mediaNode}><PrivateMediaPreview media={{ id: node.attrs.mediaId, kind: 'IMAGE', defaultAlt: node.attrs.alt }} alt={node.attrs.alt || ''} /></NodeViewWrapper>;
}

const MediaImage = Image.extend({
  addAttributes() {
    return { mediaId: { default: null }, alt: { default: '' }, title: { default: null } };
  },
  addNodeView() {
    return ReactNodeViewRenderer(MediaImageView);
  },
});

const extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
    code: false,
    codeBlock: false,
    horizontalRule: false,
    strike: false,
    underline: false,
    link: {
      openOnClick: false,
      autolink: false,
      defaultProtocol: 'https',
      protocols: ['https', 'mailto'],
      isAllowedUri: value => Boolean(safeLinkHref(value)),
      HTMLAttributes: { rel: 'noopener noreferrer' },
    },
  }),
  MediaImage.configure({ inline: false, allowBase64: false }),
  Placeholder.configure({ placeholder: 'Начните писать материал…' }),
];

function ToolbarButton({ active = false, children, onClick, title }) {
  return <button type="button" className={active ? styles.active : ''} aria-pressed={active} title={title} onClick={onClick}>{children}</button>;
}

export default function RichTextEditor({ value, onChange, disabled = false }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const editor = useEditor({
    extensions,
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => onChange(current.getJSON()),
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor || !value) return;
    if (comparableDocument(editor.getJSON()) !== comparableDocument(value)) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return <div className={styles.loading}>Загрузка редактора…</div>;

  const editLink = () => {
    const previous = editor.getAttributes('link').href || '';
    const entered = window.prompt('Введите безопасную ссылку (https://, mailto: или внутренний путь):', previous);
    if (entered === null) return;
    if (!entered.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const href = safeLinkHref(entered);
    if (!href) {
      window.alert('Разрешены только HTTPS, mailto и внутренние ссылки.');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  const insertImage = item => {
    editor.chain().focus().setImage({ mediaId: item.id, alt: item.defaultAlt || '', title: item.caption || null }).run();
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar} role="toolbar" aria-label="Форматирование текста">
        <ToolbarButton active={editor.isActive('paragraph')} title="Обычный текст" onClick={() => editor.chain().focus().setParagraph().run()}>Текст</ToolbarButton>
        {[2, 3, 4].map(level => <ToolbarButton key={level} active={editor.isActive('heading', { level })} title={`Заголовок ${level}`} onClick={() => editor.chain().focus().toggleHeading({ level }).run()}>H{level}</ToolbarButton>)}
        <span className={styles.separator} aria-hidden="true" />
        <ToolbarButton active={editor.isActive('bold')} title="Полужирный" onClick={() => editor.chain().focus().toggleBold().run()}><strong>Ж</strong></ToolbarButton>
        <ToolbarButton active={editor.isActive('italic')} title="Курсив" onClick={() => editor.chain().focus().toggleItalic().run()}><em>К</em></ToolbarButton>
        <ToolbarButton active={editor.isActive('bulletList')} title="Маркированный список" onClick={() => editor.chain().focus().toggleBulletList().run()}>• Список</ToolbarButton>
        <ToolbarButton active={editor.isActive('orderedList')} title="Нумерованный список" onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. Список</ToolbarButton>
        <ToolbarButton active={editor.isActive('blockquote')} title="Цитата" onClick={() => editor.chain().focus().toggleBlockquote().run()}>Цитата</ToolbarButton>
        <ToolbarButton active={editor.isActive('link')} title="Добавить или изменить ссылку" onClick={editLink}>Ссылка</ToolbarButton>
        <button type="button" title="Вставить изображение из медиатеки" onClick={() => setPickerOpen(true)}>Изображение</button>
      </div>
      <EditorContent editor={editor} className={styles.content} />
      {pickerOpen && <MediaPicker title="Вставьте изображение" value={null} onClose={() => setPickerOpen(false)} onChange={insertImage} />}
    </div>
  );
}
