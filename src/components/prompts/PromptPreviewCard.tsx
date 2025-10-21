import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface PromptPreviewCardProps {
  title: string;
  content: string;
  language?: string;
  showCopy?: boolean;
  showLineNumbers?: boolean;
  maxHeight?: string;
  className?: string;
}

export function PromptPreviewCard({
  title,
  content,
  language = 'text',
  showCopy = true,
  showLineNumbers = false,
  maxHeight = '400px',
  className
}: PromptPreviewCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  const lines = content.split('\n');

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          {showCopy && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="h-8"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
          )}
        </div>
        <CardDescription>
          {lines.length} {lines.length === 1 ? 'line' : 'lines'} · {content.length} characters
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div 
          className="relative rounded-lg bg-muted p-4 overflow-auto font-mono text-sm"
          style={{ maxHeight }}
        >
          {showLineNumbers ? (
            <table className="w-full">
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index}>
                    <td className="pr-4 text-muted-foreground select-none text-right align-top" style={{ minWidth: '3em' }}>
                      {index + 1}
                    </td>
                    <td className="whitespace-pre-wrap break-words">
                      {line || '\n'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <pre className="whitespace-pre-wrap break-words">{content}</pre>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
