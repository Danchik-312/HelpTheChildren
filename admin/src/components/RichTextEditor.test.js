import { vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RichTextEditor from './RichTextEditor';

vi.mock('@tiptap/extension-image', () => ({ default: { extend: () => ({ configure: () => ({}) }) } }));
vi.mock('@tiptap/extension-placeholder', () => ({ default: { configure: () => ({}) } }));
vi.mock('@tiptap/starter-kit', () => ({ default: { configure: () => ({}) } }));
vi.mock('@tiptap/react', () => ({
  EditorContent: ({ editor }) => <div>{editor.document.content[0].content[0].text}</div>,
  NodeViewWrapper: ({ children }) => <div>{children}</div>,
  ReactNodeViewRenderer: component => component,
  useEditor: options => {
    const editor = {
      document: options.content,
      getJSON: () => editor.document,
      getAttributes: () => ({}),
      isActive: () => false,
      setEditable: vi.fn(),
      commands: { setContent: value => { editor.document = value; } },
    };
    const chain = {
      focus: () => chain,
      setParagraph: () => chain,
      toggleHeading: () => chain,
      toggleBold: () => chain,
      toggleItalic: () => chain,
      toggleBulletList: () => chain,
      toggleOrderedList: () => chain,
      toggleBlockquote: () => chain,
      extendMarkRange: () => chain,
      unsetLink: () => chain,
      setLink: () => chain,
      setImage: attrs => { editor.document = { ...editor.document, content: [...editor.document.content, { type: 'image', attrs }] }; return chain; },
      run: () => { options.onUpdate({ editor }); return true; },
    };
    editor.chain = () => chain;
    return editor;
  },
}));
vi.mock('./MediaPicker', () => ({ default: ({ onChange }) => <button type="button" onClick={() => onChange({ id: '123e4567-e89b-42d3-a456-426614174000', defaultAlt: 'Фото' })}>Выбрать тестовое изображение</button> }));

test('загружает существующий JSON и сообщает вставленное медиа как JSON', async () => {
  const onChange = vi.fn();
  render(<RichTextEditor value={{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Существующий текст' }] }] }} onChange={onChange} />);
  expect(screen.getByText('Существующий текст')).toBeInTheDocument();
  fireEvent.click(screen.getByTitle('Вставить изображение из медиатеки'));
  fireEvent.click(screen.getByRole('button', { name: 'Выбрать тестовое изображение' }));
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  const lastDocument = onChange.mock.calls.at(-1)[0];
  const image = lastDocument.content.find(node => node.type === 'image');
  expect(image.attrs).toEqual({ mediaId: '123e4567-e89b-42d3-a456-426614174000', alt: 'Фото', title: null });
});
