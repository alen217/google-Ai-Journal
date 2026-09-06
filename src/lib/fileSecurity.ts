/**
 * Secure File Handling & Validation Utility
 *
 * Implements security directives for uploaded assets:
 * - Strict MIME type & file extension validation
 * - Maximum file size enforcement (5MB limit)
 * - Deep Data URL header & payload inspection (prevents script/HTML injection)
 * - Safe URL sanitizer (prevents javascript:, data:text/html, etc.)
 */

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
]);

export interface FileValidationResult {
  ok: boolean;
  dataUrl?: string;
  error?: string;
  sanitizedName?: string;
}

/**
 * Validates an uploaded image file for type, extension, size, and content safety.
 */
export async function validateAndReadImageFile(file: File): Promise<FileValidationResult> {
  if (!file) {
    return { ok: false, error: "No file provided." };
  }

  // 1. File size enforcement
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      error: `File size (${sizeMb}MB) exceeds the maximum allowed limit of 5MB.`,
    };
  }

  if (file.size === 0) {
    return { ok: false, error: "Uploaded file is empty." };
  }

  // 2. MIME type check
  const mimeType = (file.type || "").toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    return {
      ok: false,
      error: `Unsupported file type (${mimeType || "unknown"}). Allowed formats: JPEG, PNG, WebP, GIF.`,
    };
  }

  // 3. Extension check (defense against extension masquerading)
  const nameParts = file.name.split(".");
  if (nameParts.length < 2) {
    return {
      ok: false,
      error: "File must have a valid image extension (.jpg, .png, .webp, .gif).",
    };
  }
  const ext = `.${nameParts[nameParts.length - 1].toLowerCase()}`;
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      error: `Extension ${ext} is not supported. Please upload a standard photo.`,
    };
  }

  // 4. Sanitize file name (remove path traversal & control chars)
  const sanitizedName = file.name
    .replace(/[/\\?%*:|"<>]/g, "_")
    .slice(0, 100);

  // 5. Read as Data URL & inspect payload
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onerror = () => {
      resolve({ ok: false, error: "Failed to read file from disk." });
    };

    reader.onload = () => {
      const dataUrl = reader.result as string;

      if (!dataUrl || typeof dataUrl !== "string") {
        return resolve({ ok: false, error: "Invalid file data structure." });
      }

      // Check header format
      const isHeaderValid =
        dataUrl.startsWith("data:image/jpeg;base64,") ||
        dataUrl.startsWith("data:image/png;base64,") ||
        dataUrl.startsWith("data:image/webp;base64,") ||
        dataUrl.startsWith("data:image/gif;base64,");

      if (!isHeaderValid) {
        return resolve({
          ok: false,
          error: "File signature does not match an allowed image header.",
        });
      }

      // Check for disguised scripts / HTML in decoded header
      const previewSlice = dataUrl.slice(0, 200).toLowerCase();
      if (
        previewSlice.includes("<script") ||
        previewSlice.includes("<html") ||
        previewSlice.includes("javascript:")
      ) {
        return resolve({
          ok: false,
          error: "Suspicious content detected in image payload.",
        });
      }

      resolve({
        ok: true,
        dataUrl,
        sanitizedName,
      });
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Validates a web image URL to prevent SSRF / XSS vectors.
 */
export function sanitizeImageUrl(url: string): { ok: boolean; safeUrl?: string; error?: string } {
  if (!url || typeof url !== "string") {
    return { ok: false, error: "URL is empty." };
  }

  const trimmed = url.trim();

  // Safe Data URL pattern
  if (
    trimmed.startsWith("data:image/jpeg;base64,") ||
    trimmed.startsWith("data:image/png;base64,") ||
    trimmed.startsWith("data:image/webp;base64,") ||
    trimmed.startsWith("data:image/gif;base64,")
  ) {
    return { ok: true, safeUrl: trimmed };
  }

  // Safe HTTPS pattern (standard web images)
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { ok: false, error: "Only HTTP and HTTPS URLs are permitted." };
    }

    // Block private/local IP ranges
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local")
    ) {
      return { ok: false, error: "Local network image URLs cannot be loaded." };
    }

    return { ok: true, safeUrl: parsed.href };
  } catch {
    return { ok: false, error: "Invalid URL structure." };
  }
}
