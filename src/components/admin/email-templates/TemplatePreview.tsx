import React, { useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
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
    return DOMPurify.sanitize(content, {
      USE_PROFILES: { html: true },
      ADD_ATTR: [
        "style",
        "align",
        "width",
        "height",
        "bgcolor",
        "cellpadding",
        "cellspacing",
        "border",
      ],
      ADD_TAGS: ["table", "tbody", "tr", "td"],
    });
  }, [html, variables]);

  const processedText = useMemo(() => (text ? interpolate(text, variables) : null), [text, variables]);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  return (
    <div className="rounded-lg border bg-background overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/40">
        <div className="text-sm text-muted-foreground">Subject</div>
        <div className="font-medium">{subject || "(no subject)"}</div>
      </div>
      <div className="p-0">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
          <div className="text-xs text-muted-foreground">Preview</div>
          <div className="flex gap-2">
            <Button size="sm" variant={previewMode === "desktop" ? "default" : "outline"} onClick={() => setPreviewMode("desktop")}>
              Desktop
            </Button>
            <Button size="sm" variant={previewMode === "mobile" ? "default" : "outline"} onClick={() => setPreviewMode("mobile")}>
              Mobile
            </Button>
          </div>
        </div>
        <div className="p-4 bg-muted/20">
          {processedHtml ? (
            <div className="mx-auto" style={{ width: previewMode === "mobile" ? 360 : 600 }}>
              <article
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: processedHtml }}
              />
            </div>
          ) : processedText ? (
            <pre className="whitespace-pre-wrap text-sm text-foreground">{processedText}</pre>
          ) : (
            <div className="text-sm text-muted-foreground">Nothing to preview yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TemplatePreview;
