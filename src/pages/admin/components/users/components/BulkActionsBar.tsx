import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  CheckSquare, 
  Download, 
  Trash2, 
  Shield, 
  X,
  AlertTriangle,
  ChevronDown,
  FileJson,
  FileSpreadsheet,
  Mail
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ExtendedUserProfile } from "@/types/user";

interface BulkActionsBarProps {
  selectedCount: number;
  selectedUsers: (ExtendedUserProfile & { is_email_confirmed?: boolean | null })[];
  onClearSelection: () => void;
  onBulkExport: (format: 'csv' | 'json') => Promise<boolean>;
  onBulkRoleChange: (userIds: string[], newRole: string) => Promise<boolean>;
  onBulkDelete: (userIds: string[]) => Promise<boolean>;
  onBulkConfirmEmails: (userIds: string[]) => Promise<any>;
  isProcessing: boolean;
}

export function BulkActionsBar({
  selectedCount,
  selectedUsers,
  onClearSelection,
  onBulkExport,
  onBulkRoleChange,
  onBulkDelete,
  onBulkConfirmEmails,
  isProcessing,
}: BulkActionsBarProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");

  if (selectedCount === 0) return null;

  const handleRoleChange = async () => {
    if (!selectedRole) {
      toast({
        variant: "destructive",
        title: "Select a role",
        description: "Please select a role to assign",
      });
      return;
    }
    
    const userIds = selectedUsers.map(u => u.id);
    const success = await onBulkRoleChange(userIds, selectedRole);
    if (success) {
      setRoleDialogOpen(false);
      setSelectedRole("");
      onClearSelection();
    }
  };

  const handleBulkDelete = async () => {
    const userIds = selectedUsers.map(u => u.id);
    const success = await onBulkDelete(userIds);
    if (success) {
      setDeleteDialogOpen(false);
      onClearSelection();
    }
  };

  const handleBulkConfirm = async () => {
    const unconfirmedUsers = selectedUsers.filter(u => u.is_email_confirmed === false);
    if (unconfirmedUsers.length === 0) {
      toast({
        title: "No unconfirmed users",
        description: "All selected users are already confirmed",
      });
      return;
    }
    
    const userIds = unconfirmedUsers.map(u => u.id);
    await onBulkConfirmEmails(userIds);
    onClearSelection();
  };

  const unconfirmedCount = selectedUsers.filter(u => u.is_email_confirmed === false).length;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-3 px-4 py-3 bg-background border rounded-xl shadow-lg">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" />
            <span className="font-medium">{selectedCount} selected</span>
          </div>
          
          <div className="h-6 w-px bg-border" />
          
          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isProcessing}>
                <Download className="h-4 w-4 mr-2" />
                Export
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Export Format</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onBulkExport('csv')}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onBulkExport('json')}>
                <FileJson className="h-4 w-4 mr-2" />
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Confirm Emails Button */}
          {unconfirmedCount > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleBulkConfirm}
              disabled={isProcessing}
            >
              <Mail className="h-4 w-4 mr-2" />
              Confirm ({unconfirmedCount})
            </Button>
          )}

          {/* Change Role Button */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setRoleDialogOpen(true)}
            disabled={isProcessing}
          >
            <Shield className="h-4 w-4 mr-2" />
            Change Role
          </Button>

          {/* Delete Button */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setDeleteDialogOpen(true)}
            disabled={isProcessing}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>

          <div className="h-6 w-px bg-border" />

          {/* Clear Selection */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClearSelection}
            disabled={isProcessing}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Role Change Dialog */}
      <AlertDialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Change Role for {selectedCount} Users
            </AlertDialogTitle>
            <AlertDialogDescription>
              Select the new role to assign to all selected users.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="prompter">Prompter</SelectItem>
                <SelectItem value="jadmin">Junior Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRoleChange} disabled={!selectedRole || isProcessing}>
              Change Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete {selectedCount} Users
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All selected user accounts and their data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4 px-4 bg-destructive/5 rounded-lg border border-destructive/20">
            <p className="text-sm text-destructive font-medium">
              You are about to delete:
            </p>
            <ul className="mt-2 text-sm text-muted-foreground space-y-1">
              {selectedUsers.slice(0, 5).map(user => (
                <li key={user.id}>• {user.email}</li>
              ))}
              {selectedUsers.length > 5 && (
                <li>• ...and {selectedUsers.length - 5} more users</li>
              )}
            </ul>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete}
              disabled={isProcessing}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
