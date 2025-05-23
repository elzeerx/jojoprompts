
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Settings, LogOut, Shield, CreditCard, Heart, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function Header() {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const navigation = [
    { name: "Home", href: "/" },
    { name: "Pricing", href: "/pricing" },
    ...(user ? [{ name: "Prompts", href: "/prompts" }] : []),
  ];

  const userInitials = user 
    ? `${user.email?.charAt(0).toUpperCase() || 'U'}`
    : '';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <img 
              src="/lovable-uploads/eea1bdcd-7738-4e5f-810a-15c96fe07b94.png" 
              alt="JojoPrompts" 
              className="h-8 w-auto" 
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Desktop User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-warm-gold text-white text-sm font-medium">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="text-sm font-medium text-foreground">
                        {user.email}
                      </p>
                      {isAdmin && (
                        <p className="text-xs text-warm-gold font-medium">Administrator</p>
                      )}
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                    <User className="mr-2 h-4 w-4" />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/favorites")}>
                    <Heart className="mr-2 h-4 w-4" />
                    Favorites
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Subscription
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate("/admin")}>
                        <Shield className="mr-2 h-4 w-4" />
                        Admin Panel
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center space-x-2">
                <Button variant="ghost" asChild>
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button asChild className="bg-warm-gold hover:bg-warm-gold/90">
                  <Link to="/pricing">Get Started</Link>
                </Button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/40 bg-white/95 backdrop-blur">
            <div className="px-2 py-3 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className="block px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              
              <div className="border-t border-border/40 pt-3 mt-3">
                {user ? (
                  <div className="space-y-1">
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium">{user.email}</p>
                      {isAdmin && (
                        <p className="text-xs text-warm-gold">Administrator</p>
                      )}
                    </div>
                    <Link
                      to="/dashboard"
                      className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/favorites"
                      className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Favorites
                    </Link>
                    {isAdmin && (
                      <Link
                        to="/admin"
                        className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Admin Panel
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        handleSignOut();
                        setMobileMenuOpen(false);
                      }}
                      className="block w-full text-left px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Link
                      to="/login"
                      className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Sign in
                    </Link>
                    <Link
                      to="/pricing"
                      className="block px-3 py-2 text-sm font-medium text-warm-gold hover:text-warm-gold/80"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Get Started
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
