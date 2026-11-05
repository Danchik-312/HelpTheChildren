import { vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RichTextEditor from './RichTextEditor';

// Keep the real Tiptap/ProseMirror imports; browser layout is outside jsdom's scope.
test('real Tiptap renders JSON, reports toolbar edits and respects read-only state', async () => {
  const onChange = vi.fn();
  const value = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Existing document' }] }] };
  const { container, rerender } = render(<RichTextEditor value={value} onChange={onChange} />);
  await screen.findByText('Existing document');
  const editor = container.querySelector('.tiptap');
  expect(editor).toHaveAttribute('contenteditable', 'true');
  fireEvent.click(screen.getByTitle('Заголовок 2'));
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  const document = onChange.mock.calls.at(-1)[0];
  expect(document.type).toBe('doc');
  // StarterKit can append its trailing empty paragraph after a heading.
  expect(document.content[0]).toEqual({
    type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Existing document' }],
  });
  rerender(<RichTextEditor value={onChange.mock.calls.at(-1)[0]} onChange={onChange} disabled />);
  await waitFor(() => expect(editor).toHaveAttribute('contenteditable', 'false'));
});
