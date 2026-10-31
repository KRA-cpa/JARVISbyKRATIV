import {
  validateEscalationRule, describeRule, emptyEscalationRule, ESCALATION_TRIGGERS, ESCALATION_ACTIONS
} from './slaEscalation';

// The form checks mirror AppScript v9.5 slaEscalationRuleValues (the server checks again)
describe('validateEscalationRule', () => {
  it('accepts the default new rule', () => {
    expect(validateEscalationRule(emptyEscalationRule(1)).isValid).toBe(true);
  });

  it('refuses a percentage over 100 and a zero value', () => {
    expect(validateEscalationRule({ ...emptyEscalationRule(), trigger_value: 150 }).errors).toContain('A percentage can be at most 100');
    expect(validateEscalationRule({ ...emptyEscalationRule(), trigger_value: 0 }).isValid).toBe(false);
  });

  it('needs a recipient, and a role for escalate_role', () => {
    const noOne = { ...emptyEscalationRule(), notify_current_approvers: false };
    expect(validateEscalationRule(noOne).errors).toContain('Choose at least one recipient');
    const escalate = { ...emptyEscalationRule(), escalation_action: ESCALATION_ACTIONS.ESCALATE_ROLE };
    expect(validateEscalationRule(escalate).errors).toContain('Escalate to role needs at least one role');
    expect(validateEscalationRule({ ...escalate, notify_role_ids: ['r_head'] }).isValid).toBe(true);
  });

  it('refuses business units before the due date and bad emails', () => {
    const before = { ...emptyEscalationRule(), trigger: ESCALATION_TRIGGERS.BEFORE_DUE, trigger_value: 2, trigger_unit: 'business_hours' };
    expect(validateEscalationRule(before).isValid).toBe(false);
    expect(validateEscalationRule({ ...before, trigger_unit: 'hours' }).isValid).toBe(true);
    expect(validateEscalationRule({ ...emptyEscalationRule(), notify_emails: ['not-an-email'] }).errors).toContain('Check the email addresses');
  });
});

describe('describeRule', () => {
  it('describes percent, before and after rules with their recipients', () => {
    expect(describeRule(emptyEscalationRule())).toBe('At 75% of the SLA: notify (current approvers)');
    expect(describeRule({ ...emptyEscalationRule(), trigger: ESCALATION_TRIGGERS.AFTER_DUE, trigger_value: 2, trigger_unit: 'business_hours',
      escalation_action: ESCALATION_ACTIONS.ESCALATE_ROLE, notify_current_approvers: false, notify_role_ids: ['r_head'] }, id => (id === 'r_head' ? 'Head' : id)))
      .toBe('2 business hours overdue: escalate to Head (Head)');
  });
});
