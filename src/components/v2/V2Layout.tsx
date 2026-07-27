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
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <V2Header />
      <CartSanitizer />
      <main className="flex-1">
        <Outlet />
      </main>
      <V2Footer />
    </div>
  );
}

export default V2Layout;
