/**
 * Public website copy (docs/planning/PLAN_PlatformWebsite_20261101.md §2: "Copy in src/config/site.js" - text changes never
 * touch components). Used by PublicHeader (nav), HowItWorksPage and ContactPage. Static: no API call.
 *
 * Only features the live backend has (AppScript v10.2) are described here. Planned ones (conditional routing, the ticket
 * uploader, delegation, comments ...) are added when they ship - plan §1: the server decides, the site only describes.
 * Layer: config (no imports).
 */

/** The "how it works" page. Rename the nav label here; /features opens the same page (App.js). */
export const HOW_IT_WORKS_PATH = '/how-it-works';
export const HOW_IT_WORKS_LABEL = 'How it works';

/** Public header nav, in display order (user, 1 Nov 2026: features, plans, contact, privacy). */
export const PUBLIC_NAV = [
  { label: HOW_IT_WORKS_LABEL, path: HOW_IT_WORKS_PATH, also: ['/features'] },
  { label: 'Plans', path: '/plans' },
  { label: 'Contact', path: '/contact' },
  { label: 'Privacy', path: '/privacy', also: ['/privacy/draft'] }
];

export const HOW_IT_WORKS = {
  title: 'How it works',
  intro: 'TicketFlow takes a request from the form someone fills in to the last approval, on time and on record. ' +
    'Your administrators set it up without code; everyone else just fills in a form and approves.',
  // One step of a ticket's life per section, in order. icon = a name in src/components/shared/Icons.js
  steps: [
    {
      id: 'set-up',
      icon: 'Document',
      heading: 'Set up your ticket types',
      summary: 'Each kind of request - a purchase request, a leave form, an IT ticket - is a ticket type with its own form.',
      points: [
        'Custom fields: text, paragraph, date, amount and dropdown',
        'Choose who may create each type, by role and company',
        'Private tickets by default, or collaborative for the whole team',
        'Ticket numbers follow your company code and the year of your country calendar'
      ]
    },
    {
      id: 'route',
      icon: 'Workflow',
      heading: 'Route it through approvals',
      summary: 'A ticket moves through the approval steps you define, in order, to the people who hold each role.',
      points: [
        'Steps approved by any one approver, or by all of them',
        'Approve, return for changes, reject, cancel and reopen',
        'Require a comment on the actions that need one',
        'An approval inbox for each approver, and the full history on every ticket'
      ]
    },
    {
      id: 'on-time',
      icon: 'Clock',
      heading: 'Keep it on time',
      summary: 'Service levels count business time in your company\'s time zone, with your country\'s weekends and holidays.',
      points: [
        'SLAs per step and company SLA rules in business hours or days',
        'Country calendars and company holidays',
        'Escalation levels that notify, or hand the ticket to a role, before or after the due time',
        'Due-today and overdue views on the dashboard'
      ]
    },
    {
      id: 'informed',
      icon: 'Bell',
      heading: 'Keep everyone informed',
      summary: 'People hear about the tickets that need them, in the app and by email.',
      points: [
        'In-app notifications from the header bell',
        'Workflow emails with your company\'s sender name and reply-to address',
        'Tags and sharing for the ticket types that use them',
        'Links between related tickets and to Google Drive documents'
      ]
    },
    {
      id: 'protect',
      icon: 'Lock',
      heading: 'Protect sensitive work',
      summary: 'Access follows roles, and sensitive tickets stay with the people in their approval chain.',
      points: [
        'Restricted tickets and fields, masked for everyone outside the chain',
        'Sign-in by invitation only, with Google accounts',
        'Admin-only settings, and automatic sign-out after inactivity',
        'Configuration export and backup for your administrators'
      ]
    },
    {
      id: 'report',
      icon: 'List',
      heading: 'See where things stand',
      summary: 'Every ticket is on record, so the numbers are always current.',
      points: [
        'A dashboard of your open, pending and overdue tickets',
        'Paged ticket lists with search and filters',
        'The standard report, with CSV export',
        'Dates shown in each person\'s own time zone'
      ]
    }
  ],
  ctaHeading: 'Find the plan that fits',
  ctaText: 'Basic, Advanced and Enterprise share the same core ticket loop. Some of the features above come with Advanced or ' +
    'Enterprise only - the plans page shows which.'
};

/**
 * Contact page. Sales address: the REACT_APP_CONTACT_EMAIL env var (plan decision W5 - set it in Vercel, then redeploy:
 * Create React App inlines it at build time). While it isn't set, the sales buttons are hidden (compliance F4: no fake
 * form) and the page says so. Privacy questions go to the DPO address published in src/config/legal/privacy.js.
 */
export const CONTACT = {
  title: 'Contact us',
  intro: 'Questions about TicketFlow, or ready to try it with your team? Write to us and we will get back to you.',
  salesEmail: (process.env.REACT_APP_CONTACT_EMAIL || '').trim(),
  salesMissing: 'Our sales email address will be listed here soon.',
  requests: [
    {
      id: 'trial',
      icon: 'Plus',
      heading: 'Request a trial',
      text: 'We set up your company and start a trial on the plan you choose.',
      button: 'Request a trial',
      subject: 'TicketFlow trial request'
    },
    {
      id: 'talk',
      icon: 'Comment',
      heading: 'Talk to us',
      text: 'Ask about plans, set-up or how TicketFlow fits your approvals.',
      button: 'Email us',
      subject: 'TicketFlow question'
    }
  ],
  // Pre-filled lines in the email body, so a request arrives with what we need to reply
  emailBodyLines: ['Name:', 'Company:', 'Country:', 'Team size:', 'Plan of interest (Basic / Advanced / Enterprise):', '', 'Message:'],
  customerHeading: 'Already using TicketFlow?',
  customerText: 'For access, roles or a ticket, contact your organization\'s TicketFlow administrator first: they can invite ' +
    'people, assign roles and change your company\'s settings.',
  privacyHeading: 'Privacy questions',
  privacyEmail: 'jarvis.dpo@blueknight.xyz', // the same DPO address as src/config/legal/privacy.js - change both together
  privacyText: 'For a question or request about your personal information, contact our Data Protection Officer.'
};

/** mailto: link with a subject and the pre-filled body (encoded). */
export function contactMailto(email, subject) {
  const body = CONTACT.emailBodyLines.join('\n');
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
