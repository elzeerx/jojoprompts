import { Outlet } from "react-router-dom";
import { V2Header } from "./V2Header";
import { V2Footer } from "./V2Footer";
import { CartSanitizer } from "./CartSanitizer";

/**
 * Canonical V2 public shell.
 *
 * Renders exactly one site header/navigation, its sticky primary nav,
 * a page area, and one bilingual V2 footer. It does NOT wrap the legacy
 * global Header/Footer, and it does NOT show the admin floating
 * "Add Prompt" shortcut. Admin creation belongs strictly inside /admin.
 */
export function V2Layout() {
  // NOTE: the shell wrapper is a <div>, not a <main>. Each route owns its
  // own single <main> landmark. Nesting a <main> inside another <main>
  // breaks WCAG 2.4.1 landmark structure — publicShell.test.ts enforces
  // the invariant.
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <V2Header />
      <CartSanitizer />
      <div className="flex-1">
        <Outlet />
      </div>
      <V2Footer />
    </div>
  );
}

export default V2Layout;
