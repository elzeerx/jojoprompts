
import { Link } from "react-router-dom";
import { FileText, Github } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t py-6 md:py-0">
      <div className="container flex flex-col md:h-16 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-1">
          <FileText className="h-5 w-5 text-primary" />
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} JojoPrompts. All rights reserved.
          </p>
        </div>
        
        <div className="mt-4 md:mt-0 flex items-center gap-4">
          <Link to="/prompts" className="text-sm text-muted-foreground hover:text-primary">
            Browse
          </Link>
          <Link to="/about" className="text-sm text-muted-foreground hover:text-primary">
            About
          </Link>
          <a 
            href="https://github.com/jojocompany/jojoprompts" 
            className="text-sm text-muted-foreground hover:text-primary"
            target="_blank"
            rel="noreferrer"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}
