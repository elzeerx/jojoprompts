import { describe, expect, it } from "bun:test";

declare const require: (moduleName: string) => {
  readFileSync(path: string, encoding: string): string;
};

const { readFileSync } = require("fs");
const APP_SOURCE = readFileSync(
  new URL("../App.tsx", import.meta.url).pathname,
  "utf8",
);

const LOCKED_APP_START = APP_SOURCE.indexOf("function LockedApp()");
const APP_START = APP_SOURCE.indexOf("function App()");
const LOCKED_APP = APP_SOURCE.slice(LOCKED_APP_START, APP_START);
const LOCK_RETURN_START = APP_SOURCE.indexOf("if (isLaunchLocked())", APP_START);
const PROVIDER_TREE_START = APP_SOURCE.indexOf(
  "<QueryClientProvider",
  APP_START,
);
const UNLOCKED_APP = APP_SOURCE.slice(PROVIDER_TREE_START);

describe("absolute production launch-lock route contract", () => {
  it("returns the locked app before mounting any stateful provider", () => {
    expect(LOCKED_APP_START).toBeGreaterThan(-1);
    expect(LOCK_RETURN_START).toBeGreaterThan(APP_START);
    expect(PROVIDER_TREE_START).toBeGreaterThan(LOCK_RETURN_START);
    expect(
      APP_SOURCE.slice(LOCK_RETURN_START, PROVIDER_TREE_START),
    ).toContain("return <LockedApp />");
  });

  it("renders only the inert Coming Soon page while locked", () => {
    expect(LOCKED_APP).toContain("<ComingSoonPage />");
    expect(LOCKED_APP).not.toContain("QueryClientProvider");
    expect(LOCKED_APP).not.toContain("BrowserRouter");
    expect(LOCKED_APP).not.toContain("LanguageProvider");
    expect(LOCKED_APP).not.toContain("AuthProvider");
    expect(LOCKED_APP).not.toContain("OAuthConsent");
    expect(LOCKED_APP).not.toContain("AdminLayout");
    expect(LOCKED_APP).not.toContain("V2Layout");
  });

  it("keeps OAuth, admin, auth, and V2 routes in the unlocked provider tree", () => {
    expect(UNLOCKED_APP).toContain("<AuthProvider>");
    expect(UNLOCKED_APP).toContain('path="/.lovable/oauth/consent"');
    expect(UNLOCKED_APP).toContain('path="/admin"');
    expect(UNLOCKED_APP).toContain("<V2Layout />");
    expect(UNLOCKED_APP).toContain("routes.map");
  });
});
