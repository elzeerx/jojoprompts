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
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback className="text-lg">
                  {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-2xl font-bold">
                  {user.first_name} {user.last_name}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1">
                  <Badge variant={getRoleBadgeVariant(user.role)}>
                    {user.role}
                  </Badge>
                  <span className="text-muted-foreground">@{user.username}</span>
                </DialogDescription>
              </div>
            </div>
            <div className="flex gap-2">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={() => setIsEditing(false)} variant="ghost" size="sm">
                    <X className="h-4 w-4" />
                  </Button>
                  <Button onClick={handleSubmit} size="sm" disabled={isLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="p-6">
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="contact">Contact</TabsTrigger>
                <TabsTrigger value="subscription">Subscription</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Basic Information
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="firstName">First Name</Label>
                          {isEditing ? (
                            <Input
                              id="firstName"
                              value={formData.first_name || ''}
                              onChange={(e) => handleChange('first_name', e.target.value)}
                              className={errors.first_name ? 'border-red-500' : ''}
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground mt-1">
                              {user.first_name || 'Not set'}
                            </p>
                          )}
                          {errors.first_name && (
                            <p className="text-xs text-red-500 mt-1">{errors.first_name}</p>
                          )}
                        </div>
                        
                        <div>
                          <Label htmlFor="lastName">Last Name</Label>
                          {isEditing ? (
                            <Input
                              id="lastName"
                              value={formData.last_name || ''}
                              onChange={(e) => handleChange('last_name', e.target.value)}
                              className={errors.last_name ? 'border-red-500' : ''}
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground mt-1">
                              {user.last_name || 'Not set'}
                            </p>
                          )}
                          {errors.last_name && (
                            <p className="text-xs text-red-500 mt-1">{errors.last_name}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="username">Username</Label>
                        {isEditing ? (
                          <Input
                            id="username"
                            value={formData.username || ''}
                            onChange={(e) => handleChange('username', e.target.value)}
                            className={errors.username ? 'border-red-500' : ''}
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground mt-1">
                            @{user.username || 'Not set'}
                          </p>
                        )}
                        {errors.username && (
                          <p className="text-xs text-red-500 mt-1">{errors.username}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="bio">Bio</Label>
                        {isEditing ? (
                          <Textarea
                            id="bio"
                            value={formData.bio || ''}
                            onChange={(e) => handleChange('bio', e.target.value)}
                            placeholder="Tell us about yourself..."
                            className={errors.bio ? 'border-red-500' : ''}
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground mt-1">
                            {user.bio || 'No bio available'}
                          </p>
                        )}
                         {errors.bio && (
                           <p className="text-xs text-red-500 mt-1">{errors.bio}</p>
                         )}
                       </div>
                       
                       <div>
                         <Label>Profile Picture</Label>
                         {isEditing ? (
                           <AvatarUpload
                             currentAvatarUrl={formData.avatar_url}
                             userId={user.id}
                             userName={`${user.first_name} ${user.last_name}`}
                             onAvatarChange={(url) => handleChange('avatar_url', url)}
                           />
                         ) : (
                           <div className="flex items-center gap-3 mt-2">
                             <Avatar className="h-12 w-12">
                               <AvatarImage src={user.avatar_url || undefined} />
                               <AvatarFallback>
                                 {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
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

                  {/* System Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      System Information
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="role">Role</Label>
                        {isEditing ? (
                          <Select
                            value={formData.role}
                            onValueChange={(value) => handleChange('role', value)}
                          >
                            <SelectTrigger>
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
                          <p className="text-sm text-muted-foreground mt-1">
                            {user.role}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="membershipTier">Membership Tier</Label>
                        {isEditing ? (
                          <Select
                            value={formData.membership_tier || 'free'}
                            onValueChange={(value) => handleChange('membership_tier', value)}
                          >
                            <SelectTrigger>
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
                          <p className="text-sm text-muted-foreground mt-1">
                            {user.membership_tier || 'Free'}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label>Account Created</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDate(user.created_at)}
                        </p>
                      </div>

                       <div>
                         <Label>Last Sign In</Label>
                         <p className="text-sm text-muted-foreground mt-1">
                           {formatDate(user.last_sign_in_at)}
                         </p>
                       </div>

                       <div>
                         <Label>Account Status</Label>
                         {isEditing ? (
                           <Select
                             value={user.account_disabled ? 'disabled' : 'enabled'}
                             onValueChange={(value) => handleChange('account_status' as any, value)}
                           >
                             <SelectTrigger>
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
                           <div className="flex items-center gap-2 mt-1">
                             {user.account_disabled ? (
                               <>
                                 <XCircle className="h-4 w-4 text-red-600" />
                                 <span className="text-sm text-red-600">Disabled</span>
                               </>
                             ) : (
                               <>
                                 <CheckCircle className="h-4 w-4 text-green-600" />
                                 <span className="text-sm text-green-600">Enabled</span>
                               </>
                             )}
                           </div>
                         )}
                       </div>

                       <div>
                         <Label>Email Verification</Label>
                         {isEditing ? (
                           <Select
                             value={user.email_confirmed_at ? 'confirmed' : 'unconfirmed'}
                             onValueChange={(value) => handleChange('email_confirmed' as any, value === 'confirmed')}
                           >
                             <SelectTrigger>
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               <SelectItem value="confirmed">
                                 <div className="flex items-center gap-2">
                                   <CheckCircle className="h-4 w-4 text-green-600" />
                                   Verified
                                 </div>
                               </SelectItem>
                               <SelectItem value="unconfirmed">
                                 <div className="flex items-center gap-2">
                                   <AlertCircle className="h-4 w-4 text-orange-600" />
                                   Unverified
                                 </div>
                               </SelectItem>
                             </SelectContent>
                           </Select>
                         ) : (
                           <div className="flex items-center gap-2 mt-1">
                             {user.email_confirmed_at ? (
                               <>
                                 <CheckCircle className="h-4 w-4 text-green-600" />
                                 <span className="text-sm text-green-600">Verified</span>
                               </>
                             ) : (
                               <>
                                 <AlertCircle className="h-4 w-4 text-orange-600" />
                                 <span className="text-sm text-orange-600">Unverified</span>
                               </>
                             )}
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
                        <Button onClick={addSocialLink} variant="outline" size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Link
                        </Button>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      {Object.entries(socialLinks).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No social links added</p>
                      ) : (
                        Object.entries(socialLinks).map(([platform, url]) => (
                          <div key={platform} className="flex items-center gap-2">
                            <div className="flex-1">
                              <Label className="capitalize">{platform}</Label>
                              {isEditing ? (
                                <div className="flex gap-2">
                                  <Input
                                    value={url}
                                    onChange={(e) => handleSocialLinkChange(platform, e.target.value)}
                                    placeholder={`Your ${platform} URL`}
                                  />
                                  <Button
                                    onClick={() => removeSocialLink(platform)}
                                    variant="ghost"
                                    size="sm"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {url || 'Not set'}
                                </p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="subscription" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Subscription Information
                  </h3>
                  
                  {user.subscription ? (
                    <div className="bg-card p-6 rounded-lg border">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Plan</Label>
                          <p className="text-lg font-semibold text-primary">
                            {user.subscription.plan_name}
                          </p>
                        </div>
                        <div>
                          <Label>Status</Label>
                          <Badge variant="default" className="mt-1">
                            {user.subscription.status}
                          </Badge>
                        </div>
                        <div>
                          <Label>Price</Label>
                          <p className="text-sm text-muted-foreground">
                            ${user.subscription.price_usd}
                            {user.subscription.is_lifetime ? ' (Lifetime)' : '/month'}
                          </p>
                        </div>
                        <div>
                          <Label>Payment Method</Label>
                          <p className="text-sm text-muted-foreground">
                            {user.subscription.payment_method || 'N/A'}
                          </p>
                        </div>
                        {user.subscription.start_date && (
                          <div>
                            <Label>Start Date</Label>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(user.subscription.start_date)}
                            </p>
                          </div>
                        )}
                        {user.subscription.end_date && (
                          <div>
                            <Label>End Date</Label>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(user.subscription.end_date)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No active subscription</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="activity" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Account Activity
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="bg-card p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Last Sign In</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(user.last_sign_in_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-card p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Account Created</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(user.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-card p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Email Status</p>
                          <Badge 
                            variant={user.is_email_confirmed ? "default" : "secondary"}
                            className="mt-1"
                          >
                            {user.is_email_confirmed ? "Confirmed" : "Unconfirmed"}
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