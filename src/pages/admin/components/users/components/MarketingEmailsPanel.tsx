import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Users, Send, Loader2, UserCheck } from "lucide-react";
import { useUsersWithoutPlans } from "@/hooks/useUsersWithoutPlans";
import { useMarketingEmails } from "@/hooks/useMarketingEmails";
import { useIsMobile } from "@/hooks/use-mobile";

export function MarketingEmailsPanel() {
  const { users, loading, refetch } = useUsersWithoutPlans();
  const { sendReminderEmail, sendBulkReminderEmails, sending } = useMarketingEmails();
  const isMobile = useIsMobile();
  
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(users.map(user => user.id)));
    } else {
      setSelectedUsers(new Set());
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    const newSelected = new Set(selectedUsers);
    if (checked) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleSendIndividual = async (user: any) => {
    if (!user.email) {
      return;
    }
    
    await sendReminderEmail(
      user.email,
      user.first_name || "User",
      user.last_name || "",
      true
    );
  };

  const handleSendBulk = async () => {
    const selectedUserData = users
      .filter(user => selectedUsers.has(user.id) && user.email)
      .map(user => ({
        email: user.email!,
        first_name: user.first_name || "User",
        last_name: user.last_name || ""
      }));

    if (selectedUserData.length === 0) {
      return;
    }

    await sendBulkReminderEmails(selectedUserData);
    setSelectedUsers(new Set()); // Clear selection after sending
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading users without plans...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Marketing Email Campaign
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Send plan reminder emails to users without active subscriptions
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {users.length} users without plans
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <UserCheck className="h-3 w-3" />
                {selectedUsers.size} selected
              </Badge>
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                onClick={() => handleSendBulk()}
                disabled={selectedUsers.size === 0 || sending}
                className="flex-1 sm:flex-none"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send to Selected ({selectedUsers.size})
              </Button>
              <Button variant="outline" onClick={refetch} disabled={loading}>
                Refresh
              </Button>
            </div>
          </div>

          {users.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
                <Checkbox
                  id="select-all"
                  checked={selectedUsers.size === users.length && users.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <label htmlFor="select-all" className="text-sm font-medium">
                  Select all users
                </label>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={selectedUsers.has(user.id)}
                        onCheckedChange={(checked) => 
                          handleSelectUser(user.id, checked as boolean)
                        }
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {user.first_name} {user.last_name}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            @{user.username}
                          </Badge>
                        </div>
                        {user.email && (
                          <p className="text-sm text-muted-foreground">
                            {user.email}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Joined: {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSendIndividual(user)}
                      disabled={sending || !user.email}
                      className={isMobile ? "text-xs px-2" : ""}
                    >
                      {sending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Mail className="h-3 w-3 mr-1" />
                          Send
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {users.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No users without plans</h3>
              <p className="text-muted-foreground">
                All registered users have active subscription plans!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}