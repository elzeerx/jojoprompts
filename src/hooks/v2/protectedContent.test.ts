import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("V2 protected-content wiring", () => {
  it("useResourceDetail never queries protected prompt columns", () => {
    const src = read("src/hooks/v2/useResourceDetail.ts");
    expect(src).not.toContain('select("*")');
    expect(src).not.toContain("prompt_text");
    expect(src).not.toContain("prompt_text_ar");
    // safe explicit list must be present
    expect(src).toContain("hero_image_path");
    expect(src).toContain("legacy_prompt_id");
  });

  it("useEntitledResourceContent is disabled unless signed-in + owned", () => {
    const src = read("src/hooks/v2/useEntitledResourceContent.ts");
    expect(src).toContain("!!user && !!resourceId && owned === true");
    expect(src).toContain("v2_get_entitled_resource_content");
  });

  it("V2Header calls useAuth unconditionally at top-level", () => {
    const src = read("src/components/v2/V2Header.tsx");
    expect(src).not.toMatch(/try\s*\{\s*[^}]*useAuth\(\)/);
    expect(src).toMatch(/const\s*\{\s*user\s*,\s*isAdmin\s*,\s*signOut\s*\}\s*=\s*useAuth\(\)/);
  });

  it("V2Footer calls useAuth unconditionally at top-level", () => {
    const src = read("src/components/v2/V2Footer.tsx");
    expect(src).not.toMatch(/try\s*\{\s*[^}]*useAuth\(\)/);
    expect(src).toMatch(/const\s*\{\s*user\s*\}\s*=\s*useAuth\(\)/);
  });

  it("ResourceDetailPage gates the Your prompt section on ownership + legacy_prompt_id", () => {
    const src = read("src/pages/v2/ResourceDetailPage.tsx");
    expect(src).toContain("shouldFetchProtected");
    expect(src).toContain("entitled-prompt-section");
    expect(src).toContain("useEntitledResourceContent");
    // no protected text is serialized for unowned visitors
    expect(src).toMatch(/shouldFetchProtected\s*&&/);
  });
});
