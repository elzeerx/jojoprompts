
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
  
  return (
    <header className="bg-white border-b border-warm-gold/20 sticky top-0 z-50 backdrop-blur-sm bg-white/95">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <img alt="JojoPrompts" className="h-8 w-auto" src="/lovable-uploads/2207fac5-9e06-4da3-a1b4-da690a123a56.png" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/prompts" className="text-dark-base hover:text-warm-gold transition-colors font-medium">
              Prompts
            </Link>
            {!user && (
              <Link to="/pricing" className="text-dark-base hover:text-warm-gold transition-colors font-medium">
                Pricing
              </Link>
            )}
            <Link to="/about" className="text-dark-base hover:text-warm-gold transition-colors font-medium">
              About
            </Link>
          </nav>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-warm-gold/10 transition-colors">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-warm-gold text-white font-medium">
                        {user.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 bg-white border border-warm-gold/20 shadow-lg rounded-lg p-2" align="end" forceMount>
                  <DropdownMenuItem onClick={() => navigate("/dashboard")} className="hover:bg-warm-gold/10 rounded-md transition-colors cursor-pointer p-3">
                    <User className="mr-3 h-4 w-4 text-warm-gold" />
                    <span className="text-dark-base font-medium">Dashboard</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/favorites")} className="hover:bg-warm-gold/10 rounded-md transition-colors cursor-pointer p-3">
                    <Heart className="mr-3 h-4 w-4 text-warm-gold" />
                    <span className="text-dark-base font-medium">Favorites</span>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate("/admin")} className="hover:bg-warm-gold/10 rounded-md transition-colors cursor-pointer p-3">
                      <Settings className="mr-3 h-4 w-4 text-warm-gold" />
                      <span className="text-dark-base font-medium">Admin</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="my-2 bg-warm-gold/20" />
                  <DropdownMenuItem onClick={handleLogout} className="hover:bg-warm-gold/10 rounded-md transition-colors cursor-pointer p-3">
                    <LogOut className="mr-3 h-4 w-4 text-warm-gold" />
                    <span className="text-dark-base font-medium">Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center space-x-2">
                <Button variant="ghost" onClick={() => navigate("/login")} className="text-dark-base hover:text-warm-gold">
                  Login
                </Button>
                <Button onClick={() => navigate("/pricing")} className="bg-warm-gold hover:bg-warm-gold/90 text-white">
                  Get Started
                </Button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={toggleMobileMenu}>
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-warm-gold/20">
            <nav className="flex flex-col space-y-2">
              <Link to="/prompts" className="px-4 py-2 text-dark-base hover:text-warm-gold transition-colors font-medium" onClick={() => setIsMobileMenuOpen(false)}>
                Prompts
              </Link>
              {!user && (
                <Link to="/pricing" className="px-4 py-2 text-dark-base hover:text-warm-gold transition-colors font-medium" onClick={() => setIsMobileMenuOpen(false)}>
                  Pricing
                </Link>
              )}
              <Link to="/about" className="px-4 py-2 text-dark-base hover:text-warm-gold transition-colors font-medium" onClick={() => setIsMobileMenuOpen(false)}>
                About
              </Link>
              
              {user ? (
                <>
                  <Link to="/dashboard" className="px-4 py-2 text-dark-base hover:text-warm-gold transition-colors font-medium" onClick={() => setIsMobileMenuOpen(false)}>
                    Dashboard
                  </Link>
                  <Link to="/favorites" className="px-4 py-2 text-dark-base hover:text-warm-gold transition-colors font-medium" onClick={() => setIsMobileMenuOpen(false)}>
                    Favorites
                  </Link>
                  {isAdmin && (
                    <Link to="/admin" className="px-4 py-2 text-dark-base hover:text-warm-gold transition-colors font-medium" onClick={() => setIsMobileMenuOpen(false)}>
                      Admin
                    </Link>
                  )}
                  <button onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }} className="px-4 py-2 text-left text-dark-base hover:text-warm-gold transition-colors font-medium">
                    Log out
                  </button>
                </>
              ) : (
                <div className="px-4 py-2 space-y-2">
                  <Button variant="ghost" onClick={() => {
                    navigate("/login");
                    setIsMobileMenuOpen(false);
                  }} className="w-full justify-start text-dark-base hover:text-warm-gold">
                    Login
                  </Button>
                  <Button onClick={() => {
                    navigate("/pricing");
                    setIsMobileMenuOpen(false);
                  }} className="w-full bg-warm-gold hover:bg-warm-gold/90 text-white">
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
