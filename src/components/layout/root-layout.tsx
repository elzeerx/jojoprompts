
import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./header";
import { Footer } from "./footer";
import { useAuth } from "@/contexts/AuthContext";
import { FloatingAddPromptButton } from "../ui/FloatingAddPromptButton";
import { ErrorBoundary } from "../ErrorBoundary";
import { PreviewWatchdog } from "../PreviewWatchdog";

export function RootLayout() {
  const location = useLocation();

  // Define a dummy reloadPrompts function for the FloatingAddPromptButton when used outside of the prompts page
  const dummyReloadPrompts = async () => {
    console.log("Dummy reload function called from layout");
    // This is just a placeholder since the actual reload functionality happens in the PromptsPage component
  };

  return (
    <ErrorBoundary>
      <PreviewWatchdog>
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1 relative">
            <Outlet />
            {/* Only show the FloatingAddPromptButton on pages other than the home page and prompts page */}
            {location.pathname !== "/" && location.pathname !== "/prompts" && (
              <FloatingAddPromptButton reloadPrompts={dummyReloadPrompts} className="rounded-none" />
            )}
          </main>
          <Footer />
        </div>
      </PreviewWatchdog>
    </ErrorBoundary>
  );
}
