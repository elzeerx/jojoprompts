import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, User, MapPin, Phone, Globe } from "lucide-react";

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  bio?: string;
  avatar_url?: string;
  country?: string;
  phone_number?: string;
  social_links?: any;
}

interface ProfileDetailsSectionProps {
  userProfile: UserProfile;
  onUpdate: (updates: Partial<UserProfile>) => Promise<void>;
}

export function ProfileDetailsSection({ userProfile, onUpdate }: ProfileDetailsSectionProps) {
  const [bio, setBio] = useState(userProfile.bio || "");
  const [country, setCountry] = useState(userProfile.country || "");
  const [phoneNumber, setPhoneNumber] = useState(userProfile.phone_number || "");
  const [socialLinks, setSocialLinks] = useState(userProfile.social_links || {});
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSocialLinkChange = (platform: string, handle: string) => {
    setSocialLinks(prev => ({
      ...prev,
      [platform]: handle
    }));
  };

  const handleSubmit = async () => {
    setIsUpdating(true);
    try {
      await onUpdate({
        bio,
        country,
        phone_number: phoneNumber,
        social_links: socialLinks,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const hasChanges = 
    bio !== (userProfile.bio || "") ||
    country !== (userProfile.country || "") ||
    phoneNumber !== (userProfile.phone_number || "") ||
    JSON.stringify(socialLinks) !== JSON.stringify(userProfile.social_links || {});

  const getInitials = () => {
    return `${userProfile.first_name[0] || ''}${userProfile.last_name[0] || ''}`.toUpperCase();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Picture
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={userProfile.avatar_url} />
            <AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Photo
            </Button>
            <p className="text-sm text-muted-foreground">
              JPG, PNG or GIF. Max size 5MB.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              rows={4}
              maxLength={500}
            />
            <p className="text-sm text-muted-foreground text-right">
              {bio.length}/500 characters
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location & Contact
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Your country"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input
              id="phoneNumber"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1 (555) 123-4567"
              type="tel"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Social Links
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {['twitter', 'linkedin', 'github', 'website'].map((platform) => (
              <div key={platform} className="space-y-2">
                <Label htmlFor={platform} className="capitalize">
                  {platform === 'website' ? 'Website' : `${platform} Handle`}
                </Label>
                <Input
                  id={platform}
                  value={socialLinks[platform] || ""}
                  onChange={(e) => handleSocialLinkChange(platform, e.target.value)}
                  placeholder={platform === 'website' ? 'your-website.com' : `@your${platform}handle`}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {hasChanges && (
        <Button 
          onClick={handleSubmit} 
          disabled={isUpdating}
          className="w-full"
        >
          {isUpdating ? "Updating..." : "Save Profile Details"}
        </Button>
      )}
    </div>
  );
}