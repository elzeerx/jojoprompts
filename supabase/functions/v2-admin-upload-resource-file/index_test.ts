// Deno.test suite for v2-admin-upload-resource-file (helpers + handler).
import {
  assertEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildStoragePath,
  extOf,
  handleRequest,
  type HandlerDeps,
  isUuid,
  safeBasename,
  sha256Hex,
  validateUpload,
} from "./index.ts";

const VER = "11111111-2222-4333-8444-555555555555";
const INNER = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

Deno.test("extOf: extracts lowercase extension or null", () => {
  assertEquals(extOf("a.ZIP"), "zip");
  assertEquals(extOf("readme.md"), "md");
  assertStrictEquals(extOf("noext"), null);
  assertStrictEquals(extOf(".hidden"), null);
  assertStrictEquals(extOf("trailing."), null);
});

Deno.test("safeBasename: rejects path separators, control, dotfiles", () => {
  assertEquals(safeBasename("clip.zip"), "clip.zip");
  assertEquals(safeBasename("منشور.zip"), "منشور.zip");
  assertStrictEquals(safeBasename("a/b.zip"), null);
  assertStrictEquals(safeBasename("a\\b.zip"), null);
  assertStrictEquals(safeBasename(""), null);
  assertStrictEquals(safeBasename(".."), null);
  assertStrictEquals(safeBasename("bad\u0000.zip"), null);
  assertStrictEquals(safeBasename("x".repeat(181) + ".zip"), null);
});

Deno.test("isUuid", () => {
  assertEquals(isUuid(VER), true);
  assertEquals(isUuid("not-a-uuid"), false);
});

Deno.test("buildStoragePath is deterministic and namespaced under version", () => {
  assertEquals(
    buildStoragePath(VER, INNER, "a.zip"),
    `${VER}/${INNER}/a.zip`,
  );
});

Deno.test("sha256Hex: lowercase 64-hex; matches known vector", async () => {
  const empty = await sha256Hex(new Uint8Array());
  assertEquals(empty, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  const abc = await sha256Hex(new TextEncoder().encode("abc"));
  assertEquals(abc, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

Deno.test("validateUpload: happy path zip with octet-stream", () => {
  const r = validateUpload({ versionId: VER, fileName: "pkg.zip", size: 1024, mime: "application/octet-stream" });
  assertEquals(r.ok, true);
  assertEquals(r.ext, "zip");
  assertEquals(r.canonicalCt, "application/zip");
});

Deno.test("validateUpload: happy path markdown", () => {
  const r = validateUpload({ versionId: VER, fileName: "readme.md", size: 12, mime: "text/markdown" });
  assertEquals(r.ok, true);
  assertEquals(r.canonicalCt, "text/markdown");
});

Deno.test("validateUpload: rejects unknown extension", () => {
  const r = validateUpload({ versionId: VER, fileName: "malware.exe", size: 100, mime: "application/octet-stream" });
  assertEquals(r.ok, false);
  assertEquals(r.error, "invalid_extension");
});

Deno.test("validateUpload: rejects HTML/JS", () => {
  const r = validateUpload({ versionId: VER, fileName: "x.html", size: 10, mime: "text/html" });
  assertEquals(r.ok, false);
  assertEquals(r.error, "invalid_extension");
});

Deno.test("validateUpload: rejects octet-stream for non-zip", () => {
  const r = validateUpload({ versionId: VER, fileName: "config.json", size: 10, mime: "application/octet-stream" });
  assertEquals(r.ok, false);
  assertEquals(r.error, "invalid_content_type");
});

Deno.test("validateUpload: rejects size 0 and >25 MiB", () => {
  const zero = validateUpload({ versionId: VER, fileName: "a.zip", size: 0, mime: "application/zip" });
  assertEquals(zero.error, "invalid_file_size");
  const big = validateUpload({ versionId: VER, fileName: "a.zip", size: 25 * 1024 * 1024 + 1, mime: "application/zip" });
  assertEquals(big.error, "invalid_file_size");
});

Deno.test("validateUpload: rejects invalid version id", () => {
  const r = validateUpload({ versionId: "nope", fileName: "a.zip", size: 10, mime: "application/zip" });
  assertEquals(r.error, "invalid_version_id");
});

Deno.test("validateUpload: rejects path traversal file name", () => {
  const r = validateUpload({ versionId: VER, fileName: "../evil.zip", size: 10, mime: "application/zip" });
  assertEquals(r.error, "invalid_file_name");
});

Deno.test("no storage-path leakage in json error strings", () => {
  // Sanity check: helper only returns codes, never paths.
  const r = validateUpload({ versionId: VER, fileName: "pkg.zip", size: 0, mime: "application/zip" });
  assertEquals(r.error, "invalid_file_size");
  assertEquals("path" in r, false);
});
