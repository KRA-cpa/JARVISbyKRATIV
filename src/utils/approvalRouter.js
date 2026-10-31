import {
  canCompleteWorkflowStep,
  calculateNextStep,
  isWorkflowComplete,
  WORKFLOW_CONSTANTS
} from './workflowEngine';

/**
 * Approval Router - Handles automatic workflow progression
 * Processes ticket routing through workflow steps based on completion criteria
 */

export class ApprovalRouter {
  constructor(api) {
    this.api = api;
  }

  /**
   * Process workflow progression for a ticket
   * @param {string} ticketId - The ticket ID
   * @param {Object} currentStep - Current workflow step
   * @param {Array} stepApprovals - Current step approvals
   * @param {Array} workflowSteps - All workflow steps for this ticket type
   * @returns {Object} Routing result with status and next actions
   */
  async processWorkflowStep(ticketId, currentStep, stepApprovals, workflowSteps) {
    try {
      // Check if current step can be completed
      const completionCheck = canCompleteWorkflowStep(currentStep, stepApprovals, []);

      if (!completionCheck.canComplete && !completionCheck.rejected) {
        return {
          success: true,
          action: 'waiting',
          message: 'Step pending completion',
          nextStep: null
        };
      }

      // Handle rejected steps
      if (completionCheck.rejected) {
        return await this.handleRejectedStep(ticketId, currentStep, completionCheck);
      }

      // Get ticket data for conditional evaluation
      const ticket = await this.api.Tickets.getById(ticketId);

      // Calculate next step with ticket data for conditional routing
      const nextStep = calculateNextStep(currentStep, workflowSteps, ticket);

      if (!nextStep) {
        // Workflow complete
        return await this.completeWorkflow(ticketId);
      }

      // Progress to next step
      return await this.progressToNextStep(ticketId, currentStep, nextStep);

    } catch (error) {
      console.error('Workflow processing error:', error);
      return {
        success: false,
        error: error.message,
        action: 'error'
      };
    }
  }

  /**
   * Handle workflow step rejection
   * @param {string} ticketId - The ticket ID
   * @param {Object} currentStep - Current workflow step
   * @param {Object} completionCheck - Completion check result
   */
  async handleRejectedStep(ticketId, currentStep, completionCheck) {
    try {
      // Update ticket status to rejected/returned
      await this.api.Tickets.update(ticketId, {
        status: WORKFLOW_CONSTANTS.TICKET_STATUS.RETURNED,
        updated_at: new Date().toISOString()
      });

      // Create system notification
      await this.createSystemNotification(ticketId, {
        type: 'step_rejected',
        step_name: currentStep.name,
        reason: completionCheck.reason,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        action: 'rejected',
        message: `Step rejected: ${completionCheck.reason}`,
        status: WORKFLOW_CONSTANTS.TICKET_STATUS.RETURNED
      };

    } catch (error) {
      throw new Error(`Failed to handle rejection: ${error.message}`);
    }
  }

  /**
   * Complete the entire workflow
   * @param {string} ticketId - The ticket ID
   */
  async completeWorkflow(ticketId) {
    try {
      // Update ticket status to completed
      await this.api.Tickets.update(ticketId, {
        status: WORKFLOW_CONSTANTS.TICKET_STATUS.COMPLETED,
        current_step_id: null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Create completion notification
      await this.createSystemNotification(ticketId, {
        type: 'workflow_completed',
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        action: 'completed',
        message: 'Workflow completed successfully',
        status: WORKFLOW_CONSTANTS.TICKET_STATUS.COMPLETED
      };

    } catch (error) {
      throw new Error(`Failed to complete workflow: ${error.message}`);
    }
  }

  /**
   * Progress ticket to next workflow step
   * @param {string} ticketId - The ticket ID
   * @param {Object} currentStep - Current workflow step
   * @param {Object} nextStep - Next workflow step
   */
  async progressToNextStep(ticketId, currentStep, nextStep) {
    try {
      // Update ticket with next step
      await this.api.Tickets.update(ticketId, {
        current_step_id: nextStep.id,
        status: this.getStepStatus(nextStep),
        updated_at: new Date().toISOString()
      });

      // Create step transition notification
      await this.createSystemNotification(ticketId, {
        type: 'step_transition',
        from_step: currentStep.name,
        to_step: nextStep.name,
        timestamp: new Date().toISOString()
      });

      // Handle step-specific actions
      await this.handleStepEntry(ticketId, nextStep);

      return {
        success: true,
        action: 'progressed',
        message: `Advanced to: ${nextStep.name}`,
        nextStep: nextStep,
        status: this.getStepStatus(nextStep)
      };

    } catch (error) {
      throw new Error(`Failed to progress to next step: ${error.message}`);
    }
  }

  /**
   * Handle actions when entering a new step
   * @param {string} ticketId - The ticket ID
   * @param {Object} step - The workflow step being entered
   */
  async handleStepEntry(ticketId, step) {
    try {
      switch (step.step_type) {
        case WORKFLOW_CONSTANTS.STEP_TYPES.NOTIFICATION:
          await this.handleNotificationStep(ticketId, step);
          break;

        case WORKFLOW_CONSTANTS.STEP_TYPES.APPROVAL:
          await this.handleApprovalStepEntry(ticketId, step);
          break;

        case WORKFLOW_CONSTANTS.STEP_TYPES.TASK:
          await this.handleTaskStepEntry(ticketId, step);
          break;

        default:
          // No special handling needed
          break;
      }
    } catch (error) {
      console.error('Step entry handling error:', error);
      // Don't throw - step progression should continue even if notifications fail
    }
  }

  /**
   * Handle notification step processing
   * @param {string} ticketId - The ticket ID
   * @param {Object} step - The notification step
   */
  async handleNotificationStep(ticketId, step) {
    // Create notification
    await this.createSystemNotification(ticketId, {
      type: 'step_notification',
      step_name: step.name,
      message: step.notification_message || `Notification: ${step.name}`,
      timestamp: new Date().toISOString()
    });

    // Notification steps complete immediately
    // This will trigger another routing cycle to move to the next step
    setTimeout(() => {
      this.triggerRoutingCheck(ticketId);
    }, 100);
  }

  /**
   * Handle approval step entry
   * @param {string} ticketId - The ticket ID
   * @param {Object} step - The approval step
   */
  async handleApprovalStepEntry(ticketId, step) {
    // Create notification for approvers
    await this.createSystemNotification(ticketId, {
      type: 'approval_required',
      step_name: step.name,
      approver_logic: step.approver_logic,
      timestamp: new Date().toISOString()
    });

    // Set SLA if configured
    if (step.sla_duration) {
      await this.setSLA(ticketId, step);
    }
  }

  /**
   * Handle task step entry
   * @param {string} ticketId - The ticket ID
   * @param {Object} step - The task step
   */
  async handleTaskStepEntry(ticketId, step) {
    // Create task notification
    await this.createSystemNotification(ticketId, {
      type: 'task_assigned',
      step_name: step.name,
      external_app_url: step.external_app_url,
      timestamp: new Date().toISOString()
    });

    // Set SLA if configured
    if (step.sla_duration) {
      await this.setSLA(ticketId, step);
    }
  }

  /**
   * Set SLA deadline for a step
   * @param {string} ticketId - The ticket ID
   * @param {Object} step - The workflow step with SLA
   */
  async setSLA(ticketId, step) {
    try {
      const deadline = this.calculateSLADeadline(step);

      await this.api.Tickets.update(ticketId, {
        sla_deadline: deadline.toISOString(),
        updated_at: new Date().toISOString()
      });

    } catch (error) {
      console.error('SLA setting error:', error);
    }
  }

  /**
   * Calculate SLA deadline based on step configuration
   * @param {Object} step - The workflow step
   * @returns {Date} SLA deadline
   */
  calculateSLADeadline(step) {
    const now = new Date();
    let deadline = new Date(now);

    // Add duration based on unit
    switch (step.sla_unit) {
      case 'minutes':
        deadline.setMinutes(deadline.getMinutes() + step.sla_duration);
        break;
      case 'hours':
        deadline.setHours(deadline.getHours() + step.sla_duration);
        break;
      case 'days':
        if (step.exclude_weekends) {
          deadline = this.addBusinessDays(deadline, step.sla_duration);
        } else {
          deadline.setDate(deadline.getDate() + step.sla_duration);
        }
        break;
      case 'weeks':
        if (step.exclude_weekends) {
          deadline = this.addBusinessDays(deadline, step.sla_duration * 5);
        } else {
          deadline.setDate(deadline.getDate() + (step.sla_duration * 7));
        }
        break;
      default:
        deadline.setHours(deadline.getHours() + 24); // Default 24 hours
    }

    return deadline;
  }

  /**
   * Add business days (excluding weekends)
   * @param {Date} startDate - Starting date
   * @param {number} businessDays - Number of business days to add
   * @returns {Date} End date
   */
  addBusinessDays(startDate, businessDays) {
    const date = new Date(startDate);
    let daysAdded = 0;

    while (daysAdded < businessDays) {
      date.setDate(date.getDate() + 1);
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        daysAdded++;
      }
    }

    return date;
  }

  /**
   * Create system notification for workflow events
   * @param {string} ticketId - The ticket ID
   * @param {Object} notificationData - Notification details
   */
  async createSystemNotification(ticketId, notificationData) {
    try {
      // This would integrate with a notification system
      // For now, we'll log it and potentially store in the database
      console.log('System Notification:', {
        ticket_id: ticketId,
        ...notificationData
      });

      // Could be enhanced to:
      // - Send emails
      // - Create in-app notifications
      // - Update activity logs
      // - Integrate with external notification services

    } catch (error) {
      console.error('Notification creation error:', error);
    }
  }

  /**
   * Get appropriate ticket status for a workflow step
   * @param {Object} step - The workflow step
   * @returns {string} Ticket status
   */
  getStepStatus(step) {
    switch (step.step_type) {
      case WORKFLOW_CONSTANTS.STEP_TYPES.APPROVAL:
        return WORKFLOW_CONSTANTS.TICKET_STATUS.PENDING_APPROVAL;
      case WORKFLOW_CONSTANTS.STEP_TYPES.TASK:
        return WORKFLOW_CONSTANTS.TICKET_STATUS.IN_PROGRESS;
      case WORKFLOW_CONSTANTS.STEP_TYPES.NOTIFICATION:
        return WORKFLOW_CONSTANTS.TICKET_STATUS.IN_PROGRESS;
      default:
        return WORKFLOW_CONSTANTS.TICKET_STATUS.IN_PROGRESS;
    }
  }

  /**
   * Trigger a routing check for a ticket (async)
   * @param {string} ticketId - The ticket ID
   */
  triggerRoutingCheck(ticketId) {
    // This would typically be called by the main application
    // when approvals are submitted or external tasks completed
    console.log(`Routing check triggered for ticket: ${ticketId}`);
  }

  /**
   * Batch process multiple tickets for workflow progression
   * @param {Array} ticketIds - Array of ticket IDs to process
   * @returns {Array} Processing results for each ticket
   */
  async batchProcessWorkflows(ticketIds) {
    const results = [];

    for (const ticketId of ticketIds) {
      try {
        // Get ticket and workflow data
        const ticket = await this.api.Tickets.getById(ticketId);
        if (!ticket || !ticket.current_step_id) continue;

        const workflowSteps = await this.api.WorkflowSteps.getByTicketType(ticket.ticket_type_id);
        const currentStep = workflowSteps.find(step => step.id === ticket.current_step_id);
        const stepApprovals = await this.api.StepApprovals.getStepApprovals(ticketId, ticket.current_step_id);

        // Process workflow step
        const result = await this.processWorkflowStep(ticketId, currentStep, stepApprovals, workflowSteps);
        results.push({ ticketId, ...result });

      } catch (error) {
        results.push({
          ticketId,
          success: false,
          error: error.message,
          action: 'error'
        });
      }
    }

    return results;
  }
}

/**
 * Standalone routing functions for direct use
 */

/**
 * Process a single ticket's workflow step
 * @param {Object} api - API instance
 * @param {string} ticketId - The ticket ID
 */
export const processTicketWorkflow = async (api, ticketId) => {
  const router = new ApprovalRouter(api);

  try {
    const ticket = await api.Tickets.getById(ticketId);
    if (!ticket || !ticket.current_step_id) {
      return { success: false, message: 'No active workflow step found' };
    }

    const workflowSteps = await api.WorkflowSteps.getByTicketType(ticket.ticket_type_id);
    const currentStep = workflowSteps.find(step => step.id === ticket.current_step_id);
    const stepApprovals = await api.StepApprovals.getStepApprovals(ticketId, ticket.current_step_id);

    return await router.processWorkflowStep(ticketId, currentStep, stepApprovals, workflowSteps);
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Check if any tickets need workflow processing
 * @param {Object} api - API instance
 * @param {Array} ticketIds - Optional array of specific ticket IDs to check
 */
export const checkPendingWorkflows = async (api, ticketIds = null) => {
  const router = new ApprovalRouter(api);

  try {
    // Get tickets that might need processing
    let tickets;
    if (ticketIds) {
      tickets = await Promise.all(ticketIds.map(id => api.Tickets.getById(id)));
    } else {
      // Open tickets only, read page by page (AppScript v10.0)
      tickets = await api.Tickets.getAll({ status: 'open' });
      tickets = tickets.filter(ticket =>
        ticket.current_step_id &&
        ![
          WORKFLOW_CONSTANTS.TICKET_STATUS.COMPLETED,
          WORKFLOW_CONSTANTS.TICKET_STATUS.CANCELLED
        ].includes(ticket.status)
      );
    }

    const processingResults = await router.batchProcessWorkflows(
      tickets.map(ticket => ticket.id)
    );

    return {
      success: true,
      processed: processingResults.length,
      results: processingResults
    };

  } catch (error) {
    return { success: false, error: error.message };
  }
};

export default ApprovalRouter;