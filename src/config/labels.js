/**
 * User-facing labels that may be renamed later in one place (AppScript v10.0, design PLAN_FeatureGaps_Volume §2.7).
 * Internal names stay is_confidential / confidential_* ; the UI, emails and CSV say "Restricted".
 * Keep in step with RESTRICTED_LABEL / RESTRICTED_MASK / RESTRICTED_TICKET_MESSAGE in the AppScript file.
 */
export const RESTRICTED_LABEL = 'Restricted';
export const RESTRICTED_MASK = '•••••• Restricted';
export const RESTRICTED_TICKET_MESSAGE = 'This ticket is restricted to the people in its approval chain';

// Ticket type Restricted settings (setTicketTypeFeatures)
export const RESTRICTED_MODES = [
  { value: 'off', label: 'Off' },
  { value: 'optional', label: 'Optional (the requester ticks it)' },
  { value: 'always', label: 'Always (every ticket of this type)' }
];
export const RESTRICTED_ADMIN_ACCESS = [
  { value: 'reveal_with_reason', label: 'Admins reveal with a reason (logged)' },
  { value: 'always', label: 'Admins always see it' },
  { value: 'never', label: 'Admins never see it' }
];

/** Is this a Restricted ticket's stub (what people outside its chain receive)? */
export const isRestrictedStub = ticket => Boolean(ticket && ticket.confidential === true && !('title' in ticket));
