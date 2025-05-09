
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { LogOut, User, ShieldCheck, Heart } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { useAuth } from "@/contexts/AuthContext";

interface HeaderProps {
  userRole?: string | null;
  userEmail?: string | null;
  onLogout?: () => void;
}

export function Header({
  userEmail,
  onLogout
}: HeaderProps) {
  const {
    userRole,
    user
  } = useAuth();
  const isLoggedIn = !!userEmail;
  const isAdmin = userRole === "admin";

  // Get initials from email for avatar
  const getInitials = (email: string) => {
    if (!email) return "U";
    return email.charAt(0).toUpperCase();
  };
  
  return (
    <header className="border-b border-border w-full py-1">
      <div className="max-w-[1200px] mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <a href={isLoggedIn ? "/prompts" : "/"} className="flex items-center gap-2">
            <img alt="JojoPrompts logo" className="h-6 w-auto" src="/lovable-uploads/ff979f5e-633f-404f-8799-bd078ad6c678.png" />
          </a>
          
          <nav className="hidden md:flex gap-8">
            {isLoggedIn && <>
                <Link to="/prompts" className="text-base font-bold hover:text-primary transition-colors">
                  Browse Prompts
                </Link>
                <Link to="/dashboard" className="text-base font-bold hover:text-primary transition-colors flex items-center gap-1.5">
                  <Heart className="h-4 w-4" />
                  Favorites
                </Link>
                {isAdmin && 
                  <Link to="/admin" className="text-base font-bold hover:text-primary transition-colors flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    Admin
                  </Link>
                }
              </>
            }
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          {isLoggedIn ? 
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-none border border-border">
                  <Avatar className="h-8 w-8 rounded-none">
                    <AvatarFallback className="bg-primary text-primary-foreground rounded-none">
                      {getInitials(userEmail || "")}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-none">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {userEmail && <p className="font-medium font-mono">{userEmail}</p>}
                    {userRole && <p className="w-[200px] truncate text-sm text-muted-foreground font-mono">
                        {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                      </p>}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="font-mono">
                  <Link to="/dashboard" className="cursor-pointer flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Favorites
                  </Link>
                </DropdownMenuItem>
                {isAdmin && <DropdownMenuItem asChild className="font-mono">
                    <Link to="/admin" className="cursor-pointer">
                      Admin Panel
                    </Link>
                  </DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer text-destructive font-mono" onClick={onLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu> 
            : 
            <div className="flex gap-3">
              <Button asChild variant="outline" className="rounded-none font-bold">
                <Link to="/login">Login</Link>
              </Button>
            </div>
          }
        </div>
      </div>
    </header>
  );
}
