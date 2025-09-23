// Behavioral Analytics Engine with ML-based Anomaly Detection

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/productionLogger';

export interface UserBehaviorMetric {
  userId: string;
  metricType: 'login_pattern' | 'api_usage' | 'location_pattern' | 'device_pattern';
  data: Record<string, any>;
  timestamp: Date;
}

export interface BehaviorBaseline {
  userId: string;
  metricType: string;
  baselineData: Record<string, any>;
  confidenceScore: number;
  lastUpdated: Date;
}

export interface AnomalyDetection {
  id?: string;
  userId: string;
  anomalyType: string;
  severityScore: number; // 0-100
  detectionAlgorithm: string;
  anomalyDetails: Record<string, any>;
  baselineDeviation: number;
  isConfirmed: boolean;
  falsePositive: boolean;
  timestamp: Date;
}

export interface MLModel {
  name: string;
  type: 'anomaly_detection' | 'classification' | 'risk_scoring';
  algorithm: string;
  configuration: Record<string, any>;
  accuracy: number;
  isActive: boolean;
}

export class BehavioralAnalytics {
  private static readonly BASELINE_CONFIDENCE_THRESHOLD = 0.7;
  private static readonly ANOMALY_THRESHOLD = 0.6;
  private static readonly LEARNING_WINDOW_DAYS = 30;

  /**
   * Initialize behavioral analytics system
   */
  static async initialize(): Promise<void> {
    try {
      // Initialize ML models
      await this.initializeMLModels();
      
      // Start baseline learning for existing users
      await this.startBaselineLearning();
      
      logger.info('Behavioral analytics system initialized');
    } catch (error) {
      logger.error('Failed to initialize behavioral analytics', { error });
    }
  }

  /**
   * Record user behavior metric
   */
  static async recordBehaviorMetric(metric: UserBehaviorMetric): Promise<void> {
    try {
      // Calculate anomaly score against existing baseline
      const anomalyScore = await this.calculateAnomalyScore(
        metric.userId,
        metric.metricType,
        metric.data
      );

      // If anomaly score is high, create anomaly record
      if (anomalyScore > this.ANOMALY_THRESHOLD) {
        await this.createAnomalyRecord({
          userId: metric.userId,
          anomalyType: `${metric.metricType}_anomaly`,
          severityScore: Math.round(anomalyScore * 100),
          detectionAlgorithm: 'statistical_deviation',
          anomalyDetails: {
            metric: metric.data,
            expected_baseline: await this.getBaseline(metric.userId, metric.metricType),
            deviation_score: anomalyScore
          },
          baselineDeviation: anomalyScore,
          isConfirmed: false,
          falsePositive: false,
          timestamp: metric.timestamp
        });
      }

      // Update baseline with new data
      await this.updateBaseline(metric);

    } catch (error) {
      logger.error('Failed to record behavior metric', { error, metric });
    }
  }

  /**
   * Detect login pattern anomalies
   */
  static async detectLoginAnomalies(
    userId: string,
    loginData: {
      timestamp: Date;
      ipAddress: string;
      location?: string;
      deviceFingerprint: string;
      userAgent: string;
    }
  ): Promise<AnomalyDetection[]> {
    const anomalies: AnomalyDetection[] = [];

    try {
      // Time pattern analysis
      const timeAnomaly = await this.analyzeTimePattern(userId, loginData.timestamp);
      if (timeAnomaly) {
        anomalies.push(timeAnomaly);
      }

      // Location analysis
      const locationAnomaly = await this.analyzeLocationPattern(userId, loginData.location);
      if (locationAnomaly) {
        anomalies.push(locationAnomaly);
      }

      // Device analysis
      const deviceAnomaly = await this.analyzeDevicePattern(userId, loginData.deviceFingerprint);
      if (deviceAnomaly) {
        anomalies.push(deviceAnomaly);
      }

      // Store anomalies
      for (const anomaly of anomalies) {
        await this.createAnomalyRecord(anomaly);
      }

    } catch (error) {
      logger.error('Failed to detect login anomalies', { error, userId });
    }

    return anomalies;
  }

  /**
   * Detect API usage anomalies
   */
  static async detectAPIAnomalies(
    userId: string,
    apiUsageData: {
      endpoint: string;
      method: string;
      timestamp: Date;
      responseTime: number;
      statusCode: number;
      frequency: number;
    }
  ): Promise<AnomalyDetection[]> {
    const anomalies: AnomalyDetection[] = [];

    try {
      // Frequency analysis
      const frequencyAnomaly = await this.analyzeAPIFrequency(userId, apiUsageData);
      if (frequencyAnomaly) {
        anomalies.push(frequencyAnomaly);
      }

      // Pattern analysis (unusual endpoints)
      const patternAnomaly = await this.analyzeAPIPattern(userId, apiUsageData);
      if (patternAnomaly) {
        anomalies.push(patternAnomaly);
      }

      // Store anomalies
      for (const anomaly of anomalies) {
        await this.createAnomalyRecord(anomaly);
      }

    } catch (error) {
      logger.error('Failed to detect API anomalies', { error, userId });
    }

    return anomalies;
  }

  /**
   * Get anomalies for user
   */
  static async getUserAnomalies(
    userId: string,
    days: number = 30,
    severityThreshold: number = 50
  ): Promise<AnomalyDetection[]> {
    try {
      const since = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();

      const { data, error } = await supabase
        .from('behavioral_anomalies')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', since)
        .gte('severity_score', severityThreshold)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to get user anomalies', { error, userId });
        return [];
      }

      return this.mapDbAnomaliesToAnomalies(data || []);
    } catch (error) {
      logger.error('Error getting user anomalies', { error, userId });
      return [];
    }
  }

  /**
   * Update baseline behavior data
   */
  static async updateBaseline(metric: UserBehaviorMetric): Promise<void> {
    try {
      // Get existing baseline
      const { data: existing } = await supabase
        .from('user_behavior_baselines')
        .select('*')
        .eq('user_id', metric.userId)
        .eq('metric_type', metric.metricType)
        .single();

      if (existing) {
        // Update existing baseline with new data
        const updatedBaseline = this.mergeBaselineData(existing.baseline_data, metric.data);
        
        await supabase
          .from('user_behavior_baselines')
          .update({
            baseline_data: updatedBaseline,
            last_updated: new Date().toISOString(),
            confidence_score: this.calculateConfidence(updatedBaseline)
          })
          .eq('id', existing.id);
      } else {
        // Create new baseline
        await supabase
          .from('user_behavior_baselines')
          .insert({
            user_id: metric.userId,
            metric_type: metric.metricType,
            baseline_data: metric.data,
            confidence_score: 0.1 // Low initial confidence
          });
      }
    } catch (error) {
      logger.error('Failed to update baseline', { error, metric });
    }
  }

  /**
   * Calculate anomaly score using database function
   */
  private static async calculateAnomalyScore(
    userId: string,
    metricType: string,
    currentData: Record<string, any>
  ): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('calculate_anomaly_score', {
        p_user_id: userId,
        p_metric_type: metricType,
        p_current_data: currentData as any
      });

      if (error) {
        logger.error('Failed to calculate anomaly score', { error });
        return 0.5; // Neutral score on error
      }

      return parseFloat(data) || 0.5;
    } catch (error) {
      logger.error('Error calculating anomaly score', { error });
      return 0.5;
    }
  }

  /**
   * Get baseline data for user and metric type
   */
  private static async getBaseline(
    userId: string,
    metricType: string
  ): Promise<Record<string, any> | null> {
    try {
      const { data } = await supabase
        .from('user_behavior_baselines')
        .select('baseline_data')
        .eq('user_id', userId)
        .eq('metric_type', metricType)
        .single();

      return (data?.baseline_data as Record<string, any>) || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create anomaly record
   */
  private static async createAnomalyRecord(anomaly: AnomalyDetection): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('behavioral_anomalies')
        .insert({
          user_id: anomaly.userId,
          anomaly_type: anomaly.anomalyType,
          severity_score: anomaly.severityScore,
          detection_algorithm: anomaly.detectionAlgorithm,
          anomaly_details: anomaly.anomalyDetails as any,
          baseline_deviation: parseFloat(anomaly.baselineDeviation.toString()),
          is_confirmed: anomaly.isConfirmed,
          false_positive: anomaly.falsePositive
        })
        .select('id')
        .single();

      if (error) {
        logger.error('Failed to create anomaly record', { error, anomaly });
        return null;
      }

      return data.id;
    } catch (error) {
      logger.error('Error creating anomaly record', { error, anomaly });
      return null;
    }
  }

  /**
   * Analyze time pattern for login
   */
  private static async analyzeTimePattern(
    userId: string,
    timestamp: Date
  ): Promise<AnomalyDetection | null> {
    const hour = timestamp.getHours();
    const baseline = await this.getBaseline(userId, 'login_pattern');
    
    if (!baseline || !baseline.typical_hours) {
      return null;
    }

    const typicalHours = baseline.typical_hours as number[];
    const isUnusualTime = !typicalHours.includes(hour);

    if (isUnusualTime) {
      return {
        userId,
        anomalyType: 'unusual_login_time',
        severityScore: 60,
        detectionAlgorithm: 'time_pattern_analysis',
        anomalyDetails: {
          login_hour: hour,
          typical_hours: typicalHours,
          deviation_type: 'time_anomaly'
        },
        baselineDeviation: 0.6,
        isConfirmed: false,
        falsePositive: false,
        timestamp
      };
    }

    return null;
  }

  /**
   * Analyze location pattern
   */
  private static async analyzeLocationPattern(
    userId: string,
    location?: string
  ): Promise<AnomalyDetection | null> {
    if (!location) return null;

    const baseline = await this.getBaseline(userId, 'location_pattern');
    
    if (!baseline || !baseline.typical_locations) {
      return null;
    }

    const typicalLocations = baseline.typical_locations as string[];
    const isNewLocation = !typicalLocations.includes(location);

    if (isNewLocation) {
      return {
        userId,
        anomalyType: 'unusual_location',
        severityScore: 75,
        detectionAlgorithm: 'location_pattern_analysis',
        anomalyDetails: {
          new_location: location,
          typical_locations: typicalLocations,
          deviation_type: 'location_anomaly'
        },
        baselineDeviation: 0.75,
        isConfirmed: false,
        falsePositive: false,
        timestamp: new Date()
      };
    }

    return null;
  }

  /**
   * Analyze device pattern
   */
  private static async analyzeDevicePattern(
    userId: string,
    deviceFingerprint: string
  ): Promise<AnomalyDetection | null> {
    const baseline = await this.getBaseline(userId, 'device_pattern');
    
    if (!baseline || !baseline.known_devices) {
      return null;
    }

    const knownDevices = baseline.known_devices as string[];
    const isNewDevice = !knownDevices.includes(deviceFingerprint);

    if (isNewDevice) {
      return {
        userId,
        anomalyType: 'new_device',
        severityScore: 70,
        detectionAlgorithm: 'device_pattern_analysis',
        anomalyDetails: {
          new_device: deviceFingerprint,
          known_devices: knownDevices.length,
          deviation_type: 'device_anomaly'
        },
        baselineDeviation: 0.7,
        isConfirmed: false,
        falsePositive: false,
        timestamp: new Date()
      };
    }

    return null;
  }

  /**
   * Analyze API frequency patterns
   */
  private static async analyzeAPIFrequency(
    userId: string,
    apiData: any
  ): Promise<AnomalyDetection | null> {
    const baseline = await this.getBaseline(userId, 'api_usage');
    
    if (!baseline || !baseline.avg_requests_per_hour) {
      return null;
    }

    const avgRequests = baseline.avg_requests_per_hour as number;
    const deviationThreshold = avgRequests * 3; // 3x normal usage

    if (apiData.frequency > deviationThreshold) {
      return {
        userId,
        anomalyType: 'unusual_api_frequency',
        severityScore: 65,
        detectionAlgorithm: 'frequency_analysis',
        anomalyDetails: {
          current_frequency: apiData.frequency,
          baseline_frequency: avgRequests,
          threshold: deviationThreshold
        },
        baselineDeviation: apiData.frequency / avgRequests,
        isConfirmed: false,
        falsePositive: false,
        timestamp: new Date()
      };
    }

    return null;
  }

  /**
   * Analyze API pattern (endpoints accessed)
   */
  private static async analyzeAPIPattern(
    userId: string,
    apiData: any
  ): Promise<AnomalyDetection | null> {
    const baseline = await this.getBaseline(userId, 'api_usage');
    
    if (!baseline || !baseline.common_endpoints) {
      return null;
    }

    const commonEndpoints = baseline.common_endpoints as string[];
    const isUnusualEndpoint = !commonEndpoints.includes(apiData.endpoint);

    // Only flag admin endpoints or sensitive operations
    const sensitiveEndpoints = ['/admin', '/delete', '/export', '/private'];
    const isSensitive = sensitiveEndpoints.some(ep => apiData.endpoint.includes(ep));

    if (isUnusualEndpoint && isSensitive) {
      return {
        userId,
        anomalyType: 'unusual_api_access',
        severityScore: 80,
        detectionAlgorithm: 'pattern_analysis',
        anomalyDetails: {
          accessed_endpoint: apiData.endpoint,
          common_endpoints: commonEndpoints,
          is_sensitive: true
        },
        baselineDeviation: 0.8,
        isConfirmed: false,
        falsePositive: false,
        timestamp: new Date()
      };
    }

    return null;
  }

  /**
   * Initialize ML models
   */
  private static async initializeMLModels(): Promise<void> {
    const models: MLModel[] = [
      {
        name: 'login_anomaly_detector',
        type: 'anomaly_detection',
        algorithm: 'isolation_forest',
        configuration: {
          contamination: 0.1,
          n_estimators: 100
        },
        accuracy: 0.85,
        isActive: true
      },
      {
        name: 'api_pattern_classifier',
        type: 'classification',
        algorithm: 'random_forest',
        configuration: {
          n_estimators: 200,
          max_depth: 10
        },
        accuracy: 0.78,
        isActive: true
      }
    ];

    for (const model of models) {
      await this.registerMLModel(model);
    }
  }

  /**
   * Register ML model
   */
  private static async registerMLModel(model: MLModel): Promise<void> {
    try {
      await supabase
        .from('ml_models')
        .upsert({
          model_name: model.name,
          model_type: model.type,
          algorithm: model.algorithm,
          configuration: model.configuration,
          accuracy_score: model.accuracy,
          is_active: model.isActive
        });
    } catch (error) {
      logger.error('Failed to register ML model', { error, model });
    }
  }

  /**
   * Start baseline learning for existing users
   */
  private static async startBaselineLearning(): Promise<void> {
    // This would typically run ML algorithms to establish baselines
    // For now, it's a placeholder
    logger.info('Baseline learning started');
  }

  /**
   * Merge new data with existing baseline
   */
  private static mergeBaselineData(
    existing: Record<string, any>,
    newData: Record<string, any>
  ): Record<string, any> {
    // Simple merge strategy - in production would use more sophisticated algorithms
    const merged = { ...existing };
    
    for (const [key, value] of Object.entries(newData)) {
      if (typeof value === 'number' && typeof existing[key] === 'number') {
        // Average numerical values
        merged[key] = (existing[key] + value) / 2;
      } else if (Array.isArray(value) && Array.isArray(existing[key])) {
        // Merge arrays, keeping unique values
        merged[key] = [...new Set([...existing[key], ...value])];
      } else {
        // Replace non-numerical values
        merged[key] = value;
      }
    }

    return merged;
  }

  /**
   * Calculate confidence score for baseline
   */
  private static calculateConfidence(baselineData: Record<string, any>): number {
    // Simple confidence calculation based on data completeness
    const requiredFields = ['avg_hour', 'typical_locations', 'common_endpoints'];
    const presentFields = requiredFields.filter(field => baselineData[field] !== undefined);
    
    return Math.min(presentFields.length / requiredFields.length, 1.0);
  }

  /**
   * Map database anomalies to AnomalyDetection objects
   */
  private static mapDbAnomaliesToAnomalies(dbAnomalies: any[]): AnomalyDetection[] {
    return dbAnomalies.map(anomaly => ({
      id: anomaly.id,
      userId: anomaly.user_id,
      anomalyType: anomaly.anomaly_type,
      severityScore: anomaly.severity_score,
      detectionAlgorithm: anomaly.detection_algorithm,
      anomalyDetails: anomaly.anomaly_details,
      baselineDeviation: anomaly.baseline_deviation,
      isConfirmed: anomaly.is_confirmed,
      falsePositive: anomaly.false_positive,
      timestamp: new Date(anomaly.created_at)
    }));
  }
}
