
import React from "react";
import { Link } from "react-router-dom";
import { Instagram, Twitter } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-dark-base text-soft-bg py-12">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img src="/lovable-uploads/8a72e1cc-7222-42dc-8715-6313b27fb26d.png" alt="JojoPrompts" className="h-16 w-auto" />
            </div>
            <p className="mb-6 text-soft-bg/80 max-w-md">
              Discover a curated collection of high-quality, ready-to-use AI prompts for ChatGPT, Midjourney, and more.
              Pay once, use forever.
            </p>
            <div className="flex space-x-4">
              <a href="https://instagram.com/jojoprompts" target="_blank" rel="noopener noreferrer" className="text-soft-bg/70 hover:text-warm-gold transition-colors">
                <span className="sr-only">Instagram</span>
                <Instagram className="h-6 w-6" />
              </a>
              <a href="https://x.com/jojoprompts" target="_blank" rel="noopener noreferrer" className="text-soft-bg/70 hover:text-warm-gold transition-colors">
                <span className="sr-only">Twitter</span>
                <Twitter className="h-6 w-6" />
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold text-lg mb-4 text-warm-gold">Quick Links</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/" className="text-soft-bg/80 hover:text-warm-gold transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/prompts" className="text-soft-bg/80 hover:text-warm-gold transition-colors">
                  Browse Prompts
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-soft-bg/80 hover:text-warm-gold transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-soft-bg/80 hover:text-warm-gold transition-colors">
                  About Us
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-lg mb-4 text-warm-gold">Contact</h3>
            <ul className="space-y-3">
              <li className="text-soft-bg/80 flex items-start">
                <span className="mr-2">📧</span>
                <a href="mailto:support@jojoprompts.com" className="hover:text-warm-gold transition-colors">
                  support@jojoprompts.com
                </a>
              </li>
              <li className="text-soft-bg/80 flex items-start">
                <span className="mr-2">🔒</span>
                <Link to="/privacy-policy" className="hover:text-warm-gold transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li className="text-soft-bg/80 flex items-start">
                <span className="mr-2">📄</span>
                <Link to="/terms-of-service" className="hover:text-warm-gold transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-soft-bg/10 text-center">
          <p className="text-soft-bg/70 font-mono">
            © {currentYear} JojoPrompts. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
