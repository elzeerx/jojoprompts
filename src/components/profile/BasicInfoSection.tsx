import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Check, X } from "lucide-react";
import { createLogger } from '@/utils/logging';

const logger = createLogger('BASIC_INFO_SECTION');

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  role: string;
}

interface BasicInfoSectionProps {
  userProfile: UserProfile;
  userEmail: string;
  onUpdate: (updates: Partial<UserProfile>) => Promise<void>;
}

export function BasicInfoSection({ userProfile, userEmail, onUpdate }: BasicInfoSectionProps) {
  const [firstName, setFirstName] = useState(userProfile.first_name || "");
  const [lastName, setLastName] = useState(userProfile.last_name || "");
  const [username, setUsername] = useState(userProfile.username || "");
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const checkUsernameAvailability = async (newUsername: string) => {
    if (!newUsername || newUsername === userProfile.username) {
      setUsernameAvailable(null);
      return;
    }

    setIsCheckingUsername(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", newUsername)
        .neq("id", userProfile.id);

      if (error) throw error;
      setUsernameAvailable(data.length === 0);
    } catch (error) {
      logger.error('Error checking username', { error, username: newUsername });
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    // Debounce username checking
    const timeoutId = setTimeout(() => {
      checkUsernameAvailability(value);
    }, 500);
    return () => clearTimeout(timeoutId);
  };

  const handleSubmit = async () => {
    if (usernameAvailable === false) {
      toast({
        title: "Username not available",
        description: "Please choose a different username",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdate({
        first_name: firstName,
        last_name: lastName,
        username: username,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const hasChanges = 
    firstName !== userProfile.first_name ||
    lastName !== userProfile.last_name ||
    username !== userProfile.username;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Enter your first name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Enter your last name"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <div className="relative">
          <Input
            id="username"
            value={username}
            onChange={(e) => handleUsernameChange(e.target.value)}
            placeholder="Choose a unique username"
            className={`pr-10 ${
              usernameAvailable === true ? 'border-green-500' : 
              usernameAvailable === false ? 'border-red-500' : ''
            }`}
          />
          {isCheckingUsername && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}
          {!isCheckingUsername && usernameAvailable === true && (
            <Check className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
          )}
          {!isCheckingUsername && usernameAvailable === false && (
            <X className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-500" />
          )}
        </div>
        {usernameAvailable === false && (
          <p className="text-sm text-red-500">Username is already taken</p>
        )}
        {usernameAvailable === true && (
          <p className="text-sm text-green-500">Username is available</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Email</Label>
        <Input value={userEmail} disabled className="bg-muted" />
        <p className="text-sm text-muted-foreground">
          Email cannot be changed here. Contact support if needed.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Role</Label>
        <Input value={userProfile.role} disabled className="bg-muted capitalize" />
      </div>

      {hasChanges && (
        <Button 
          onClick={handleSubmit} 
          disabled={isUpdating || usernameAvailable === false}
          className="w-full"
        >
          {isUpdating ? "Updating..." : "Save Changes"}
        </Button>
      )}
    </div>
  );
}