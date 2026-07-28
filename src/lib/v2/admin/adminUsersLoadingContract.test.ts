import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const hookSource = readFileSync("src/hooks/useAdminUsers.ts", "utf8");
const functionSource = readFileSync(
  "supabase/functions/get-all-users/index.ts",
  "utf8",
);
const handlerSource = readFileSync(
  "supabase/functions/get-all-users/handlers/getUsersHandler.ts",
  "utf8",
);
const sharedImportsSource = readFileSync(
  "supabase/functions/_shared/standardImports.ts",
  "utf8",
);

describe("Admin Users loading contract", () => {
  it("invokes the function by its stable slug and sends pagination in the body", () => {
    expect(hookSource).toContain('supabase.functions.invoke(\n          "get-all-users"');
    expect(hookSource).not.toContain("get-all-users?page=");
    expect(hookSource).toContain('action: "list"');
    expect(hookSource).toContain("limit: batchSize");
  });

  it("ignores stale Strict Mode and overlapping refresh results", () => {
    expect(hookSource).toContain("requestGenerationRef");
    expect(hookSource).toContain(
      "requestGeneration !== requestGenerationRef.current",
    );
    expect(hookSource).toContain("requestGenerationRef.current += 1");
    expect(hookSource).toContain("setError(null);");
  });

  it("supports the explicit list action while preserving legacy GET calls", () => {
    expect(functionSource).toContain("if (action === 'list')");
    expect(functionSource).toContain(
      "return await handleGetUsers(supabase, userId, req,",
    );
    expect(functionSource).toContain("if (req.method === 'GET')");
    expect(handlerSource).toContain("interface ListUsersOptions");
    expect(handlerSource).toContain("options: ListUsersOptions = {}");
  });

  it("allows the retry header used by current supabase-js clients", () => {
    expect(sharedImportsSource).toContain("x-retry-count");
    expect(sharedImportsSource).toContain(
      "'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'",
    );
  });
});
