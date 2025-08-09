import React from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

interface RichHtmlEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

// Minimal, focused rich editor configured for email-safe content
export function RichHtmlEditor({ value, onChange, placeholder }: RichHtmlEditorProps) {
  const modules = {
    toolbar: [
      [{ header: [2, 3, false] }],
      ["bold", "italic", "underline"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["link"],
      ["clean"],
    ],
  } as const;

  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "list",
    "bullet",
    "link",
  ];

  return (
    <div className="rounded-md border bg-background">
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        modules={modules}
        formats={formats}
      />
    </div>
  );
}

export default RichHtmlEditor;
