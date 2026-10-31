import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useWorkflowSteps, useStepApprovals, useApprovalEligibility, useCommentRequirements } from '../../hooks/useAPI';
import { useToast } from '../shared/Toast';
import { API } from '../../api/googleSheet';
import {
  canCompleteWorkflowStep,
  getApprovalCounts,
  WORKFLOW_CONSTANTS
} from '../../utils/workflowEngine';
import { processExternalAppIntegration, verifyTaskCompletion } from '../../utils/externalAppIntegration';
import Icons from '../shared/Icons';
import { formatDateOnly } from '../../utils/dateTime';

const WorkflowStep = ({ ticket, onTicketUpdate }) => {
  const { user } = useUser();
  const { success, error: showError } = useToast();
  // Firebase users carry uid; the backend moves the ticket itself (AppScript v9.0 submitStepApproval),
  // so there is no client-side routing after an approval
  const currentUserId = user?.uid || user?.id;

  // Get workflow steps for this ticket type in the ticket's company (each company has its own workflow)
  const { data: workflowSteps, loading: stepsLoading } = useWorkflowSteps(ticket?.ticket_type_id, ticket?.company_id);

  // Find current step
  const currentStep = workflowSteps?.find(step => String(step.id) === String(ticket?.current_step_id));

  // Get approvals for current step
  const { data: stepApprovals, refetch: refetchApprovals } = useStepApprovals(
    ticket?.id,
    currentStep?.id
  );

  // Can the current user act on this step? (company + ticket type roles in force; 'all' logic progress)
  const { data: eligibility, refetch: refetchEligibility } = useApprovalEligibility(currentUserId, currentStep?.id, ticket?.id);
  const canApprove = Boolean(eligibility?.can_approve);
  // can_act (AppScript v9.1, review R-03): reject / return - true for a partial approver under 'all' too
  const canAct = Boolean(eligibility?.can_act ?? eligibility?.can_approve);

  // Which actions need a comment for this ticket type / company (spec 3.3; the backend enforces it too).
  // Reject and return always ask for one here.
  const { data: commentRules } = useCommentRequirements(ticket?.ticket_type_id, ticket?.company_id);
  const commentRequired = pendingActionName => pendingActionName !== 'approve' || Boolean(commentRules?.require_on_approve);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [comment, setComment] = useState('');
  const [externalAppIntegration, setExternalAppIntegration] = useState(null);

  // Reset comment when modal closes
  useEffect(() => {
    if (!showCommentModal) {
      setComment('');
      setPendingAction(null);
    }
  }, [showCommentModal]);

  // Process external app integration when step changes
  useEffect(() => {
    if (currentStep?.step_type === WORKFLOW_CONSTANTS.STEP_TYPES.TASK && currentStep.external_app_config?.enabled) {
      processExternalAppIntegration(currentStep, ticket, user, API)
        .then(result => setExternalAppIntegration(result))
        .catch(error => {
          console.error('External app integration failed:', error);
          setExternalAppIntegration({ success: false, error: error.message });
        });
    } else {
      setExternalAppIntegration(null);
    }
  }, [currentStep, ticket, user]);

  const handleApprovalAction = (action) => {
    setPendingAction(action);
    setShowCommentModal(true);
  };

  const submitApproval = async () => {
    if (!pendingAction || !currentStep || !ticket) return;

    setIsSubmitting(true);
    try {
      const result = await API.StepApprovals.submitApproval(
        ticket.id,
        currentStep.id,
        currentUserId,
        pendingAction,
        comment
      );

      if (result?.partial) {
        const required = result.required_role_ids?.length || 0;
        const approved = (result.approved_role_ids || []).filter(id => (result.required_role_ids || []).includes(id)).length;
        success(`Approval recorded (${approved} of ${required} approver roles) - waiting for the others`);
      } else {
        success(`Step ${pendingAction}d successfully!`);
      }
      setShowCommentModal(false);

      // The backend already moved the ticket: refresh what this screen shows
      await refetchApprovals();
      await refetchEligibility();
      onTicketUpdate?.();

    } catch (error) {
      console.error('Approval submission failed:', error);
      showError(error.message || 'Failed to submit approval. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExternalTaskComplete = async () => {
    if (!currentStep || currentStep.step_type !== WORKFLOW_CONSTANTS.STEP_TYPES.TASK) return;

    setIsSubmitting(true);
    try {
      // Verify task completion if external app integration is configured
      if (externalAppIntegration && currentStep.external_app_config?.completion_method) {
        const verificationResult = await verifyTaskCompletion(
          currentStep,
          ticket,
          user,
          { comment: 'Manual completion confirmation' },
          API
        );

        if (!verificationResult.verified) {
          showError(verificationResult.message || 'Task completion verification failed');
          return;
        }
      }

      await API.StepApprovals.submitApproval(
        ticket.id,
        currentStep.id,
        currentUserId,
        'complete',
        'External task completed'
      );

      // AppScript v9.2: completing a task moves the ticket on like an approval (routing included)
      success('Task marked as complete!');
      await refetchEligibility();
      onTicketUpdate?.();

    } catch (error) {
      console.error('Task completion failed:', error);
      showError(error.message || 'Failed to mark task as complete. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (stepsLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-600">Loading workflow information...</span>
        </div>
      </div>
    );
  }

  if (!workflowSteps || workflowSteps.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <div className="text-center">
          <Icons.Workflow size={48} className="mx-auto text-gray-400 mb-2" />
          <p className="text-gray-600">No workflow configured for this ticket type</p>
        </div>
      </div>
    );
  }

  if (!currentStep) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center space-x-2">
          <Icons.Success size={20} className="text-green-600" />
          <span className="text-green-800 font-medium">Workflow Complete</span>
        </div>
        <p className="text-green-700 mt-2">This ticket has completed all workflow steps.</p>
      </div>
    );
  }

  const approvalCounts = getApprovalCounts(stepApprovals || []);
  const completionStatus = canCompleteWorkflowStep(currentStep, stepApprovals || [], []);

  const getStepStatusColor = () => {
    if (completionStatus.rejected) return 'red';
    if (completionStatus.canComplete) return 'green';
    return 'blue';
  };

  const getStepStatusIcon = () => {
    if (completionStatus.rejected) return Icons.Error;
    if (completionStatus.canComplete) return Icons.Success;
    return Icons.Clock;
  };

  const StatusIcon = getStepStatusIcon();
  const statusColor = getStepStatusColor();

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Current Workflow Step</h3>
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full bg-${statusColor}-100 text-${statusColor}-800`}>
              <StatusIcon size={16} />
              <span className="text-sm font-medium">{currentStep.step_type}</span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Step Information */}
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">{currentStep.name}</h4>
            <p className="text-gray-600">
              Status: <span className="font-medium">{ticket.status}</span>
            </p>

            {currentStep.sla_duration && (
              <p className="text-gray-600">
                SLA: {currentStep.sla_duration} {currentStep.sla_unit}
                {currentStep.exclude_weekends && ' (business days only)'}
              </p>
            )}
          </div>

          {/* Approval Step Details */}
          {currentStep.step_type === WORKFLOW_CONSTANTS.STEP_TYPES.APPROVAL && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h5 className="font-medium text-gray-900 mb-3">Approval Progress</h5>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{approvalCounts.approved}</div>
                  <div className="text-sm text-gray-600">Approved</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{approvalCounts.rejected}</div>
                  <div className="text-sm text-gray-600">Rejected</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{approvalCounts.returned}</div>
                  <div className="text-sm text-gray-600">Returned</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">{approvalCounts.pending}</div>
                  <div className="text-sm text-gray-600">Pending</div>
                </div>
              </div>

              <div className="text-sm text-gray-600">
                <strong>Logic:</strong> {currentStep.approver_logic === 'all' ? 'Every approver role' : 'Any one approver'} must approve
              </div>

              {currentStep.approver_logic === 'all' && eligibility?.required_role_ids?.length > 0 && (
                <div className="text-sm text-gray-600 mt-1">
                  <strong>Approver roles:</strong>{' '}
                  {(eligibility.approved_role_ids || []).filter(id => eligibility.required_role_ids.includes(id)).length} of {eligibility.required_role_ids.length} have approved this step
                </div>
              )}

              <div className="text-sm text-gray-600 mt-1">
                <strong>Status:</strong> {completionStatus.reason}
              </div>
            </div>
          )}

          {/* External Task Details */}
          {currentStep.step_type === WORKFLOW_CONSTANTS.STEP_TYPES.TASK && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h5 className="font-medium text-blue-900 mb-2">External Task Required</h5>

              {/* External App Integration Status */}
              {externalAppIntegration ? (
                <div className="mb-4">
                  {externalAppIntegration.success ? (
                    <div className="text-blue-700 mb-3">
                      <p>{externalAppIntegration.message}</p>
                      {externalAppIntegration.documents && (
                        <div className="mt-2">
                          <p className="text-sm font-medium">Required Documents:</p>
                          <ul className="text-sm mt-1 space-y-1">
                            {externalAppIntegration.documents.map((doc, index) => (
                              <li key={index}>
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 underline"
                                >
                                  {doc.name}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {externalAppIntegration.checklist && externalAppIntegration.checklist.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-medium">Task Checklist:</p>
                          <ul className="text-sm mt-1 space-y-1">
                            {externalAppIntegration.checklist.map((item, index) => (
                              <li key={index} className="flex items-center">
                                <Icons.Success size={12} className="mr-2 text-blue-600" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-red-700 mb-3">
                      <p>External app integration failed: {externalAppIntegration.error || externalAppIntegration.message}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-blue-700 mb-4">Complete the required task in the external system.</p>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                {/* External App URL */}
                {externalAppIntegration?.url ? (
                  <a
                    href={externalAppIntegration.url}
                    target={externalAppIntegration.target || "_blank"}
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Icons.ExternalLink size={16} className="mr-2" />
                    Open External App
                  </a>
                ) : /^https?:\/\//i.test(currentStep.external_app_url || '') && (
                  <a
                    href={currentStep.external_app_url.replace('{ticket_id}', encodeURIComponent(ticket.id))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Icons.ExternalLink size={16} className="mr-2" />
                    Open External App
                  </a>
                )}

                {/* Task Completion Button - only the roles assigned to the task (same rule as approving) */}
                {canApprove && (
                  <button
                    onClick={handleExternalTaskComplete}
                    disabled={isSubmitting}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {(isSubmitting) && (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    )}
                    <Icons.Success size={16} className="mr-2" />
                    {externalAppIntegration?.completion_action_name || currentStep.completion_action_name || 'Mark Task Complete'}
                  </button>
                )}
              </div>
              {!canApprove && eligibility && (
                <p className="text-sm text-blue-800 mt-3">Only users with a role assigned to this task can mark it complete.</p>
              )}
            </div>
          )}

          {/* Current Step Approvals */}
          {stepApprovals && stepApprovals.length > 0 && (
            <div>
              <h5 className="font-medium text-gray-900 mb-3">Recent Approvals</h5>
              <div className="space-y-2">
                {stepApprovals.slice(0, 3).map((approval, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${{
                        'approve': 'bg-green-500',
                        'reject': 'bg-red-500',
                        'return': 'bg-yellow-500'
                      }[approval.action] || 'bg-gray-500'}`} />
                      <div>
                        <div className="font-medium text-gray-900">{approval.user_name}</div>
                        <div className="text-sm text-gray-600">{approval.comment}</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDateOnly(approval.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Why the current user can't approve */}
          {!canApprove && eligibility && currentStep.step_type === WORKFLOW_CONSTANTS.STEP_TYPES.APPROVAL && (
            <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
              {eligibility.already_approved
                ? 'You have approved this step. It moves on when every approver role has approved - you can still reject or return it.'
                : 'You are not an approver for this step (no role in force for this company and ticket type).'}
            </div>
          )}

          {/* Action Buttons - approve needs can_approve; reject / return need can_act */}
          {canAct && currentStep.step_type === WORKFLOW_CONSTANTS.STEP_TYPES.APPROVAL && (
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
              {canApprove && (
                <button
                  onClick={() => handleApprovalAction('approve')}
                  disabled={isSubmitting}
                  className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {(isSubmitting) && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  )}
                  <Icons.Success size={16} className="mr-2" />
                  Approve
                </button>
              )}

              <button
                onClick={() => handleApprovalAction('reject')}
                disabled={isSubmitting}
                className="flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {(isSubmitting) && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                )}
                <Icons.Error size={16} className="mr-2" />
                Reject
              </button>

              <button
                onClick={() => handleApprovalAction('return')}
                disabled={isSubmitting}
                className="flex items-center justify-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
              >
                {(isSubmitting) && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                )}
                <Icons.Edit size={16} className="mr-2" />
                Return
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Comment Modal */}
      {showCommentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {pendingAction === 'approve' ? 'Approve Step' :
               pendingAction === 'reject' ? 'Reject Step' : 'Return Step'}
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comment {commentRequired(pendingAction) ? '*' : '(optional)'}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={`Enter reason for ${pendingAction}...`}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCommentModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitApproval}
                disabled={isSubmitting || (commentRequired(pendingAction) && !comment.trim())}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center"
              >
                {isSubmitting && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                )}
                {pendingAction === 'approve' ? 'Approve' :
                 pendingAction === 'reject' ? 'Reject' : 'Return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WorkflowStep;