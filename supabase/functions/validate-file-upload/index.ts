
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

// Allowed file types with their MIME types
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
];

const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

function sanitizeFilename(filename: string): string {
  // Remove or replace dangerous characters
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 255);
}

function validateFileType(mimeType: string, fileType: 'image' | 'document'): boolean {
  const allowedTypes = fileType === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_DOCUMENT_TYPES;
  return allowedTypes.includes(mimeType);
}

function validateFileSize(size: number, fileType: 'image' | 'document'): boolean {
  const maxSize = fileType === 'image' ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
  return size <= maxSize;
}

function detectMaliciousPatterns(filename: string, content?: ArrayBuffer): boolean {
  // Check filename for suspicious patterns
  const suspiciousPatterns = [
    /\.exe$/i,
    /\.bat$/i,
    /\.cmd$/i,
    /\.scr$/i,
    /\.vbs$/i,
    /\.js$/i,
    /\.jar$/i,
    /\.php$/i,
    /\.asp$/i,
    /\.jsp$/i
  ];

  if (suspiciousPatterns.some(pattern => pattern.test(filename))) {
    return true;
  }

  // Basic content analysis for images
  if (content && content.byteLength > 0) {
    const bytes = new Uint8Array(content.slice(0, 100));
    
    // Check for script tags in SVG files
    const textContent = new TextDecoder().decode(bytes);
    if (textContent.includes('<script') || textContent.includes('javascript:')) {
      return true;
    }
  }

  return false;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405
    });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileType = formData.get('fileType') as string;

    if (!file) {
      return new Response(JSON.stringify({ 
        isValid: false, 
        error: "No file provided" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    // Validate file type
    if (!fileType || !['image', 'document'].includes(fileType)) {
      return new Response(JSON.stringify({ 
        isValid: false, 
        error: "Invalid file type specified" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    // Validate MIME type
    if (!validateFileType(file.type, fileType as 'image' | 'document')) {
      return new Response(JSON.stringify({ 
        isValid: false, 
        error: `File type ${file.type} not allowed for ${fileType} uploads` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    // Validate file size
    if (!validateFileSize(file.size, fileType as 'image' | 'document')) {
      const maxSize = fileType === 'image' ? '5MB' : '10MB';
      return new Response(JSON.stringify({ 
        isValid: false, 
        error: `File size exceeds ${maxSize} limit` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    // Get file content for analysis
    const fileContent = await file.arrayBuffer();

    // Check for malicious patterns
    if (detectMaliciousPatterns(file.name, fileContent)) {
      return new Response(JSON.stringify({ 
        isValid: false, 
        error: "File contains potentially malicious content" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    // Sanitize filename
    const sanitizedFilename = sanitizeFilename(file.name);

    return new Response(JSON.stringify({ 
      isValid: true, 
      sanitizedFilename,
      fileSize: file.size,
      mimeType: file.type
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("File validation error:", error);
    return new Response(JSON.stringify({ 
      isValid: false, 
      error: "File validation failed" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});
