import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { useEffect, useImperativeHandle, forwardRef } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  editable?: boolean;
}

export interface RichTextEditorRef {
  editor: Editor | null;
}

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  ({ content, onChange, editable = true }, ref) => {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'text-primary underline cursor-pointer',
          },
        }),
        Underline,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
      ],
      content,
      editable,
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
      },
      editorProps: {
        attributes: {
          class: 'prose prose-base max-w-none focus:outline-none min-h-[500px] prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-3xl prose-h1:mb-4 prose-h2:text-2xl prose-h2:mb-3 prose-h3:text-xl prose-h3:mb-2 prose-p:leading-7 prose-p:mb-4 prose-ul:my-4 prose-ol:my-4 prose-li:my-1 prose-strong:font-semibold prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        },
      },
    });

    useImperativeHandle(ref, () => ({
      editor,
    }));

    useEffect(() => {
      if (editor && content !== editor.getHTML()) {
        editor.commands.setContent(content);
      }
    }, [content, editor]);

    return <EditorContent editor={editor} />;
  }
);
