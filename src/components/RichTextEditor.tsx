import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import Strike from '@tiptap/extension-strike';
import { useEffect, useImperativeHandle, forwardRef } from 'react';
import { formatDocumentContent } from '@/utils/formatDocument';

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
    const formattedContent = formatDocumentContent(content);
    
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
          bulletList: false,
          orderedList: false,
          listItem: false,
          strike: false, // We'll use the dedicated Strike extension
        }),
        BulletList.configure({
          keepMarks: true,
          keepAttributes: false,
        }),
        OrderedList.configure({
          keepMarks: true,
          keepAttributes: false,
        }),
        ListItem,
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'text-primary underline cursor-pointer',
          },
        }),
        Underline,
        Strike,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
      ],
      content: formattedContent,
      editable,
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
      },
      editorProps: {
        attributes: {
          class: 'prose prose-lg max-w-none focus:outline-none min-h-[500px] prose-headings:font-bold prose-headings:tracking-tight prose-h1:text-4xl prose-h1:mb-6 prose-h1:mt-8 prose-h2:text-3xl prose-h2:mb-5 prose-h2:mt-7 prose-h3:text-2xl prose-h3:mb-4 prose-h3:mt-6 prose-p:text-base prose-p:leading-relaxed prose-p:mb-6 prose-p:text-foreground prose-ul:my-6 prose-ul:list-disc prose-ul:pl-6 prose-ol:my-6 prose-ol:list-decimal prose-ol:pl-6 prose-li:my-2 prose-li:text-base prose-li:leading-relaxed prose-strong:font-bold prose-strong:text-foreground prose-em:italic prose-a:text-primary prose-a:underline hover:prose-a:text-primary/80 prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic',
        },
      },
    });

    useImperativeHandle(ref, () => ({
      editor,
    }));

    useEffect(() => {
      if (editor && content !== editor.getHTML()) {
        const formatted = formatDocumentContent(content);
        editor.commands.setContent(formatted);
      }
    }, [content, editor]);

    return <EditorContent editor={editor} />;
  }
);
