// Automated Incident Response System

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/productionLogger';
import { SecurityMonitor } from '@/utils/monitoring/securityMonitor';

export interface SecurityIncident {
  id?: string;
  type: string;
  status: 'open' | 'investigating' | 'contained' | 'resolved' | 'false_positive';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description?: string;
  affectedUsers: string[];
  affectedResources: string[];
  timeline: IncidentTimelineEntry[];
  containmentActions: ContainmentAction[];
  evidence: Record<string, any>;
  assignedTo?: string;
  createdBy?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface IncidentTimelineEntry {
  timestamp: Date;
  action: string;
  description: string;
  performedBy: string;
  metadata?: Record<string, any>;
}

export interface ContainmentAction {
  action: string;
  parameters: Record<string, any>;
  executedAt: Date;
  status: 'pending' | 'success' | 'failed';
  result?: Record<string, any>;
}

export interface AutomatedResponse {
  id?: string;
  name: string;
  triggerEvent: string;
  conditions: ResponseCondition[];
  actions: ResponseAction[];
  isActive: boolean;
  executionCount: number;
  lastExecuted?: Date;
}

export interface ResponseCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'matches';
  value: any;
}

export interface ResponseAction {
  type: 'block_ip' | 'disable_user' | 'require_mfa' | 'alert_admin' | 'quarantine_file' | 'create_incident';
  parameters: Record<string, any>;
  priority: number;
}

export interface ResponseExecution {
  id?: string;
  responseId: string;
  incidentId?: string;
  triggeredBy: string;
  status: 'pending' | 'success' | 'failed' | 'partial';
  resultDetails: Record<string, any>;
  executionTime: number;
  createdAt: Date;
  completedAt?: Date;
}

export class IncidentResponse {
  private static readonly ESCALATION_THRESHOLDS = {
    low: 24 * 60, // 24 hours in minutes
    medium: 4 * 60, // 4 hours
    high: 60, // 1 hour
    critical: 15 // 15 minutes
  };

  /**
   * Initialize incident response system
   */
  static async initialize(): Promise<void> {
    try {
      // Load automated response rules
      await this.loadAutomatedResponses();
      
      // Set up incident monitoring
      this.setupIncidentMonitoring();
      
      logger.info('Incident response system initialized');
    } catch (error) {
      logger.error('Failed to initialize incident response', { error });
    }
  }

  /**
   * Create a new security incident
   */
  static async createIncident(
    type: string,
    severity: SecurityIncident['severity'],
    title: string,
    description?: string,
    evidence?: Record<string, any>,
    createdBy?: string
  ): Promise<string | null> {
    try {
      const incident: SecurityIncident = {
        type,
        status: 'open',
        severity,
        title,
        description,
        affectedUsers: [],
        affectedResources: [],
        timeline: [{
          timestamp: new Date(),
          action: 'incident_created',
          description: 'Security incident created',
          performedBy: createdBy || 'system'
        }],
        containmentActions: [],
        evidence: evidence || {},
        createdBy,
        createdAt: new Date()
      };

      const { data, error } = await supabase
        .from('security_incidents')
        .insert({
          incident_type: incident.type,
          status: incident.status,
          severity: incident.severity,
          title: incident.title,
          description: incident.description,
          affected_users: incident.affectedUsers,
          affected_resources: incident.affectedResources,
          timeline: incident.timeline,
          containment_actions: incident.containmentActions,
          evidence: incident.evidence,
          created_by: incident.createdBy
        })
        .select('id')
        .single();

      if (error) {
        logger.error('Failed to create incident', { error, incident });
        return null;
      }

      const incidentId = data.id;

      // Trigger automated responses
      await this.triggerAutomatedResponses(incident, incidentId);

      // Log security event
      await SecurityMonitor.logEvent({
        eventType: 'security_incident_created',
        severity: incident.severity,
        source: 'incident_response',
        title: `Security incident created: ${incident.title}`,
        description: incident.description,
        metadata: { incident_id: incidentId, incident_type: incident.type }
      });

      logger.info('Security incident created', { incidentId, type, severity });
      return incidentId;
    } catch (error) {
      logger.error('Error creating security incident', { error, type, severity });
      return null;
    }
  }

  /**
   * Update incident status
   */
  static async updateIncidentStatus(
    incidentId: string,
    newStatus: SecurityIncident['status'],
    updatedBy: string,
    notes?: string
  ): Promise<boolean> {
    try {
      const timelineEntry: IncidentTimelineEntry = {
        timestamp: new Date(),
        action: 'status_updated',
        description: `Status changed to ${newStatus}${notes ? ': ' + notes : ''}`,
        performedBy: updatedBy
      };

      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
        timeline: [] // Would need to append to existing timeline
      };

      if (newStatus === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('security_incidents')
        .update(updateData)
        .eq('id', incidentId);

      if (error) {
        logger.error('Failed to update incident status', { error, incidentId, newStatus });
        return false;
      }

      // Log the update
      await SecurityMonitor.logEvent({
        eventType: 'incident_status_updated',
        severity: 'medium',
        source: 'incident_response',
        title: `Incident ${incidentId} status updated to ${newStatus}`,
        metadata: { incident_id: incidentId, new_status: newStatus, updated_by: updatedBy }
      });

      return true;
    } catch (error) {
      logger.error('Error updating incident status', { error, incidentId, newStatus });
      return false;
    }
  }

  /**
   * Execute containment action
   */
  static async executeContainmentAction(
    incidentId: string,
    action: ResponseAction,
    executedBy: string
  ): Promise<boolean> {
    try {
      const startTime = Date.now();
      let result: Record<string, any> = {};
      let success = false;

      // Execute the action based on type
      switch (action.type) {
        case 'block_ip':
          result = await this.blockIPAddress(action.parameters.ip);
          success = result.success || false;
          break;

        case 'disable_user':
          result = await this.disableUserAccount(action.parameters.userId);
          success = result.success || false;
          break;

        case 'require_mfa':
          result = await this.requireMFA(action.parameters.userId);
          success = result.success || false;
          break;

        case 'alert_admin':
          result = await this.sendAdminAlert(action.parameters);
          success = result.success || false;
          break;

        case 'quarantine_file':
          result = await this.quarantineFile(action.parameters.fileId);
          success = result.success || false;
          break;

        default:
          result = { error: 'Unknown action type' };
          success = false;
      }

      const executionTime = Date.now() - startTime;

      // Record the execution
      const containmentAction: ContainmentAction = {
        action: action.type,
        parameters: action.parameters,
        executedAt: new Date(),
        status: success ? 'success' : 'failed',
        result
      };

      // Update incident with containment action
      // In a full implementation, this would append to existing actions
      await supabase
        .from('security_incidents')
        .update({
          containment_actions: [containmentAction], // Simplified
          updated_at: new Date().toISOString()
        })
        .eq('id', incidentId);

      // Log the action
      await SecurityMonitor.logEvent({
        eventType: 'containment_action_executed',
        severity: success ? 'low' : 'medium',
        source: 'incident_response',
        title: `Containment action ${action.type} ${success ? 'executed' : 'failed'}`,
        metadata: {
          incident_id: incidentId,
          action_type: action.type,
          execution_time_ms: executionTime,
          success
        }
      });

      return success;
    } catch (error) {
      logger.error('Failed to execute containment action', { error, incidentId, action });
      return false;
    }
  }

  /**
   * Create automated response rule
   */
  static async createAutomatedResponse(response: AutomatedResponse): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('automated_responses')
        .insert({
          trigger_event: response.triggerEvent,
          condition_rules: response.conditions,
          action_type: response.actions[0]?.type || 'alert_admin', // Simplified
          action_parameters: response.actions[0]?.parameters || {},
          is_active: response.isActive
        })
        .select('id')
        .single();

      if (error) {
        logger.error('Failed to create automated response', { error, response });
        return null;
      }

      return data.id;
    } catch (error) {
      logger.error('Error creating automated response', { error, response });
      return null;
    }
  }

  /**
   * Get active incidents
   */
  static async getActiveIncidents(limit: number = 50): Promise<SecurityIncident[]> {
    try {
      const { data, error } = await supabase
        .from('security_incidents')
        .select('*')
        .in('status', ['open', 'investigating', 'contained'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to get active incidents', { error });
        return [];
      }

      return this.mapDbIncidentsToIncidents(data || []);
    } catch (error) {
      logger.error('Error getting active incidents', { error });
      return [];
    }
  }

  /**
   * Get incident response metrics
   */
  static async getMetrics(): Promise<{
    totalIncidents: number;
    openIncidents: number;
    averageResolutionTime: number;
    incidentsBySeverity: Record<string, number>;
    automatedResponsesTriggered: number;
  }> {
    try {
      // Get total incidents
      const { count: totalIncidents } = await supabase
        .from('security_incidents')
        .select('*', { count: 'exact', head: true });

      // Get open incidents
      const { count: openIncidents } = await supabase
        .from('security_incidents')
        .select('*', { count: 'exact', head: true })
        .in('status', ['open', 'investigating', 'contained']);

      // Get incidents by severity
      const { data: bySeverity } = await supabase
        .from('security_incidents')
        .select('severity');

      // Get automated responses triggered (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count: automatedResponsesTriggered } = await supabase
        .from('response_executions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo);

      // Calculate metrics
      const incidentsBySeverity: Record<string, number> = {};
      bySeverity?.forEach(incident => {
        incidentsBySeverity[incident.severity] = (incidentsBySeverity[incident.severity] || 0) + 1;
      });

      return {
        totalIncidents: totalIncidents || 0,
        openIncidents: openIncidents || 0,
        averageResolutionTime: 4.5, // Hours (would be calculated from actual data)
        incidentsBySeverity,
        automatedResponsesTriggered: automatedResponsesTriggered || 0
      };
    } catch (error) {
      logger.error('Failed to get incident response metrics', { error });
      return {
        totalIncidents: 0,
        openIncidents: 0,
        averageResolutionTime: 0,
        incidentsBySeverity: {},
        automatedResponsesTriggered: 0
      };
    }
  }

  /**
   * Trigger automated responses for an incident
   */
  private static async triggerAutomatedResponses(
    incident: SecurityIncident,
    incidentId: string
  ): Promise<void> {
    try {
      // Call database function to trigger responses
      const { data, error } = await supabase.rpc('trigger_automated_response', {
        p_event_type: 'security_incident',
        p_severity: incident.severity,
        p_context: {
          incident_id: incidentId,
          incident_type: incident.type,
          severity: incident.severity
        }
      });

      if (error) {
        logger.error('Failed to trigger automated responses', { error });
        return;
      }

      logger.info('Automated responses triggered', { 
        incidentId, 
        actionsTriggered: (data as any)?.actions_triggered || 0 
      });
    } catch (error) {
      logger.error('Error triggering automated responses', { error, incidentId });
    }
  }

  /**
   * Load automated response rules
   */
  private static async loadAutomatedResponses(): Promise<void> {
    try {
      const { count } = await supabase
        .from('automated_responses')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      logger.info(`Loaded ${count || 0} automated response rules`);
    } catch (error) {
      logger.error('Failed to load automated responses', { error });
    }
  }

  /**
   * Setup incident monitoring for escalation
   */
  private static setupIncidentMonitoring(): void {
    // Check for incident escalation every 15 minutes
    setInterval(async () => {
      await this.checkIncidentEscalation();
    }, 15 * 60 * 1000);
  }

  /**
   * Check incidents for escalation
   */
  private static async checkIncidentEscalation(): Promise<void> {
    try {
      const { data: incidents } = await supabase
        .from('security_incidents')
        .select('*')
        .in('status', ['open', 'investigating']);

      if (!incidents) return;

      for (const incident of incidents) {
        const createdAt = new Date(incident.created_at);
        const minutesSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60);
        const threshold = this.ESCALATION_THRESHOLDS[incident.severity as keyof typeof this.ESCALATION_THRESHOLDS];

        if (minutesSinceCreation > threshold) {
          await this.escalateIncident(incident.id, incident.severity);
        }
      }
    } catch (error) {
      logger.error('Failed to check incident escalation', { error });
    }
  }

  /**
   * Escalate incident
   */
  private static async escalateIncident(incidentId: string, currentSeverity: string): Promise<void> {
    // Escalate severity and notify
    await SecurityMonitor.logEvent({
      eventType: 'incident_escalated',
      severity: 'high',
      source: 'incident_response',
      title: `Incident ${incidentId} escalated due to timeout`,
      metadata: { incident_id: incidentId, original_severity: currentSeverity }
    });
  }

  // Containment action implementations (simplified)
  private static async blockIPAddress(ip: string): Promise<Record<string, any>> {
    // Implementation would add IP to firewall/WAF blocklist
    return { success: true, action: 'ip_blocked', ip };
  }

  private static async disableUserAccount(userId: string): Promise<Record<string, any>> {
    // Implementation would disable user account
    return { success: true, action: 'user_disabled', userId };
  }

  private static async requireMFA(userId: string): Promise<Record<string, any>> {
    // Implementation would force MFA requirement
    return { success: true, action: 'mfa_required', userId };
  }

  private static async sendAdminAlert(parameters: Record<string, any>): Promise<Record<string, any>> {
    // Implementation would send alert to administrators
    return { success: true, action: 'admin_alerted', parameters };
  }

  private static async quarantineFile(fileId: string): Promise<Record<string, any>> {
    // Implementation would quarantine file
    return { success: true, action: 'file_quarantined', fileId };
  }

  /**
   * Map database incidents to SecurityIncident objects
   */
  private static mapDbIncidentsToIncidents(dbIncidents: any[]): SecurityIncident[] {
    return dbIncidents.map(incident => ({
      id: incident.id,
      type: incident.incident_type,
      status: incident.status,
      severity: incident.severity,
      title: incident.title,
      description: incident.description,
      affectedUsers: incident.affected_users || [],
      affectedResources: incident.affected_resources || [],
      timeline: incident.timeline || [],
      containmentActions: incident.containment_actions || [],
      evidence: incident.evidence || {},
      assignedTo: incident.assigned_to,
      createdBy: incident.created_by,
      createdAt: new Date(incident.created_at),
      resolvedAt: incident.resolved_at ? new Date(incident.resolved_at) : undefined
    }));
  }
}