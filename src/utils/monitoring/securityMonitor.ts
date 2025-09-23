// Real-time Security Monitoring System

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/productionLogger';

export interface SecurityEvent {
  id?: string;
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface MonitoringMetrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  recentTrends: Array<{ time: Date; count: number }>;
  topSources: Array<{ source: string; count: number }>;
}

export interface AlertRule {
  id?: string;
  name: string;
  eventType: string;
  conditions: Record<string, any>;
  threshold: number;
  timeWindow: number; // minutes
  isActive: boolean;
  actions: string[];
}

export class SecurityMonitor {
  private static readonly EVENT_BUFFER_SIZE = 1000;
  private static eventBuffer: SecurityEvent[] = [];
  private static alertRules: Map<string, AlertRule> = new Map();

  /**
   * Initialize security monitoring system
   */
  static async initialize(): Promise<void> {
    try {
      // Load existing alert rules
      await this.loadAlertRules();
      
      // Set up real-time monitoring
      this.setupRealtimeMonitoring();
      
      // Start periodic cleanup
      this.startPeriodicCleanup();
      
      logger.info('Security monitoring system initialized');
    } catch (error) {
      logger.error('Failed to initialize security monitoring', { error });
    }
  }

  /**
   * Log a security event
   */
  static async logEvent(event: SecurityEvent): Promise<string | null> {
    try {
      // Add to buffer for real-time processing
      this.addToBuffer(event);
      
      // Store in database
      const { data, error } = await supabase
        .from('security_monitoring_events')
        .insert({
          event_type: event.eventType,
          severity: event.severity,
          source: event.source,
          title: event.title,
          description: event.description,
          metadata: event.metadata || {},
          user_id: event.userId,
          ip_address: event.ipAddress,
          user_agent: event.userAgent
        })
        .select('id')
        .single();

      if (error) {
        logger.error('Failed to log security event', { error, event });
        return null;
      }

      const eventId = data.id;

      // Check alert rules
      await this.checkAlertRules(event);

      // Trigger real-time notifications
      await this.triggerRealtimeNotification(event);

      return eventId;
    } catch (error) {
      logger.error('Error logging security event', { error, event });
      return null;
    }
  }

  /**
   * Get real-time monitoring metrics
   */
  static async getMetrics(timeRange: number = 24): Promise<MonitoringMetrics> {
    try {
      const since = new Date(Date.now() - (timeRange * 60 * 60 * 1000)).toISOString();

      // Get event counts by type
      const { data: eventsByType } = await supabase
        .from('security_monitoring_events')
        .select('event_type')
        .gte('created_at', since);

      // Get event counts by severity
      const { data: eventsBySeverity } = await supabase
        .from('security_monitoring_events')
        .select('severity')
        .gte('created_at', since);

      // Get recent trends (hourly counts)
      const { data: recentEvents } = await supabase
        .from('security_monitoring_events')
        .select('created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: true });

      return this.processMetrics(eventsByType, eventsBySeverity, recentEvents);
    } catch (error) {
      logger.error('Failed to get monitoring metrics', { error });
      return this.getEmptyMetrics();
    }
  }

  /**
   * Get recent security events
   */
  static async getRecentEvents(
    limit: number = 50,
    severity?: string,
    eventType?: string
  ): Promise<SecurityEvent[]> {
    try {
      let query = supabase
        .from('security_monitoring_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (severity) {
        query = query.eq('severity', severity);
      }

      if (eventType) {
        query = query.eq('event_type', eventType);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to get recent events', { error });
        return [];
      }

      return this.mapDbEventsToEvents(data || []);
    } catch (error) {
      logger.error('Error getting recent events', { error });
      return [];
    }
  }

  /**
   * Create or update alert rule
   */
  static async createAlertRule(rule: AlertRule): Promise<boolean> {
    try {
      // Store rule in memory
      this.alertRules.set(rule.name, rule);

      // In a full implementation, you'd store this in a database table
      logger.info('Alert rule created', { ruleName: rule.name });
      return true;
    } catch (error) {
      logger.error('Failed to create alert rule', { error, rule });
      return false;
    }
  }

  /**
   * Resolve a security event
   */
  static async resolveEvent(
    eventId: string,
    resolvedBy: string,
    resolution?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('security_monitoring_events')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy,
          metadata: { resolution }
        })
        .eq('id', eventId);

      if (error) {
        logger.error('Failed to resolve event', { error, eventId });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error resolving event', { error, eventId });
      return false;
    }
  }

  /**
   * Add event to buffer for real-time processing
   */
  private static addToBuffer(event: SecurityEvent): void {
    this.eventBuffer.push(event);
    
    // Keep buffer size manageable
    if (this.eventBuffer.length > this.EVENT_BUFFER_SIZE) {
      this.eventBuffer = this.eventBuffer.slice(-this.EVENT_BUFFER_SIZE);
    }
  }

  /**
   * Setup real-time monitoring using Supabase realtime
   */
  private static setupRealtimeMonitoring(): void {
    try {
      // Subscribe to new security events
      const channel = supabase
        .channel('security-monitoring')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'security_monitoring_events'
        }, (payload) => {
          this.handleRealtimeEvent(payload.new as any);
        })
        .subscribe();

      logger.info('Real-time monitoring setup complete');
    } catch (error) {
      logger.error('Failed to setup real-time monitoring', { error });
    }
  }

  /**
   * Handle real-time events
   */
  private static handleRealtimeEvent(event: any): void {
    // Process real-time event
    const securityEvent: SecurityEvent = {
      id: event.id,
      eventType: event.event_type,
      severity: event.severity,
      source: event.source,
      title: event.title,
      description: event.description,
      metadata: event.metadata,
      userId: event.user_id,
      ipAddress: event.ip_address,
      userAgent: event.user_agent
    };

    // Add to buffer
    this.addToBuffer(securityEvent);

    // Broadcast to connected clients (if applicable)
    this.broadcastEvent(securityEvent);
  }

  /**
   * Check alert rules against new event
   */
  private static async checkAlertRules(event: SecurityEvent): Promise<void> {
    for (const [name, rule] of this.alertRules) {
      if (!rule.isActive) continue;
      
      if (rule.eventType === event.eventType || rule.eventType === '*') {
        const shouldAlert = await this.evaluateAlertConditions(rule, event);
        
        if (shouldAlert) {
          await this.triggerAlert(rule, event);
        }
      }
    }
  }

  /**
   * Evaluate alert conditions
   */
  private static async evaluateAlertConditions(
    rule: AlertRule,
    event: SecurityEvent
  ): Promise<boolean> {
    try {
      // Count recent events matching criteria
      const since = new Date(Date.now() - (rule.timeWindow * 60 * 1000)).toISOString();
      
      let query = supabase
        .from('security_monitoring_events')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since);

      if (rule.eventType !== '*') {
        query = query.eq('event_type', rule.eventType);
      }

      // Apply additional conditions
      for (const [field, value] of Object.entries(rule.conditions)) {
        if (field === 'severity') {
          query = query.eq('severity', value);
        } else if (field === 'source') {
          query = query.eq('source', value);
        }
      }

      const { count } = await query;
      return (count || 0) >= rule.threshold;
    } catch (error) {
      logger.error('Failed to evaluate alert conditions', { error, rule });
      return false;
    }
  }

  /**
   * Trigger alert action
   */
  private static async triggerAlert(rule: AlertRule, event: SecurityEvent): Promise<void> {
    try {
      for (const action of rule.actions) {
        switch (action) {
          case 'email_admin':
            await this.sendAdminEmail(rule, event);
            break;
          case 'create_incident':
            await this.createSecurityIncident(rule, event);
            break;
          case 'block_ip':
            if (event.ipAddress) {
              await this.blockIP(event.ipAddress);
            }
            break;
          case 'disable_user':
            if (event.userId) {
              await this.disableUser(event.userId);
            }
            break;
        }
      }

      logger.info('Alert triggered', { ruleName: rule.name, eventId: event.id });
    } catch (error) {
      logger.error('Failed to trigger alert', { error, rule, event });
    }
  }

  /**
   * Load alert rules from configuration
   */
  private static async loadAlertRules(): Promise<void> {
    // Default alert rules
    const defaultRules: AlertRule[] = [
      {
        name: 'Critical Events',
        eventType: '*',
        conditions: { severity: 'critical' },
        threshold: 1,
        timeWindow: 5,
        isActive: true,
        actions: ['email_admin', 'create_incident']
      },
      {
        name: 'Failed Login Attempts',
        eventType: 'authentication_failed',
        conditions: {},
        threshold: 5,
        timeWindow: 15,
        isActive: true,
        actions: ['block_ip']
      },
      {
        name: 'Suspicious Activity',
        eventType: 'suspicious_activity',
        conditions: {},
        threshold: 3,
        timeWindow: 30,
        isActive: true,
        actions: ['email_admin']
      }
    ];

    for (const rule of defaultRules) {
      this.alertRules.set(rule.name, rule);
    }
  }

  /**
   * Start periodic cleanup
   */
  private static startPeriodicCleanup(): void {
    // Clean up old events every hour
    setInterval(async () => {
      try {
        const cutoff = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString(); // 30 days
        
        await supabase
          .from('security_monitoring_events')
          .delete()
          .lt('created_at', cutoff)
          .eq('is_resolved', true);

        logger.info('Completed security events cleanup');
      } catch (error) {
        logger.error('Failed to cleanup old events', { error });
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Process metrics data
   */
  private static processMetrics(
    eventsByType: any[],
    eventsBySeverity: any[],
    recentEvents: any[]
  ): MonitoringMetrics {
    const typeMap: Record<string, number> = {};
    const severityMap: Record<string, number> = {};

    // Count by type
    eventsByType?.forEach(event => {
      typeMap[event.event_type] = (typeMap[event.event_type] || 0) + 1;
    });

    // Count by severity
    eventsBySeverity?.forEach(event => {
      severityMap[event.severity] = (severityMap[event.severity] || 0) + 1;
    });

    // Process trends (hourly buckets)
    const trends = this.processTrends(recentEvents || []);

    return {
      totalEvents: recentEvents?.length || 0,
      eventsByType: typeMap,
      eventsBySeverity: severityMap,
      recentTrends: trends,
      topSources: [] // Would be calculated from events
    };
  }

  /**
   * Process trend data into hourly buckets
   */
  private static processTrends(events: any[]): Array<{ time: Date; count: number }> {
    const hourlyBuckets = new Map<string, number>();

    events.forEach(event => {
      const hour = new Date(event.created_at);
      hour.setMinutes(0, 0, 0);
      const key = hour.toISOString();
      hourlyBuckets.set(key, (hourlyBuckets.get(key) || 0) + 1);
    });

    return Array.from(hourlyBuckets.entries()).map(([time, count]) => ({
      time: new Date(time),
      count
    }));
  }

  /**
   * Get empty metrics structure
   */
  private static getEmptyMetrics(): MonitoringMetrics {
    return {
      totalEvents: 0,
      eventsByType: {},
      eventsBySeverity: {},
      recentTrends: [],
      topSources: []
    };
  }

  /**
   * Map database events to SecurityEvent objects
   */
  private static mapDbEventsToEvents(dbEvents: any[]): SecurityEvent[] {
    return dbEvents.map(event => ({
      id: event.id,
      eventType: event.event_type,
      severity: event.severity,
      source: event.source,
      title: event.title,
      description: event.description,
      metadata: event.metadata,
      userId: event.user_id,
      ipAddress: event.ip_address,
      userAgent: event.user_agent
    }));
  }

  // Placeholder methods for alert actions
  private static async triggerRealtimeNotification(event: SecurityEvent): Promise<void> {
    // Implementation would broadcast to connected clients
  }

  private static broadcastEvent(event: SecurityEvent): void {
    // Implementation would use WebSocket or Server-Sent Events
  }

  private static async sendAdminEmail(rule: AlertRule, event: SecurityEvent): Promise<void> {
    // Implementation would send email notification
  }

  private static async createSecurityIncident(rule: AlertRule, event: SecurityEvent): Promise<void> {
    // Implementation would create incident record
  }

  private static async blockIP(ipAddress: string): Promise<void> {
    // Implementation would add IP to blocklist
  }

  private static async disableUser(userId: string): Promise<void> {
    // Implementation would disable user account
  }
}
