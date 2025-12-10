import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Mail, CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';
import { format, subDays, startOfDay, eachDayOfInterval } from 'date-fns';

interface SequenceData {
  id: string;
  status: string;
  plan_price: number;
  sequence_step: number;
  email_1_sent_at: string | null;
  email_2_sent_at: string | null;
  email_3_sent_at: string | null;
  created_at: string;
  conversion_date: string | null;
}

export function AbandonedCartAnalytics() {
  const [sequences, setSequences] = useState<SequenceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('abandoned_cart_sequences')
        .select('id, status, plan_price, sequence_step, email_1_sent_at, email_2_sent_at, email_3_sent_at, created_at, conversion_date')
        .order('created_at', { ascending: false });
      
      setSequences(data || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Calculate metrics
  const metrics = useMemo(() => {
    const total = sequences.length;
    const active = sequences.filter(s => s.status === 'active').length;
    const converted = sequences.filter(s => s.status === 'converted').length;
    const expired = sequences.filter(s => s.status === 'expired').length;
    const paused = sequences.filter(s => s.status === 'paused').length;
    
    const totalEmailsSent = sequences.reduce((sum, s) => {
      return sum + (s.email_1_sent_at ? 1 : 0) + (s.email_2_sent_at ? 1 : 0) + (s.email_3_sent_at ? 1 : 0);
    }, 0);

    const recoveredRevenue = sequences
      .filter(s => s.status === 'converted')
      .reduce((sum, s) => sum + (s.plan_price || 0), 0);

    const potentialRevenue = sequences
      .filter(s => s.status === 'active')
      .reduce((sum, s) => sum + (s.plan_price || 0), 0);

    const conversionRate = total > 0 ? (converted / total) * 100 : 0;

    // Calculate conversion by step
    const convertedByStep = {
      step1: sequences.filter(s => s.status === 'converted' && s.sequence_step === 1).length,
      step2: sequences.filter(s => s.status === 'converted' && s.sequence_step === 2).length,
      step3: sequences.filter(s => s.status === 'converted' && s.sequence_step === 3).length,
    };

    return {
      total,
      active,
      converted,
      expired,
      paused,
      totalEmailsSent,
      recoveredRevenue,
      potentialRevenue,
      conversionRate,
      convertedByStep,
    };
  }, [sequences]);

  // Chart data: Daily sequences over last 30 days
  const dailyData = useMemo(() => {
    const last30Days = eachDayOfInterval({
      start: subDays(new Date(), 29),
      end: new Date(),
    });

    return last30Days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const created = sequences.filter(s => {
        const date = new Date(s.created_at);
        return date >= dayStart && date < dayEnd;
      }).length;

      const converted = sequences.filter(s => {
        if (!s.conversion_date) return false;
        const date = new Date(s.conversion_date);
        return date >= dayStart && date < dayEnd;
      }).length;

      return {
        date: format(day, 'MMM d'),
        created,
        converted,
      };
    });
  }, [sequences]);

  // Pie chart data for status distribution
  const statusData = useMemo(() => [
    { name: 'Active', value: metrics.active, color: '#3b82f6' },
    { name: 'Converted', value: metrics.converted, color: '#22c55e' },
    { name: 'Expired', value: metrics.expired, color: '#6b7280' },
    { name: 'Paused', value: metrics.paused, color: '#eab308' },
  ].filter(d => d.value > 0), [metrics]);

  // Email funnel data
  const funnelData = useMemo(() => {
    const email1Sent = sequences.filter(s => s.email_1_sent_at).length;
    const email2Sent = sequences.filter(s => s.email_2_sent_at).length;
    const email3Sent = sequences.filter(s => s.email_3_sent_at).length;
    
    return [
      { step: 'Email 1', sent: email1Sent, conversions: metrics.convertedByStep.step1 },
      { step: 'Email 2', sent: email2Sent, conversions: metrics.convertedByStep.step2 },
      { step: 'Email 3', sent: email3Sent, conversions: metrics.convertedByStep.step3 },
    ];
  }, [sequences, metrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-warm-gold"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Emails Sent</span>
            </div>
            <p className="text-2xl font-bold mt-1">{metrics.totalEmailsSent}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Converted</span>
            </div>
            <p className="text-2xl font-bold mt-1">{metrics.converted}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-warm-gold" />
              <span className="text-xs text-muted-foreground">Rate</span>
            </div>
            <p className="text-2xl font-bold mt-1">{metrics.conversionRate.toFixed(1)}%</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Recovered</span>
            </div>
            <p className="text-2xl font-bold mt-1">${metrics.recoveredRevenue}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Potential</span>
            </div>
            <p className="text-2xl font-bold mt-1">${metrics.potentialRevenue}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-muted-foreground">Expired</span>
            </div>
            <p className="text-2xl font-bold mt-1">{metrics.expired}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Daily Sequences (30 Days)</CardTitle>
            <CardDescription>New sequences created vs conversions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" fontSize={11} tick={{ fill: '#6b7280' }} />
                  <YAxis fontSize={11} tick={{ fill: '#6b7280' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="created" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="Created"
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="converted" 
                    stroke="#22c55e" 
                    strokeWidth={2}
                    name="Converted"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status Distribution</CardTitle>
            <CardDescription>Current sequence status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] flex items-center justify-center">
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground">No data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Email Funnel Performance</CardTitle>
          <CardDescription>Emails sent and conversions at each step</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" fontSize={11} tick={{ fill: '#6b7280' }} />
                <YAxis dataKey="step" type="category" fontSize={12} tick={{ fill: '#6b7280' }} width={70} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }} 
                />
                <Bar dataKey="sent" fill="#3b82f6" name="Emails Sent" radius={[0, 4, 4, 0]} />
                <Bar dataKey="conversions" fill="#22c55e" name="Conversions" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
