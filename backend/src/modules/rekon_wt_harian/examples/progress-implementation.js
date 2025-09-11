/**
 * Example: How to implement Global Progress Module in rekon_wt_harian
 * This file shows how to migrate from the old progress system to the new global one
 */

import { ProgressHelper } from '../../../services/progress/index.js';
import logger from '../../../config/logger.js';

/**
 * Example 1: Basic Progress Implementation
 * Replace old progressService.initProgress() calls
 */
export async function exampleBasicProgress() {
  // OLD WAY (before):
  // const progressId = progressService.initProgress({
  //   totalItems: 100,
  //   processedItems: 0,
  //   status: 'running',
  //   message: 'Starting rekon process...',
  //   details: { cab: 'A001', periode: '2024-01' }
  // });

  // NEW WAY (with global progress):
  const progressId = ProgressHelper.start({
    processType: 'rekon_wt_harian',
    identifier: 'A001_2024-01', // cab_periode format
    totalSteps: 100,
    title: 'Rekon WT Harian Process',
    description: 'Processing rekon for branch A001, period 2024-01',
    metadata: {
      cab: 'A001',
      periode: '2024-01',
      startedBy: 'user123'
    }
  });

  return progressId;
}

/**
 * Example 2: Step-by-step Progress Updates
 * Replace old progressService.updateProgress() calls
 */
export async function exampleStepProgress(progressId) {
  // Simulate processing steps
  const steps = [
    { name: 'Validating data', items: 25 },
    { name: 'Processing transactions', items: 50 },
    { name: 'Generating reports', items: 20 },
    { name: 'Finalizing results', items: 5 }
  ];

  let processedItems = 0;

  for (const step of steps) {
    // OLD WAY:
    // progressService.updateProgress(progressId, {
    //   processedItems: processedItems,
    //   message: `Processing: ${step.name}`,
    //   details: { currentStep: step.name }
    // });

    // NEW WAY:
    ProgressHelper.updateStep(progressId, {
      currentStep: processedItems,
      message: `Processing: ${step.name}`,
      details: {
        currentStep: step.name,
        stepProgress: 0
      }
    });

    // Simulate step processing
    for (let i = 0; i < step.items; i++) {
      processedItems++;
      
      // Update progress within step
      ProgressHelper.updateStep(progressId, {
        currentStep: processedItems,
        message: `${step.name}: ${i + 1}/${step.items}`,
        details: {
          currentStep: step.name,
          stepProgress: Math.round(((i + 1) / step.items) * 100)
        }
      });

      // Simulate work
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Complete the progress
  ProgressHelper.complete(
    progressId,
    'Rekon process completed successfully',
    {
      details: {
        totalProcessed: processedItems,
        duration: '2 minutes 30 seconds',
        status: 'success'
      }
    }
  );
}

/**
 * Example 3: Error Handling
 * Replace old error handling in progress
 */
export async function exampleErrorHandling(progressId) {
  try {
    // Simulate some processing that might fail
    await simulateProcessingWithError();
    
    ProgressHelper.complete(progressId, 'Process completed successfully');
  } catch (error) {
    // OLD WAY:
    // progressService.updateProgress(progressId, {
    //   status: 'failed',
    //   message: `Error: ${error.message}`,
    //   details: { error: error.stack }
    // });

    // NEW WAY:
    ProgressHelper.fail(progressId, error.message, {
      errorType: error.name,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Example 4: Checking for Active Processes
 * Prevent multiple concurrent processes
 */
export async function exampleActiveProcessCheck(cab, periode) {
  // Check if there's already an active process for this cab/periode
  const activeProcess = ProgressHelper.getActiveProcess('rekon_wt_harian', `${cab}_${periode}`);
  
  if (activeProcess) {
    throw new Error(`Rekon process for ${cab} periode ${periode} is already running (Progress ID: ${activeProcess.progressId})`);
  }

  // Start new process
  const progressId = ProgressHelper.start({
    processType: 'rekon_wt_harian',
    identifier: `${cab}_${periode}`,
    totalSteps: 100,
    title: 'Rekon WT Harian Process',
    description: `Processing rekon for branch ${cab}, period ${periode}`,
    metadata: { cab, periode }
  });

  return progressId;
}

/**
 * Example 5: Getting Latest Progress
 * For frontend to check last process status
 */
export function exampleGetLatestProgress(cab, periode) {
  const latestProgress = ProgressHelper.getLatestProgress('rekon_wt_harian', `${cab}_${periode}`);
  
  if (!latestProgress) {
    return {
      status: 'not_found',
      message: `No previous rekon process found for ${cab} periode ${periode}`
    };
  }

  return {
    status: 'found',
    data: latestProgress,
    message: `Last process: ${latestProgress.status} at ${latestProgress.updatedAt}`
  };
}

/**
 * Example 6: Complete Migration Pattern
 * How to replace the entire old progress implementation
 */
export class RekonProgressManager {
  constructor(cab, periode, userId) {
    this.cab = cab;
    this.periode = periode;
    this.userId = userId;
    this.identifier = `${cab}_${periode}`;
    this.progressId = null;
  }

  async start(totalItems) {
    // Check for active process
    const activeProcess = ProgressHelper.getActiveProcess('rekon_wt_harian', this.identifier);
    if (activeProcess) {
      throw new Error(`Rekon process already running for ${this.cab} periode ${this.periode}`);
    }

    // Start new progress
    this.progressId = ProgressHelper.start({
      processType: 'rekon_wt_harian',
      identifier: this.identifier,
      totalSteps: totalItems,
      title: 'Rekon WT Harian Process',
      description: `Processing rekon for branch ${this.cab}, period ${this.periode}`,
      metadata: {
        cab: this.cab,
        periode: this.periode,
        startedBy: this.userId,
        startTime: new Date().toISOString()
      }
    });

    logger.info(`Started rekon progress: ${this.progressId} for ${this.cab} periode ${this.periode}`);
    return this.progressId;
  }

  updateProgress(processedItems, message, details = {}) {
    if (!this.progressId) {
      throw new Error('Progress not started. Call start() first.');
    }

    ProgressHelper.updateStep(this.progressId, {
      currentStep: processedItems,
      message,
      details: {
        ...details,
        cab: this.cab,
        periode: this.periode,
        lastUpdate: new Date().toISOString()
      }
    });
  }

  complete(summary = {}) {
    if (!this.progressId) {
      throw new Error('Progress not started. Call start() first.');
    }

    ProgressHelper.complete(
      this.progressId,
      `Rekon completed for ${this.cab} periode ${this.periode}`,
      {
        details: {
          ...summary,
          cab: this.cab,
          periode: this.periode,
          completedAt: new Date().toISOString()
        }
      }
    );

    logger.info(`Completed rekon progress: ${this.progressId} for ${this.cab} periode ${this.periode}`);
  }

  fail(error, details = {}) {
    if (!this.progressId) {
      throw new Error('Progress not started. Call start() first.');
    }

    ProgressHelper.fail(this.progressId, error.message, {
      ...details,
      cab: this.cab,
      periode: this.periode,
      errorType: error.name,
      stack: error.stack,
      failedAt: new Date().toISOString()
    });

    logger.error(`Failed rekon progress: ${this.progressId} for ${this.cab} periode ${this.periode}`, error);
  }
}

// Helper function to simulate processing with potential error
async function simulateProcessingWithError() {
  // Simulate random error
  if (Math.random() < 0.3) {
    throw new Error('Simulated processing error');
  }
  
  // Simulate work
  await new Promise(resolve => setTimeout(resolve, 1000));
}