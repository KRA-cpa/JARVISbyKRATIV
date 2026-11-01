/**
 * Public website copy and brand (docs/planning/PLAN_PlatformWebsite_20261101.md §2: "Copy in src/config/site.js" - text changes never
 * touch components). Used by PublicHeader (nav), HowItWorksPage and ContactPage. Static: no API call.
 *
 * Only features the live backend has (AppScript v10.2) are described here. Planned ones (conditional routing, the ticket
 * uploader, delegation, comments ...) are added when they ship - plan §1: the server decides, the site only describes.
 * Layer: config (no imports).
 */

/**
 * Brand (plan decision W4a, 1 Nov 2026): "Daloy by KRAtiv" - Tagalog for "flow"; "TicketFlow" was taken. KRA = the
 * founder's initials. JARVIS stays the internal project / server name and is never shown to users.
 */
export const BRAND_NAME = 'Daloy';
export const BRAND_COMPANY = 'KRAtiv';
export const BRAND_BYLINE = `by ${BRAND_COMPANY}`;
export const BRAND_PARENT_LINE = `A ${BRAND_COMPANY} Solutions app`;
/** Copyright holder in the footer (user, 1 Nov 2026). */
export const BRAND_COPYRIGHT_OWNER = `${BRAND_COMPANY} Solutions / Kenneth Advento`;
export const BRAND_DESCRIPTOR = 'Ticketing & Workflow Orchestration';
/** Taglines (user, 1 Nov 2026: calm, not "workaholic"). Alternates: docs/design/daloy-brand/TAGLINES.md.
 * BRAND_MEANING doubles as the pronunciation hint (English speakers default to DAH-loy). */
export const BRAND_TAGLINE = 'Less chasing, more flow.';
export const BRAND_TAGLINE_LOCAL = 'Magaan ang daloy.';
export const BRAND_MEANING = 'da-LOY · Tagalog for "flow"';

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
  intro: 'From request to approval in four steps, set up without code.',
  // Kept short on purpose (user, 1 Nov 2026: the first version was "too detailed" - it is archived in
  // docs/archive/2026-11/how-it-works-detailed/). icon = a name in src/components/shared/Icons.js
  steps: [
    { id: 'form', icon: 'Document', heading: 'Build the form', text: 'Each kind of request gets its own form with the fields it needs.' },
    { id: 'route', icon: 'Users', heading: 'Set the approvers', text: 'The ticket goes step by step to the people in each role.' },
    { id: 'time', icon: 'Clock', heading: 'Keep it on time', text: 'SLAs count business time and escalate a step that runs late.' },
    { id: 'done', icon: 'CheckCircle', heading: 'See it done', text: 'Everyone is notified, and every ticket stays on record.' }
  ],
  ctaHeading: 'Find the plan that fits',
  ctaText: 'All plans include the core ticket loop; the plans page shows what each one adds.'
};

/**
 * Contact page. Sales address: the REACT_APP_CONTACT_EMAIL env var (plan decision W5 - set it in Vercel, then redeploy:
 * Create React App inlines it at build time). While it isn't set, the sales buttons are hidden (compliance F4: no fake
 * form) and the page says so. Privacy questions go to the DPO address published in src/config/legal/privacy.js.
 */
export const CONTACT = {
  title: 'Contact us',
  intro: `Questions about ${BRAND_NAME}, or ready to try it with your team? Write to us and we will get back to you.`,
  salesEmail: (process.env.REACT_APP_CONTACT_EMAIL || '').trim(),
  salesMissing: 'Our sales email address will be listed here soon.',
  requests: [
    {
      id: 'trial',
      icon: 'Plus',
      heading: 'Request a trial',
      text: 'We set up your company and start a trial on the plan you choose.',
      button: 'Request a trial',
      subject: `${BRAND_NAME} trial request`
    },
    {
      id: 'talk',
      icon: 'Comment',
      heading: 'Talk to us',
      text: `Ask about plans, set-up or how ${BRAND_NAME} fits your approvals.`,
      button: 'Email us',
      subject: `${BRAND_NAME} question`
    }
  ],
  // Pre-filled lines in the email body, so a request arrives with what we need to reply
  emailBodyLines: ['Name:', 'Company:', 'Country:', 'Team size:', 'Plan of interest (Basic / Advanced / Enterprise):', '', 'Message:'],
  customerHeading: `Already using ${BRAND_NAME}?`,
  customerText: `For access, roles or a ticket, contact your organization's ${BRAND_NAME} administrator first: they can invite ` +
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
