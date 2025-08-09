import React, { useMemo } from "react";
import DOMPurify from "dompurify";

interface TemplatePreviewProps {
  subject?: string;
  html?: string;
  text?: string | null;
  variables?: Record<string, any>;
}

function interpolate(template: string, vars: Record<string, any>) {
  const getter = (path: string) => path.split(".").reduce<any>((acc, key) => (acc ? acc[key] : undefined), vars);
  // Replace {{var}}
  let out = template.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
    const v = getter(key);
    return v == null ? "" : String(v);
  });
  // Also support [[var]] just in case
  out = out.replace(/\[\[\s*([\w.]+)\s*\]\]/g, (_, key) => {
    const v = getter(key);
    return v == null ? "" : String(v);
  });
  return out;
}

export function TemplatePreview({ subject = "", html = "", text, variables = {} }: TemplatePreviewProps) {
  const processedHtml = useMemo(() => {
    const content = interpolate(html || "", variables);
    return DOMPurify.sanitize(content, { USE_PROFILES: { html: true } });
  }, [html, variables]);

  const processedText = useMemo(() => (text ? interpolate(text, variables) : null), [text, variables]);

  return (
    <div className="rounded-lg border bg-background overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/40">
        <div className="text-sm text-muted-foreground">Subject</div>
        <div className="font-medium">{subject || "(no subject)"}</div>
      </div>
      <div className="p-4">
        {processedHtml ? (
          <article
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: processedHtml }}
          />
        ) : processedText ? (
          <pre className="whitespace-pre-wrap text-sm text-foreground">{processedText}</pre>
        ) : (
          <div className="text-sm text-muted-foreground">Nothing to preview yet.</div>
        )}
      </div>
    </div>
  );
}

export default TemplatePreview;
