import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserCRUD } from "@/hooks/useUserCRUD";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useUserActions } from "./hooks/useUserActions";
import { UsersTable } from "./UsersTable";
import { UsersHeader } from "./components/UsersHeader";
import { UserPerformanceStats } from "./UserPerformanceStats";
import { MarketingEmailsPanel } from "./components/MarketingEmailsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


export default function UsersManagement() {
  const { isSuperAdmin } = useSuperAdmin();
  const {
    users,
    total,
    totalPages,
    currentPage,
    searchTerm,
    isLoading,
    error,
    updateUser,
    deleteUser,
    setPage,
    setSearch,
    refetch
  } = useUserCRUD();
  
  const { resendConfirmationEmail } = useUserActions();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Users Management</h2>
        <p className="text-muted-foreground">
          Manage user accounts, roles, subscriptions, and marketing campaigns
        </p>
      </div>

      <div className="space-y-6">
        {isSuperAdmin && (
          <Alert className="border-warm-gold bg-warm-gold/5">
            <AlertCircle className="h-4 w-4 text-warm-gold" />
            <AlertDescription>
              Super Admin Mode Active - You have complete control over all user operations
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="marketing">Marketing Emails</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6 mt-6">
            <UsersHeader 
              searchTerm={searchTerm}
              onSearchChange={setSearch}
              onUserCreated={refetch}
            />

            <UserPerformanceStats 
              total={total}
              performance={null}
              retryCount={0}
              loading={isLoading}
            />

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Failed to load users</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    className="ml-4"
                  >
                    Try Again
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <UsersTable
                  users={users}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  total={total}
                  onPageChange={setPage}
                  updatingUserId={null}
                  onUpdateUser={updateUser}
                  onAssignPlan={async () => {}}
                  onSendResetEmail={async () => {}}
                  onSearchChange={setSearch}
                  searchTerm={searchTerm}
                  onDeleteUser={deleteUser}
                  onResendConfirmation={resendConfirmationEmail}
                  onRefresh={refetch}
                />
                <div className="text-sm text-muted-foreground">
                  Total users: {total}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="marketing" className="mt-6">
            <MarketingEmailsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
