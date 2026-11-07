/**
 * SAMPLE data for the requester one-pager demo (/r/demo) - docs/planning/PLAN_RequesterOnePager_20261101.md.
 * Made-up company, people and tickets: the page makes NO API call and nothing typed there is sent or saved.
 * When R1 is built, the real page reads getCreatableTicketTypes / paged getTickets instead of this file.
 * icon = a name in src/components/shared/Icons.js. Layer: config (no imports).
 */

export const DEMO_COMPANY = { name: 'Sample Trading Corp.', initials: 'ST', helpEmail: 'admin@sample-trading.example' };
export const DEMO_USER = { firstName: 'Juan', name: 'Juan dela Cruz' };

/** The request types this requester may file ("who can create", v10.0), with their forms. */
export const DEMO_TYPES = [
  {
    id: 'pr', prefix: 'PR', icon: 'Tag', name: 'Purchase request', blurb: 'Buy supplies, equipment or services',
    steps: ['Manager', 'Finance'], firstApprover: 'Maria Santos (Manager)',
    fields: [
      { id: 'item', label: 'What do you need?', type: 'text', required: true, placeholder: 'e.g. 2 office chairs' },
      { id: 'amount', label: 'Estimated amount (PHP)', type: 'amount', required: true },
      { id: 'needed', label: 'Needed by', type: 'date' },
      { id: 'why', label: 'Why is it needed?', type: 'paragraph' }
    ]
  },
  {
    id: 'lv', prefix: 'LV', icon: 'Calendar', name: 'Leave request', blurb: 'Vacation, sick or emergency leave',
    steps: ['Manager', 'HR'], firstApprover: 'Maria Santos (Manager)',
    fields: [
      { id: 'kind', label: 'Type of leave', type: 'dropdown', required: true, options: ['Vacation', 'Sick', 'Emergency'] },
      { id: 'from', label: 'From', type: 'date', required: true },
      { id: 'to', label: 'To', type: 'date', required: true },
      { id: 'note', label: 'Note for your manager', type: 'paragraph' }
    ]
  },
  {
    id: 'it', prefix: 'IT', icon: 'Settings', name: 'IT support', blurb: 'Laptop, access, email or printer issues',
    steps: ['IT'], firstApprover: 'IT Support',
    fields: [
      { id: 'what', label: 'What is the problem?', type: 'text', required: true, placeholder: 'e.g. Cannot print to 2F printer' },
      { id: 'urgency', label: 'How urgent?', type: 'dropdown', required: true, options: ['Can wait', 'Today', 'Blocking my work'] },
      { id: 'details', label: 'Details', type: 'paragraph' }
    ]
  },
  {
    id: 'rb', prefix: 'RB', icon: 'Documents', name: 'Reimbursement', blurb: 'Get paid back for work expenses',
    steps: ['Manager', 'Finance'], firstApprover: 'Maria Santos (Manager)',
    fields: [
      { id: 'expense', label: 'Expense', type: 'text', required: true, placeholder: 'e.g. Taxi to client meeting' },
      { id: 'amount', label: 'Amount (PHP)', type: 'amount', required: true },
      { id: 'date', label: 'Date of expense', type: 'date', required: true },
      { id: 'receipt', label: 'Receipt link', type: 'text', placeholder: 'Google Drive or OneDrive link' }
    ]
  }
];

/**
 * The requester's existing requests. stepIndex = the step now handling it (steps.length = finished).
 * history = the timeline shown when a request is opened.
 */
export const DEMO_REQUESTS = [
  {
    number: 'PR-2026-00000042', typeId: 'pr', title: 'Laptop for new hire (Ana)', status: 'In progress', stepIndex: 1,
    withWho: 'Finance', due: 'Due Wed, 4 Nov',
    history: [
      { when: '30 Oct, 9:14 AM', what: 'You sent the request' },
      { when: '30 Oct, 2:02 PM', what: 'Maria Santos (Manager) approved' },
      { when: '30 Oct, 2:02 PM', what: 'Now with Finance' }
    ]
  },
  {
    number: 'LV-2026-00000118', typeId: 'lv', title: 'Vacation leave, 24-26 Dec', status: 'Returned', stepIndex: 0,
    withWho: 'You', due: 'Please update',
    history: [
      { when: '28 Oct, 10:30 AM', what: 'You sent the request' },
      { when: '29 Oct, 8:45 AM', what: 'Maria Santos returned it: "Please add who covers for you."' }
    ]
  },
  {
    number: 'IT-2026-00000307', typeId: 'it', title: 'Email not syncing on phone', status: 'Done', stepIndex: 1,
    withWho: '', due: 'Closed 27 Oct',
    history: [
      { when: '27 Oct, 8:05 AM', what: 'You sent the request' },
      { when: '27 Oct, 11:40 AM', what: 'IT Support resolved it' }
    ]
  }
];

/** Status chip colours (Tailwind classes), light + dark. */
export const DEMO_STATUS_STYLES = {
  'In progress': 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200',
  Returned: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  Done: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-200',
  Sent: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
};
