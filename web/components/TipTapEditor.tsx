'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect, useState, useRef } from 'react';
import StarterKit from '@tiptap/starter-kit';
import { Heading } from '@tiptap/extension-heading';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  LinkIcon,
  PaintBrushIcon,
  SwatchIcon,
  ListBulletIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
} from '@heroicons/react/24/outline';
import {
  BoldIcon as BoldIconSolid,
  ItalicIcon as ItalicIconSolid,
  UnderlineIcon as UnderlineIconSolid,
  StrikethroughIcon as StrikethroughIconSolid,
} from '@heroicons/react/24/solid';

interface TipTapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

// Color palette
const TEXT_COLORS = [
  { label: 'Black', value: '#000000' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Pink', value: '#ec4899' },
];

const HIGHLIGHT_COLORS = [
  { label: 'Yellow', value: '#fef08a' },
  { label: 'Green', value: '#bbf7d0' },
  { label: 'Blue', value: '#bfdbfe' },
  { label: 'Pink', value: '#fce7f3' },
  { label: 'Orange', value: '#fed7aa' },
  { label: 'Purple', value: '#e9d5ff' },
  { label: 'Red', value: '#fecaca' },
];

export default function TipTapEditor({ content, onChange, placeholder }: TipTapEditorProps) {
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const textColorRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const linkPopoverRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  const [editorState, setEditorState] = useState({
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrike: false,
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Heading.configure({
        levels: [1, 2, 3],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      TextStyle,
      Color,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer',
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl focus:outline-none min-h-[300px] p-4 max-w-none text-black',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
      updateEditorState(editor);
    },
    onSelectionUpdate: ({ editor }) => {
      updateEditorState(editor);
    },
    onFocus: ({ editor }) => {
      updateEditorState(editor);
    },
  });

  const updateEditorState = (editorInstance: any) => {
    if (!editorInstance) return;
    setEditorState({
      isBold: editorInstance.isActive('bold'),
      isItalic: editorInstance.isActive('italic'),
      isUnderline: editorInstance.isActive('underline'),
      isStrike: editorInstance.isActive('strike'),
    });
  };

  useEffect(() => {
    if (editor) {
      updateEditorState(editor);
    }
  }, [editor]);

  // Close color pickers and link popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (textColorRef.current && !textColorRef.current.contains(event.target as Node)) {
        setShowTextColorPicker(false);
      }
      if (highlightRef.current && !highlightRef.current.contains(event.target as Node)) {
        setShowHighlightPicker(false);
      }
      if (linkPopoverRef.current && !linkPopoverRef.current.contains(event.target as Node)) {
        setShowLinkPopover(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus link input when popover opens
  useEffect(() => {
    if (showLinkPopover && linkInputRef.current) {
      linkInputRef.current.focus();
      // Get current link URL if link is active
      if (editor && editor.isActive('link')) {
        const attrs = editor.getAttributes('link');
        setLinkUrl(attrs.href || '');
      } else {
        setLinkUrl('');
      }
    }
  }, [showLinkPopover, editor]);

  // Update editor content when content prop changes (important for edit mode)
  useEffect(() => {
    if (editor && content !== undefined) {
      const currentContent = editor.getHTML();
      // Only update if content actually changed to avoid unnecessary updates
      if (currentContent !== content) {
        editor.commands.setContent(content, { emitUpdate: false });
      }
    }
  }, [content, editor]);

  const getActiveTextColor = () => {
    if (!editor) return '#000000';
    return editor.getAttributes('textStyle').color || '#000000';
  };

  const getActiveHighlight = () => {
    if (!editor) return null;
    const highlight = editor.getAttributes('highlight');
    return highlight.color || highlight.backgroundColor || null;
  };

  const applyTextColor = (color: string) => {
    if (!editor) return;
    editor.chain().focus().setColor(color).run();
    setShowTextColorPicker(false);
  };

  const applyHighlight = (color: string) => {
    if (!editor) return;
    editor.chain().focus().toggleHighlight({ color }).run();
    setShowHighlightPicker(false);
  };

  const removeHighlight = () => {
    if (!editor) return;
    editor.chain().focus().unsetHighlight().run();
    setShowHighlightPicker(false);
  };

  const isLinkActive = () => {
    if (!editor) return false;
    return editor.isActive('link');
  };

  const getLinkUrl = () => {
    if (!editor) return '';
    const attrs = editor.getAttributes('link');
    return attrs.href || '';
  };

  const handleSetLink = () => {
    if (!editor) return;
    
    if (linkUrl.trim()) {
      const url = linkUrl.trim().startsWith('http://') || linkUrl.trim().startsWith('https://') 
        ? linkUrl.trim() 
        : `https://${linkUrl.trim()}`;
      
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    
    setShowLinkPopover(false);
    setLinkUrl('');
  };

  const handleRemoveLink = () => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
    setShowLinkPopover(false);
    setLinkUrl('');
  };

  const handleLinkButtonClick = () => {
    if (!editor) return;
    
    if (editor.isActive('link')) {
      // If link is active, open popover with current URL
      const currentUrl = getLinkUrl();
      setLinkUrl(currentUrl);
      setShowLinkPopover(true);
    } else {
      // If no link, open popover for new link
      setLinkUrl('');
      setShowLinkPopover(true);
    }
  };

  if (!editor) {
    return null;
  }

  const activeTextColor = getActiveTextColor();
  const activeHighlight = getActiveHighlight();

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
      {/* Toolbar */}
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 flex flex-wrap items-center gap-2">
        {/* B, I, U, Strikethrough */}
        <button
          type="button"
          onClick={() => {
            editor.chain().focus().toggleBold().run();
            updateEditorState(editor);
          }}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-gray-200 ${
            editorState.isBold ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700'
          }`}
          title="Bold"
        >
          {editorState.isBold ? (
            <BoldIconSolid className="w-5 h-5" />
          ) : (
            <BoldIcon className="w-5 h-5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            editor.chain().focus().toggleItalic().run();
            updateEditorState(editor);
          }}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-gray-200 ${
            editorState.isItalic ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700'
          }`}
          title="Italic"
        >
          {editorState.isItalic ? (
            <ItalicIconSolid className="w-5 h-5" />
          ) : (
            <ItalicIcon className="w-5 h-5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            editor.chain().focus().toggleUnderline().run();
            updateEditorState(editor);
          }}
          className={`p-2 rounded hover:bg-gray-200 ${
            editorState.isUnderline ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700'
          }`}
          title="Underline"
        >
          {editorState.isUnderline ? (
            <UnderlineIconSolid className="w-5 h-5" />
          ) : (
            <UnderlineIcon className="w-5 h-5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            editor.chain().focus().toggleStrike().run();
            updateEditorState(editor);
          }}
          className={`p-2 rounded hover:bg-gray-200 ${
            editorState.isStrike ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700'
          }`}
          title="Strikethrough"
        >
          {editorState.isStrike ? (
            <StrikethroughIconSolid className="w-5 h-5" />
          ) : (
            <StrikethroughIcon className="w-5 h-5" />
          )}
        </button>
        
        <div className="w-px h-6 bg-gray-300"></div>
        
        {/* Link, Background Color, Text Color */}
        <div className="relative" ref={linkPopoverRef}>
          {/* <button
            type="button"
            onClick={handleLinkButtonClick}
            className={`p-2 rounded hover:bg-gray-200 ${
              isLinkActive() ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700'
            }`}
            title="Link"
          >
            <LinkIcon className="w-5 h-5" />
          </button> */}
          {showLinkPopover && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-[60] min-w-[280px]">
              <div className="space-y-2">
                <input
                  ref={linkInputRef}
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSetLink();
                    } else if (e.key === 'Escape') {
                      setShowLinkPopover(false);
                      editor?.chain().focus().run();
                    }
                  }}
                  placeholder="Enter URL..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-black"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSetLink}
                    className="flex-1 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                  >
                    {isLinkActive() ? 'Update' : 'Add'} Link
                  </button>
                  {isLinkActive() && (
                    <button
                      type="button"
                      onClick={handleRemoveLink}
                      className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Highlight Color Picker */}
<div className="relative" ref={highlightRef}>
<button
    type="button"
    onClick={() => {
      setShowHighlightPicker(!showHighlightPicker);
      setShowTextColorPicker(false);
    }}
    className={`p-2 rounded hover:bg-gray-200 ${
      activeHighlight ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700'
    }`}
    title="Background Color"
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10l4-4V7l-4-4H7l-4 4v10l4 4z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v8" />
      <rect x="9" y="11" width="6" height="4" fill="currentColor" opacity="0.3"/>
    </svg>
  </button>
  {showHighlightPicker && (
    <div className="absolute top-full left-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-[55] min-w-[180px]">
      <div className="mb-2">
        <span className="text-xs font-medium text-gray-600 block mb-2">Background Color</span>
        <div className="grid grid-cols-4 gap-2">
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => applyHighlight(color.value)}
              className={`relative w-8 h-8 rounded transition-transform hover:scale-110 ${
                activeHighlight === color.value 
                  ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' 
                  : 'border border-gray-300'
              }`}
              style={{ backgroundColor: color.value }}
              title={color.label}
            >
              {activeHighlight === color.value && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white drop-shadow-md" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      {activeHighlight && (
        <button
          type="button"
          onClick={removeHighlight}
          className="w-full mt-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors"
        >
          Remove Highlight
        </button>
      )}
    </div>
  )}
</div>

{/* Text Color Picker */}
<div className="relative" ref={textColorRef}>
<button
    type="button"
    onClick={() => {
      setShowTextColorPicker(!showTextColorPicker);
      setShowHighlightPicker(false);
    }}
    className={`p-2 rounded hover:bg-gray-200 ${
      activeTextColor !== '#000000' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700'
    }`}
    title="Text Color"
  >
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
      <text x="12" y="16" fontSize="14" fontWeight="bold" textAnchor="middle" fill="currentColor">A</text>
      <rect x="6" y="18" width="12" height="3" rx="1" fill="currentColor"/>
    </svg>
  </button>
  {showTextColorPicker && (
    <div className="absolute top-full left-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-[55] min-w-[180px]">
      <div className="mb-2">
        <span className="text-xs font-medium text-gray-600 block mb-2">Text Color</span>
        <div className="grid grid-cols-4 gap-2">
          {TEXT_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => applyTextColor(color.value)}
              className={`relative w-8 h-8 rounded transition-transform hover:scale-110 ${
                activeTextColor === color.value 
                  ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' 
                  : 'border border-gray-300'
              }`}
              style={{ backgroundColor: color.value }}
              title={color.label}
            >
              {activeTextColor === color.value && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white drop-shadow-md" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => applyTextColor('#000000')}
        className="w-full mt-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
      >
        Reset to Black
      </button>
    </div>
  )}
</div>

        <div className="w-px h-6 bg-gray-300"></div>
        
        {/* Text Alignment Buttons */}
        {/* Align Left */}
<button
  type="button"
  onClick={() => editor.chain().focus().setTextAlign('left').run()}
  className={`p-2 rounded hover:bg-gray-200 ${
    editor.isActive({ textAlign: 'left' }) ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700'
  }`}
  title="Align Left"
>
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h10M4 14h16M4 18h10" />
  </svg>
</button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`p-2 rounded hover:bg-gray-200 ${
            editor.isActive({ textAlign: 'center' }) ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700'
          }`}
          title="Align Center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M6 14h12M3 18h18M3 6h18" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`p-2 rounded hover:bg-gray-200 ${
            editor.isActive({ textAlign: 'right' }) ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700'
          }`}
          title="Align Right"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M9 14h12M3 18h18M3 6h18" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={`p-2 rounded hover:bg-gray-200 ${
            editor.isActive({ textAlign: 'justify' }) ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700'
          }`}
          title="Justify"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M3 10h18M3 14h18M3 18h18" />
          </svg>
        </button>
        
        <div className="w-px h-6 bg-gray-300"></div>
        
        {/* H1, H2, H3 */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-2 rounded hover:bg-gray-200 ${
            editor.isActive('heading', { level: 1 }) ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700'
          }`}
          title="Heading 1"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded hover:bg-gray-200 ${
            editor.isActive('heading', { level: 2 }) ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700'
          }`}
          title="Heading 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-2 rounded hover:bg-gray-200 ${
            editor.isActive('heading', { level: 3 }) ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700'
          }`}
          title="Heading 3"
        >
          H3
        </button>
        
        <div className="w-px h-6 bg-gray-300"></div>
        
        {/* Unordered List (Bullet List) */}
<button
  type="button"
  onClick={() => editor.chain().focus().toggleBulletList().run()}
  className={`p-2 rounded hover:bg-gray-200 ${
    editor.isActive('bulletList') ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700'
  }`}
  title="Bullet List"
>
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
</button>

{/* Ordered List (Numbered List) - Improved Icon */}
<button
  type="button"
  onClick={() => editor.chain().focus().toggleOrderedList().run()}
  className={`p-2 rounded hover:bg-gray-200 ${
    editor.isActive('orderedList') ? 'bg-indigo-100 text-indigo-700' : 'text-gray-700'
  }`}
  title="Ordered List"
>
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 6h12M9 12h12M9 18h12" />
    <text x="3" y="9" fill="currentColor" fontSize="8" fontWeight="bold">1</text>
    <text x="3" y="15" fill="currentColor" fontSize="8" fontWeight="bold">2</text>
    <text x="3" y="21" fill="currentColor" fontSize="8" fontWeight="bold">3</text>
  </svg>
</button>
        
        <div className="w-px h-6 bg-gray-300"></div>
        
        {/* Undo/Redo Buttons */}
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          className="p-2 rounded hover:bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
        >
          <ArrowUturnLeftIcon className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          className="p-2 rounded hover:bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Redo (Ctrl+Shift+Z)"
        >
          <ArrowUturnRightIcon className="w-5 h-5" />
        </button>
      </div>
      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}

