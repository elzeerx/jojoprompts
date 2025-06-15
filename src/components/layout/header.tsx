import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Menu, X, User, LogOut, Settings, Heart } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Header() {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      console.log("[HEADER] Starting logout process");
      await signOut();
      console.log("[HEADER] Logout completed");
    } catch (error) {
      console.error("[HEADER] Logout error:", error);
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
      // Not logged in, send to home
      navigate("/home");
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
          <nav className="hidden md:flex items-center space-x-6 lg:space-x-8">
            <Link
              to="/prompts"
              className="text-dark-base hover:text-warm-gold transition-colors font-medium text-sm lg:text-base py-2 px-1"
            >
              Prompts
            </Link>
            {!user && (
              <Link
                to="/pricing"
                className="text-dark-base hover:text-warm-gold transition-colors font-medium text-sm lg:text-base py-2 px-1"
              >
                Pricing
              </Link>
            )}
            <Link
              to="/about"
              className="text-dark-base hover:text-warm-gold transition-colors font-medium text-sm lg:text-base py-2 px-1"
            >
              About
            </Link>
          </nav>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center space-x-3">
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
                    className="hover:bg-warm-gold/10 rounded-md transition-colors cursor-pointer p-3 touch-manipulation"
                  >
                    <User className="mr-3 h-4 w-4 text-warm-gold" />
                    <span className="text-dark-base font-medium">Dashboard</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => navigate("/favorites")}
                    className="hover:bg-warm-gold/10 rounded-md transition-colors cursor-pointer p-3 touch-manipulation"
                  >
                    <Heart className="mr-3 h-4 w-4 text-warm-gold" />
                    <span className="text-dark-base font-medium">Favorites</span>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem
                      onClick={() => navigate("/admin")}
                      className="hover:bg-warm-gold/10 rounded-md transition-colors cursor-pointer p-3 touch-manipulation"
                    >
                      <Settings className="mr-3 h-4 w-4 text-warm-gold" />
                      <span className="text-dark-base font-medium">Admin</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="my-2 bg-warm-gold/20" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="hover:bg-warm-gold/10 rounded-md transition-colors cursor-pointer p-3 touch-manipulation"
                  >
                    <LogOut className="mr-3 h-4 w-4 text-warm-gold" />
                    <span className="text-dark-base font-medium">Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  onClick={() => navigate("/login")}
                  className="text-dark-base hover:text-warm-gold text-sm lg:text-base py-2 px-3 touch-manipulation"
                >
                  Login
                </Button>
                <Button
                  onClick={() => navigate("/pricing")}
                  className="bg-warm-gold hover:bg-warm-gold/90 text-white text-sm lg:text-base py-2 px-3 lg:px-4 touch-manipulation"
                >
                  Get Started
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
              <Link
                to="/prompts"
                className="block px-4 py-3 text-dark-base hover:text-warm-gold hover:bg-warm-gold/5 transition-all font-medium touch-manipulation rounded-lg mx-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Prompts
              </Link>
              {!user && (
                <Link
                  to="/pricing"
                  className="block px-4 py-3 text-dark-base hover:text-warm-gold hover:bg-warm-gold/5 transition-all font-medium touch-manipulation rounded-lg mx-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
              )}
              <Link
                to="/about"
                className="block px-4 py-3 text-dark-base hover:text-warm-gold hover:bg-warm-gold/5 transition-all font-medium touch-manipulation rounded-lg mx-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                About
              </Link>

              {user ? (
                <>
                  <div className="border-t border-warm-gold/10 mt-2 pt-2">
                    <Link
                      to="/dashboard"
                      className="block px-4 py-3 text-dark-base hover:text-warm-gold hover:bg-warm-gold/5 transition-all font-medium touch-manipulation rounded-lg mx-2"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/favorites"
                      className="block px-4 py-3 text-dark-base hover:text-warm-gold hover:bg-warm-gold/5 transition-all font-medium touch-manipulation rounded-lg mx-2"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Favorites
                    </Link>
                    {isAdmin && (
                      <Link
                        to="/admin"
                        className="block px-4 py-3 text-dark-base hover:text-warm-gold hover:bg-warm-gold/5 transition-all font-medium touch-manipulation rounded-lg mx-2"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Admin
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="block w-full text-left px-4 py-3 text-dark-base hover:text-warm-gold hover:bg-warm-gold/5 transition-all font-medium touch-manipulation rounded-lg mx-2"
                    >
                      Log out
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
                    className="w-full justify-start text-dark-base hover:text-warm-gold hover:bg-warm-gold/5 touch-manipulation h-12"
                  >
                    Login
                  </Button>
                  <Button
                    onClick={() => {
                      navigate("/pricing");
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full bg-warm-gold hover:bg-warm-gold/90 text-white touch-manipulation h-12"
                  >
                    Get Started
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
