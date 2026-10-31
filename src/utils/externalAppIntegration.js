/**
 * External App Integration - Manual Task-based Workflow Pausing
 * Handles integration points where workflows pause for external system interactions
 */
import { formatDateTime } from './dateTime';

/**
 * External app integration types
 */
export const EXTERNAL_APP_TYPES = {
  WEB_APP: 'web_app',
  API_ENDPOINT: 'api_endpoint',
  EMAIL_ACTION: 'email_action',
  MANUAL_TASK: 'manual_task',
  DOCUMENT_REVIEW: 'document_review',
  APPROVAL_PORTAL: 'approval_portal'
};

/**
 * Integration action types
 */
export const INTEGRATION_ACTIONS = {
  OPEN_URL: 'open_url',
  REDIRECT: 'redirect',
  API_CALL: 'api_call',
  EMAIL_SEND: 'email_send',
  NOTIFICATION: 'notification',
  MANUAL_COMPLETION: 'manual_completion'
};

/**
 * Task completion verification methods
 */
export const VERIFICATION_METHODS = {
  MANUAL_CONFIRM: 'manual_confirm',
  API_CALLBACK: 'api_callback',
  EMAIL_RESPONSE: 'email_response',
  FILE_UPLOAD: 'file_upload',
  APPROVAL_CODE: 'approval_code',
  TIME_BASED: 'time_based'
};

/**
 * Process external app integration for a workflow step
 * @param {Object} step - Workflow step with external app configuration
 * @param {Object} ticket - Current ticket
 * @param {Object} user - Current user
 * @param {Object} api - API instance
 * @returns {Object} Integration result
 */
export const processExternalAppIntegration = async (step, ticket, user, api) => {
  if (!step.external_app_config || !step.external_app_config.enabled) {
    return { success: false, message: 'External app integration not configured' };
  }

  const config = step.external_app_config;

  try {
    // Log the integration attempt
    await logIntegrationEvent(ticket.id, step.id, 'integration_started', {
      user_id: user.id,
      config_type: config.type,
      timestamp: new Date().toISOString()
    }, api);

    // Process based on integration type
    switch (config.type) {
      case EXTERNAL_APP_TYPES.WEB_APP:
        return await processWebAppIntegration(config, step, ticket, user);

      case EXTERNAL_APP_TYPES.API_ENDPOINT:
        return await processApiIntegration(config, step, ticket, user, api);

      case EXTERNAL_APP_TYPES.EMAIL_ACTION:
        return await processEmailIntegration(config, step, ticket, user, api);

      case EXTERNAL_APP_TYPES.MANUAL_TASK:
        return await processManualTaskIntegration(config, step, ticket, user);

      case EXTERNAL_APP_TYPES.DOCUMENT_REVIEW:
        return await processDocumentReviewIntegration(config, step, ticket, user);

      case EXTERNAL_APP_TYPES.APPROVAL_PORTAL:
        return await processApprovalPortalIntegration(config, step, ticket, user, api);

      default:
        throw new Error(`Unknown external app type: ${config.type}`);
    }

  } catch (error) {
    // Log the error
    await logIntegrationEvent(ticket.id, step.id, 'integration_error', {
      user_id: user.id,
      error: error.message,
      timestamp: new Date().toISOString()
    }, api);

    return { success: false, error: error.message };
  }
};

/**
 * Process web app integration
 * @param {Object} config - Integration configuration
 * @param {Object} step - Workflow step
 * @param {Object} ticket - Current ticket
 * @param {Object} user - Current user
 * @returns {Object} Integration result
 */
export const processWebAppIntegration = async (config, step, ticket, user) => {
  // Generate URL with ticket context
  const targetUrl = generateContextualUrl(config.url, ticket, user, step);

  return {
    success: true,
    action: INTEGRATION_ACTIONS.OPEN_URL,
    url: targetUrl,
    target: config.target || '_blank',
    message: config.user_message || 'Please complete the task in the external application',
    completion_method: config.completion_method || VERIFICATION_METHODS.MANUAL_CONFIRM,
    completion_action_name: step.completion_action_name || 'Mark Task Complete'
  };
};

/**
 * Process API integration
 * @param {Object} config - Integration configuration
 * @param {Object} step - Workflow step
 * @param {Object} ticket - Current ticket
 * @param {Object} user - Current user
 * @param {Object} api - API instance
 * @returns {Object} Integration result
 */
export const processApiIntegration = async (config, step, ticket, user, api) => {
  try {
    // Prepare API request data
    const requestData = {
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
      step_id: step.id,
      user_id: user.id,
      user_email: user.email,
      timestamp: new Date().toISOString(),
      ...config.request_data
    };

    // Make API call
    const response = await makeExternalApiCall(config.endpoint, config.method, requestData, config.headers);

    return {
      success: true,
      action: INTEGRATION_ACTIONS.API_CALL,
      response: response,
      message: config.success_message || 'External API call completed successfully',
      completion_method: config.completion_method || VERIFICATION_METHODS.API_CALLBACK
    };

  } catch (error) {
    return {
      success: false,
      action: INTEGRATION_ACTIONS.API_CALL,
      error: error.message,
      message: config.error_message || 'External API call failed'
    };
  }
};

/**
 * Process email integration
 * @param {Object} config - Integration configuration
 * @param {Object} step - Workflow step
 * @param {Object} ticket - Current ticket
 * @param {Object} user - Current user
 * @param {Object} api - API instance
 * @returns {Object} Integration result
 */
export const processEmailIntegration = async (config, step, ticket, user, api) => {
  try {
    const emailData = {
      to: config.recipient_email || user.email,
      subject: generateContextualText(config.subject_template, ticket, user, step),
      body: generateContextualText(config.body_template, ticket, user, step),
      ticket_id: ticket.id,
      step_id: step.id
    };

    // Send email through API
    await api.Notifications?.sendEmail?.(emailData);

    return {
      success: true,
      action: INTEGRATION_ACTIONS.EMAIL_SEND,
      message: config.success_message || 'Email sent successfully',
      completion_method: config.completion_method || VERIFICATION_METHODS.EMAIL_RESPONSE
    };

  } catch (error) {
    return {
      success: false,
      action: INTEGRATION_ACTIONS.EMAIL_SEND,
      error: error.message,
      message: config.error_message || 'Failed to send email'
    };
  }
};

/**
 * Process manual task integration
 * @param {Object} config - Integration configuration
 * @param {Object} step - Workflow step
 * @param {Object} ticket - Current ticket
 * @param {Object} user - Current user
 * @returns {Object} Integration result
 */
export const processManualTaskIntegration = async (config, step, ticket, user) => {
  return {
    success: true,
    action: INTEGRATION_ACTIONS.MANUAL_COMPLETION,
    message: config.instructions || 'Please complete the manual task',
    completion_method: VERIFICATION_METHODS.MANUAL_CONFIRM,
    completion_action_name: step.completion_action_name || 'Mark Task Complete',
    checklist: config.checklist || [],
    attachments_required: config.attachments_required || false
  };
};

/**
 * Process document review integration
 * @param {Object} config - Integration configuration
 * @param {Object} step - Workflow step
 * @param {Object} ticket - Current ticket
 * @param {Object} user - Current user
 * @returns {Object} Integration result
 */
export const processDocumentReviewIntegration = async (config, step, ticket, user) => {
  const documents = config.documents || [];
  const contextualDocuments = documents.map(doc => ({
    ...doc,
    url: generateContextualUrl(doc.url, ticket, user, step)
  }));

  return {
    success: true,
    action: INTEGRATION_ACTIONS.MANUAL_COMPLETION,
    message: config.instructions || 'Please review the required documents',
    documents: contextualDocuments,
    completion_method: config.completion_method || VERIFICATION_METHODS.MANUAL_CONFIRM,
    completion_action_name: step.completion_action_name || 'Confirm Review Complete'
  };
};

/**
 * Process approval portal integration
 * @param {Object} config - Integration configuration
 * @param {Object} step - Workflow step
 * @param {Object} ticket - Current ticket
 * @param {Object} user - Current user
 * @param {Object} api - API instance
 * @returns {Object} Integration result
 */
export const processApprovalPortalIntegration = async (config, step, ticket, user, api) => {
  try {
    // Create approval session in external system
    const sessionData = {
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
      step_id: step.id,
      approver_id: user.id,
      approver_email: user.email,
      return_url: config.return_url
    };

    // Generate portal URL
    const portalUrl = generateContextualUrl(config.portal_url, ticket, user, step);

    return {
      success: true,
      action: INTEGRATION_ACTIONS.REDIRECT,
      url: portalUrl,
      message: config.user_message || 'Please complete approval in the external portal',
      completion_method: VERIFICATION_METHODS.API_CALLBACK,
      session_data: sessionData
    };

  } catch (error) {
    return {
      success: false,
      action: INTEGRATION_ACTIONS.REDIRECT,
      error: error.message,
      message: config.error_message || 'Failed to access approval portal'
    };
  }
};

/**
 * Verify task completion
 * @param {Object} step - Workflow step
 * @param {Object} ticket - Current ticket
 * @param {Object} user - Current user
 * @param {Object} completionData - Data provided for verification
 * @param {Object} api - API instance
 * @returns {Object} Verification result
 */
export const verifyTaskCompletion = async (step, ticket, user, completionData, api) => {
  const config = step.external_app_config;
  const verificationMethod = config?.completion_method || VERIFICATION_METHODS.MANUAL_CONFIRM;

  try {
    switch (verificationMethod) {
      case VERIFICATION_METHODS.MANUAL_CONFIRM:
        return verifyManualCompletion(completionData, user);

      case VERIFICATION_METHODS.API_CALLBACK:
        return await verifyApiCallback(config, completionData, api);

      case VERIFICATION_METHODS.EMAIL_RESPONSE:
        return await verifyEmailResponse(config, completionData, api);

      case VERIFICATION_METHODS.FILE_UPLOAD:
        return await verifyFileUpload(config, completionData, api);

      case VERIFICATION_METHODS.APPROVAL_CODE:
        return verifyApprovalCode(config, completionData);

      case VERIFICATION_METHODS.TIME_BASED:
        return verifyTimeBased(config, completionData);

      default:
        return { verified: false, message: 'Unknown verification method' };
    }

  } catch (error) {
    return { verified: false, error: error.message };
  }
};

/**
 * Helper functions
 */

/**
 * Generate URL with ticket context
 * @param {string} urlTemplate - URL template with placeholders
 * @param {Object} ticket - Current ticket
 * @param {Object} user - Current user
 * @param {Object} step - Workflow step
 * @returns {string} Contextualized URL
 */
const generateContextualUrl = (urlTemplate, ticket, user, step) => {
  return urlTemplate
    .replace('{ticket_id}', encodeURIComponent(ticket.id))
    .replace('{ticket_number}', encodeURIComponent(ticket.ticket_number))
    .replace('{step_id}', encodeURIComponent(step.id))
    .replace('{user_id}', encodeURIComponent(user.id))
    .replace('{user_email}', encodeURIComponent(user.email))
    .replace('{company_id}', encodeURIComponent(ticket.company_id))
    .replace('{timestamp}', encodeURIComponent(new Date().toISOString()));
};

/**
 * Generate text with ticket context
 * @param {string} template - Text template with placeholders
 * @param {Object} ticket - Current ticket
 * @param {Object} user - Current user
 * @param {Object} step - Workflow step
 * @returns {string} Contextualized text
 */
const generateContextualText = (template, ticket, user, step) => {
  return template
    .replace('{ticket_id}', ticket.id)
    .replace('{ticket_number}', ticket.ticket_number)
    .replace('{ticket_title}', ticket.title)
    .replace('{step_name}', step.name)
    .replace('{user_name}', user.name || user.email)
    .replace('{user_email}', user.email)
    .replace('{timestamp}', formatDateTime(new Date())); // v10.1: the display zone
};

/**
 * Make external API call
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method
 * @param {Object} data - Request data
 * @param {Object} headers - Request headers
 * @returns {Object} API response
 */
const makeExternalApiCall = async (endpoint, method = 'POST', data, headers = {}) => {
  const response = await fetch(endpoint, {
    method: method.toUpperCase(),
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: method.toUpperCase() !== 'GET' ? JSON.stringify(data) : undefined
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} ${response.statusText}`);
  }

  return await response.json();
};

/**
 * Log integration event
 * @param {string} ticketId - Ticket ID
 * @param {string} stepId - Step ID
 * @param {string} eventType - Event type
 * @param {Object} data - Event data
 * @param {Object} api - API instance
 */
const logIntegrationEvent = async (ticketId, stepId, eventType, data, api) => {
  try {
    await api.IntegrationLogs?.create?.({
      ticket_id: ticketId,
      step_id: stepId,
      event_type: eventType,
      event_data: data,
      created_date: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log integration event:', error);
  }
};

/**
 * Verification methods
 */

const verifyManualCompletion = (completionData, user) => {
  return {
    verified: true,
    method: VERIFICATION_METHODS.MANUAL_CONFIRM,
    verified_by: user.id,
    verified_at: new Date().toISOString(),
    comment: completionData.comment
  };
};

const verifyApiCallback = async (config, completionData, api) => {
  // Verify callback token or session
  if (config.callback_verification_url) {
    const response = await makeExternalApiCall(
      config.callback_verification_url,
      'POST',
      completionData
    );
    return {
      verified: response.verified === true,
      method: VERIFICATION_METHODS.API_CALLBACK,
      verification_response: response
    };
  }
  return { verified: false, message: 'No callback verification configured' };
};

const verifyEmailResponse = async (config, completionData, api) => {
  // This would check for email confirmation
  return { verified: false, message: 'Email verification not implemented' };
};

const verifyFileUpload = async (config, completionData, api) => {
  // Verify required files were uploaded
  if (completionData.files && completionData.files.length > 0) {
    return {
      verified: true,
      method: VERIFICATION_METHODS.FILE_UPLOAD,
      files: completionData.files
    };
  }
  return { verified: false, message: 'Required files not uploaded' };
};

const verifyApprovalCode = (config, completionData) => {
  if (config.approval_code && completionData.code === config.approval_code) {
    return {
      verified: true,
      method: VERIFICATION_METHODS.APPROVAL_CODE
    };
  }
  return { verified: false, message: 'Invalid approval code' };
};

const verifyTimeBased = (config, completionData) => {
  const now = new Date();
  const startTime = new Date(completionData.start_time);
  const minDuration = config.minimum_duration_minutes || 0;

  if ((now - startTime) >= (minDuration * 60 * 1000)) {
    return {
      verified: true,
      method: VERIFICATION_METHODS.TIME_BASED,
      duration_minutes: Math.floor((now - startTime) / (60 * 1000))
    };
  }
  return { verified: false, message: `Minimum duration of ${minDuration} minutes not met` };
};

/**
 * Create sample external app configuration
 * @returns {Object} Sample configuration
 */
export const createSampleExternalAppConfig = () => {
  return {
    enabled: true,
    type: EXTERNAL_APP_TYPES.WEB_APP,
    url: 'https://external-app.com/task?ticket={ticket_id}&user={user_email}',
    target: '_blank',
    user_message: 'Please complete the required task in the external application',
    completion_method: VERIFICATION_METHODS.MANUAL_CONFIRM,
    success_message: 'Task completed successfully',
    error_message: 'Failed to access external application'
  };
};

const externalAppIntegration = {
  processExternalAppIntegration,
  verifyTaskCompletion,
  createSampleExternalAppConfig,
  EXTERNAL_APP_TYPES,
  INTEGRATION_ACTIONS,
  VERIFICATION_METHODS
};

export default externalAppIntegration;
