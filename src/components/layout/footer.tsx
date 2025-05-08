
import React from "react";

export function Footer() {
  return (
    <footer className="border-t border-border py-6">
      <div className="max-w-[1200px] mx-auto flex justify-center px-4">
        <p className="text-sm font-mono text-muted-foreground">
          © {new Date().getFullYear()} JojoPrompts. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
