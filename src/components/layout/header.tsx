
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, LogOut, Menu, User, Settings, Star, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, loading, signOut } = useAuth();
  const { toast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  // Fetch user subscription data
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!user) {
        setUserSubscription(null);
        setSubscriptionLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_subscriptions")
          .select("*, subscription_plans:plan_id(name)")
          .eq("user_id", user.id)
          .eq("status", "active")
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("Error fetching subscription:", error);
        }

        setUserSubscription(data);
      } catch (err) {
        console.error("Error in subscription fetch:", err);
      } finally {
        setSubscriptionLoading(false);
      }
    };

    fetchSubscription();
  }, [user]);

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return "";
    
    const firstName = user.user_metadata?.first_name || "";
    const lastName = user.user_metadata?.last_name || "";
    
    const firstInitial = firstName ? firstName[0] : "";
    const lastInitial = lastName ? lastName[0] : "";
    
    return (firstInitial + lastInitial).toUpperCase();
  };
  
  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    } catch (error) {
      console.error("Error logging out:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to log out. Please try again.",
      });
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold">JojoPrompts</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/prompts"
              className={`text-sm font-medium transition-colors ${
                isActive("/prompts")
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              All Prompts
            </Link>
            
            {/* Categorized prompt pages */}
            <Link
              to="/prompts/chatgpt"
              className={`text-sm font-medium transition-colors ${
                isActive("/prompts/chatgpt")
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              ChatGPT
            </Link>
            
            <Link
              to="/prompts/midjourney"
              className={`text-sm font-medium transition-colors ${
                isActive("/prompts/midjourney")
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              Midjourney
            </Link>
            
            <Link
              to="/prompts/workflows"
              className={`text-sm font-medium transition-colors ${
                isActive("/prompts/workflows")
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              n8n Workflows
            </Link>
            
            <Link
              to="/pricing"
              className={`text-sm font-medium transition-colors ${
                isActive("/pricing")
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              Pricing
            </Link>
            
            <Link
              to="/about"
              className={`text-sm font-medium transition-colors ${
                isActive("/about")
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary"
              }`}
            >
              About
            </Link>
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Mobile Menu Trigger */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="outline" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>JojoPrompts</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 mt-6">
                <Link
                  to="/prompts"
                  className="text-base"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  All Prompts
                </Link>
                <Link
                  to="/prompts/chatgpt"
                  className="text-base"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  ChatGPT
                </Link>
                <Link
                  to="/prompts/midjourney"
                  className="text-base"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Midjourney
                </Link>
                <Link
                  to="/prompts/workflows"
                  className="text-base"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  n8n Workflows
                </Link>
                <Link
                  to="/pricing"
                  className="text-base"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <Link
                  to="/about"
                  className="text-base"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  About
                </Link>

                <div className="h-px bg-border my-2" />
                
                {!loading && !user ? (
                  <>
                    <Link
                      to="/login"
                      className="text-base"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Login
                    </Link>
                    <Link
                      to="/signup"
                      className="text-base"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Sign Up
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      to="/favorites"
                      className="text-base"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Favorites
                    </Link>
                    <Link
                      to="/dashboard"
                      className="text-base"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                    {isAdmin && (
                      <Link
                        to="/admin"
                        className="text-base"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Admin Dashboard
                      </Link>
                    )}
                    <button
                      className="text-base text-left text-red-500"
                      onClick={() => {
                        handleLogout();
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      Logout
                    </button>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>

          {/* User auth state */}
          {!loading && !user && (
            <div className="hidden md:flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/login")}>
                Login
              </Button>
              <Button onClick={() => navigate("/pricing")}>
                Get Started
              </Button>
            </div>
          )}

          {/* User dropdown menu */}
          {!loading && user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{getUserInitials()}</AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline-block">
                    {user.user_metadata?.first_name || user.email}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user.email}</p>
                  {!subscriptionLoading && userSubscription && (
                    <p className="text-xs text-muted-foreground">
                      {userSubscription.subscription_plans.name} Plan
                    </p>
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Dashboard</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/favorites")}>
                  <Star className="mr-2 h-4 w-4" />
                  <span>Favorites</span>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Admin Dashboard</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-500">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
};
