import React, { useState, useRef, useEffect } from 'react';
import { 
  Bold, 
  Italic, 
  Code, 
  Link, 
  List, 
  ListOrdered, 
  Quote, 
  Undo, 
  Redo,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  features?: string[];
  maxLength?: number;
  disabled?: boolean;
}

interface FormatAction {
  name: string;
  icon: React.ReactNode;
  action: () => void;
  isActive?: boolean;
  shortcut?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Enter your text...",
  className,
  features = ['bold', 'italic', 'code', 'link'],
  maxLength,
  disabled = false
}: RichTextEditorProps) {
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Save current selection
  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const start = getTextOffset(range.startContainer, range.startOffset);
      const end = getTextOffset(range.endContainer, range.endOffset);
      setSelection({ start, end });
    }
  };

  // Restore selection
  const restoreSelection = () => {
    if (!selection || !editorRef.current) return;
    
    const range = document.createRange();
    const startNode = getNodeAtOffset(editorRef.current, selection.start);
    const endNode = getNodeAtOffset(editorRef.current, selection.end);
    
    if (startNode && endNode) {
      range.setStart(startNode.node, startNode.offset);
      range.setEnd(endNode.node, endNode.offset);
      
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  };

  // Helper functions for selection management
  const getTextOffset = (node: Node, offset: number): number => {
    let totalOffset = 0;
    const walker = document.createTreeWalker(
      editorRef.current!,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentNode = walker.nextNode();
    while (currentNode) {
      if (currentNode === node) {
        return totalOffset + offset;
      }
      totalOffset += currentNode.textContent?.length || 0;
      currentNode = walker.nextNode();
    }
    return totalOffset;
  };

  const getNodeAtOffset = (root: Node, offset: number): { node: Node; offset: number } | null => {
    let currentOffset = 0;
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentNode = walker.nextNode();
    while (currentNode) {
      const nodeLength = currentNode.textContent?.length || 0;
      if (currentOffset + nodeLength >= offset) {
        return {
          node: currentNode,
          offset: offset - currentOffset
        };
      }
      currentOffset += nodeLength;
      currentNode = walker.nextNode();
    }
    return null;
  };

  // Format actions
  const formatActions: FormatAction[] = [
    {
      name: 'bold',
      icon: <Bold className="h-4 w-4" />,
      action: () => document.execCommand('bold', false),
      shortcut: 'Ctrl+B'
    },
    {
      name: 'italic',
      icon: <Italic className="h-4 w-4" />,
      action: () => document.execCommand('italic', false),
      shortcut: 'Ctrl+I'
    },
    {
      name: 'code',
      icon: <Code className="h-4 w-4" />,
      action: () => {
        const selection = window.getSelection();
        if (selection && selection.toString()) {
          const range = selection.getRangeAt(0);
          const codeElement = document.createElement('code');
          range.surroundContents(codeElement);
          onChange(editorRef.current?.innerHTML || '');
        }
      },
      shortcut: 'Ctrl+`'
    },
    {
      name: 'link',
      icon: <Link className="h-4 w-4" />,
      action: () => {
        const selection = window.getSelection();
        if (selection && selection.toString()) {
          setLinkText(selection.toString());
          setIsLinkDialogOpen(true);
        }
      },
      shortcut: 'Ctrl+K'
    },
    {
      name: 'list',
      icon: <List className="h-4 w-4" />,
      action: () => document.execCommand('insertUnorderedList', false),
      shortcut: 'Ctrl+L'
    },
    {
      name: 'orderedList',
      icon: <ListOrdered className="h-4 w-4" />,
      action: () => document.execCommand('insertOrderedList', false),
      shortcut: 'Ctrl+Shift+L'
    },
    {
      name: 'quote',
      icon: <Quote className="h-4 w-4" />,
      action: () => document.execCommand('formatBlock', false, 'blockquote'),
      shortcut: 'Ctrl+Q'
    },
    {
      name: 'alignLeft',
      icon: <AlignLeft className="h-4 w-4" />,
      action: () => document.execCommand('justifyLeft', false)
    },
    {
      name: 'alignCenter',
      icon: <AlignCenter className="h-4 w-4" />,
      action: () => document.execCommand('justifyCenter', false)
    },
    {
      name: 'alignRight',
      icon: <AlignRight className="h-4 w-4" />,
      action: () => document.execCommand('justifyRight', false)
    }
  ];

  // Filter actions based on features prop
  const availableActions = formatActions.filter(action => 
    features.includes(action.name)
  );

  // Handle editor input
  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      onChange(html);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    // Save selection before formatting
    saveSelection();

    // Handle shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          document.execCommand('bold', false);
          break;
        case 'i':
          e.preventDefault();
          document.execCommand('italic', false);
          break;
        case 'k':
          e.preventDefault();
          const action = availableActions.find(a => a.name === 'link');
          action?.action();
          break;
        case 'l':
          e.preventDefault();
          if (e.shiftKey) {
            document.execCommand('insertOrderedList', false);
          } else {
            document.execCommand('insertUnorderedList', false);
          }
          break;
        case 'q':
          e.preventDefault();
          document.execCommand('formatBlock', false, 'blockquote');
          break;
        case 'z':
          e.preventDefault();
          if (e.shiftKey) {
            document.execCommand('redo', false);
          } else {
            document.execCommand('undo', false);
          }
          break;
      }
    }

    // Check max length
    if (maxLength && editorRef.current) {
      const textLength = editorRef.current.textContent?.length || 0;
      if (textLength >= maxLength && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
      }
    }
  };

  // Insert link
  const insertLink = () => {
    if (linkUrl && linkText) {
      const linkElement = document.createElement('a');
      linkElement.href = linkUrl;
      linkElement.textContent = linkText;
      
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(linkElement);
        onChange(editorRef.current?.innerHTML || '');
      }
    }
    
    setIsLinkDialogOpen(false);
    setLinkUrl('');
    setLinkText('');
  };

  // Handle formatting action
  const handleFormatAction = (action: FormatAction) => {
    if (disabled) return;
    
    restoreSelection();
    action.action();
    onChange(editorRef.current?.innerHTML || '');
  };

  // Update editor content when value changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value && !editorRef.current.matches(':focus')) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  return (
    <div className={cn("border rounded-lg", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b bg-gray-50">
        {availableActions.map((action) => (
          <Button
            key={action.name}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleFormatAction(action)}
            disabled={disabled}
            className="h-8 w-8 p-0"
            title={`${action.name} (${action.shortcut})`}
          >
            {action.icon}
          </Button>
        ))}
        
        <div className="flex-1" />
        
        {maxLength && (
          <span className="text-xs text-gray-500">
            {(editorRef.current?.textContent?.length || 0)} / {maxLength}
          </span>
        )}
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        spellCheck={true}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onBlur={saveSelection}
        onFocus={saveSelection}
        className={cn(
          "min-h-[200px] p-4 focus:outline-none",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        data-placeholder={placeholder}
        style={{
          '--placeholder-color': '#9ca3af'
        } as React.CSSProperties}
      />

      {/* Link Dialog */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Link Text</label>
              <Input
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Link text"
              />
            </div>
            <div>
              <label className="text-sm font-medium">URL</label>
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                type="url"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsLinkDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={insertLink}>
                Insert Link
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Placeholder styles */}
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: var(--placeholder-color);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
} 