
import React from "react";

export function Footer() {
  return (
    <footer className="border-t py-6 md:py-0">
      <div className="container flex justify-center">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} JojoPrompts. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
