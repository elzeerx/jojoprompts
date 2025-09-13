import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  Upload, 
  Download, 
  Mail, 
  Users, 
  FileText,
  Settings,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface BatchOperation {
  id: string;
  type: 'import' | 'export' | 'email' | 'update';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total: number;
  processed: number;
  errors: string[];
  created_at: string;
  completed_at?: string;
}

export function BatchOperationsPanel() {
  const [operations, setOperations] = useState<BatchOperation[]>([]);
  const [activeTab, setActiveTab] = useState('import');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importOptions, setImportOptions] = useState({
    updateExisting: false,
    skipInvalid: true,
    defaultRole: 'user'
  });

  // Export state
  const [exportOptions, setExportOptions] = useState({
    format: 'csv',
    includeMetadata: true,
    filterBy: 'all',
    dateRange: '30days'
  });

  // Email state
  const [emailCampaign, setEmailCampaign] = useState({
    subject: '',
    message: '',
    template: '',
    targetRole: 'all',
    testEmail: ''
  });

  // Bulk update state
  const [bulkUpdate, setBulkUpdate] = useState({
    action: 'role_change',
    newRole: '',
    filters: {
      role: '',
      createdAfter: '',
      lastActiveAfter: ''
    }
  });

  const handleImportUsers = async () => {
    if (!importFile) {
      toast({
        title: 'Error',
        description: 'Please select a file to import',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Mock import process
      const operation: BatchOperation = {
        id: `import_${Date.now()}`,
        type: 'import',
        status: 'running',
        progress: 0,
        total: 100, // Mock total
        processed: 0,
        errors: [],
        created_at: new Date().toISOString()
      };

      setOperations(prev => [operation, ...prev]);

      // Simulate progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setOperations(prev => prev.map(op => 
          op.id === operation.id 
            ? { ...op, progress: i, processed: i }
            : op
        ));
      }

      setOperations(prev => prev.map(op => 
        op.id === operation.id 
          ? { ...op, status: 'completed', completed_at: new Date().toISOString() }
          : op
      ));

      toast({
        title: 'Success',
        description: `Imported ${operation.total} users successfully`
      });

    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to import users',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportUsers = async () => {
    setIsProcessing(true);
    try {
      const operation: BatchOperation = {
        id: `export_${Date.now()}`,
        type: 'export',
        status: 'running',
        progress: 0,
        total: 657, // Mock total users
        processed: 0,
        errors: [],
        created_at: new Date().toISOString()
      };

      setOperations(prev => [operation, ...prev]);

      // Simulate export progress
      for (let i = 0; i <= 100; i += 20) {
        await new Promise(resolve => setTimeout(resolve, 300));
        setOperations(prev => prev.map(op => 
          op.id === operation.id 
            ? { ...op, progress: i, processed: Math.floor((i / 100) * operation.total) }
            : op
        ));
      }

      setOperations(prev => prev.map(op => 
        op.id === operation.id 
          ? { ...op, status: 'completed', completed_at: new Date().toISOString() }
          : op
      ));

      // Trigger download (mock)
      const blob = new Blob(['user_id,username,email,role,created_at\n'], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();

      toast({
        title: 'Success',
        description: 'User export completed and downloaded'
      });

    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to export users',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendEmailCampaign = async () => {
    if (!emailCampaign.subject || !emailCampaign.message) {
      toast({
        title: 'Error',
        description: 'Please provide subject and message',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    try {
      const operation: BatchOperation = {
        id: `email_${Date.now()}`,
        type: 'email',
        status: 'running',
        progress: 0,
        total: 425, // Mock total recipients
        processed: 0,
        errors: [],
        created_at: new Date().toISOString()
      };

      setOperations(prev => [operation, ...prev]);

      // Simulate email sending progress
      for (let i = 0; i <= 100; i += 15) {
        await new Promise(resolve => setTimeout(resolve, 400));
        setOperations(prev => prev.map(op => 
          op.id === operation.id 
            ? { ...op, progress: i, processed: Math.floor((i / 100) * operation.total) }
            : op
        ));
      }

      setOperations(prev => prev.map(op => 
        op.id === operation.id 
          ? { ...op, status: 'completed', completed_at: new Date().toISOString() }
          : op
      ));

      toast({
        title: 'Success',
        description: `Email campaign sent to ${operation.total} users`
      });

    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to send email campaign',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkUpdate = async () => {
    setIsProcessing(true);
    try {
      const operation: BatchOperation = {
        id: `update_${Date.now()}`,
        type: 'update',
        status: 'running',
        progress: 0,
        total: 156, // Mock total affected users
        processed: 0,
        errors: [],
        created_at: new Date().toISOString()
      };

      setOperations(prev => [operation, ...prev]);

      // Simulate bulk update progress
      for (let i = 0; i <= 100; i += 25) {
        await new Promise(resolve => setTimeout(resolve, 250));
        setOperations(prev => prev.map(op => 
          op.id === operation.id 
            ? { ...op, progress: i, processed: Math.floor((i / 100) * operation.total) }
            : op
        ));
      }

      setOperations(prev => prev.map(op => 
        op.id === operation.id 
          ? { ...op, status: 'completed', completed_at: new Date().toISOString() }
          : op
      ));

      toast({
        title: 'Success',
        description: `Updated ${operation.total} users successfully`
      });

    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to perform bulk update',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'import': return <Upload className="h-4 w-4" />;
      case 'export': return <Download className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'update': return <Settings className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'running': return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default: return <Play className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Batch Operations</h2>
        <p className="text-muted-foreground">Import, export, and manage users in bulk</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="import">Import</TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="update">Update</TabsTrigger>
            </TabsList>

            <TabsContent value="import" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Import Users
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="import-file">CSV File</Label>
                    <Input
                      id="import-file"
                      type="file"
                      accept=".csv"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Expected columns: username, email, first_name, last_name, role
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="update-existing"
                        checked={importOptions.updateExisting}
                        onCheckedChange={(checked) => 
                          setImportOptions(prev => ({ ...prev, updateExisting: !!checked }))
                        }
                      />
                      <Label htmlFor="update-existing">Update existing users</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="skip-invalid"
                        checked={importOptions.skipInvalid}
                        onCheckedChange={(checked) => 
                          setImportOptions(prev => ({ ...prev, skipInvalid: !!checked }))
                        }
                      />
                      <Label htmlFor="skip-invalid">Skip invalid entries</Label>
                    </div>

                    <div>
                      <Label htmlFor="default-role">Default Role</Label>
                      <Select 
                        value={importOptions.defaultRole}
                        onValueChange={(value) => 
                          setImportOptions(prev => ({ ...prev, defaultRole: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="prompter">Prompter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button 
                    onClick={handleImportUsers}
                    disabled={!importFile || isProcessing}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Start Import
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="export" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Export Users
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="export-format">Format</Label>
                    <Select 
                      value={exportOptions.format}
                      onValueChange={(value) => 
                        setExportOptions(prev => ({ ...prev, format: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="xlsx">Excel</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="export-filter">Filter By</Label>
                    <Select 
                      value={exportOptions.filterBy}
                      onValueChange={(value) => 
                        setExportOptions(prev => ({ ...prev, filterBy: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="active">Active Users</SelectItem>
                        <SelectItem value="admin">Admins Only</SelectItem>
                        <SelectItem value="subscribers">Subscribers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-metadata"
                      checked={exportOptions.includeMetadata}
                      onCheckedChange={(checked) => 
                        setExportOptions(prev => ({ ...prev, includeMetadata: !!checked }))
                      }
                    />
                    <Label htmlFor="include-metadata">Include metadata</Label>
                  </div>

                  <Button 
                    onClick={handleExportUsers}
                    disabled={isProcessing}
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Users
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="email" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Email Campaign
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="email-subject">Subject</Label>
                    <Input
                      id="email-subject"
                      placeholder="Campaign subject..."
                      value={emailCampaign.subject}
                      onChange={(e) => setEmailCampaign(prev => ({ ...prev, subject: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="email-message">Message</Label>
                    <Textarea
                      id="email-message"
                      placeholder="Your message here..."
                      rows={6}
                      value={emailCampaign.message}
                      onChange={(e) => setEmailCampaign(prev => ({ ...prev, message: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="target-role">Target Audience</Label>
                    <Select 
                      value={emailCampaign.targetRole}
                      onValueChange={(value) => 
                        setEmailCampaign(prev => ({ ...prev, targetRole: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="user">Users Only</SelectItem>
                        <SelectItem value="prompter">Prompters</SelectItem>
                        <SelectItem value="subscribers">Subscribers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    onClick={handleSendEmailCampaign}
                    disabled={isProcessing}
                    className="w-full"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Send Campaign
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="update" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Bulk Update
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="update-action">Action</Label>
                    <Select 
                      value={bulkUpdate.action}
                      onValueChange={(value) => 
                        setBulkUpdate(prev => ({ ...prev, action: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="role_change">Change Role</SelectItem>
                        <SelectItem value="membership_tier">Update Membership</SelectItem>
                        <SelectItem value="status_change">Change Status</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {bulkUpdate.action === 'role_change' && (
                    <div>
                      <Label htmlFor="new-role">New Role</Label>
                      <Select 
                        value={bulkUpdate.newRole}
                        onValueChange={(value) => 
                          setBulkUpdate(prev => ({ ...prev, newRole: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select new role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="prompter">Prompter</SelectItem>
                          <SelectItem value="jadmin">Junior Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="filter-role">Filter by Current Role</Label>
                    <Select 
                      value={bulkUpdate.filters.role}
                      onValueChange={(value) => 
                        setBulkUpdate(prev => ({ 
                          ...prev, 
                          filters: { ...prev.filters, role: value }
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Any role</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="prompter">Prompter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    onClick={handleBulkUpdate}
                    disabled={isProcessing || !bulkUpdate.newRole}
                    className="w-full"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Execute Bulk Update
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Operation History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {operations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No operations yet</p>
              ) : (
                operations.map((operation) => (
                  <div key={operation.id} className="space-y-2 p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getOperationIcon(operation.type)}
                        <span className="text-sm font-medium">
                          {operation.type.charAt(0).toUpperCase() + operation.type.slice(1)}
                        </span>
                      </div>
                      {getStatusIcon(operation.status)}
                    </div>
                    
                    {operation.status === 'running' && (
                      <div className="space-y-1">
                        <Progress value={operation.progress} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                          {operation.processed} / {operation.total} processed
                        </p>
                      </div>
                    )}
                    
                    {operation.status === 'completed' && (
                      <p className="text-xs text-green-600">
                        Completed {operation.total} items
                      </p>
                    )}
                    
                    {operation.errors.length > 0 && (
                      <div className="text-xs text-red-600">
                        {operation.errors.length} errors
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}