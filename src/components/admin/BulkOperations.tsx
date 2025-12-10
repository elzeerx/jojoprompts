import { useState } from "react";
import { createLogger } from '@/utils/logging';
import { handleError } from '@/utils/errorHandler';

const logger = createLogger('BULK_OPERATIONS');
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  Download,
  Upload,
  Trash2,
  Edit,
  AlertTriangle,
  CheckCircle,
  X
} from "lucide-react";
import { ExtendedUserProfile, UserRole } from "@/types/user";
import { toast } from "@/hooks/use-toast";

interface BulkOperationsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUsers: ExtendedUserProfile[];
  allUsers: ExtendedUserProfile[];
  onBulkUpdate: (userIds: string[], updateData: any) => Promise<void>;
  onBulkDelete: (userIds: string[]) => Promise<void>;
  onExportUsers: (userIds: string[]) => Promise<void>;
  isLoading?: boolean;
}

type OperationType = 'update' | 'delete' | 'export' | null;

export function BulkOperations({
  open,
  onOpenChange,
  selectedUsers,
  allUsers,
  onBulkUpdate,
  onBulkDelete,
  onExportUsers,
  isLoading = false
}: BulkOperationsProps) {
  const [operationType, setOperationType] = useState<OperationType>(null);
  const [updateData, setUpdateData] = useState({
    role: '',
    membership_tier: '',
    account_status: ''
  });
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [includeFields, setIncludeFields] = useState<string[]>([
    'first_name',
    'last_name',
    'username',
    'email',
    'role'
  ]);
  const [confirmationText, setConfirmationText] = useState('');
  const [progress, setProgress] = useState(0);

  const availableFields = [
    'first_name',
    'last_name',
    'username',
    'email',
    'role',
    'membership_tier',
    'country',
    'phone_number',
    'created_at',
    'last_sign_in_at'
  ];

  const handleBulkUpdate = async () => {
    if (selectedUsers.length === 0) {
      toast({
        title: "No users selected",
        description: "Please select users to update.",
        variant: "destructive"
      });
      return;
    }

    const cleanUpdateData = Object.fromEntries(
      Object.entries(updateData).filter(([key, value]) => value !== '')
    );

    if (Object.keys(cleanUpdateData).length === 0) {
      toast({
        title: "No changes specified",
        description: "Please specify at least one field to update.",
        variant: "destructive"
      });
      return;
    }

    try {
      const userIds = selectedUsers.map(user => user.id);
      await onBulkUpdate(userIds, cleanUpdateData);
      
      toast({
        title: "Bulk update completed",
        description: `Successfully updated ${userIds.length} users.`
      });
      
      resetForm();
    } catch (error) {
      const appError = handleError(error, { component: 'BulkOperations', action: 'bulkUpdate' });
      logger.error('Bulk update error', appError);
      toast({
        title: "Bulk update failed",
        description: "Some users may not have been updated. Please check the logs.",
        variant: "destructive"
      });
    }
  };

  const handleBulkDelete = async () => {
    const expectedText = `DELETE ${selectedUsers.length} USERS`;
    
    if (confirmationText !== expectedText) {
      toast({
        title: "Confirmation required",
        description: `Type "${expectedText}" to confirm deletion.`,
        variant: "destructive"
      });
      return;
    }

    try {
      const userIds = selectedUsers.map(user => user.id);
      await onBulkDelete(userIds);
      
      toast({
        title: "Bulk deletion completed",
        description: `Successfully deleted ${userIds.length} users.`
      });
      
      resetForm();
    } catch (error) {
      const appError = handleError(error, { component: 'BulkOperations', action: 'bulkDelete' });
      logger.error('Bulk delete error', appError);
      toast({
        title: "Bulk deletion failed",
        description: "Some users may not have been deleted. Please check the logs.",
        variant: "destructive"
      });
    }
  };

  const handleExport = async () => {
    if (selectedUsers.length === 0) {
      toast({
        title: "No users selected",
        description: "Please select users to export.",
        variant: "destructive"
      });
      return;
    }

    if (includeFields.length === 0) {
      toast({
        title: "No fields selected",
        description: "Please select at least one field to export.",
        variant: "destructive"
      });
      return;
    }

    try {
      const userIds = selectedUsers.map(user => user.id);
      await onExportUsers(userIds);
      
      toast({
        title: "Export started",
        description: `Generating ${exportFormat.toUpperCase()} export for ${userIds.length} users.`
      });
      
      resetForm();
    } catch (error) {
      const appError = handleError(error, { component: 'BulkOperations', action: 'export' });
      logger.error('Export error', appError);
      toast({
        title: "Export failed",
        description: "Failed to generate export. Please try again.",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setOperationType(null);
    setUpdateData({ role: '', membership_tier: '', account_status: '' });
    setConfirmationText('');
    setProgress(0);
    onOpenChange(false);
  };

  const renderOperationSelector = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Button
        variant="outline"
        className="h-20 flex flex-col gap-2"
        onClick={() => setOperationType('update')}
      >
        <Edit className="h-6 w-6" />
        <span>Bulk Update</span>
        <span className="text-xs text-muted-foreground">
          Update multiple users
        </span>
      </Button>
      
      <Button
        variant="outline"
        className="h-20 flex flex-col gap-2"
        onClick={() => setOperationType('export')}
      >
        <Download className="h-6 w-6" />
        <span>Export Data</span>
        <span className="text-xs text-muted-foreground">
          Download user data
        </span>
      </Button>
      
      <Button
        variant="outline"
        className="h-20 flex flex-col gap-2 text-red-600 hover:text-red-700"
        onClick={() => setOperationType('delete')}
      >
        <Trash2 className="h-6 w-6" />
        <span>Bulk Delete</span>
        <span className="text-xs text-muted-foreground">
          Permanently delete users
        </span>
      </Button>
    </div>
  );

  const renderBulkUpdate = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
        <Edit className="h-5 w-5 text-blue-600" />
        <span className="font-medium">
          Updating {selectedUsers.length} users
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="bulkRole">Role</Label>
          <Select
            value={updateData.role}
            onValueChange={(value) => setUpdateData(prev => ({ ...prev, role: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select role (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No change</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="prompter">Prompter</SelectItem>
              <SelectItem value="jadmin">Junior Admin</SelectItem>
              <SelectItem value="admin">Administrator</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="bulkMembershipTier">Membership Tier</Label>
          <Select
            value={updateData.membership_tier}
            onValueChange={(value) => setUpdateData(prev => ({ ...prev, membership_tier: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select tier (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No change</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="basic">Basic</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="bulkAccountStatus">Account Status</Label>
          <Select
            value={updateData.account_status}
            onValueChange={(value) => setUpdateData(prev => ({ ...prev, account_status: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No change</SelectItem>
              <SelectItem value="enabled">Enabled</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setOperationType(null)}>
          Back
        </Button>
        <Button onClick={handleBulkUpdate} disabled={isLoading}>
          Update {selectedUsers.length} Users
        </Button>
      </div>
    </div>
  );

  const renderExport = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
        <Download className="h-5 w-5 text-green-600" />
        <span className="font-medium">
          Exporting {selectedUsers.length} users
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Export Format</Label>
          <Select value={exportFormat} onValueChange={(value: 'csv' | 'json') => setExportFormat(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV (Spreadsheet)</SelectItem>
              <SelectItem value="json">JSON (Data)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Fields to Include</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {availableFields.map(field => (
              <div key={field} className="flex items-center space-x-2">
                <Checkbox
                  id={field}
                  checked={includeFields.includes(field)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setIncludeFields(prev => [...prev, field]);
                    } else {
                      setIncludeFields(prev => prev.filter(f => f !== field));
                    }
                  }}
                />
                <Label htmlFor={field} className="text-sm">
                  {field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setOperationType(null)}>
          Back
        </Button>
        <Button onClick={handleExport} disabled={isLoading}>
          <Download className="h-4 w-4 mr-2" />
          Export {selectedUsers.length} Users
        </Button>
      </div>
    </div>
  );

  const renderBulkDelete = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
        <AlertTriangle className="h-5 w-5 text-red-600" />
        <span className="font-medium text-red-800">
          Permanently delete {selectedUsers.length} users
        </span>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h4 className="font-semibold text-red-800 mb-2">Warning: This action cannot be undone</h4>
        <p className="text-sm text-red-700 mb-4">
          This will permanently delete all user data including profiles, subscriptions, 
          prompts, and activity history. The users will be completely removed from the system.
        </p>
        
        <div>
          <Label htmlFor="confirmText" className="text-red-800">
            Type "DELETE {selectedUsers.length} USERS" to confirm:
          </Label>
          <Input
            id="confirmText"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            placeholder={`DELETE ${selectedUsers.length} USERS`}
            className="mt-1"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setOperationType(null)}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={handleBulkDelete}
          disabled={isLoading || confirmationText !== `DELETE ${selectedUsers.length} USERS`}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete {selectedUsers.length} Users
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Operations
          </DialogTitle>
          <DialogDescription>
            Perform operations on multiple users at once.
            {selectedUsers.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {selectedUsers.length} users selected
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!operationType && renderOperationSelector()}
          {operationType === 'update' && renderBulkUpdate()}
          {operationType === 'export' && renderExport()}
          {operationType === 'delete' && renderBulkDelete()}

          {progress > 0 && progress < 100 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}