import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/monitoring/logger';

// Security Training Types
export interface SecurityTrainingModule {
  id: string;
  title: string;
  category: 'developer' | 'admin' | 'user' | 'compliance';
  description: string;
  duration: number; // minutes
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  prerequisites: string[];
  learningObjectives: string[];
  content: TrainingContent;
  assessment: TrainingAssessment;
  certification: CertificationInfo;
}

export interface TrainingContent {
  sections: TrainingSection[];
  resources: TrainingResource[];
  practicalExercises: PracticalExercise[];
}

export interface TrainingResource {
  id: string;
  title: string;
  type: 'document' | 'video' | 'link' | 'tool';
  url: string;
  description: string;
}

export interface TrainingSection {
  id: string;
  title: string;
  content: string;
  multimedia: MultimediaContent[];
  interactiveElements: InteractiveElement[];
}

export interface MultimediaContent {
  type: 'video' | 'audio' | 'image' | 'diagram';
  url: string;
  description: string;
  duration?: number;
}

export interface InteractiveElement {
  type: 'quiz' | 'simulation' | 'code_review' | 'scenario';
  content: any;
  scoring: ScoringCriteria;
}

export interface PracticalExercise {
  id: string;
  title: string;
  description: string;
  environment: 'sandbox' | 'simulation' | 'real_world';
  steps: ExerciseStep[];
  expectedOutcome: string;
  evaluationCriteria: string[];
}

export interface ExerciseStep {
  stepNumber: number;
  instruction: string;
  hints: string[];
  timeLimit?: number;
}

export interface TrainingAssessment {
  assessmentType: 'quiz' | 'practical' | 'project' | 'certification_exam';
  questions: AssessmentQuestion[];
  passingScore: number;
  timeLimit: number;
  retakePolicy: RetakePolicy;
}

export interface AssessmentQuestion {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'essay' | 'practical';
  question: string;
  options?: string[];
  correctAnswer: any;
  explanation: string;
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface RetakePolicy {
  maxAttempts: number;
  waitTimeBetweenAttempts: number; // hours
  scorePenalty?: number;
}

export interface ScoringCriteria {
  maxPoints: number;
  passingThreshold: number;
  timeBonus?: boolean;
  penaltyForIncorrect?: number;
}

export interface CertificationInfo {
  certificateName: string;
  validityPeriod: number; // months
  renewalRequirements: string[];
  certifyingAuthority: string;
  certificationLevel: 'basic' | 'intermediate' | 'advanced' | 'expert';
}

export interface TrainingRecord {
  id: string;
  userId: string;
  moduleId: string;
  startDate: Date;
  completionDate?: Date;
  status: 'not_started' | 'in_progress' | 'completed' | 'failed' | 'expired';
  score?: number;
  assessmentResults: AssessmentResult[];
  timeSpent: number; // minutes
  certificateIssued: boolean;
  expiryDate?: Date;
  refresherRequired: boolean;
}

export interface AssessmentResult {
  assessmentId: string;
  score: number;
  maxScore: number;
  passed: boolean;
  attempt: number;
  completedAt: Date;
  incorrectAnswers: string[];
}

export interface TrainingProgress {
  userId: string;
  overallProgress: number; // percentage
  completedModules: number;
  totalModules: number;
  currentLevel: string;
  certificationsEarned: string[];
  skillsAcquired: string[];
  weakAreas: string[];
  recommendedNextSteps: string[];
}

/**
 * Security Awareness and Training Program Manager
 * Handles developer training, admin procedures, and user awareness programs
 */
export class SecurityAwarenessManager {
  private static instance: SecurityAwarenessManager;
  private trainingModules: Map<string, SecurityTrainingModule> = new Map();
  private userProgress: Map<string, TrainingProgress> = new Map();

  static getInstance(): SecurityAwarenessManager {
    if (!SecurityAwarenessManager.instance) {
      SecurityAwarenessManager.instance = new SecurityAwarenessManager();
    }
    return SecurityAwarenessManager.instance;
  }

  /**
   * Initialize security training program
   */
  async initializeTrainingProgram(): Promise<void> {
    try {
      logger.info('Initializing security training program');

      // Initialize training modules for different roles
      await this.initializeDeveloperTraining();
      await this.initializeAdminTraining();
      await this.initializeUserAwarenessTraining();
      await this.initializeComplianceTraining();

      logger.info('Security training program initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize training program', { error });
      throw error;
    }
  }

  /**
   * Enroll user in training module
   */
  async enrollUserInTraining(
    userId: string,
    moduleId: string,
    enrollmentType: 'self_enrolled' | 'mandatory' | 'recommended' = 'self_enrolled'
  ): Promise<string> {
    try {
      logger.info('Enrolling user in training', { userId, moduleId, enrollmentType });

      const module = await this.getTrainingModule(moduleId);
      if (!module) throw new Error('Training module not found');

      // Check prerequisites
      const hasPrerequisites = await this.checkPrerequisites(userId, module.prerequisites);
      if (!hasPrerequisites) {
        throw new Error('Prerequisites not met');
      }

      // Create training record
      const { data, error } = await supabase
        .from('security_training_records')
        .insert({
          user_id: userId,
          training_module: moduleId,
          training_category: module.category,
          completion_status: 'not_started',
          assessment_results: {},
          certificate_issued: false,
          refresher_required: false
        })
        .select()
        .single();

      if (error) throw error;

      logger.info('User enrolled in training', { 
        recordId: data.id, 
        userId, 
        moduleId 
      });

      return data.id;
    } catch (error) {
      logger.error('Failed to enroll user in training', { error, userId, moduleId });
      throw error;
    }
  }

  /**
   * Start training session
   */
  async startTrainingSession(recordId: string): Promise<void> {
    try {
      logger.info('Starting training session', { recordId });

      await supabase
        .from('security_training_records')
        .update({
          completion_status: 'in_progress',
          start_date: new Date().toISOString()
        })
        .eq('id', recordId);

      logger.info('Training session started', { recordId });
    } catch (error) {
      logger.error('Failed to start training session', { error, recordId });
      throw error;
    }
  }

  /**
   * Submit training assessment
   */
  async submitTrainingAssessment(
    recordId: string,
    answers: Record<string, any>,
    timeSpent: number
  ): Promise<AssessmentResult> {
    try {
      logger.info('Submitting training assessment', { recordId });

      // Get training record and module
      const { data: record, error: recordError } = await supabase
        .from('security_training_records')
        .select('*')
        .eq('id', recordId)
        .single();

      if (recordError) throw recordError;

      const module = await this.getTrainingModule(record.training_module);
      if (!module) throw new Error('Training module not found');

      // Evaluate assessment
      const result = await this.evaluateAssessment(module.assessment, answers, timeSpent);

      // Update training record
      const status = result.passed ? 'completed' : 'failed';
      const certificateIssued = result.passed && module.certification !== null;

      const updateData: any = {

        completion_status: status,
        completion_date: result.passed ? new Date().toISOString() : null,
        score: result.score,
        assessment_results: { ...record.assessment_results as any, [Date.now()]: result },
        certificate_issued: certificateIssued,
        expiry_date: certificateIssued ? 
          new Date(Date.now() + module.certification.validityPeriod * 30 * 24 * 60 * 60 * 1000).toISOString() :
          null
      };

      await supabase
        .from('security_training_records')
        .update(updateData)
        .eq('id', recordId);

      logger.info('Training assessment submitted', { 
        recordId, 
        passed: result.passed, 
        score: result.score 
      });

      return result;
    } catch (error) {
      logger.error('Failed to submit training assessment', { error, recordId });
      throw error;
    }
  }

  /**
   * Get user training progress
   */
  async getUserTrainingProgress(userId: string): Promise<TrainingProgress> {
    try {
      const { data: records, error } = await supabase
        .from('security_training_records')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const completedModules = records.filter(r => r.completion_status === 'completed').length;
      const totalModules = this.trainingModules.size;
      const overallProgress = totalModules > 0 ? (completedModules / totalModules) * 100 : 0;

      const certificationsEarned = records
        .filter(r => r.certificate_issued)
        .map(r => r.training_module);

      const progress: TrainingProgress = {
        userId,
        overallProgress,
        completedModules,
        totalModules,
        currentLevel: this.determineCurrentLevel(overallProgress),
        certificationsEarned,
        skillsAcquired: await this.getSkillsAcquired(records),
        weakAreas: await this.identifyWeakAreas(records),
        recommendedNextSteps: await this.generateRecommendations(userId, records)
      };

      this.userProgress.set(userId, progress);
      return progress;
    } catch (error) {
      logger.error('Failed to get user training progress', { error, userId });
      throw error;
    }
  }

  /**
   * Generate personalized training recommendations
   */
  async generateTrainingRecommendations(userId: string): Promise<string[]> {
    try {
      const progress = await this.getUserTrainingProgress(userId);
      const userRole = await this.getUserRole(userId);

      const recommendations: string[] = [];

      // Role-based recommendations
      switch (userRole) {
        case 'admin':
          if (!progress.certificationsEarned.includes('admin-security-fundamentals')) {
            recommendations.push('admin-security-fundamentals');
          }
          break;
        case 'prompter':
        case 'jadmin':
          if (!progress.certificationsEarned.includes('developer-secure-coding')) {
            recommendations.push('developer-secure-coding');
          }
          break;
        default:
          if (!progress.certificationsEarned.includes('user-security-awareness')) {
            recommendations.push('user-security-awareness');
          }
      }

      // Weakness-based recommendations
      progress.weakAreas.forEach(area => {
        const relatedModules = this.findModulesByTopic(area);
        recommendations.push(...relatedModules);
      });

      return [...new Set(recommendations)]; // Remove duplicates
    } catch (error) {
      logger.error('Failed to generate training recommendations', { error, userId });
      throw error;
    }
  }

  /**
   * Schedule mandatory training
   */
  async scheduleMandatoryTraining(
    userIds: string[],
    moduleIds: string[],
    deadline: Date,
    escalationPolicy?: any
  ): Promise<void> {
    try {
      logger.info('Scheduling mandatory training', { 
        userCount: userIds.length, 
        moduleCount: moduleIds.length 
      });

      for (const userId of userIds) {
        for (const moduleId of moduleIds) {
          try {
            await this.enrollUserInTraining(userId, moduleId, 'mandatory');
            
            // Set deadline and escalation
            await supabase
              .from('security_training_records')
              .update({
                next_training_date: deadline.toISOString()
              })
              .eq('user_id', userId)
              .eq('training_module', moduleId);

          } catch (enrollmentError) {
            logger.warn('Failed to enroll user in mandatory training', { 
              error: enrollmentError, 
              userId, 
              moduleId 
            });
          }
        }
      }

      logger.info('Mandatory training scheduled successfully');
    } catch (error) {
      logger.error('Failed to schedule mandatory training', { error });
      throw error;
    }
  }

  /**
   * Generate training compliance report
   */
  async generateComplianceReport(
    framework: 'gdpr' | 'soc2' | 'iso27001' | 'all' = 'all'
  ): Promise<any> {
    try {
      const { data: allRecords, error } = await supabase
        .from('security_training_records')
        .select('*');

      if (error) throw error;

      const report = {
        framework,
        generatedDate: new Date(),
        overallComplianceRate: 0,
        trainingStatistics: {
          totalUsers: 0,
          completedTraining: 0,
          pendingTraining: 0,
          expiredCertifications: 0
        },
        complianceByRole: {},
        riskAreas: [],
        recommendations: []
      };

      // Calculate statistics
      const userIds = [...new Set(allRecords.map(r => r.user_id))];
      report.trainingStatistics.totalUsers = userIds.length;
      report.trainingStatistics.completedTraining = allRecords.filter(r => r.completion_status === 'completed').length;
      report.trainingStatistics.pendingTraining = allRecords.filter(r => ['not_started', 'in_progress'].includes(r.completion_status)).length;
      report.trainingStatistics.expiredCertifications = allRecords.filter(r => 
        r.expiry_date && new Date(r.expiry_date) < new Date()
      ).length;

      report.overallComplianceRate = userIds.length > 0 ? 
        (report.trainingStatistics.completedTraining / userIds.length) * 100 : 0;

      // Identify risk areas
      if (report.overallComplianceRate < 80) {
        report.riskAreas.push('Low overall training completion rate');
      }
      if (report.trainingStatistics.expiredCertifications > 0) {
        report.riskAreas.push('Expired security certifications detected');
      }

      // Generate recommendations
      report.recommendations = await this.generateComplianceRecommendations(report);

      return report;
    } catch (error) {
      logger.error('Failed to generate compliance report', { error, framework });
      throw error;
    }
  }

  // Private helper methods

  private async initializeDeveloperTraining(): Promise<void> {
    const modules = [
      {
        id: 'developer-secure-coding',
        title: 'Secure Coding Fundamentals',
        category: 'developer' as const,
        description: 'Essential secure coding practices for developers',
        duration: 120
      },
      {
        id: 'developer-crypto-security',
        title: 'Cryptography and Data Protection',
        category: 'developer' as const,
        description: 'Implementing cryptographic controls in applications',
        duration: 90
      }
    ];

    for (const module of modules) {
      this.trainingModules.set(module.id, {
        ...module,
        difficultyLevel: 'intermediate',
        prerequisites: [],
        learningObjectives: ['Understand secure coding principles'],
        content: { sections: [], resources: [], practicalExercises: [] },
        assessment: { 
          assessmentType: 'quiz', 
          questions: [], 
          passingScore: 80, 
          timeLimit: 60,
          retakePolicy: { maxAttempts: 3, waitTimeBetweenAttempts: 24 }
        },
        certification: {
          certificateName: `${module.title} Certificate`,
          validityPeriod: 12,
          renewalRequirements: [],
          certifyingAuthority: 'Internal Security Team',
          certificationLevel: 'intermediate'
        }
      });
    }
  }

  private async initializeAdminTraining(): Promise<void> {
    const modules = [
      {
        id: 'admin-security-fundamentals',
        title: 'Security Administration Fundamentals',
        category: 'admin' as const,
        description: 'Core security administration concepts and practices',
        duration: 150
      },
      {
        id: 'admin-incident-response',
        title: 'Security Incident Response',
        category: 'admin' as const,
        description: 'Managing and responding to security incidents',
        duration: 180
      }
    ];

    for (const module of modules) {
      this.trainingModules.set(module.id, {
        ...module,
        difficultyLevel: 'advanced',
        prerequisites: [],
        learningObjectives: ['Master security administration'],
        content: { sections: [], resources: [], practicalExercises: [] },
        assessment: { 
          assessmentType: 'practical', 
          questions: [], 
          passingScore: 85, 
          timeLimit: 120,
          retakePolicy: { maxAttempts: 2, waitTimeBetweenAttempts: 48 }
        },
        certification: {
          certificateName: `${module.title} Certificate`,
          validityPeriod: 12,
          renewalRequirements: [],
          certifyingAuthority: 'Internal Security Team',
          certificationLevel: 'advanced'
        }
      });
    }
  }

  private async initializeUserAwarenessTraining(): Promise<void> {
    const modules = [
      {
        id: 'user-security-awareness',
        title: 'Security Awareness for Users',
        category: 'user' as const,
        description: 'Basic security awareness for all users',
        duration: 45
      },
      {
        id: 'user-phishing-awareness',
        title: 'Phishing and Social Engineering Awareness',
        category: 'user' as const,
        description: 'Recognizing and responding to phishing attempts',
        duration: 30
      }
    ];

    for (const module of modules) {
      this.trainingModules.set(module.id, {
        ...module,
        difficultyLevel: 'beginner',
        prerequisites: [],
        learningObjectives: ['Understand basic security concepts'],
        content: { sections: [], resources: [], practicalExercises: [] },
        assessment: { 
          assessmentType: 'quiz', 
          questions: [], 
          passingScore: 75, 
          timeLimit: 30,
          retakePolicy: { maxAttempts: 5, waitTimeBetweenAttempts: 1 }
        },
        certification: {
          certificateName: `${module.title} Certificate`,
          validityPeriod: 12,
          renewalRequirements: [],
          certifyingAuthority: 'Internal Security Team',
          certificationLevel: 'basic'
        }
      });
    }
  }

  private async initializeComplianceTraining(): Promise<void> {
    const modules = [
      {
        id: 'compliance-gdpr',
        title: 'GDPR Compliance Training',
        category: 'compliance' as const,
        description: 'Understanding GDPR requirements and implementation',
        duration: 90
      },
      {
        id: 'compliance-soc2',
        title: 'SOC 2 Compliance Training',
        category: 'compliance' as const,
        description: 'SOC 2 controls and compliance requirements',
        duration: 120
      }
    ];

    for (const module of modules) {
      this.trainingModules.set(module.id, {
        ...module,
        difficultyLevel: 'intermediate',
        prerequisites: [],
        learningObjectives: ['Understand compliance requirements'],
        content: { sections: [], resources: [], practicalExercises: [] },
        assessment: { 
          assessmentType: 'certification_exam', 
          questions: [], 
          passingScore: 80, 
          timeLimit: 90,
          retakePolicy: { maxAttempts: 3, waitTimeBetweenAttempts: 72 }
        },
        certification: {
          certificateName: `${module.title} Certificate`,
          validityPeriod: 24,
          renewalRequirements: ['Annual refresher training'],
          certifyingAuthority: 'Internal Security Team',
          certificationLevel: 'intermediate'
        }
      });
    }
  }

  private async getTrainingModule(moduleId: string): Promise<SecurityTrainingModule | null> {
    return this.trainingModules.get(moduleId) || null;
  }

  private async checkPrerequisites(userId: string, prerequisites: string[]): Promise<boolean> {
    if (prerequisites.length === 0) return true;

    const { data: records, error } = await supabase
      .from('security_training_records')
      .select('training_module, completion_status')
      .eq('user_id', userId)
      .eq('completion_status', 'completed');

    if (error) return false;

    const completedModules = records.map(r => r.training_module);
    return prerequisites.every(prereq => completedModules.includes(prereq));
  }

  private async evaluateAssessment(
    assessment: TrainingAssessment,
    answers: Record<string, any>,
    timeSpent: number
  ): Promise<AssessmentResult> {
    let totalPoints = 0;
    let earnedPoints = 0;
    const incorrectAnswers: string[] = [];

    assessment.questions.forEach(question => {
      totalPoints += question.points;
      
      const userAnswer = answers[question.id];
      const isCorrect = this.checkAnswer(question, userAnswer);
      
      if (isCorrect) {
        earnedPoints += question.points;
      } else {
        incorrectAnswers.push(question.id);
      }
    });

    const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    const passed = score >= assessment.passingScore;

    return {
      assessmentId: assessment.assessmentType,
      score,
      maxScore: 100,
      passed,
      attempt: 1, // Would track actual attempt number
      completedAt: new Date(),
      incorrectAnswers
    };
  }

  private checkAnswer(question: AssessmentQuestion, userAnswer: any): boolean {
    switch (question.type) {
      case 'multiple_choice':
      case 'true_false':
        return userAnswer === question.correctAnswer;
      case 'essay':
        // Would implement more sophisticated evaluation for essay questions
        return userAnswer && userAnswer.length > 50; // Simple check
      case 'practical':
        // Would implement practical evaluation
        return true; // Simplified
      default:
        return false;
    }
  }

  private determineCurrentLevel(overallProgress: number): string {
    if (overallProgress >= 90) return 'Expert';
    if (overallProgress >= 70) return 'Advanced';
    if (overallProgress >= 40) return 'Intermediate';
    return 'Beginner';
  }

  private async getSkillsAcquired(records: any[]): Promise<string[]> {
    const skills = records
      .filter(r => r.completion_status === 'completed')
      .map(r => r.training_module)
      .map(module => this.moduleToSkillMapping(module))
      .flat();
    
    return [...new Set(skills)];
  }

  private moduleToSkillMapping(moduleId: string): string[] {
    const skillMap: Record<string, string[]> = {
      'developer-secure-coding': ['Secure Coding', 'Input Validation', 'Authentication'],
      'admin-security-fundamentals': ['Security Administration', 'Access Control'],
      'user-security-awareness': ['Phishing Recognition', 'Password Security'],
      'compliance-gdpr': ['GDPR Compliance', 'Data Protection']
    };

    return skillMap[moduleId] || [];
  }

  private async identifyWeakAreas(records: any[]): Promise<string[]> {
    const weakAreas: string[] = [];
    
    records.forEach(record => {
      if (record.completion_status === 'failed' || record.score < 70) {
        weakAreas.push(record.training_module);
      }
    });

    return [...new Set(weakAreas)];
  }

  private async generateRecommendations(userId: string, records: any[]): Promise<string[]> {
    const recommendations: string[] = [];
    
    // Check for expired certifications
    const expiredCerts = records.filter(r => 
      r.expiry_date && new Date(r.expiry_date) < new Date()
    );
    
    if (expiredCerts.length > 0) {
      recommendations.push('Renew expired certifications');
    }

    // Check for failed assessments
    const failedModules = records.filter(r => r.completion_status === 'failed');
    if (failedModules.length > 0) {
      recommendations.push('Retake failed training modules');
    }

    return recommendations;
  }

  private async getUserRole(userId: string): Promise<string> {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) return 'user';
    return data.role || 'user';
  }

  private findModulesByTopic(topic: string): string[] {
    const moduleArray = Array.from(this.trainingModules.values());
    return moduleArray
      .filter(module => 
        module.title.toLowerCase().includes(topic.toLowerCase()) ||
        module.description.toLowerCase().includes(topic.toLowerCase())
      )
      .map(module => module.id);
  }

  private async generateComplianceRecommendations(report: any): Promise<string[]> {
    const recommendations: string[] = [];

    if (report.overallComplianceRate < 80) {
      recommendations.push('Implement mandatory training completion requirements');
    }

    if (report.trainingStatistics.expiredCertifications > 0) {
      recommendations.push('Establish automated certification renewal reminders');
    }

    if (report.trainingStatistics.pendingTraining > report.trainingStatistics.totalUsers * 0.2) {
      recommendations.push('Improve training engagement and completion rates');
    }

    return recommendations;
  }
}

export const securityAwarenessManager = SecurityAwarenessManager.getInstance();