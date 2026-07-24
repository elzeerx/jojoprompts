/**
 * Launch-lock route classification tests.
 * Verifies that when PUBLIC_LAUNCH_LOCK is enabled, only /admin/** and /login
 * are considered reachable; everything else must fall to Coming Soon.
 */
import { describe, it, expect } from "@jest/globals";
import { isLaunchLocked, PUBLIC_LAUNCH_LOCK } from "@/config/siteMode";

function classify(path: string): "coming-soon" | "admin" | "login" | "reset" {
  if (!isLaunchLocked()) return "coming-soon"; // irrelevant when unlocked
  if (path === "/login" || path.startsWith("/login?")) return "login";
  if (path === "/reset-password" || path.startsWith("/reset-password?")) return "reset";
  if (path === "/admin" || path.startsWith("/admin/")) return "admin";
  return "coming-soon";
}

describe("launch lock", () => {
  it("flag is currently ON", () => {
    expect(PUBLIC_LAUNCH_LOCK).toBe(true);
    expect(isLaunchLocked()).toBe(true);
  });

  it.each([
    ["/", "coming-soon"],
    ["/explore", "coming-soon"],
    ["/resources/example-slug", "coming-soon"],
    ["/pricing", "coming-soon"],
    ["/library", "coming-soon"],
    ["/checkout", "coming-soon"],
    ["/cart", "coming-soon"],
    ["/prompts", "coming-soon"],
    ["/prompts/chatgpt", "coming-soon"],
    ["/signup", "coming-soon"],
    ["/signup?plan=premium", "coming-soon"],
    ["/favorites", "coming-soon"],
    ["/dashboard", "coming-soon"],
    ["/about", "coming-soon"],
  ] as const)("public path %s → %s", (path, expected) => {
    expect(classify(path)).toBe(expected);
  });

  it("admin routes stay reachable", () => {
    expect(classify("/admin")).toBe("admin");
    expect(classify("/admin/publishing/imports")).toBe("admin");
  });

  it("login remains reachable for admin authentication", () => {
    expect(classify("/login")).toBe("login");
    expect(classify("/login?redirect=/admin")).toBe("login");
  });

  it("reset-password remains reachable", () => {
    expect(classify("/reset-password")).toBe("reset");
  });
});
