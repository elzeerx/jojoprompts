
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Menu, X, User, LogOut, Settings, Heart } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Header() {
  const {
    user,
    signOut
  } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };
  
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };
  
  return <header className="bg-white border-b border-warm-gold/20 sticky top-0 z-50 backdrop-blur-sm bg-white/95">
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
            <Link to="/pricing" className="text-dark-base hover:text-warm-gold transition-colors font-medium">
              Pricing
            </Link>
            <Link to="/about" className="text-dark-base hover:text-warm-gold transition-colors font-medium">
              About
            </Link>
          </nav>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-warm-gold text-white">
                        {user.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Dashboard</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/favorites")}>
                    <Heart className="mr-2 h-4 w-4" />
                    <span>Favorites</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu> : <div className="flex items-center space-x-2">
                <Button variant="ghost" onClick={() => navigate("/login")} className="text-dark-base hover:text-warm-gold">
                  Login
                </Button>
                <Button onClick={() => navigate("/signup")} className="bg-warm-gold hover:bg-warm-gold/90 text-white">
                  Sign Up
                </Button>
              </div>}
          </div>

          {/* Mobile menu button */}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={toggleMobileMenu}>
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && <div className="md:hidden py-4 border-t border-warm-gold/20">
            <nav className="flex flex-col space-y-2">
              <Link to="/prompts" className="px-4 py-2 text-dark-base hover:text-warm-gold transition-colors font-medium" onClick={() => setIsMobileMenuOpen(false)}>
                Prompts
              </Link>
              <Link to="/pricing" className="px-4 py-2 text-dark-base hover:text-warm-gold transition-colors font-medium" onClick={() => setIsMobileMenuOpen(false)}>
                Pricing
              </Link>
              <Link to="/about" className="px-4 py-2 text-dark-base hover:text-warm-gold transition-colors font-medium" onClick={() => setIsMobileMenuOpen(false)}>
                About
              </Link>
              
              {user ? <>
                  <Link to="/dashboard" className="px-4 py-2 text-dark-base hover:text-warm-gold transition-colors font-medium" onClick={() => setIsMobileMenuOpen(false)}>
                    Dashboard
                  </Link>
                  <Link to="/favorites" className="px-4 py-2 text-dark-base hover:text-warm-gold transition-colors font-medium" onClick={() => setIsMobileMenuOpen(false)}>
                    Favorites
                  </Link>
                  <button onClick={() => {
              handleLogout();
              setIsMobileMenuOpen(false);
            }} className="px-4 py-2 text-left text-dark-base hover:text-warm-gold transition-colors font-medium">
                    Log out
                  </button>
                </> : <div className="px-4 py-2 space-y-2">
                  <Button variant="ghost" onClick={() => {
              navigate("/login");
              setIsMobileMenuOpen(false);
            }} className="w-full justify-start text-dark-base hover:text-warm-gold">
                    Login
                  </Button>
                  <Button onClick={() => {
              navigate("/signup");
              setIsMobileMenuOpen(false);
            }} className="w-full bg-warm-gold hover:bg-warm-gold/90 text-white">
                    Sign Up
                  </Button>
                </div>}
            </nav>
          </div>}
      </div>
    </header>;
}
