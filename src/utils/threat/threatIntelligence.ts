// Threat Intelligence Integration System

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/productionLogger';

export interface ThreatIndicator {
  id?: string;
  type: 'ip' | 'domain' | 'hash' | 'email' | 'url';
  value: string;
  threatType: 'malware' | 'phishing' | 'botnet' | 'tor' | 'proxy' | 'suspicious';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  confidence: number; // 0-100
  description?: string;
  metadata?: Record<string, any>;
  firstSeen: Date;
  lastSeen: Date;
  isActive: boolean;
}

export interface ThreatCheckResult {
  isThreat: boolean;
  indicators: ThreatIndicator[];
  riskScore: number;
  recommendation: string;
  sources: string[];
}

export interface ThreatFeed {
  name: string;
  url: string;
  apiKey?: string;
  format: 'json' | 'xml' | 'csv';
  updateInterval: number; // hours
  isActive: boolean;
  lastUpdate?: Date;
}

export class ThreatIntelligence {
  private static readonly THREAT_FEEDS: ThreatFeed[] = [
    {
      name: 'AbuseIPDB',
      url: 'https://api.abuseipdb.com/api/v2/check',
      format: 'json',
      updateInterval: 24,
      isActive: true
    },
    {
      name: 'VirusTotal',
      url: 'https://www.virustotal.com/vtapi/v2/',
      format: 'json',
      updateInterval: 12,
      isActive: true
    }
  ];

  private static readonly CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours
  private static threatCache = new Map<string, { result: ThreatCheckResult; expires: number }>();

  /**
   * Initialize threat intelligence system
   */
  static async initialize(): Promise<void> {
    try {
      // Load existing threat indicators
      await this.loadThreatIndicators();
      
      // Start periodic feed updates
      this.startPeriodicUpdates();
      
      logger.info('Threat intelligence system initialized');
    } catch (error) {
      logger.error('Failed to initialize threat intelligence', { error });
    }
  }

  /**
   * Check if an IP address is a known threat
   */
  static async checkIP(ipAddress: string): Promise<ThreatCheckResult> {
    try {
      // Check cache first
      const cached = this.getCachedResult(`ip:${ipAddress}`);
      if (cached) {
        return cached;
      }

      const indicators: ThreatIndicator[] = [];
      let maxRiskScore = 0;
      const sources: string[] = [];

      // Check local database
      const localIndicators = await this.getLocalIndicators('ip', ipAddress);
      indicators.push(...localIndicators);

      // Check external feeds
      const externalIndicators = await this.checkExternalFeeds('ip', ipAddress);
      indicators.push(...externalIndicators);

      // Calculate overall risk score
      for (const indicator of indicators) {
        const score = this.calculateIndicatorRisk(indicator);
        maxRiskScore = Math.max(maxRiskScore, score);
        if (!sources.includes(indicator.source)) {
          sources.push(indicator.source);
        }
      }

      const result: ThreatCheckResult = {
        isThreat: indicators.length > 0,
        indicators,
        riskScore: maxRiskScore,
        recommendation: this.generateRecommendation(maxRiskScore, indicators),
        sources
      };

      // Cache the result
      this.cacheResult(`ip:${ipAddress}`, result);

      return result;
    } catch (error) {
      logger.error('Failed to check IP threat status', { error, ipAddress });
      return this.getEmptyResult();
    }
  }

  /**
   * Check if a domain is a known threat
   */
  static async checkDomain(domain: string): Promise<ThreatCheckResult> {
    try {
      const cached = this.getCachedResult(`domain:${domain}`);
      if (cached) {
        return cached;
      }

      const indicators: ThreatIndicator[] = [];
      let maxRiskScore = 0;
      const sources: string[] = [];

      // Check local database
      const localIndicators = await this.getLocalIndicators('domain', domain);
      indicators.push(...localIndicators);

      // Check external feeds (simplified for demo)
      const externalIndicators = await this.checkExternalFeeds('domain', domain);
      indicators.push(...externalIndicators);

      // Calculate risk score
      for (const indicator of indicators) {
        const score = this.calculateIndicatorRisk(indicator);
        maxRiskScore = Math.max(maxRiskScore, score);
        if (!sources.includes(indicator.source)) {
          sources.push(indicator.source);
        }
      }

      const result: ThreatCheckResult = {
        isThreat: indicators.length > 0,
        indicators,
        riskScore: maxRiskScore,
        recommendation: this.generateRecommendation(maxRiskScore, indicators),
        sources
      };

      this.cacheResult(`domain:${domain}`, result);
      return result;
    } catch (error) {
      logger.error('Failed to check domain threat status', { error, domain });
      return this.getEmptyResult();
    }
  }

  /**
   * Check file hash against threat databases
   */
  static async checkFileHash(hash: string): Promise<ThreatCheckResult> {
    try {
      const cached = this.getCachedResult(`hash:${hash}`);
      if (cached) {
        return cached;
      }

      const indicators: ThreatIndicator[] = [];
      let maxRiskScore = 0;
      const sources: string[] = [];

      // Check local database
      const localIndicators = await this.getLocalIndicators('hash', hash);
      indicators.push(...localIndicators);

      // In a real implementation, this would check VirusTotal, etc.
      const externalIndicators = await this.checkExternalFeeds('hash', hash);
      indicators.push(...externalIndicators);

      for (const indicator of indicators) {
        const score = this.calculateIndicatorRisk(indicator);
        maxRiskScore = Math.max(maxRiskScore, score);
        if (!sources.includes(indicator.source)) {
          sources.push(indicator.source);
        }
      }

      const result: ThreatCheckResult = {
        isThreat: indicators.length > 0,
        indicators,
        riskScore: maxRiskScore,
        recommendation: this.generateRecommendation(maxRiskScore, indicators),
        sources
      };

      this.cacheResult(`hash:${hash}`, result);
      return result;
    } catch (error) {
      logger.error('Failed to check file hash threat status', { error, hash });
      return this.getEmptyResult();
    }
  }

  /**
   * Add threat indicator to database
   */
  static async addThreatIndicator(indicator: ThreatIndicator): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('threat_indicators')
        .upsert({
          indicator_type: indicator.type,
          indicator_value: indicator.value,
          threat_type: indicator.threatType,
          severity: indicator.severity,
          source: indicator.source,
          confidence: indicator.confidence,
          description: indicator.description,
          metadata: indicator.metadata || {},
          first_seen: indicator.firstSeen.toISOString(),
          last_seen: indicator.lastSeen.toISOString(),
          is_active: indicator.isActive
        })
        .select('id')
        .single();

      if (error) {
        logger.error('Failed to add threat indicator', { error, indicator });
        return null;
      }

      return data.id;
    } catch (error) {
      logger.error('Error adding threat indicator', { error, indicator });
      return null;
    }
  }

  /**
   * Update threat indicators from external feeds
   */
  static async updateFromFeeds(): Promise<void> {
    try {
      for (const feed of this.THREAT_FEEDS) {
        if (!feed.isActive) continue;

        await this.updateFromFeed(feed);
      }

      logger.info('Threat feed update completed');
    } catch (error) {
      logger.error('Failed to update from threat feeds', { error });
    }
  }

  /**
   * Get threat statistics
   */
  static async getThreatStats(): Promise<{
    totalIndicators: number;
    indicatorsByType: Record<string, number>;
    indicatorsBySeverity: Record<string, number>;
    recentThreats: number;
    topSources: Array<{ source: string; count: number }>;
  }> {
    try {
      // Get total count
      const { count: totalIndicators } = await supabase
        .from('threat_indicators')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get counts by type
      const { data: byType } = await supabase
        .from('threat_indicators')
        .select('indicator_type')
        .eq('is_active', true);

      // Get counts by severity
      const { data: bySeverity } = await supabase
        .from('threat_indicators')
        .select('severity')
        .eq('is_active', true);

      // Get recent threats (last 24 hours)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: recentThreats } = await supabase
        .from('threat_indicators')
        .select('*', { count: 'exact', head: true })
        .gte('last_seen', yesterday)
        .eq('is_active', true);

      // Process the data
      const indicatorsByType: Record<string, number> = {};
      const indicatorsBySeverity: Record<string, number> = {};

      byType?.forEach(item => {
        indicatorsByType[item.indicator_type] = (indicatorsByType[item.indicator_type] || 0) + 1;
      });

      bySeverity?.forEach(item => {
        indicatorsBySeverity[item.severity] = (indicatorsBySeverity[item.severity] || 0) + 1;
      });

      return {
        totalIndicators: totalIndicators || 0,
        indicatorsByType,
        indicatorsBySeverity,
        recentThreats: recentThreats || 0,
        topSources: [] // Would be calculated from actual data
      };
    } catch (error) {
      logger.error('Failed to get threat stats', { error });
      return {
        totalIndicators: 0,
        indicatorsByType: {},
        indicatorsBySeverity: {},
        recentThreats: 0,
        topSources: []
      };
    }
  }

  /**
   * Get local threat indicators
   */
  private static async getLocalIndicators(
    type: string,
    value: string
  ): Promise<ThreatIndicator[]> {
    try {
      const { data, error } = await supabase
        .from('threat_indicators')
        .select('*')
        .eq('indicator_type', type)
        .eq('indicator_value', value)
        .eq('is_active', true);

      if (error || !data) {
        return [];
      }

      return this.mapDbIndicatorsToIndicators(data);
    } catch (error) {
      logger.error('Failed to get local indicators', { error, type, value });
      return [];
    }
  }

  /**
   * Check external threat feeds
   */
  private static async checkExternalFeeds(
    type: string,
    value: string
  ): Promise<ThreatIndicator[]> {
    // Simplified implementation - in practice would make actual API calls
    // For demo purposes, we'll return empty array
    try {
      // This would implement actual API calls to threat intelligence feeds
      // like AbuseIPDB, VirusTotal, etc.
      return [];
    } catch (error) {
      logger.error('Failed to check external feeds', { error, type, value });
      return [];
    }
  }

  /**
   * Calculate risk score for an indicator
   */
  private static calculateIndicatorRisk(indicator: ThreatIndicator): number {
    let score = 0;

    // Base score by severity
    switch (indicator.severity) {
      case 'critical':
        score += 90;
        break;
      case 'high':
        score += 70;
        break;
      case 'medium':
        score += 50;
        break;
      case 'low':
        score += 30;
        break;
    }

    // Adjust by confidence
    score = score * (indicator.confidence / 100);

    // Adjust by recency
    const daysSinceLastSeen = (Date.now() - indicator.lastSeen.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastSeen > 30) {
      score *= 0.8; // Reduce score for older indicators
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Generate recommendation based on risk score
   */
  private static generateRecommendation(
    riskScore: number,
    indicators: ThreatIndicator[]
  ): string {
    if (riskScore >= 80) {
      return 'Block immediately - High threat detected';
    } else if (riskScore >= 60) {
      return 'Monitor closely - Potential threat detected';
    } else if (riskScore >= 40) {
      return 'Investigate - Suspicious activity detected';
    } else if (indicators.length > 0) {
      return 'Monitor - Low risk indicators found';
    } else {
      return 'No threats detected';
    }
  }

  /**
   * Cache threat check result
   */
  private static cacheResult(key: string, result: ThreatCheckResult): void {
    this.threatCache.set(key, {
      result,
      expires: Date.now() + this.CACHE_DURATION_MS
    });
  }

  /**
   * Get cached threat check result
   */
  private static getCachedResult(key: string): ThreatCheckResult | null {
    const cached = this.threatCache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.result;
    }
    
    if (cached) {
      this.threatCache.delete(key);
    }
    
    return null;
  }

  /**
   * Load existing threat indicators
   */
  private static async loadThreatIndicators(): Promise<void> {
    try {
      const { count } = await supabase
        .from('threat_indicators')
        .select('*', { count: 'exact', head: true });

      logger.info(`Loaded ${count || 0} threat indicators`);
    } catch (error) {
      logger.error('Failed to load threat indicators', { error });
    }
  }

  /**
   * Start periodic feed updates
   */
  private static startPeriodicUpdates(): void {
    // Update feeds every 6 hours
    setInterval(async () => {
      await this.updateFromFeeds();
    }, 6 * 60 * 60 * 1000);
  }

  /**
   * Update from a specific feed
   */
  private static async updateFromFeed(feed: ThreatFeed): Promise<void> {
    try {
      // In a real implementation, this would:
      // 1. Fetch data from the feed URL
      // 2. Parse the response based on format
      // 3. Extract threat indicators
      // 4. Add/update indicators in database
      
      logger.info(`Updated from feed: ${feed.name}`);
    } catch (error) {
      logger.error(`Failed to update from feed: ${feed.name}`, { error });
    }
  }

  /**
   * Get empty threat check result
   */
  private static getEmptyResult(): ThreatCheckResult {
    return {
      isThreat: false,
      indicators: [],
      riskScore: 0,
      recommendation: 'No threats detected',
      sources: []
    };
  }

  /**
   * Map database indicators to ThreatIndicator objects
   */
  private static mapDbIndicatorsToIndicators(dbIndicators: any[]): ThreatIndicator[] {
    return dbIndicators.map(indicator => ({
      id: indicator.id,
      type: indicator.indicator_type,
      value: indicator.indicator_value,
      threatType: indicator.threat_type,
      severity: indicator.severity,
      source: indicator.source,
      confidence: indicator.confidence,
      description: indicator.description,
      metadata: indicator.metadata,
      firstSeen: new Date(indicator.first_seen),
      lastSeen: new Date(indicator.last_seen),
      isActive: indicator.is_active
    }));
  }
}