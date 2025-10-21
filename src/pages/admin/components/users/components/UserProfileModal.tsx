import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  Shield, 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  CreditCard,
  Globe,
  Calendar,
  Edit,
  Save,
  X,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import { ExtendedUserProfile, UserUpdateData, SocialLinks } from "@/types/user";
import { validateUserProfileFields } from "../utils/fieldValidation";
import { AvatarUpload } from "@/components/admin/AvatarUpload";

interface UserProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: (ExtendedUserProfile & { 
    subscription?: { 
      plan_name: string;
      status: string;
      is_lifetime: boolean;
      price_usd: number;
      start_date?: string;
      end_date?: string;
      payment_method?: string;
      subscription_created_at?: string;
      duration_days?: number;
    } | null;
    account_disabled?: boolean;
    email_confirmed_at?: string | null;
  }) | null;
  onSave: (userId: string, data: UserUpdateData) => void;
  isLoading?: boolean;
}

export function UserProfileModal({
  open,
  onOpenChange,
  user,
  onSave,
  isLoading = false,
}: UserProfileModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<UserUpdateData>({});
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        email: user.email,
        role: user.role,
        bio: user.bio,
        avatar_url: user.avatar_url,
        country: user.country,
        phone_number: user.phone_number,
        timezone: user.timezone,
        membership_tier: user.membership_tier,
      });
      setSocialLinks(user.social_links || {});
      setErrors({});
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate fields
    const validation = validateUserProfileFields({
      ...formData,
      social_links: socialLinks
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    // Prepare changes
    const changes: UserUpdateData = {};
    Object.keys(formData).forEach(key => {
      const typedKey = key as keyof UserUpdateData;
      if (formData[typedKey] !== (user as any)[typedKey]) {
        (changes as any)[typedKey] = formData[typedKey];
      }
    });

    // Add social links if changed
    if (JSON.stringify(socialLinks) !== JSON.stringify(user.social_links || {})) {
      changes.social_links = socialLinks;
    }

    if (Object.keys(changes).length > 0) {
      onSave(user.id, changes);
    }
    
    setIsEditing(false);
    setErrors({});
  };

  const handleChange = (field: keyof UserUpdateData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const { [field]: removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleSocialLinkChange = (platform: string, url: string) => {
    setSocialLinks(prev => ({
      ...prev,
      [platform]: url
    }));
  };

  const removeSocialLink = (platform: string) => {
    setSocialLinks(prev => {
      const { [platform]: removed, ...rest } = prev;
      return rest;
    });
  };

  const addSocialLink = () => {
    const platform = prompt("Enter social media platform name:");
    if (platform && !socialLinks[platform]) {
      setSocialLinks(prev => ({
        ...prev,
        [platform]: ""
      }));
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'jadmin': return 'secondary';
      case 'prompter': return 'outline';
      default: return 'secondary';
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] p-0 bg-background/95 backdrop-blur-sm border border-border/50">
        {/* Enhanced Header */}
        <div className="relative p-6 pb-4 border-b border-border/50 bg-card/50">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            {/* User Info Section */}
            <div className="flex items-start gap-4">
              <div className="relative">
                <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-2 border-border/20 shadow-sm">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback className="text-lg font-medium bg-primary/10 text-primary">
                    {user.first_name?.charAt(0)?.toUpperCase()}{user.last_name?.charAt(0)?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground mb-1 truncate">
                  {user.first_name} {user.last_name}
                </DialogTitle>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <Badge 
                    variant={getRoleBadgeVariant(user.role)}
                    className="w-fit text-xs font-medium"
                  >
                    {user.role}
                  </Badge>
                  <span className="text-sm text-muted-foreground font-mono">
                    @{user.username}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="flex gap-2 shrink-0">
              {!isEditing ? (
                <Button 
                  onClick={() => setIsEditing(true)} 
                  variant="outline" 
                  size="sm"
                  className="mobile-button-secondary border-primary/30 hover:bg-primary/5"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button 
                    onClick={() => setIsEditing(false)} 
                    variant="ghost" 
                    size="sm"
                    className="hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button 
                    onClick={handleSubmit} 
                    size="sm" 
                    disabled={isLoading}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Tab Content */}
        <ScrollArea className="flex-1 max-h-[calc(95vh-180px)]">
          <div className="p-6">
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="w-full h-12 bg-muted/50 p-1 rounded-xl">
                <TabsTrigger 
                  value="profile" 
                  className="flex-1 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                >
                  Profile
                </TabsTrigger>
                <TabsTrigger 
                  value="contact"
                  className="flex-1 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                >
                  Contact
                </TabsTrigger>
                <TabsTrigger 
                  value="subscription"
                  className="flex-1 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                >
                  Subscription
                </TabsTrigger>
                <TabsTrigger 
                  value="activity"
                  className="flex-1 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                >
                  Activity
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-0 mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Basic Information Section */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 pb-3 border-b border-border/30">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">
                        Basic Information
                      </h3>
                    </div>
                    
                    <div className="space-y-5">
                      {/* Name Fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName" className="text-sm font-medium text-muted-foreground">
                            First Name
                          </Label>
                          {isEditing ? (
                            <Input
                              id="firstName"
                              value={formData.first_name || ''}
                              onChange={(e) => handleChange('first_name', e.target.value)}
                              className={`mobile-input ${errors.first_name ? 'border-destructive focus:ring-destructive' : ''}`}
                              placeholder="Enter first name"
                            />
                          ) : (
                            <div className="py-2.5 px-3 bg-muted/30 rounded-lg">
                              <p className="text-sm text-foreground">
                                {user.first_name || 'Not set'}
                              </p>
                            </div>
                          )}
                          {errors.first_name && (
                            <p className="text-xs text-destructive flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {errors.first_name}
                            </p>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="lastName" className="text-sm font-medium text-muted-foreground">
                            Last Name
                          </Label>
                          {isEditing ? (
                            <Input
                              id="lastName"
                              value={formData.last_name || ''}
                              onChange={(e) => handleChange('last_name', e.target.value)}
                              className={`mobile-input ${errors.last_name ? 'border-destructive focus:ring-destructive' : ''}`}
                              placeholder="Enter last name"
                            />
                          ) : (
                            <div className="py-2.5 px-3 bg-muted/30 rounded-lg">
                              <p className="text-sm text-foreground">
                                {user.last_name || 'Not set'}
                              </p>
                            </div>
                          )}
                          {errors.last_name && (
                            <p className="text-xs text-destructive flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {errors.last_name}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Username */}
                      <div className="space-y-2">
                        <Label htmlFor="username" className="text-sm font-medium text-muted-foreground">
                          Username
                        </Label>
                        {isEditing ? (
                          <Input
                            id="username"
                            value={formData.username || ''}
                            onChange={(e) => handleChange('username', e.target.value)}
                            className={`mobile-input ${errors.username ? 'border-destructive focus:ring-destructive' : ''}`}
                            placeholder="Enter username"
                          />
                        ) : (
                          <div className="py-2.5 px-3 bg-muted/30 rounded-lg">
                            <p className="text-sm text-foreground font-mono">
                              @{user.username || 'Not set'}
                            </p>
                          </div>
                        )}
                        {errors.username && (
                          <p className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {errors.username}
                          </p>
                        )}
                      </div>

                      {/* Bio */}
                      <div className="space-y-2">
                        <Label htmlFor="bio" className="text-sm font-medium text-muted-foreground">
                          Bio
                        </Label>
                        {isEditing ? (
                          <Textarea
                            id="bio"
                            value={formData.bio || ''}
                            onChange={(e) => handleChange('bio', e.target.value)}
                            placeholder="Tell us about yourself..."
                            className={`mobile-textarea ${errors.bio ? 'border-destructive focus:ring-destructive' : ''}`}
                            rows={3}
                          />
                        ) : (
                          <div className="py-2.5 px-3 bg-muted/30 rounded-lg min-h-[80px]">
                            <p className="text-sm text-foreground">
                              {user.bio || 'No bio available'}
                            </p>
                          </div>
                        )}
                        {errors.bio && (
                          <p className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {errors.bio}
                          </p>
                        )}
                      </div>
                      
                      {/* Profile Picture */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">
                          Profile Picture
                        </Label>
                        {isEditing ? (
                          <AvatarUpload
                            currentAvatarUrl={formData.avatar_url}
                            userId={user.id}
                            userName={`${user.first_name} ${user.last_name}`}
                            onAvatarChange={(url) => handleChange('avatar_url', url)}
                          />
                        ) : (
                          <div className="flex items-center gap-4 py-2.5 px-3 bg-muted/30 rounded-lg">
                            <Avatar className="h-12 w-12 border border-border/20">
                              <AvatarImage src={user.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                {user.first_name?.charAt(0)?.toUpperCase()}{user.last_name?.charAt(0)?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-muted-foreground">
                              {user.avatar_url ? 'Custom avatar set' : 'Using default avatar'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* System Information Section */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 pb-3 border-b border-border/30">
                      <div className="p-2 rounded-lg bg-secondary/10">
                        <Shield className="h-5 w-5 text-secondary" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">
                        System Information
                      </h3>
                    </div>
                    
                    <div className="space-y-5">
                      {/* Role */}
                      <div className="space-y-2">
                        <Label htmlFor="role" className="text-sm font-medium text-muted-foreground">
                          Role
                        </Label>
                        {isEditing ? (
                          <Select
                            value={formData.role}
                            onValueChange={(value) => handleChange('role', value)}
                          >
                            <SelectTrigger className="mobile-select">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="prompter">Prompter</SelectItem>
                              <SelectItem value="jadmin">Junior Admin</SelectItem>
                              <SelectItem value="admin">Administrator</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="py-2.5 px-3 bg-muted/30 rounded-lg">
                            <p className="text-sm text-foreground capitalize">
                              {user.role}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Membership Tier */}
                      <div className="space-y-2">
                        <Label htmlFor="membershipTier" className="text-sm font-medium text-muted-foreground">
                          Membership Tier
                        </Label>
                        {isEditing ? (
                          <Select
                            value={formData.membership_tier || 'free'}
                            onValueChange={(value) => handleChange('membership_tier', value)}
                          >
                            <SelectTrigger className="mobile-select">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="free">Free</SelectItem>
                              <SelectItem value="basic">Basic</SelectItem>
                              <SelectItem value="premium">Premium</SelectItem>
                              <SelectItem value="enterprise">Enterprise</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="py-2.5 px-3 bg-muted/30 rounded-lg">
                            <p className="text-sm text-foreground capitalize">
                              {user.membership_tier || 'Free'}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Account Created */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">
                          Account Created
                        </Label>
                        <div className="py-2.5 px-3 bg-muted/30 rounded-lg">
                          <p className="text-sm text-foreground">
                            {formatDate(user.created_at)}
                          </p>
                        </div>
                      </div>

                      {/* Last Sign In */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">
                          Last Sign In
                        </Label>
                        <div className="py-2.5 px-3 bg-muted/30 rounded-lg">
                          <p className="text-sm text-foreground">
                            {formatDate(user.last_sign_in_at)}
                          </p>
                        </div>
                      </div>

                      {/* Account Status */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">
                          Account Status
                        </Label>
                        {isEditing ? (
                          <Select
                            value={user.account_disabled ? 'disabled' : 'enabled'}
                            onValueChange={(value) => handleChange('account_status' as any, value)}
                          >
                            <SelectTrigger className="mobile-select">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="enabled">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  Enabled
                                </div>
                              </SelectItem>
                              <SelectItem value="disabled">
                                <div className="flex items-center gap-2">
                                  <XCircle className="h-4 w-4 text-red-600" />
                                  Disabled
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="py-2.5 px-3 bg-muted/30 rounded-lg">
                            <div className="flex items-center gap-2">
                              {!user.account_disabled ? (
                                <>
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <span className="text-sm text-green-700 font-medium">Enabled</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4 text-red-600" />
                                  <span className="text-sm text-red-700 font-medium">Disabled</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Email Verification */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">
                          Email Verification
                        </Label>
                        {isEditing ? (
                          <Select
                            value={user.email_confirmed_at ? 'verified' : 'unverified'}
                            onValueChange={(value) => handleChange('email_confirmed' as any, value)}
                          >
                            <SelectTrigger className="mobile-select">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="verified">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  Verified
                                </div>
                              </SelectItem>
                              <SelectItem value="unverified">
                                <div className="flex items-center gap-2">
                                  <AlertCircle className="h-4 w-4 text-orange-600" />
                                  Unverified
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="py-2.5 px-3 bg-muted/30 rounded-lg">
                            <div className="flex items-center gap-2">
                              {user.email_confirmed_at ? (
                                <>
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <span className="text-sm text-green-700 font-medium">Verified</span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle className="h-4 w-4 text-orange-600" />
                                  <span className="text-sm text-orange-700 font-medium">Unverified</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="contact" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Contact Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Contact Information
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="email">Email Address</Label>
                        {isEditing ? (
                          <Input
                            id="email"
                            type="email"
                            value={formData.email || ''}
                            onChange={(e) => handleChange('email', e.target.value)}
                            className={errors.email ? 'border-red-500' : ''}
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground mt-1">
                            {user.email || 'Not set'}
                          </p>
                        )}
                        {errors.email && (
                          <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="phone">Phone Number</Label>
                        {isEditing ? (
                          <Input
                            id="phone"
                            value={formData.phone_number || ''}
                            onChange={(e) => handleChange('phone_number', e.target.value)}
                            placeholder="+1 (555) 123-4567"
                            className={errors.phone_number ? 'border-red-500' : ''}
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground mt-1">
                            {user.phone_number || 'Not set'}
                          </p>
                        )}
                        {errors.phone_number && (
                          <p className="text-xs text-red-500 mt-1">{errors.phone_number}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="country">Country</Label>
                        {isEditing ? (
                          <Input
                            id="country"
                            value={formData.country || ''}
                            onChange={(e) => handleChange('country', e.target.value)}
                            placeholder="United States"
                            className={errors.country ? 'border-red-500' : ''}
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground mt-1">
                            {user.country || 'Not set'}
                          </p>
                        )}
                        {errors.country && (
                          <p className="text-xs text-red-500 mt-1">{errors.country}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="timezone">Timezone</Label>
                        {isEditing ? (
                          <Input
                            id="timezone"
                            value={formData.timezone || ''}
                            onChange={(e) => handleChange('timezone', e.target.value)}
                            placeholder="America/New_York"
                            className={errors.timezone ? 'border-red-500' : ''}
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground mt-1">
                            {user.timezone || 'Not set'}
                          </p>
                        )}
                        {errors.timezone && (
                          <p className="text-xs text-red-500 mt-1">{errors.timezone}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Social Links */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Globe className="h-5 w-5" />
                        Social Links
                      </h3>
                      {isEditing && (
                        <Button onClick={addSocialLink} size="sm" variant="outline">
                          <Plus className="h-4 w-4 mr-1" />
                          Add Link
                        </Button>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      {Object.entries(socialLinks).length > 0 ? (
                        Object.entries(socialLinks).map(([platform, url]) => (
                          <div key={platform} className="flex items-center gap-3">
                            <div className="flex-1">
                              <Label className="capitalize">{platform}</Label>
                              {isEditing ? (
                                <div className="flex gap-2 mt-1">
                                  <Input
                                    value={url}
                                    onChange={(e) => handleSocialLinkChange(platform, e.target.value)}
                                    placeholder={`Enter ${platform} URL`}
                                  />
                                  <Button
                                    onClick={() => removeSocialLink(platform)}
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground mt-1 truncate">
                                  {url || 'Not set'}
                                </p>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {isEditing ? 'Click "Add Link" to add social media links' : 'No social links added'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="subscription" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Subscription Details */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Subscription Details
                    </h3>
                    
                    {user.subscription ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Plan:</span>
                          <Badge variant="secondary">{user.subscription.plan_name}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Status:</span>
                          <Badge variant={user.subscription.status === 'active' ? 'default' : 'secondary'}>
                            {user.subscription.status}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Price:</span>
                          <span className="text-sm">${user.subscription.price_usd}/month</span>
                        </div>
                        {user.subscription.start_date && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Start Date:</span>
                            <span className="text-sm">{formatDate(user.subscription.start_date)}</span>
                          </div>
                        )}
                        {user.subscription.end_date && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">End Date:</span>
                            <span className="text-sm">{formatDate(user.subscription.end_date)}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No active subscription</p>
                    )}
                  </div>

                  {/* Payment Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Payment Information
                    </h3>
                    
                    {user.subscription?.payment_method ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Payment Method:</span>
                          <span className="text-sm">{user.subscription.payment_method}</span>
                        </div>
                        {user.subscription.subscription_created_at && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Subscription Created:</span>
                            <span className="text-sm">{formatDate(user.subscription.subscription_created_at)}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No payment information available</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Recent Activity
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Account Information */}
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Account Created</p>
                          <p className="text-sm text-muted-foreground">{formatDate(user.created_at)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Last Sign In</p>
                          <p className="text-sm text-muted-foreground">{formatDate(user.last_sign_in_at)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Email Status</p>
                          <Badge 
                            variant={user.email_confirmed_at ? "default" : "secondary"}
                            className="mt-1"
                          >
                            {user.email_confirmed_at ? "Verified" : "Unverified"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}