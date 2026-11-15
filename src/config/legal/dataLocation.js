/**
 * "Where your data is stored" - the data-location statement for NEW clients (migration step 0.10;
 * docs/planning/DISCLOSURE_DataLocation_NewClients_20261115.md - change the text in both places together).
 * User, 15 Nov 2026: "no notice needed. no payng clients for now. or word it for new clients" - shown at sign-up, in the
 * welcome email and in proposals; the full provider list is DPA Annex C (src/config/legal/dpa.js).
 *
 * PROPOSED DRAFT: not legal advice, not in effect. `[[...]]` = pending decision. Shown like the other legal drafts
 * (LegalPage): the text on previews / local development and on /data-location/draft; production /data-location shows
 * the placeholder. Both statements (before / after the move) are here for review; on publishing keep the one in force
 * (B once src/config/platform.js MIGRATION_COMPLETE is true).
 * Layer: config (no imports).
 */

export const DATA_LOCATION_STATEMENT = {
  status: 'draft', // 'draft' | 'published'
  version: '0.1',
  effectiveDate: '',
  lastUpdated: '15 November 2026',
  title: 'Where your data is stored',
  draftPath: '/data-location/draft',
  pendingChange: null,
  placeholderIntro: 'This page will explain where Daloy stores your organization\'s data and which service providers process ' +
    'it. Until it is published, the Data Processing Agreement your administrator accepts lists them.',
  placeholderContact: 'Questions: our Data Protection Officer at KRATIV.dpo@blueknight.xyz.',
  draftNotice: 'DRAFT for review - not in effect. It shows both versions of the statement: before and after the move to ' +
    'our dedicated database. Highlighted items are decisions that are still open.',
  sections: [
    {
      id: 'before-move',
      heading: 'Statement A - for a client who signs up before the move',
      body: 'Daloy\'s application server runs on Google Cloud in Singapore. Your organization\'s data is currently kept in ' +
        'Google Sheets through Google Apps Script, and is moving to a dedicated Postgres database run by Neon, Inc. in ' +
        'Singapore (Amazon Web Services region ap-southeast-1) [[in the coming weeks / by date]].\n\n' +
        'You sign in with your Google account. No provider offers a Philippine region for these services today; Singapore is ' +
        'the nearest. We remain responsible for your data under the Data Privacy Act of 2012.\n\n' +
        'You don\'t need to do anything for the move. We announce the short maintenance window ahead of time; during it, ' +
        'Daloy is read-only.'
    },
    {
      id: 'after-move',
      heading: 'Statement B - after the move',
      body: 'Your organization\'s Daloy data is stored in Singapore: in a managed Postgres database run by Neon, Inc. (Amazon ' +
        'Web Services region ap-southeast-1), with the application server on Google Cloud in Singapore.\n\n' +
        'You sign in with your Google account. No provider offers a Philippine region for these services today; Singapore is ' +
        'the nearest. We remain responsible for your data under the Data Privacy Act of 2012.'
    },
    {
      id: 'own-sheet',
      heading: 'If you prefer your own Google Sheet',
      body: 'Daloy can also run on a Google Sheet in your organization\'s own Google account. Your data then stays where your ' +
        'Google account keeps it - its location is your choice.'
    },
    {
      id: 'own-drive-mail',
      heading: 'Your own Drive and mail',
      body: 'Attachments and notification emails can go through your organization\'s own Google Drive and mail service once ' +
        'you connect them. Those stay under your organization\'s agreements with those providers.'
    },
    {
      id: 'providers',
      heading: 'Our service providers',
      body: '- Google LLC - the application server and scheduled jobs (Google Cloud, Singapore), the website (Firebase Hosting), ' +
        'sign-in with Google, and our own mailbox for invitations and account emails.\n' +
        '- Neon, Inc. - the database (Singapore, on Amazon Web Services).\n' +
        '- Before the move only: Google Sheets / Apps Script (today\'s data store) and Google Firebase Authentication (today\'s ' +
        'sign-in check).\n\n' +
        'The full list is in the Data Processing Agreement (Annex C), which your administrator accepts at sign-up. We tell ' +
        'administrators [[30]] days before we add a new provider.'
    },
    {
      id: 'contact',
      heading: 'Questions',
      body: 'Contact our Data Protection Officer at KRATIV.dpo@blueknight.xyz.'
    }
  ]
};
