
import React from "react";
import { Link } from "react-router-dom";
import { Instagram, Twitter } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-dark-base text-soft-bg mobile-section-padding">
      <div className="container">
        {/* Mobile-first responsive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {/* Logo and description - takes full width on mobile */}
          <div className="sm:col-span-2 lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img 
                src="/lovable-uploads/8a72e1cc-7222-42dc-8715-6313b27fb26d.png" 
                alt="JojoPrompts" 
                className="h-12 w-auto sm:h-16" 
              />
            </div>
            <p className="mb-6 text-soft-bg/80 max-w-md text-sm sm:text-base leading-relaxed">
              Discover a curated collection of high-quality, ready-to-use AI prompts for ChatGPT, Midjourney, and more.
              Pay once, use forever.
            </p>
            {/* Mobile-optimized social links */}
            <div className="flex space-x-4">
              <a 
                href="https://instagram.com/jojoprompts" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-soft-bg/70 hover:text-warm-gold transition-colors p-2 rounded-full hover:bg-warm-gold/10 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Follow us on Instagram"
              >
                <Instagram className="h-5 w-5 sm:h-6 sm:w-6" />
              </a>
              <a 
                href="https://x.com/jojoprompts" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-soft-bg/70 hover:text-warm-gold transition-colors p-2 rounded-full hover:bg-warm-gold/10 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Follow us on X (Twitter)"
              >
                <Twitter className="h-5 w-5 sm:h-6 sm:w-6" />
              </a>
            </div>
          </div>
          
          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4 text-warm-gold">Quick Links</h3>
            <ul className="space-y-2 sm:space-y-3">
              <li>
                <Link 
                  to="/" 
                  className="text-soft-bg/80 hover:text-warm-gold transition-colors text-sm sm:text-base block py-1 sm:py-0"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link 
                  to="/prompts" 
                  className="text-soft-bg/80 hover:text-warm-gold transition-colors text-sm sm:text-base block py-1 sm:py-0"
                >
                  Browse Prompts
                </Link>
              </li>
              <li>
                <Link 
                  to="/pricing" 
                  className="text-soft-bg/80 hover:text-warm-gold transition-colors text-sm sm:text-base block py-1 sm:py-0"
                >
                  Pricing
                </Link>
              </li>
              <li>
                <Link 
                  to="/about" 
                  className="text-soft-bg/80 hover:text-warm-gold transition-colors text-sm sm:text-base block py-1 sm:py-0"
                >
                  About Us
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Contact */}
          <div>
            <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4 text-warm-gold">Contact</h3>
            <ul className="space-y-2 sm:space-y-3">
              <li className="text-soft-bg/80 flex items-start">
                <span className="mr-2 text-base">📧</span>
                <a 
                  href="mailto:info@jojoprompts.com" 
                  className="hover:text-warm-gold transition-colors text-sm sm:text-base break-all"
                >
                  info@jojoprompts.com
                </a>
              </li>
              <li className="text-soft-bg/80 flex items-start">
                <span className="mr-2 text-base">🔒</span>
                <Link 
                  to="/privacy-policy" 
                  className="hover:text-warm-gold transition-colors text-sm sm:text-base"
                >
                  Privacy Policy
                </Link>
              </li>
              <li className="text-soft-bg/80 flex items-start">
                <span className="mr-2 text-base">📄</span>
                <Link 
                  to="/terms-of-service" 
                  className="hover:text-warm-gold transition-colors text-sm sm:text-base"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Copyright */}
        <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-soft-bg/10 text-center">
          <p className="text-soft-bg/70 font-mono text-sm sm:text-base">
            © {currentYear} JojoPrompts. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
