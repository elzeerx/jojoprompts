import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  Globe,
  Calendar,
  Edit,
  Save,
  X,
  Plus,
  Trash2,
  AlertCircle
} from "lucide-react";
import { ExtendedUserProfile, UserUpdateData, SocialLinks } from "@/types/user";
import { validateUserProfileFields } from "../utils/fieldValidation";
import { AvatarUpload } from "@/components/admin/AvatarUpload";
import { 
  RoleBadge, 
  VerificationBadge, 
  SubscriptionBadge, 
  AccountStatusBadge,
  OrphanedBadge 
} from "./shared";

interface UserProfileSheetProps {
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
    is_email_confirmed?: boolean | null;
    has_auth_account?: boolean;
  }) | null;
  onSave: (userId: string, data: UserUpdateData) => void;
  isLoading?: boolean;
}

export function UserProfileSheet({
  open,
  onOpenChange,
  user,
  onSave,
  isLoading = false,
}: UserProfileSheetProps) {
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
        email_confirmed: user.email_confirmed_at ? true : false,
        account_status: user.account_disabled ? 'disabled' : 'enabled',
      });
      setSocialLinks(user.social_links || {});
      setErrors({});
      setIsEditing(false);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const validation = validateUserProfileFields({
      ...formData,
      social_links: socialLinks
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    const changes: UserUpdateData = {};
    Object.keys(formData).forEach(key => {
      const typedKey = key as keyof UserUpdateData;
      if (formData[typedKey] !== (user as any)[typedKey]) {
        (changes as any)[typedKey] = formData[typedKey];
      }
    });

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
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const { [field]: removed, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleSocialLinkChange = (platform: string, url: string) => {
    setSocialLinks(prev => ({ ...prev, [platform]: url }));
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
      setSocialLinks(prev => ({ ...prev, [platform]: "" }));
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

  if (!user) return null;

  const isEmailConfirmed = user.is_email_confirmed ?? (user.email_confirmed_at ? true : false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[600px] p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-6 pb-4 border-b bg-muted/30">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-border/20 shadow-sm">
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback className="text-lg font-medium bg-primary/10 text-primary">
                  {user.first_name?.charAt(0)?.toUpperCase()}{user.last_name?.charAt(0)?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <SheetTitle className="text-xl font-bold">
                  {user.first_name} {user.last_name}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-2 mt-1">
                  <span className="font-mono">@{user.username}</span>
                  <RoleBadge role={user.role} size="sm" />
                </SheetDescription>
              </div>
            </div>
            
            <div className="flex gap-2">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <>
                  <Button onClick={() => setIsEditing(false)} variant="ghost" size="sm">
                    <X className="h-4 w-4" />
                  </Button>
                  <Button onClick={handleSubmit} size="sm" disabled={isLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Quick Stats Bar */}
          <div className="flex flex-wrap gap-2 mt-4">
            <VerificationBadge isVerified={isEmailConfirmed} />
            <SubscriptionBadge 
              planName={user.subscription?.plan_name} 
              isLifetime={user.subscription?.is_lifetime}
            />
            <AccountStatusBadge isDisabled={user.account_disabled || false} />
            <OrphanedBadge hasAuthAccount={user.has_auth_account ?? true} />
          </div>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="w-full h-10 bg-muted/50 p-1 rounded-lg mb-6">
                <TabsTrigger value="profile" className="flex-1 rounded-md text-sm">
                  Profile
                </TabsTrigger>
                <TabsTrigger value="contact" className="flex-1 rounded-md text-sm">
                  Contact
                </TabsTrigger>
                <TabsTrigger value="subscription" className="flex-1 rounded-md text-sm">
                  Subscription
                </TabsTrigger>
                <TabsTrigger value="activity" className="flex-1 rounded-md text-sm">
                  Activity
                </TabsTrigger>
              </TabsList>

              {/* Profile Tab */}
              <TabsContent value="profile" className="space-y-6 mt-0">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <User className="h-4 w-4" />
                    Basic Information
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">First Name</Label>
                      {isEditing ? (
                        <Input
                          value={formData.first_name || ''}
                          onChange={(e) => handleChange('first_name', e.target.value)}
                          className={errors.first_name ? 'border-destructive' : ''}
                        />
                      ) : (
                        <p className="text-sm py-2 px-3 bg-muted/30 rounded-lg">{user.first_name || 'Not set'}</p>
                      )}
                      {errors.first_name && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />{errors.first_name}
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Last Name</Label>
                      {isEditing ? (
                        <Input
                          value={formData.last_name || ''}
                          onChange={(e) => handleChange('last_name', e.target.value)}
                          className={errors.last_name ? 'border-destructive' : ''}
                        />
                      ) : (
                        <p className="text-sm py-2 px-3 bg-muted/30 rounded-lg">{user.last_name || 'Not set'}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Username</Label>
                    {isEditing ? (
                      <Input
                        value={formData.username || ''}
                        onChange={(e) => handleChange('username', e.target.value)}
                        className={errors.username ? 'border-destructive' : ''}
                      />
                    ) : (
                      <p className="text-sm py-2 px-3 bg-muted/30 rounded-lg font-mono">@{user.username}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Bio</Label>
                    {isEditing ? (
                      <Textarea
                        value={formData.bio || ''}
                        onChange={(e) => handleChange('bio', e.target.value)}
                        rows={3}
                      />
                    ) : (
                      <p className="text-sm py-2 px-3 bg-muted/30 rounded-lg min-h-[60px]">
                        {user.bio || 'No bio available'}
                      </p>
                    )}
                  </div>

                  {isEditing && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Profile Picture</Label>
                      <AvatarUpload
                        currentAvatarUrl={formData.avatar_url}
                        userId={user.id}
                        userName={`${user.first_name} ${user.last_name}`}
                        onAvatarChange={(url) => handleChange('avatar_url', url)}
                      />
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <User className="h-4 w-4" />
                    System Information
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Role</Label>
                      {isEditing ? (
                        <Select
                          value={formData.role || 'user'}
                          onValueChange={(value) => handleChange('role', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="prompter">Prompter</SelectItem>
                            <SelectItem value="jadmin">Junior Admin</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="py-2">
                          <RoleBadge role={user.role} />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Membership Tier</Label>
                      <p className="text-sm py-2 px-3 bg-muted/30 rounded-lg capitalize">
                        {user.membership_tier || 'Free'}
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Contact Tab */}
              <TabsContent value="contact" className="space-y-6 mt-0">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    Contact Information
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <Input
                          value={formData.email || ''}
                          onChange={(e) => handleChange('email', e.target.value)}
                          className="flex-1"
                        />
                      ) : (
                        <p className="text-sm py-2 px-3 bg-muted/30 rounded-lg flex-1">{user.email}</p>
                      )}
                      <VerificationBadge isVerified={isEmailConfirmed} size="sm" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Phone Number</Label>
                    {isEditing ? (
                      <Input
                        value={formData.phone_number || ''}
                        onChange={(e) => handleChange('phone_number', e.target.value)}
                      />
                    ) : (
                      <p className="text-sm py-2 px-3 bg-muted/30 rounded-lg">
                        {user.phone_number || 'Not set'}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Country</Label>
                      {isEditing ? (
                        <Input
                          value={formData.country || ''}
                          onChange={(e) => handleChange('country', e.target.value)}
                        />
                      ) : (
                        <p className="text-sm py-2 px-3 bg-muted/30 rounded-lg flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          {user.country || 'Not set'}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Timezone</Label>
                      {isEditing ? (
                        <Input
                          value={formData.timezone || ''}
                          onChange={(e) => handleChange('timezone', e.target.value)}
                        />
                      ) : (
                        <p className="text-sm py-2 px-3 bg-muted/30 rounded-lg flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {user.timezone || 'Not set'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Globe className="h-4 w-4" />
                      Social Links
                    </div>
                    {isEditing && (
                      <Button variant="outline" size="sm" onClick={addSocialLink}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    )}
                  </div>
                  
                  {Object.entries(socialLinks).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(socialLinks).map(([platform, url]) => (
                        <div key={platform} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground capitalize min-w-[80px]">{platform}</span>
                          {isEditing ? (
                            <>
                              <Input
                                value={url}
                                onChange={(e) => handleSocialLinkChange(platform, e.target.value)}
                                className="flex-1"
                                placeholder={`${platform} URL`}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeSocialLink(platform)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate">
                              {url}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">No social links added</p>
                  )}
                </div>
              </TabsContent>

              {/* Subscription Tab */}
              <TabsContent value="subscription" className="space-y-6 mt-0">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Subscription Details
                  </div>
                  
                  {user.subscription ? (
                    <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Plan</span>
                        <SubscriptionBadge 
                          planName={user.subscription.plan_name}
                          isLifetime={user.subscription.is_lifetime}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Price</span>
                        <span className="text-sm font-medium">
                          ${user.subscription.price_usd}
                          {user.subscription.is_lifetime ? ' (one-time)' : '/period'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <span className="text-sm font-medium capitalize">{user.subscription.status}</span>
                      </div>
                      {user.subscription.start_date && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Start Date</span>
                          <span className="text-sm">{formatDate(user.subscription.start_date)}</span>
                        </div>
                      )}
                      {user.subscription.end_date && !user.subscription.is_lifetime && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">End Date</span>
                          <span className="text-sm">{formatDate(user.subscription.end_date)}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-muted/30 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">No active subscription</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Activity Tab */}
              <TabsContent value="activity" className="space-y-6 mt-0">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Account Activity
                  </div>
                  
                  <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Account Created</span>
                      <span className="text-sm">{formatDate(user.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Last Sign In</span>
                      <span className="text-sm">{formatDate(user.last_sign_in_at)}</span>
                    </div>
                    {user.email_confirmed_at && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Email Confirmed</span>
                        <span className="text-sm">{formatDate(user.email_confirmed_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
