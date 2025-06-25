
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, User, LogOut, Settings, Heart, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { AdminNavigationButton } from "./AdminNavigationButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { user, userRole, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleUserDashboard = () => {
    if (userRole === 'admin') {
      navigate('/admin');
    } else if (userRole === 'prompter') {
      navigate('/prompter-dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  const navItems = [
    { name: "Home", href: "/" },
    { name: "Prompts", href: "/prompts" },
    { name: "Pricing", href: "/pricing" },
    { name: "About", href: "/about" },
    { name: "Contact", href: "/contact" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-warm-gold/20 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <Sparkles className="h-8 w-8 text-warm-gold" />
            <span className="text-xl font-bold text-dark-base">JoJo Prompts</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex md:items-center md:space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`text-sm font-medium transition-colors hover:text-warm-gold ${
                  location.pathname === item.href
                    ? "text-warm-gold"
                    : "text-gray-700"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Right side items */}
          <div className="flex items-center space-x-4">
            {/* Search Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSearchOpen(true)}
              className="text-warm-gold hover:text-warm-gold/80 hover:bg-warm-gold/10"
            >
              <Search className="h-4 w-4" />
            </Button>

            {/* Admin Navigation - Only visible to admins */}
            <AdminNavigationButton />

            {user ? (
              <>
                {/* Favorites Link */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/favorites')}
                  className="hidden sm:flex text-warm-gold hover:text-warm-gold/80 hover:bg-warm-gold/10"
                >
                  <Heart className="h-4 w-4 mr-2" />
                  Favorites
                </Button>

                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-warm-gold hover:text-warm-gold/80 hover:bg-warm-gold/10">
                      <User className="h-4 w-4 mr-2" />
                      Account
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={handleUserDashboard}>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Dashboard</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/favorites')} className="sm:hidden">
                      <Heart className="mr-2 h-4 w-4" />
                      <span>Favorites</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sign out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="hidden md:flex md:items-center md:space-x-4">
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="text-warm-gold hover:text-warm-gold/80 hover:bg-warm-gold/10">
                    Sign in
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm" className="bg-warm-gold hover:bg-warm-gold/90 text-white">
                    Get Started
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden text-warm-gold"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="space-y-1 pb-3 pt-2">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`block px-3 py-2 text-base font-medium transition-colors hover:text-warm-gold ${
                    location.pathname === item.href
                      ? "text-warm-gold"
                      : "text-gray-700"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              
              {user ? (
                <div className="space-y-1 border-t border-gray-200 pt-4">
                  <button
                    onClick={handleUserDashboard}
                    className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:text-warm-gold"
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => navigate('/favorites')}
                    className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:text-warm-gold"
                  >
                    Favorites
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:text-warm-gold"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="space-y-1 border-t border-gray-200 pt-4">
                  <Link
                    to="/login"
                    className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-warm-gold"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/signup"
                    className="block px-3 py-2 text-base font-medium text-warm-gold"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Global Search Modal */}
      <GlobalSearch 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
      />
    </header>
  );
}
