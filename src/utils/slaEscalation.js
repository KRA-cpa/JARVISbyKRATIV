/**
 * SLA escalation - labels and form checks for the admin screen (AppScript v9.5)
 *
 * The server runs the escalations (runSLAEscalations, every 15 minutes) and decides who is notified, by email or
 * in the app; this file only describes and validates rules for the form (compliance F1 - until v9.5 an engine
 * here ran in every open browser on hard-coded rules). validateEscalationRule mirrors slaEscalationRuleValues
 * in the AppScript file; the server checks again.
 */

export const ESCALATION_TRIGGERS = {
  PERCENT_ELAPSED: 'percent_elapsed', // at X% of the time between reaching the step and its due date
  BEFORE_DUE: 'before_due',           // X minutes / hours / days before the due date
  AFTER_DUE: 'after_due'              // X units after the due date (overdue)
};

export const ESCALATION_ACTIONS = {
  NOTIFY: 'notify',                   // notify the recipients
  ESCALATE_ROLE: 'escalate_role'      // notify + let holders of the roles approve / reject / return this step
};

export const ESCALATION_UNITS = ['minutes', 'hours', 'days', 'business_hours', 'business_days'];

export const TRIGGER_LABELS = {
  percent_elapsed: '% of the SLA used',
  before_due: 'Before the due date',
  after_due: 'After the due date (overdue)'
};

export const ACTION_LABELS = {
  notify: 'Notify',
  escalate_role: 'Escalate to role (may act on the step)'
};

export const UNIT_LABELS = {
  minutes: 'minutes',
  hours: 'hours',
  days: 'days',
  business_hours: 'business hours',
  business_days: 'business days'
};

// Email for SLA notices per ticket type: 'default' follows the global setting
export const SLA_EMAIL_MODES = ['default', 'on', 'off'];

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** A new rule for the form. */
export const emptyEscalationRule = (level = 1) => ({
  level,
  name: '',
  step_id: '',
  trigger: ESCALATION_TRIGGERS.PERCENT_ELAPSED,
  trigger_value: 75,
  trigger_unit: 'hours',
  escalation_action: ESCALATION_ACTIONS.NOTIFY,
  notify_current_approvers: true,
  notify_requester: false,
  notify_role_ids: [],
  notify_emails: [],
  message: ''
});

/**
 * Form check, the same rules as the server.
 * @param {Object} rule - Form values
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateEscalationRule(rule) {
  const errors = [];
  const level = Number(rule.level);
  if (!Number.isInteger(level) || level < 1) errors.push('Level must be a whole number from 1');
  if (!Object.values(ESCALATION_TRIGGERS).includes(rule.trigger)) errors.push('Choose when the rule fires');
  const value = Number(rule.trigger_value);
  if (!Number.isFinite(value) || value <= 0) errors.push('The value must be greater than 0');
  if (rule.trigger === ESCALATION_TRIGGERS.PERCENT_ELAPSED && value > 100) errors.push('A percentage can be at most 100');
  if (rule.trigger !== ESCALATION_TRIGGERS.PERCENT_ELAPSED && !ESCALATION_UNITS.includes(rule.trigger_unit)) errors.push('Choose a unit');
  if (rule.trigger === ESCALATION_TRIGGERS.BEFORE_DUE && String(rule.trigger_unit).startsWith('business')) {
    errors.push('"Before the due date" counts back in minutes, hours or days');
  }
  if (!Object.values(ESCALATION_ACTIONS).includes(rule.escalation_action)) errors.push('Choose an action');
  const roles = rule.notify_role_ids || [];
  const emails = rule.notify_emails || [];
  if (rule.escalation_action === ESCALATION_ACTIONS.ESCALATE_ROLE && roles.length === 0) errors.push('Escalate to role needs at least one role');
  if (emails.some(email => !EMAIL.test(email))) errors.push('Check the email addresses');
  if (!rule.notify_current_approvers && !rule.notify_requester && roles.length === 0 && emails.length === 0) {
    errors.push('Choose at least one recipient');
  }
  return { isValid: errors.length === 0, errors };
}

/**
 * One-line description of a rule for the list.
 * @param {Object} rule - Rule (from the server or the form)
 * @param {Function} roleName - role id -> name (optional)
 */
export function describeRule(rule, roleName = id => id) {
  const value = Number(rule.trigger_value);
  const unit = UNIT_LABELS[rule.trigger_unit] || rule.trigger_unit;
  const when = rule.trigger === ESCALATION_TRIGGERS.PERCENT_ELAPSED
    ? `At ${value}% of the SLA`
    : rule.trigger === ESCALATION_TRIGGERS.BEFORE_DUE
      ? `${value} ${unit} before due`
      : `${value} ${unit} overdue`;
  const who = [
    rule.notify_current_approvers ? 'current approvers' : null,
    rule.notify_requester ? 'requester' : null,
    ...(rule.notify_role_ids || []).map(roleName),
    ...(rule.notify_emails || [])
  ].filter(Boolean).join(', ');
  const what = rule.escalation_action === ESCALATION_ACTIONS.ESCALATE_ROLE
    ? `escalate to ${(rule.notify_role_ids || []).map(roleName).join(', ')}`
    : 'notify';
  return `${when}: ${what}${who ? ` (${who})` : ''}`;
}
