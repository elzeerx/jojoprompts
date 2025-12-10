import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Mail, Pause, Play, TrendingUp, Users, DollarSign, Clock, Send, Plus, Download, Trash2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface AbandonedCartSequence {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  plan_name: string;
  plan_price: number;
  currency: string;
  sequence_step: number;
  status: string;
  email_1_sent_at: string | null;
  email_2_sent_at: string | null;
  email_3_sent_at: string | null;
  next_email_scheduled_at: string | null;
  created_at: string;
  conversion_date: string | null;
}

interface Stats {
  total: number;
  active: number;
  converted: number;
  expired: number;
  potentialRevenue: number;
  conversionRate: number;
}

export function AbandonedCartManagement() {
  const [sequences, setSequences] = useState<AbandonedCartSequence[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    converted: 0,
    expired: 0,
    potentialRevenue: 0,
    conversionRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newSequenceEmail, setNewSequenceEmail] = useState('');
  const [newSequencePlanId, setNewSequencePlanId] = useState('');
  const [plans, setPlans] = useState<{ id: string; name: string; price_usd: number }[]>([]);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const fetchSequences = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('abandoned_cart_sequences')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;

      setSequences(data || []);

      // Calculate stats
      const allSequences = data || [];
      const active = allSequences.filter(s => s.status === 'active').length;
      const converted = allSequences.filter(s => s.status === 'converted').length;
      const expired = allSequences.filter(s => s.status === 'expired').length;
      const potentialRevenue = allSequences
        .filter(s => s.status === 'active')
        .reduce((sum, s) => sum + (s.plan_price || 0), 0);

      setStats({
        total: allSequences.length,
        active,
        converted,
        expired,
        potentialRevenue,
        conversionRate: allSequences.length > 0 ? (converted / allSequences.length) * 100 : 0,
      });
    } catch (error: any) {
      console.error('Error fetching sequences:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch abandoned cart data',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSequences();
  }, [statusFilter]);

  // Fetch subscription plans
  useEffect(() => {
    const fetchPlans = async () => {
      const { data } = await supabase.from('subscription_plans').select('id, name, price_usd');
      if (data) setPlans(data);
    };
    fetchPlans();
  }, []);

  // Toggle selection
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sequences.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sequences.map(s => s.id)));
    }
  };

  // Create new sequence manually
  const createSequence = async () => {
    if (!newSequenceEmail || !newSequencePlanId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Email and plan are required' });
      return;
    }
    setCreating(true);
    try {
      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('email', newSequenceEmail)
        .single();

      if (profileError || !profile) {
        throw new Error('User not found with this email');
      }

      const { data, error } = await supabase.functions.invoke('send-abandoned-cart-email', {
        body: { action: 'start_sequence', user_id: profile.id, plan_id: newSequencePlanId },
      });

      if (error) throw error;

      toast({ title: 'Sequence Created', description: 'Recovery sequence started successfully' });
      setCreateDialogOpen(false);
      setNewSequenceEmail('');
      setNewSequencePlanId('');
      fetchSequences();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setCreating(false);
    }
  };

  const processQueue = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-abandoned-cart-email', {
        body: { action: 'process_queue' },
      });

      if (error) throw error;

      toast({
        title: 'Queue Processed',
        description: `Processed ${data.processed} emails. ${data.errors?.length || 0} errors.`,
      });

      fetchSequences();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to process queue',
      });
    } finally {
      setProcessing(false);
    }
  };

  const sendEmail = async (sequenceId: string, step: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-abandoned-cart-email', {
        body: { action: 'send_single', sequence_id: sequenceId, step },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Email Sent',
          description: `Step ${step} email sent successfully`,
        });
        fetchSequences();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to send email',
      });
    }
  };

  const pauseSequence = async (sequenceId: string) => {
    try {
      const { error } = await supabase.functions.invoke('send-abandoned-cart-email', {
        body: { action: 'pause_sequence', sequence_id: sequenceId },
      });

      if (error) throw error;

      toast({ title: 'Sequence Paused' });
      fetchSequences();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    }
  };

  const resumeSequence = async (sequenceId: string) => {
    try {
      const { error } = await supabase.functions.invoke('send-abandoned-cart-email', {
        body: { action: 'resume_sequence', sequence_id: sequenceId },
      });

      if (error) throw error;

      toast({ title: 'Sequence Resumed' });
      fetchSequences();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    }
  };

  // Bulk pause
  const bulkPause = async () => {
    for (const id of selectedIds) {
      await pauseSequence(id);
    }
    setSelectedIds(new Set());
  };

  // Bulk resume
  const bulkResume = async () => {
    for (const id of selectedIds) {
      await resumeSequence(id);
    }
    setSelectedIds(new Set());
  };

  // Bulk delete (cancel sequences)
  const bulkCancel = async () => {
    try {
      for (const id of selectedIds) {
        await supabase.from('abandoned_cart_sequences').update({ status: 'cancelled' }).eq('id', id);
      }
      toast({ title: 'Sequences Cancelled', description: `${selectedIds.size} sequences cancelled` });
      setSelectedIds(new Set());
      fetchSequences();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['User Email', 'User Name', 'Plan', 'Price', 'Status', 'Step', 'Created At', 'Conversion Date'];
    const rows = sequences.map(s => [
      s.user_email,
      s.user_name || '',
      s.plan_name,
      s.plan_price,
      s.status,
      s.sequence_step,
      s.created_at,
      s.conversion_date || '',
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `abandoned-carts-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-blue-100 text-blue-800">Active</Badge>;
      case 'converted':
        return <Badge className="bg-green-100 text-green-800">Converted</Badge>;
      case 'expired':
        return <Badge variant="secondary">Expired</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-100 text-yellow-800">Paused</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="text-red-600">Cancelled</Badge>;
      case 'unsubscribed':
        return <Badge variant="outline">Unsubscribed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStepProgress = (sequence: AbandonedCartSequence) => {
    const steps = [
      { sent: !!sequence.email_1_sent_at, label: '1' },
      { sent: !!sequence.email_2_sent_at, label: '2' },
      { sent: !!sequence.email_3_sent_at, label: '3' },
    ];

    return (
      <div className="flex gap-1">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              step.sent
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {step.label}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Sequences</p>
                <p className="text-3xl font-bold text-blue-600">{stats.active}</p>
              </div>
              <Users className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Potential Revenue</p>
                <p className="text-3xl font-bold text-warm-gold">${stats.potentialRevenue.toFixed(0)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-warm-gold/30" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Converted</p>
                <p className="text-3xl font-bold text-green-600">{stats.converted}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <p className="text-3xl font-bold">{stats.conversionRate.toFixed(1)}%</p>
              </div>
              <Clock className="h-8 w-8 text-gray-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Abandoned Cart Recovery
              </CardTitle>
              <CardDescription>
                Manage email sequences for users who didn't complete checkout
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSequences}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                title="Export to CSV"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
              <Button
                onClick={processQueue}
                disabled={processing}
                className="bg-warm-gold hover:bg-warm-gold/90"
              >
                {processing ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Process Queue
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Bulk Actions Bar */}
          {selectedIds.size > 0 && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={bulkPause}>
                  <Pause className="h-4 w-4 mr-1" /> Pause All
                </Button>
                <Button variant="outline" size="sm" onClick={bulkResume}>
                  <Play className="h-4 w-4 mr-1" /> Resume All
                </Button>
                <Button variant="outline" size="sm" onClick={bulkCancel} className="text-red-600 hover:text-red-700">
                  <Trash2 className="h-4 w-4 mr-1" /> Cancel All
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox 
                      checked={selectedIds.size === sequences.length && sequences.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next Email</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : sequences.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No abandoned cart sequences found
                    </TableCell>
                  </TableRow>
                ) : (
                  sequences.map((sequence) => (
                    <TableRow key={sequence.id}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedIds.has(sequence.id)}
                          onCheckedChange={() => toggleSelect(sequence.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sequence.user_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{sequence.user_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{sequence.plan_name}</TableCell>
                      <TableCell>
                        {sequence.currency === 'KWD'
                          ? `${sequence.plan_price} KWD`
                          : `$${sequence.plan_price}`}
                      </TableCell>
                      <TableCell>{getStepProgress(sequence)}</TableCell>
                      <TableCell>{getStatusBadge(sequence.status)}</TableCell>
                      <TableCell>
                        {sequence.next_email_scheduled_at && sequence.status === 'active' ? (
                          <span className="text-sm">
                            {formatDistanceToNow(new Date(sequence.next_email_scheduled_at), {
                              addSuffix: true,
                            })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {sequence.status === 'active' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  sendEmail(sequence.id, sequence.sequence_step + 1)
                                }
                                disabled={sequence.sequence_step >= 3}
                                title="Send next email now"
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => pauseSequence(sequence.id)}
                                title="Pause sequence"
                              >
                                <Pause className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {sequence.status === 'paused' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resumeSequence(sequence.id)}
                              title="Resume sequence"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Sequence Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Recovery Sequence</DialogTitle>
            <DialogDescription>
              Manually start an abandoned cart recovery sequence for a user
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">User Email</Label>
              <Input
                id="email"
                placeholder="user@example.com"
                value={newSequenceEmail}
                onChange={(e) => setNewSequenceEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
              <Select value={newSequencePlanId} onValueChange={setNewSequencePlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - ${plan.price_usd}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createSequence} disabled={creating} className="bg-warm-gold hover:bg-warm-gold/90">
              {creating && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
              Create Sequence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
