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

// ---------------- Handler tests ----------------

const AUTH = "Bearer test-token";
const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const V = "11111111-2222-4333-8444-555555555555";
const INNER_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

interface Recorder {
  uploaded: Array<{ path: string; ct: string; size: number }>;
  removed: string[];
  registered: number;
}

function makeDeps(overrides: Partial<HandlerDeps> = {}): { deps: HandlerDeps; rec: Recorder } {
  const rec: Recorder = { uploaded: [], removed: [], registered: 0 };
  const base: HandlerDeps = {
    getUserId: async () => ADMIN_ID,
    isAdmin: async () => true,
    storage: {
      upload: async (path, bytes, ct) => {
        rec.uploaded.push({ path, ct, size: bytes.byteLength });
        return { error: null };
      },
      remove: async (path) => {
        rec.removed.push(path);
      },
    },
    registerFile: async (a) => {
      rec.registered++;
      return {
        data: {
          file_id: "ffffffff-1111-4111-8111-111111111111",
          file_name: a.fileName,
          content_type: a.contentType,
          size_bytes: a.sizeBytes,
          checksum_sha256: a.checksumSha256, // intentionally passed by RPC; handler must strip
          created_at: "2026-07-24T00:00:00Z",
        },
        error: null,
      };
    },
    newInnerUuid: () => INNER_UUID,
    ...overrides,
  };
  return { deps: base, rec };
}

function multipart(fields: Record<string, string>, files: Array<{ name: string; type: string; content: Uint8Array; field?: string }>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  for (const f of files) {
    fd.append(f.field ?? "file", new File([new Uint8Array(f.content)], f.name, { type: f.type }));
  }
  return fd;
}

function req(method: string, body?: BodyInit, headers: Record<string, string> = {}): Request {
  return new Request("http://x/", { method, body, headers });
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  return text ? JSON.parse(text) as Record<string, unknown> : {};
}

const LEAK_TOKENS = ["resource-packages", INNER_UUID, "checksum", "service", "supabase.co", "storage/v1"];
function assertNoLeak(text: string, extra: string[] = []) {
  for (const t of [...LEAK_TOKENS, ...extra]) {
    if (text.includes(t)) throw new Error(`response leaked token '${t}': ${text}`);
  }
}

Deno.test("handler: OPTIONS returns 200 with CORS", async () => {
  const { deps } = makeDeps();
  const res = await handleRequest(req("OPTIONS"), deps);
  assertEquals(res.status, 200);
});

Deno.test("handler: GET rejected 405", async () => {
  const { deps } = makeDeps();
  const res = await handleRequest(req("GET"), deps);
  assertEquals(res.status, 405);
  assertEquals((await readJson(res)).error, "method_not_allowed");
});

Deno.test("handler: missing Authorization -> 401", async () => {
  const { deps } = makeDeps();
  const res = await handleRequest(req("POST", "x"), deps);
  assertEquals(res.status, 401);
  assertEquals((await readJson(res)).error, "unauthorized");
});

Deno.test("handler: invalid token (getUserId returns null) -> 401", async () => {
  const { deps } = makeDeps({ getUserId: async () => null });
  const res = await handleRequest(req("POST", "x", { Authorization: AUTH }), deps);
  assertEquals(res.status, 401);
});

Deno.test("handler: non-admin -> 403", async () => {
  const { deps } = makeDeps({ isAdmin: async () => false });
  const res = await handleRequest(req("POST", "x", { Authorization: AUTH }), deps);
  assertEquals(res.status, 403);
  assertEquals((await readJson(res)).error, "forbidden");
});

Deno.test("handler: malformed multipart -> 400 invalid_multipart", async () => {
  const { deps } = makeDeps();
  const res = await handleRequest(
    req("POST", "not-a-form", { Authorization: AUTH, "content-type": "multipart/form-data; boundary=xxx" }),
    deps,
  );
  assertEquals(res.status, 400);
  assertEquals((await readJson(res)).error, "invalid_multipart");
});

Deno.test("handler: missing file -> 400 missing_file", async () => {
  const { deps } = makeDeps();
  const fd = multipart({ version_id: V }, []);
  const res = await handleRequest(req("POST", fd, { Authorization: AUTH }), deps);
  assertEquals(res.status, 400);
  assertEquals((await readJson(res)).error, "missing_file");
});

Deno.test("handler: multiple files -> 400 too_many_files", async () => {
  const { deps } = makeDeps();
  const fd = multipart(
    { version_id: V },
    [
      { name: "a.zip", type: "application/zip", content: new Uint8Array([1, 2, 3]) },
      { name: "b.zip", type: "application/zip", content: new Uint8Array([4, 5, 6]), field: "extra" },
    ],
  );
  const res = await handleRequest(req("POST", fd, { Authorization: AUTH }), deps);
  assertEquals(res.status, 400);
  assertEquals((await readJson(res)).error, "too_many_files");
});

Deno.test("handler: invalid version id -> 400", async () => {
  const { deps } = makeDeps();
  const fd = multipart({ version_id: "nope" }, [{ name: "a.zip", type: "application/zip", content: new Uint8Array([1]) }]);
  const res = await handleRequest(req("POST", fd, { Authorization: AUTH }), deps);
  assertEquals(res.status, 400);
  assertEquals((await readJson(res)).error, "invalid_version_id");
});

Deno.test("handler: invalid file name (path traversal) -> 400", async () => {
  const { deps } = makeDeps();
  const fd = multipart({ version_id: V }, [{ name: "../evil.zip", type: "application/zip", content: new Uint8Array([1]) }]);
  const res = await handleRequest(req("POST", fd, { Authorization: AUTH }), deps);
  assertEquals(res.status, 400);
  assertEquals((await readJson(res)).error, "invalid_file_name");
});

Deno.test("handler: invalid extension -> 400", async () => {
  const { deps } = makeDeps();
  const fd = multipart({ version_id: V }, [{ name: "malware.exe", type: "application/octet-stream", content: new Uint8Array([1]) }]);
  const res = await handleRequest(req("POST", fd, { Authorization: AUTH }), deps);
  assertEquals(res.status, 400);
  assertEquals((await readJson(res)).error, "invalid_extension");
});

Deno.test("handler: invalid content_type for extension -> 400", async () => {
  const { deps } = makeDeps();
  const fd = multipart({ version_id: V }, [{ name: "config.json", type: "application/octet-stream", content: new Uint8Array([1]) }]);
  const res = await handleRequest(req("POST", fd, { Authorization: AUTH }), deps);
  assertEquals(res.status, 400);
  assertEquals((await readJson(res)).error, "invalid_content_type");
});

Deno.test("handler: file too large -> 400 invalid_file_size", async () => {
  const { deps } = makeDeps();
  const big = new Uint8Array(25 * 1024 * 1024 + 1);
  const fd = multipart({ version_id: V }, [{ name: "a.zip", type: "application/zip", content: big }]);
  const res = await handleRequest(req("POST", fd, { Authorization: AUTH }), deps);
  assertEquals(res.status, 400);
  assertEquals((await readJson(res)).error, "invalid_file_size");
});

Deno.test("handler: happy path -> 200, uploads once, registers once, safe metadata only", async () => {
  const { deps, rec } = makeDeps();
  const bytes = new TextEncoder().encode("abc");
  const fd = multipart({ version_id: V }, [{ name: "pkg.zip", type: "application/zip", content: bytes }]);
  const res = await handleRequest(req("POST", fd, { Authorization: AUTH }), deps);
  assertEquals(res.status, 200);
  const body = await readJson(res);
  assertEquals(body.ok, true);
  const file = body.file as Record<string, unknown>;
  assertEquals(file.file_name, "pkg.zip");
  assertEquals(file.content_type, "application/zip");
  assertEquals(file.size_bytes, 3);
  assertEquals("checksum_sha256" in file, false);
  assertEquals("storage_path" in file, false);
  assertEquals("storage_bucket" in file, false);
  assertEquals(rec.uploaded.length, 1);
  assertEquals(rec.removed.length, 0);
  assertEquals(rec.registered, 1);
});

Deno.test("handler: registration failure invokes storage cleanup exactly once", async () => {
  const { deps, rec } = makeDeps({
    registerFile: async () => ({ error: { message: "version_not_found detail" } }),
  });
  const fd = multipart({ version_id: V }, [{ name: "pkg.zip", type: "application/zip", content: new Uint8Array([1, 2, 3]) }]);
  const res = await handleRequest(req("POST", fd, { Authorization: AUTH }), deps);
  assertEquals(res.status, 404);
  assertEquals((await readJson(res)).error, "version_not_found");
  assertEquals(rec.uploaded.length, 1);
  assertEquals(rec.removed.length, 1);
});

Deno.test("handler: upload failure surfaces upload_failed with no leakage", async () => {
  const { deps, rec } = makeDeps({
    storage: {
      upload: async () => ({ error: { message: "s3: bucket resource-packages denied at path 11111111-2222-4333-8444-555555555555/x/pkg.zip" } }),
      remove: async () => {},
    },
  });
  const fd = multipart({ version_id: V }, [{ name: "pkg.zip", type: "application/zip", content: new Uint8Array([1, 2, 3]) }]);
  const res = await handleRequest(req("POST", fd, { Authorization: AUTH }), deps);
  assertEquals(res.status, 502);
  const text = await res.clone().text();
  assertEquals((await readJson(res)).error, "upload_failed");
  assertNoLeak(text);
  assertEquals(rec.registered, 0);
});

Deno.test("handler: response bodies do not leak bucket/path/checksum/service/raw provider text across error branches", async () => {
  const cases: Array<{ regErr: string; expectStatus: number; expectCode: string }> = [
    { regErr: "forbidden something", expectStatus: 403, expectCode: "forbidden" },
    { regErr: "invalid_file_name blah", expectStatus: 400, expectCode: "invalid_file_name" },
    { regErr: "invalid_storage_path leak resource-packages/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/pkg.zip", expectStatus: 400, expectCode: "invalid_storage_path" },
    { regErr: "invalid_file_size", expectStatus: 400, expectCode: "invalid_file_size" },
    { regErr: "invalid_checksum abcd", expectStatus: 400, expectCode: "invalid_checksum" },
    { regErr: "invalid_content_type xyz", expectStatus: 400, expectCode: "invalid_content_type" },
    { regErr: "some unclassified provider error: service_role token exposure resource-packages/xyz", expectStatus: 502, expectCode: "registration_failed" },
  ];
  for (const c of cases) {
    const { deps } = makeDeps({ registerFile: async () => ({ error: { message: c.regErr } }) });
    const fd = multipart({ version_id: V }, [{ name: "pkg.zip", type: "application/zip", content: new Uint8Array([1, 2, 3]) }]);
    const res = await handleRequest(req("POST", fd, { Authorization: AUTH }), deps);
    assertEquals(res.status, c.expectStatus);
    const text = await res.text();
    const body = JSON.parse(text);
    assertEquals(body.error, c.expectCode);
    assertNoLeak(text, ["service_role"]);
  }
});
