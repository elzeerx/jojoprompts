import { Button } from "@/components/ui/button";
import { UserRole } from "@/types/user";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserCog, Shield, X, Download } from "lucide-react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
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

interface BulkActionsBarProps {
  selectedUserIds: string[];
  onBulkDelete: () => Promise<void>;
  onBulkRoleChange: (role: UserRole) => Promise<void>;
  onBulkStatusChange: (status: 'active' | 'suspended') => Promise<void>;
  onBulkExport: (format: 'json' | 'csv') => Promise<void>;
  onClearSelection: () => void;
  isProcessing?: boolean;
}

export function BulkActionsBar({
  selectedUserIds,
  onBulkDelete,
  onBulkRoleChange,
  onBulkStatusChange,
  onBulkExport,
  onClearSelection,
  isProcessing = false
}: BulkActionsBarProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole | ''>('');
  const [selectedStatus, setSelectedStatus] = useState<'active' | 'suspended' | ''>('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleRoleChange = async (role: string) => {
    setSelectedRole(role as UserRole);
    if (role) {
      await onBulkRoleChange(role as UserRole);
      setSelectedRole('');
    }
  };

  const handleStatusChange = async (status: string) => {
    setSelectedStatus(status as 'active' | 'suspended');
    if (status) {
      await onBulkStatusChange(status as 'active' | 'suspended');
      setSelectedStatus('');
    }
  };

  const handleDelete = async () => {
    await onBulkDelete();
    setDeleteDialogOpen(false);
  };

  if (selectedUserIds.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-card border shadow-lg rounded-lg p-4 flex items-center gap-4 animate-in slide-in-from-bottom-4">
        {/* Selection Count */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {selectedUserIds.length} selected
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={isProcessing}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-border" />

        {/* Bulk Actions */}
        <div className="flex items-center gap-2">
          {/* Role Change */}
          <Select
            value={selectedRole}
            onValueChange={handleRoleChange}
            disabled={isProcessing}
          >
            <SelectTrigger className="w-[140px] h-9">
              <UserCog className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Change Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="prompter">Prompter</SelectItem>
              <SelectItem value="jadmin">Junior Admin</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Change */}
          <Select
            value={selectedStatus}
            onValueChange={handleStatusChange}
            disabled={isProcessing}
          >
            <SelectTrigger className="w-[140px] h-9">
              <Shield className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Change Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>

          {/* Export */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkExport('json')}
            disabled={isProcessing}
            className="h-9"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>

          {/* Delete */}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={isProcessing}
            className="h-9"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedUserIds.length} Users?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected users
              and all of their associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Users
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}