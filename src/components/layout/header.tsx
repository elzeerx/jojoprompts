
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/hooks/useTranslation";
import { Menu, X, User, LogOut, Settings, Heart, Edit } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { createLogger } from '@/utils/logging';
import { cn } from "@/lib/utils";

const logger = createLogger('HEADER');

export function Header() {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t, isRTL } = useTranslation();
  
  // Safe auth hook with fallback
  let user = null;
  let signOut = async () => {};
  let isAdmin = false;
  let isPrompter = false;
  let canManagePrompts = false;
  
  try {
    const authContext = useAuth();
    user = authContext.user;
    signOut = authContext.signOut;
    isAdmin = authContext.isAdmin;
    isPrompter = authContext.isPrompter;
    canManagePrompts = authContext.canManagePrompts;
  } catch (error) {
    logger.warn('Auth context unavailable in Header', error);
  }

  const handleLogout = async () => {
    try {
      logger.info('Starting logout process');
      await signOut();
      logger.info('Logout completed');
    } catch (error) {
      logger.error('Logout error', error);
    }
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Handler for conditional logo navigation
  const handleLogoClick = () => {
    if (user) {
      // If logged in, send to /prompts
      navigate("/prompts");
    } else {
      // Not logged in, send to the main page
      navigate("/");
    }
  };

  return (
    <header className="bg-white/95 backdrop-blur-sm border-b border-warm-gold/20 sticky top-0 z-50">
      <div className="container mx-auto">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo - Mobile optimized */}
          <button
            onClick={handleLogoClick}
            className="flex items-center space-x-2 touch-manipulation focus:outline-none"
            aria-label="JojoPrompts Home"
            type="button"
            tabIndex={0}
            style={{ background: "none", border: "none", padding: 0, margin: 0 }}
          >
            <img
              alt="JojoPrompts"
              className="h-6 w-auto sm:h-8 transition-all duration-200"
              src="/lovable-uploads/2207fac5-9e06-4da3-a1b4-da690a123a56.png"
            />
          </button>

          {/* Desktop Navigation */}
          <nav className={cn(
            "hidden md:flex items-center gap-6 lg:gap-8",
            isRTL && "flex-row-reverse"
          )}>
            <Link
              to="/examples"
              className="text-dark-base hover:text-warm-gold transition-colors font-medium text-sm lg:text-base py-2 px-1"
            >
              {t('nav.examples')}
            </Link>
            <Link
              to="/prompts"
              className="text-dark-base hover:text-warm-gold transition-colors font-medium text-sm lg:text-base py-2 px-1"
            >
              {t('nav.prompts')}
            </Link>
            {!user && (
              <Link
                to="/pricing"
                className="text-dark-base hover:text-warm-gold transition-colors font-medium text-sm lg:text-base py-2 px-1"
              >
                {t('nav.pricing')}
              </Link>
            )}
            <Link
              to="/about"
              className="text-dark-base hover:text-warm-gold transition-colors font-medium text-sm lg:text-base py-2 px-1"
            >
              {t('nav.about')}
            </Link>
          </nav>

          {/* Desktop Auth */}
          <div className={cn(
            "hidden md:flex items-center gap-3",
            isRTL && "flex-row-reverse"
          )}>
            <LanguageSwitcher variant="desktop" />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-9 w-9 lg:h-10 lg:w-10 rounded-full hover:bg-warm-gold/10 transition-colors touch-manipulation"
                  >
                    <Avatar className="h-7 w-7 lg:h-8 lg:w-8">
                      <AvatarFallback className="bg-warm-gold text-white font-medium text-sm">
                        {user.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-60 lg:w-64 bg-white border border-warm-gold/20 shadow-lg rounded-lg p-2"
                  align="end"
                  forceMount
                >
                  <DropdownMenuItem
                    onClick={() => navigate("/dashboard")}
                    className={cn(
                      "hover:bg-warm-gold/10 rounded-md transition-colors cursor-pointer p-3 touch-manipulation",
                      isRTL && "flex-row-reverse"
                    )}
                  >
                    <User className={cn("h-4 w-4 text-warm-gold", isRTL ? "ml-3" : "mr-3")} />
                    <span className="text-dark-base font-medium">{t('nav.dashboard')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate("/favorites")}
                    className={cn(
                      "hover:bg-warm-gold/10 rounded-md transition-colors cursor-pointer p-3 touch-manipulation",
                      isRTL && "flex-row-reverse"
                    )}
                  >
                    <Heart className={cn("h-4 w-4 text-warm-gold", isRTL ? "ml-3" : "mr-3")} />
                    <span className="text-dark-base font-medium">{t('nav.favorites')}</span>
                  </DropdownMenuItem>
                  {isPrompter && (
                    <DropdownMenuItem
                      onClick={() => navigate("/dashboard/prompter")}
                      className={cn(
                        "hover:bg-warm-gold/10 rounded-md transition-colors cursor-pointer p-3 touch-manipulation",
                        isRTL && "flex-row-reverse"
                      )}
                    >
                      <Edit className={cn("h-4 w-4 text-warm-gold", isRTL ? "ml-3" : "mr-3")} />
                      <span className="text-dark-base font-medium">{t('nav.myPrompts')}</span>
                    </DropdownMenuItem>
                   )}
                   {isAdmin && (
                     <DropdownMenuItem
                       onClick={() => navigate("/admin")}
                       className={cn(
                         "hover:bg-warm-gold/10 rounded-md transition-colors cursor-pointer p-3 touch-manipulation",
                         isRTL && "flex-row-reverse"
                       )}
                     >
                       <Settings className={cn("h-4 w-4 text-warm-gold", isRTL ? "ml-3" : "mr-3")} />
                       <span className="text-dark-base font-medium">{t('nav.admin')}</span>
                     </DropdownMenuItem>
                   )}
                  <DropdownMenuSeparator className="my-2 bg-warm-gold/20" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className={cn(
                      "hover:bg-warm-gold/10 rounded-md transition-colors cursor-pointer p-3 touch-manipulation",
                      isRTL && "flex-row-reverse"
                    )}
                  >
                    <LogOut className={cn("h-4 w-4 text-warm-gold", isRTL ? "ml-3" : "mr-3")} />
                    <span className="text-dark-base font-medium">{t('nav.logout')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                <Button
                  variant="ghost"
                  onClick={() => navigate("/login")}
                  className="text-dark-base hover:text-warm-gold text-sm lg:text-base py-2 px-3 touch-manipulation"
                >
                  {t('nav.login')}
                </Button>
                <Button
                  onClick={() => navigate("/pricing")}
                  className="bg-warm-gold hover:bg-warm-gold/90 text-white text-sm lg:text-base py-2 px-3 lg:px-4 touch-manipulation"
                >
                  {t('nav.signup')}
                </Button>
              </div>
            )}
          </div>

          {/* Mobile menu button - Enhanced touch target */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden touch-manipulation min-h-[44px] min-w-[44px] p-2"
            onClick={toggleMobileMenu}
          >
            {isMobileMenuOpen ?
              <X className="h-5 w-5 transition-transform duration-200" /> :
              <Menu className="h-5 w-5 transition-transform duration-200" />
            }
          </Button>
        </div>

        {/* Mobile Navigation - Enhanced animations and touch targets */}
        {isMobileMenuOpen && (
          <div className="md:hidden animate-slide-down bg-white/95 backdrop-blur-sm border-t border-warm-gold/20">
            <nav className="py-3 space-y-1">
              <div className="px-2 pb-2 border-b border-warm-gold/10">
                <LanguageSwitcher variant="mobile" />
              </div>
              <Link
                to="/examples"
                className="block px-4 py-3 text-dark-base hover:text-warm-gold hover:bg-warm-gold/5 transition-all font-medium touch-manipulation rounded-lg mx-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {t('nav.examples')}
              </Link>
              <Link
                to="/prompts"
                className="block px-4 py-3 text-dark-base hover:text-warm-gold hover:bg-warm-gold/5 transition-all font-medium touch-manipulation rounded-lg mx-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {t('nav.prompts')}
              </Link>
              {!user && (
                <Link
                  to="/pricing"
                  className="block px-4 py-3 text-dark-base hover:text-warm-gold hover:bg-warm-gold/5 transition-all font-medium touch-manipulation rounded-lg mx-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t('nav.pricing')}
                </Link>
              )}
              <Link
                to="/about"
                className="block px-4 py-3 text-dark-base hover:text-warm-gold hover:bg-warm-gold/5 transition-all font-medium touch-manipulation rounded-lg mx-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {t('nav.about')}
              </Link>

              {user ? (
                <>
                  <div className="border-t border-warm-gold/10 mt-2 pt-2">
                    <Link
                      to="/dashboard"
                      className="block px-4 py-3 text-dark-base hover:text-warm-gold hover:bg-warm-gold/5 transition-all font-medium touch-manipulation rounded-lg mx-2"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {t('nav.dashboard')}
                    </Link>
                    <Link
                      to="/favorites"
                      className="block px-4 py-3 text-dark-base hover:text-warm-gold hover:bg-warm-gold/5 transition-all font-medium touch-manipulation rounded-lg mx-2"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {t('nav.favorites')}
                    </Link>
                     {isPrompter && (
                       <Link
                         to="/dashboard/prompter"
                         className="block px-4 py-3 text-dark-base hover:text-warm-gold hover:bg-warm-gold/5 transition-all font-medium touch-manipulation rounded-lg mx-2"
                         onClick={() => setIsMobileMenuOpen(false)}
                       >
                         {t('nav.myPrompts')}
                       </Link>
                      )}
                      {isAdmin && (
                       <Link
                         to="/admin"
                         className="block px-4 py-3 text-dark-base hover:text-warm-gold hover:bg-warm-gold/5 transition-all font-medium touch-manipulation rounded-lg mx-2"
                         onClick={() => setIsMobileMenuOpen(false)}
                       >
                         {t('nav.admin')}
                       </Link>
                     )}
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsMobileMenuOpen(false);
                      }}
                      className={cn(
                        "block w-full px-4 py-3 text-dark-base hover:text-warm-gold hover:bg-warm-gold/5 transition-all font-medium touch-manipulation rounded-lg mx-2",
                        isRTL ? "text-right" : "text-left"
                      )}
                    >
                      {t('nav.logout')}
                    </button>
                  </div>
                </>
              ) : (
                <div className="border-t border-warm-gold/10 mt-2 pt-2 px-2 space-y-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      navigate("/login");
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full text-dark-base hover:text-warm-gold hover:bg-warm-gold/5 touch-manipulation h-12",
                      isRTL ? "justify-end" : "justify-start"
                    )}
                  >
                    {t('nav.login')}
                  </Button>
                  <Button
                    onClick={() => {
                      navigate("/pricing");
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full bg-warm-gold hover:bg-warm-gold/90 text-white touch-manipulation h-12"
                  >
                    {t('nav.signup')}
                  </Button>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
