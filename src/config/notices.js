/**
 * Sign-in notices: a banner on every signed-in page for 7 days, which each user can hide, linking to the full notice at
 * /notices/<id>. User, 15 Nov 2026: "banner upon login, effective for 7 days, user can hide" + "banner will provide link
 * to breach notif". The wording comes from docs/planning/TEMPLATE_BreachNotice_ProviderIncident_20261115.md
 * (A = no company data affected, B = company data may have been affected, B2 = follow-up).
 *
 * To post a notice: add an entry to LOGIN_NOTICES and deploy.
 *   - id          the incident reference, e.g. 'INC-2026-001' (B2 follow-ups: 'INC-2026-001-U1'); also the page path
 *   - template    'A' | 'B' | 'B2' - the banner colour and badge
 *   - postedAt    when the banner starts, ISO with offset, e.g. '2026-11-20T09:00:00+08:00'
 *   - days        how long the banner shows (default NOTICE_DAYS = 7); the notice page stays readable after that
 *   - companyIds  [] = every organization; else only these company ids (template B goes only to the ones in scope)
 *   - banner      the one line in the signed-in banner
 *   - statusLine  the one line on the public /status page while the banner runs (template §3: provider + date, never
 *                 customer names or data) - user, 15 Nov 2026: default kept, no separate public breach page
 *   - title, sections [{ id, heading, body }] - the notice; body = paragraphs split by a blank line, "- " lines = bullets
 *   - public      false (default) | true - publish the PUBLIC version at /notices/<id>/public and link it from /status.
 *                 Only when the NPC asks for a public notice or the people concerned can't be reached one by one
 *                 (template §0). User: "public notice must be readily available for publishing" - so every notice
 *                 carries its public text ready, and publishing is this one flag + a deploy:
 *   - publicTitle, publicSections - the public version (template P): no customer names, no per-organization detail
 * Hiding is remembered per user in this browser (a convenience only: in a private window it shows again). The notice
 * itself goes out by email too (template §2) - the banner is not the legal notice.
 *
 * PREVIEW_SAMPLE_NOTICES (one A, one B) show on Vercel previews and local development only, always in their window, so
 * the banner and page can be reviewed; production builds leave them out. On previews the public version of a notice is
 * viewable even while public is false (for review), marked "not published".
 * Layer: config (imports config/platform only).
 */
import { IS_PREVIEW_BUILD } from './platform';

export const NOTICE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export const LOGIN_NOTICES = [];

const CONTACT_LINE = 'Questions: our Data Protection Officer at KRATIV.dpo@blueknight.xyz. Please quote the reference of this notice.';

export const PREVIEW_SAMPLE_NOTICES = [
  {
    id: 'SAMPLE-A',
    sample: true,
    template: 'A',
    companyIds: [],
    banner: '[[Provider]] reported a security incident. Your organization\'s Daloy data was not affected.',
    statusLine: '[[Provider]] reported a security incident. Daloy data was not affected. Service is working normally.',
    public: false,
    publicTitle: 'Security notice: [[Provider]] incident - Daloy data was not affected',
    publicSections: [
      {
        id: 'what-happened',
        heading: 'What happened',
        body: 'On [[date]], [[Provider]], one of Daloy\'s service providers, reported a security incident: [[one-sentence ' +
          'summary, with a link to the provider\'s statement]]. The services and regions Daloy uses were not involved, and ' +
          'our own review found no unusual access to Daloy data. Daloy is working normally; customers don\'t need to do ' +
          'anything.'
      },
      { id: 'contact', heading: 'Contact', body: 'Questions: our Data Protection Officer at KRATIV.dpo@blueknight.xyz.' }
    ],
    title: 'Security notice: [[Provider]] incident - your Daloy data was not affected',
    sections: [
      {
        id: 'what-happened',
        heading: 'What happened',
        body: 'On [[date]], [[Provider]], which provides [[our database service / our application hosting]], reported a ' +
          'security incident: [[one-sentence summary of the provider\'s statement]].'
      },
      {
        id: 'your-data',
        heading: 'Your data was not affected',
        body: '[[Provider]] has confirmed that [[the affected services / regions / accounts]] were involved, and Daloy does ' +
          'not use them. We also reviewed our own access records for [[incident window]] and found no unusual access to ' +
          'your data. [[As a precaution, we changed the access keys Daloy uses with the provider.]]'
      },
      {
        id: 'what-to-do',
        heading: 'What you should do',
        body: 'Nothing. Daloy is working normally.\n\nWe tell you about incidents at our providers even when your data is ' +
          'not involved, so you hear it from us first. If anything changes, we will write to you again.'
      },
      { id: 'contact', heading: 'Contact', body: CONTACT_LINE }
    ]
  },
  {
    id: 'SAMPLE-B',
    sample: true,
    template: 'B',
    companyIds: [],
    banner: '[[Provider]] reported a security incident that may involve your organization\'s Daloy data. Please read the notice.',
    statusLine: '[[Provider]] reported a security incident that may involve Daloy data. Affected organizations have been ' +
      'contacted directly. Next update: [[date / time]].',
    public: false,
    publicTitle: 'Notice of a security incident at [[Provider]], a Daloy service provider',
    publicSections: [
      {
        id: 'what-happened',
        heading: 'What happened',
        body: 'On [[date]], [[Provider]], which provides [[what it does for Daloy]], informed us of a security incident: ' +
          '[[what was accessed or exposed, the time window]]. Data of some organizations that use Daloy, and of their ' +
          'users, may have been involved. We became aware of it on [[date and time, UTC+8]].'
      },
      {
        id: 'data',
        heading: 'What information may be involved',
        body: '- [[Names and work email addresses]]\n' +
          '- [[Content of workflow requests (tickets) of the organizations concerned]]\n\n' +
          'Not involved: passwords - Daloy does not store passwords; sign-in is through Google.'
      },
      {
        id: 'done',
        heading: 'What we have done',
        body: 'We have [[closed the access with the provider, changed our access keys and signed all users out]]. The ' +
          'organizations concerned have been contacted directly, and we are helping them with their own notices.'
      },
      {
        id: 'what-to-do',
        heading: 'What you can do',
        body: 'Be careful with emails or messages that mention Daloy or ask you to sign in. Daloy never asks for a password ' +
          'by email. If you use Daloy through your employer or another organization, it can tell you whether your ' +
          'information was involved.'
      },
      {
        id: 'contact',
        heading: 'Contact',
        body: 'Our Data Protection Officer: KRATIV.dpo@blueknight.xyz. You may also contact the National Privacy Commission ' +
          '(privacy.gov.ph). Next update on this page: [[date / time]].'
      }
    ],
    title: 'Important: [[Provider]] security incident - your organization\'s Daloy data may have been affected',
    sections: [
      {
        id: 'what-happened',
        heading: 'What happened',
        body: 'On [[date]], [[Provider]], which provides [[what it does for Daloy]], informed us that [[what was accessed or ' +
          'exposed, the time window]]. Daloy stores your organization\'s data with [[Provider]] in [[Singapore]]. We became ' +
          'aware of the incident on [[date and time, UTC+8]]. We are telling you now, before every fact is known, so that ' +
          'your organization can meet its own obligations under the Data Privacy Act of 2012.'
      },
      {
        id: 'data',
        heading: 'What data may be involved',
        body: '- [[Ticket records: titles, field values, comments, approval history]]\n' +
          '- [[Names and work email addresses of your users]]\n' +
          '- [[Sign-in records: dates, times, IP addresses]]\n\n' +
          'Not involved: passwords - Daloy does not store passwords; sign-in is through Google. Not known yet: [[what is ' +
          'still being confirmed]].'
      },
      {
        id: 'consequences',
        heading: 'Possible consequences',
        body: '[[Someone outside your organization may have read ticket content. We have no sign that it has been misused.]]'
      },
      {
        id: 'done',
        heading: 'What we have done',
        body: '- [[Worked with the provider, which closed the access on date]]\n' +
          '- [[Changed the access keys Daloy uses with the provider]]\n' +
          '- [[Signed all users out; they sign in again with Google as usual]]\n' +
          '- Recorded the incident; we will keep your administrators updated until it is closed.'
      },
      {
        id: 'what-to-do',
        heading: 'What you should do',
        body: '- Be careful with emails or messages that mention Daloy or ask you to sign in. Daloy never asks for a password ' +
          'by email.\n' +
          '- Administrators: your organization decides whether this must be reported to the National Privacy Commission ' +
          'and to the individuals concerned (generally within 72 hours of knowing, when sensitive personal information or ' +
          'information that could enable identity fraud is involved and there is a real risk of serious harm) [[counsel: ' +
          'confirm wording and the current NPC circular]]. We will give you the information you need for that report.'
      },
      { id: 'contact', heading: 'Contact', body: CONTACT_LINE + ' Next update: [[date / time]].' }
    ]
  }
];

/** Every notice this build knows: the real ones, plus the samples on previews. */
export const allNotices = () => (IS_PREVIEW_BUILD ? [...LOGIN_NOTICES, ...PREVIEW_SAMPLE_NOTICES] : LOGIN_NOTICES);

/** The notice for an id (the /notices/:id page), or null. */
export const noticeById = id => allNotices().find(n => n.id === id) || null;

/** Is the notice meant for a user of these companies? [] on the notice = everyone. */
export const noticeForCompanies = (notice, companyIds = []) => {
  if (!notice.companyIds || notice.companyIds.length === 0) return true;
  const mine = companyIds.map(String);
  return notice.companyIds.some(id => mine.includes(String(id)));
};

/** Inside its banner window: postedAt ≤ now < postedAt + days. Samples are always in their window. */
export const isNoticeInWindow = (notice, now = Date.now()) => {
  if (notice.sample) return true;
  const start = Date.parse(notice.postedAt);
  if (Number.isNaN(start)) return false;
  return now >= start && now < start + (notice.days || NOTICE_DAYS) * DAY_MS;
};

/** The public version exists (publicTitle + publicSections filled in). */
export const hasPublicVersion = notice =>
  Boolean(notice && notice.publicTitle && notice.publicSections && notice.publicSections.length);

/** /notices/<id>/public answers: published (public: true), or any notice with a public text on previews (for review). */
export const isPublicVisible = notice => hasPublicVersion(notice) && (notice.public === true || IS_PREVIEW_BUILD);

/** The /status lines now: every notice in its window with a statusLine (no company filter - the line names no one). */
export const statusNotices = (now = Date.now()) => allNotices().filter(n => n.statusLine && isNoticeInWindow(n, now));

/** The banners to show now for a user of these companies (hiding is applied by the banner). */
export const activeNotices = (companyIds = [], now = Date.now()) =>
  allNotices().filter(n => isNoticeInWindow(n, now) && noticeForCompanies(n, companyIds));
