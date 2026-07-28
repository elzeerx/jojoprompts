import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Clock,
  Globe,
  Mail,
  MapPin,
  Phone,
  User,
} from "lucide-react";
import { ExtendedUserProfile } from "@/types/user";
import {
  AccountStatusBadge,
  OrphanedBadge,
  RoleBadge,
  VerificationBadge,
} from "./shared";

type UserProfileSheetUser = ExtendedUserProfile & {
  account_disabled?: boolean;
  email_confirmed_at?: string | null;
  is_email_confirmed?: boolean | null;
  has_auth_account?: boolean;
};

interface UserProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfileSheetUser | null;
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "Not available";

  return new Date(dateString).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3 py-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span>{label}</span>
      </div>
      <div className="break-words text-sm font-medium text-foreground">
        {value || "Not set"}
      </div>
    </div>
  );
}

/**
 * Read-only account summary used by Users V2.
 *
 * Editing stays in the single, permission-aware Edit dialog so this sheet
 * does not duplicate legacy profile, plan, or subscription controls.
 */
export function UserProfileSheet({
  open,
  onOpenChange,
  user,
}: UserProfileSheetProps) {
  if (!user) return null;

  const isEmailConfirmed =
    user.is_email_confirmed ??
    (user.email_confirmed_at ? true : false);
  const socialLinks = Object.entries(user.social_links ?? {}).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-[560px]">
        <SheetHeader className="border-b bg-muted/30 p-5 pe-12 text-start sm:p-6 sm:pe-12">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14 shrink-0 border-2 border-border/20 shadow-sm sm:h-16 sm:w-16">
              <AvatarImage src={user.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-lg font-medium text-primary">
                {user.first_name?.charAt(0)?.toUpperCase()}
                {user.last_name?.charAt(0)?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <SheetTitle className="truncate text-xl font-bold">
                {[user.first_name, user.last_name].filter(Boolean).join(" ") ||
                  "Unnamed user"}
              </SheetTitle>
              <SheetDescription className="mt-1 break-all font-mono">
                @{user.username || "not-set"}
              </SheetDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                <RoleBadge role={user.role} size="sm" />
                <VerificationBadge
                  isVerified={isEmailConfirmed}
                  size="sm"
                />
                <AccountStatusBadge
                  isDisabled={user.account_disabled === true}
                  size="sm"
                />
                <OrphanedBadge
                  hasAuthAccount={user.has_auth_account ?? true}
                  size="sm"
                />
              </div>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-5 sm:p-6">
            <section aria-labelledby="account-details-heading">
              <h3
                id="account-details-heading"
                className="text-sm font-semibold text-foreground"
              >
                Account details
              </h3>
              <div className="mt-2 divide-y rounded-lg border px-4">
                <DetailRow
                  icon={User}
                  label="User ID"
                  value={user.id}
                />
                <DetailRow
                  icon={Calendar}
                  label="Created"
                  value={formatDate(user.created_at)}
                />
                <DetailRow
                  icon={Clock}
                  label="Last sign in"
                  value={formatDate(user.last_sign_in_at)}
                />
              </div>
            </section>

            <section aria-labelledby="contact-details-heading">
              <h3
                id="contact-details-heading"
                className="text-sm font-semibold text-foreground"
              >
                Contact details
              </h3>
              <div className="mt-2 divide-y rounded-lg border px-4">
                <DetailRow
                  icon={Mail}
                  label="Email"
                  value={user.email || "Not set"}
                />
                <DetailRow
                  icon={Phone}
                  label="Phone"
                  value={user.phone_number || "Not set"}
                />
                <DetailRow
                  icon={MapPin}
                  label="Country"
                  value={user.country || "Not set"}
                />
                <DetailRow
                  icon={Clock}
                  label="Timezone"
                  value={user.timezone || "Not set"}
                />
              </div>
            </section>

            {(user.bio || socialLinks.length > 0) && (
              <>
                <Separator />
                <section
                  className="space-y-4"
                  aria-labelledby="public-profile-heading"
                >
                  <h3
                    id="public-profile-heading"
                    className="text-sm font-semibold text-foreground"
                  >
                    Public profile
                  </h3>
                  {user.bio && (
                    <p className="rounded-lg border bg-muted/20 p-4 text-sm leading-relaxed">
                      {user.bio}
                    </p>
                  )}
                  {socialLinks.length > 0 && (
                    <div className="space-y-2">
                      {socialLinks.map(([platform, url]) => (
                        <a
                          key={platform}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted/50"
                        >
                          <Globe className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="min-w-0 flex-1 truncate capitalize">
                            {platform}
                          </span>
                          <span className="max-w-[55%] truncate text-muted-foreground">
                            {url}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
