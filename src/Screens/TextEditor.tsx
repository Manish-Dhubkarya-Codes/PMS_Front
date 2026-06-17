import React, { useEffect, useRef } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { FiX } from "react-icons/fi";

interface TextEditorProps {
  initialText?: string;
  onChange?: (text: string) => void;
  placeholder?: string;
  onFileUpload?: (file: File) => Promise<string>; // UPDATED: Universal file upload handler (returns URL for any file type)
  onClose?: () => void; // NEW: Optional close handler for update mode
}

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['link', 'image'], // 'image' button now triggers universal file upload handler
    ['clean'],
  ],
};
const icons = Quill.import('ui/icons');
icons.image = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-paperclip-icon lucide-paperclip"><path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/></svg>
`;

const formats = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'list', 'bullet',
  'blockquote', 'code-block',
  'link', 'image',
];

const QuillEditor: React.FC<TextEditorProps> = ({ initialText = '', onChange, placeholder, onFileUpload, onClose }) => {
  const quillRef = useRef<ReactQuill>(null);

  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (quill && onFileUpload) {
      // Custom universal file upload handler
const fileHandler = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '*/*';
  input.multiple = true; // ✅ allow multiple files
  input.click();

  input.onchange = async () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;

const range = quill.getSelection(true);
let insertIndex = range.index;

    for (const file of files) {
      try {
        const fileUrl = await onFileUpload!(file);

        if (file.type.startsWith('image/')) {
          quill.insertEmbed(insertIndex, 'image', fileUrl);
          insertIndex += 1;
        } else {
          quill.insertText(insertIndex, file.name, 'link', fileUrl);
          insertIndex += file.name.length + 1;
        }
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }

    quill.setSelection(insertIndex, 0);
    onChange?.(quill.root.innerHTML);
  };
};

      // Override default image handler with universal file handler
      (quill.getModule('toolbar') as any).addHandler('image', fileHandler);
    }
  }, [onFileUpload, onChange]);

  return (
    <div className={`w-full max-w-auto p-4 bg-white rounded-md shadow-lg relative ${onClose ? 'pb-8' : ''}`}>
      {onClose && (
        <div
          className="absolute cursor-pointer top-2 right-2 p-1 rounded-full bg-red-50 hover:bg-red-100 transition-all duration-300 z-10"
          onClick={onClose}
        >
          <FiX size={15} color="#E6656B" />
        </div>
      )}
      <ReactQuill
        ref={quillRef}
        value={initialText}
        onChange={onChange}
        placeholder={placeholder || 'Start writing your amazing content here...'}
        modules={modules}
        formats={formats}
        theme="snow"
        className="text-lg no-scrollbar"
      />
      <style>{`
        .ql-container {
          min-height: 200px;
          max-height: 200px;
        }
        .ql-editor {
          min-height: 200px;
          max-height: 200px;
        }
      `}</style>
    </div>
  );
};

export default QuillEditor;