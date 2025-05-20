import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { LogOut, User, ShieldCheck, Heart, Menu, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Header() {
  const {
    userRole,
    user,
    signOut
  } = useAuth();
  
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isLoggedIn = !!user?.email;
  const isAdmin = userRole === "admin";

  // Get initials from email for avatar
  const getInitials = (email: string) => {
    if (!email) return "U";
    return email.charAt(0).toUpperCase();
  };

  const navigation = [
    { name: "Home", href: "/" },
    { name: "Prompts", href: "/prompts" },
    { name: "Pricing", href: "/#pricing" },
  ];
  
  return (
    <header className="bg-white border-b border-warm-gold/10 w-full py-4">
      <div className="container flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <img alt="JojoPrompts logo" className="h-8 w-auto" src="/lovable-uploads/501cb37c-003d-41ce-a8c4-4ad410a18846.png" />
          </Link>
          
          {/* Desktop navigation */}
          <nav className="hidden lg:flex gap-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`text-base font-medium hover:text-warm-gold transition-colors ${
                  location.pathname === item.href ? "text-warm-gold" : "text-dark-base"
                }`}
              >
                {item.name}
              </Link>
            ))}
            
            {isLoggedIn && (
              <>
                <Link 
                  to="/dashboard" 
                  className={`text-base font-medium hover:text-warm-gold transition-colors flex items-center gap-1.5 ${
                    location.pathname === "/dashboard" ? "text-warm-gold" : "text-dark-base"
                  }`}
                >
                  <Heart className="h-4 w-4" />
                  Favorites
                </Link>
                
                {isAdmin && (
                  <Link 
                    to="/admin" 
                    className={`text-base font-medium hover:text-warm-gold transition-colors flex items-center gap-1.5 ${
                      location.pathname.startsWith("/admin") ? "text-warm-gold" : "text-dark-base"
                    }`}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Admin
                  </Link>
                )}
              </>
            )}
          </nav>
        </div>
        
        {/* Mobile menu button */}
        <div className="flex lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[80%] sm:w-[350px] border-l border-warm-gold/10">
              <div className="flex flex-col h-full">
                <div className="px-4 py-6 border-b border-warm-gold/10">
                  <div className="flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
                      <img alt="JojoPrompts logo" className="h-6 w-auto" src="/lovable-uploads/501cb37c-003d-41ce-a8c4-4ad410a18846.png" />
                      <span className="font-bold text-xl text-dark-base">JojoPrompts</span>
                    </Link>
                  </div>
                </div>
                <nav className="flex-1 px-4 py-8">
                  <div className="flex flex-col space-y-6">
                    {navigation.map((item) => (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`text-lg font-medium hover:text-warm-gold transition-colors ${
                          location.pathname === item.href ? "text-warm-gold" : "text-dark-base"
                        }`}
                      >
                        {item.name}
                      </Link>
                    ))}
                    
                    {isLoggedIn && (
                      <>
                        <Link
                          to="/dashboard"
                          className={`text-lg font-medium hover:text-warm-gold transition-colors flex items-center gap-2 ${
                            location.pathname === "/dashboard" ? "text-warm-gold" : "text-dark-base"
                          }`}
                        >
                          <Heart className="h-5 w-5" />
                          Favorites
                        </Link>
                        
                        {isAdmin && (
                          <Link
                            to="/admin"
                            className={`text-lg font-medium hover:text-warm-gold transition-colors flex items-center gap-2 ${
                              location.pathname.startsWith("/admin") ? "text-warm-gold" : "text-dark-base"
                            }`}
                          >
                            <ShieldCheck className="h-5 w-5" />
                            Admin
                          </Link>
                        )}
                        
                        <Button 
                          onClick={signOut} 
                          variant="destructive" 
                          className="justify-start mt-4"
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          Log out
                        </Button>
                      </>
                    )}
                    
                    {!isLoggedIn && (
                      <div className="pt-4">
                        <Link to="/login">
                          <Button className="w-full bg-warm-gold hover:bg-warm-gold/90">
                            Sign In
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        
        {/* Desktop auth buttons */}
        <div className="hidden lg:flex items-center gap-4">
          {isLoggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-warm-gold/20 hover:border-warm-gold/40 hover:bg-warm-gold/5">
                  <Avatar className="h-8 w-8 mr-2">
                    <AvatarFallback className="bg-warm-gold text-white">
                      {getInitials(user.email || "")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {user.email && <p className="font-medium">{user.email}</p>}
                    {userRole && (
                      <p className="text-sm text-muted-foreground">
                        {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" className="cursor-pointer flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Favorites
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="cursor-pointer flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      Admin Panel
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive"
                  onClick={signOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="outline" className="font-medium border-warm-gold/20 hover:bg-warm-gold/5 hover:border-warm-gold/40 text-dark-base">
              <Link to="/login">Sign In</Link>
            </Button>
          )}
          
          {!isLoggedIn && (
            <Button asChild className="bg-warm-gold hover:bg-warm-gold/90 text-white font-medium">
              <Link to="/signup">Sign Up</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
