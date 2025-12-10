
import React from "react";
import { Link } from "react-router-dom";
import { Instagram, Twitter } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

export function Footer() {
  const currentYear = new Date().getFullYear();
  const { t, isRTL } = useTranslation();
  
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
              {t('footer.description')}
            </p>
            {/* Mobile-optimized social links */}
            <div className={cn("flex gap-4", isRTL && "flex-row-reverse justify-end")}>
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
            <h3 className={cn(
              "font-semibold text-base sm:text-lg mb-3 sm:mb-4 text-warm-gold",
              isRTL && "text-right"
            )}>
              {t('footer.quickLinks')}
            </h3>
            <ul className="space-y-2 sm:space-y-3">
              <li>
                <Link 
                  to="/" 
                  className={cn(
                    "text-soft-bg/80 hover:text-warm-gold transition-colors text-sm sm:text-base block py-1 sm:py-0",
                    isRTL && "text-right"
                  )}
                >
                  {t('nav.home')}
                </Link>
              </li>
              <li>
                <Link 
                  to="/prompts" 
                  className={cn(
                    "text-soft-bg/80 hover:text-warm-gold transition-colors text-sm sm:text-base block py-1 sm:py-0",
                    isRTL && "text-right"
                  )}
                >
                  {t('nav.prompts')}
                </Link>
              </li>
              <li>
                <Link 
                  to="/pricing" 
                  className={cn(
                    "text-soft-bg/80 hover:text-warm-gold transition-colors text-sm sm:text-base block py-1 sm:py-0",
                    isRTL && "text-right"
                  )}
                >
                  {t('nav.pricing')}
                </Link>
              </li>
              <li>
                <Link 
                  to="/about" 
                  className={cn(
                    "text-soft-bg/80 hover:text-warm-gold transition-colors text-sm sm:text-base block py-1 sm:py-0",
                    isRTL && "text-right"
                  )}
                >
                  {t('nav.about')}
                </Link>
              </li>
            </ul>
          </div>
          
          {/* Contact */}
          <div>
            <h3 className={cn(
              "font-semibold text-base sm:text-lg mb-3 sm:mb-4 text-warm-gold",
              isRTL && "text-right"
            )}>
              {t('footer.contact')}
            </h3>
            <ul className="space-y-2 sm:space-y-3">
              <li className={cn("text-soft-bg/80 flex items-start", isRTL && "flex-row-reverse")}>
                <span className={cn("text-base", isRTL ? "ml-2" : "mr-2")}>📧</span>
                <a 
                  href="mailto:info@jojoprompts.com" 
                  className="hover:text-warm-gold transition-colors text-sm sm:text-base break-all"
                >
                  info@jojoprompts.com
                </a>
              </li>
              <li className={cn("text-soft-bg/80 flex items-start", isRTL && "flex-row-reverse")}>
                <span className={cn("text-base", isRTL ? "ml-2" : "mr-2")}>🔒</span>
                <Link 
                  to="/privacy" 
                  className="hover:text-warm-gold transition-colors text-sm sm:text-base"
                >
                  {t('footer.privacyPolicy')}
                </Link>
              </li>
              <li className={cn("text-soft-bg/80 flex items-start", isRTL && "flex-row-reverse")}>
                <span className={cn("text-base", isRTL ? "ml-2" : "mr-2")}>📄</span>
                <Link 
                  to="/terms" 
                  className="hover:text-warm-gold transition-colors text-sm sm:text-base"
                >
                  {t('footer.termsOfService')}
                </Link>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Copyright */}
        <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-soft-bg/10 text-center">
          <p className="text-soft-bg/70 font-mono text-sm sm:text-base">
            {t('footer.copyright', { year: currentYear.toString() })}
          </p>
        </div>
      </div>
    </footer>
  );
}
