/**
 * Privacy Policy content for the public /privacy page.
 * Source: docs/planning/PLAN_PrivacyPolicy_DPA_20261101.md (§3-§6). The text below is the PROPOSED DRAFT (phase L2): not legal
 * advice, not in effect, to be reviewed by counsel / the Data Protection Officer. `[[...]]` marks a pending decision (plan §1
 * D1-D10); the page highlights it.
 *
 * Which version a visitor sees (PrivacyPage):
 *   - status 'draft'     -> the draft text on Vercel previews (REACT_APP_VERCEL_ENV = preview) and local development only;
 *                           everywhere else (production) the placeholder - an unapproved policy is never public
 *   - status 'published' -> the text everywhere, with version + effective date (set them, and remove every [[...]])
 * Layer: config (no imports).
 */

export const PRIVACY_POLICY = {
  status: 'draft', // 'draft' | 'published'
  version: '',
  effectiveDate: '',
  title: 'Privacy Policy',
  // What production shows while status is 'draft'
  placeholderIntro: 'Our Privacy Policy is being prepared in line with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173). ' +
    'It will be published here before we collect personal information beyond what is needed to sign in to the app.',
  placeholderContact: 'If you have a question about your personal information in the meantime, contact our Data Protection ' +
    'Officer at jarvis.dpo@blueknight.xyz or the administrator of your organization. You may also reach the National Privacy ' +
    'Commission at privacy.gov.ph.',
  draftNotice: 'DRAFT for review - not in effect. This proposed text follows the Philippine Data Privacy Act of 2012 (RA 10173) and ' +
    'still has to be reviewed by counsel and our Data Protection Officer. Highlighted items are decisions that are still open.',
  sections: [
    {
      id: 'who-we-are',
      heading: 'Who we are and how to contact our Data Protection Officer',
      body: 'This Privacy Policy explains how [[legal name of the company that operates TicketFlow]] ("TicketFlow", "we", "us"), ' +
        'with address at [[registered business address]], collects, uses, shares and protects personal information when you visit ' +
        'our website or use the TicketFlow application.\n\n' +
        'Our Data Protection Officer (DPO) can be reached at jarvis.dpo@blueknight.xyz or by mail at [[DPO mailing address]]. ' +
        'Please contact the DPO for any question or request about your personal information.'
    },
    {
      id: 'scope',
      heading: 'What this policy covers',
      body: 'This policy covers our website, the TicketFlow application, signing in, and the emails we send.\n\n' +
        'TicketFlow is used by organizations (for example, your employer) to run their own forms, tickets and approval workflows. For ' +
        'your account, sign-in, our website and billing, we decide how personal information is used: we are the personal information ' +
        'controller. For the content an organization puts into TicketFlow - its tickets, form answers, workflow history and the ' +
        'profiles of its users - we process personal information on that organization\'s behalf and on its instructions: the ' +
        'organization is the personal information controller and we are its personal information processor. The organization\'s own ' +
        'privacy policy applies to that content, and requests about it are best sent to the organization first; we will help it respond.'
    },
    {
      id: 'what-we-collect',
      heading: 'What personal information we collect',
      body: '- Account and sign-in: when you sign in with Google, we receive your name, email address, profile photo link, a unique ' +
        'account identifier and the time you signed in.\n' +
        '- Profile set up by your organization: display name, work email, phone number, employment dates, your approvers and your ' +
        'account status.\n' +
        '- Preferences: settings such as display time zone, dark mode and whether you receive email notifications.\n' +
        '- Tickets and workflows: whatever your organization\'s forms ask for, the actions you take (submitted, approved, returned) and ' +
        'comments. Depending on the form, this can include sensitive personal information such as health details in a leave request ' +
        'or a government ID number - only as your organization decides.\n' +
        '- Notifications: the in-app notices and emails sent to you about tickets.\n' +
        '- Security and activity logs: who did what and when, and sign-in records [[decision: whether the IP address of a sign-in is kept]]; ' +
        'our hosting provider also keeps technical request logs.\n' +
        '- Billing: for organizations that subscribe, the billing contact and invoice details.\n' +
        '- Messages you send us.'
    },
    {
      id: 'why',
      heading: 'Why we use it and on what lawful basis',
      body: '- To provide the TicketFlow service you or your organization signed up for - the contract with your organization ' +
        '(Data Privacy Act, Section 12(b)).\n' +
        '- To keep accounts and data secure, prevent misuse and fix problems - our legitimate interests (Section 12(f)), balanced ' +
        'against your rights.\n' +
        '- To meet legal obligations, such as keeping invoices for tax purposes and responding to lawful requests (Section 12(c)).\n' +
        '- With your consent, for anything optional we may offer later, such as newsletters. You can withdraw consent at any time.\n\n' +
        'Sensitive personal information in tickets is processed only as instructed by the organization that collects it, which is ' +
        'responsible for its lawful basis under Section 13. We use only what each purpose needs.'
    },
    {
      id: 'sharing',
      heading: 'Who receives it, including service providers',
      body: '- Your organization and its users, according to the visibility rules your organization sets for each type of ticket.\n' +
        '- Our service providers, who process data for us under agreements that require them to protect it: Google (Google ' +
        'Workspace / Sheets, Apps Script, Firebase Authentication and email sending) and Vercel (website and application hosting) ' +
        '[[confirm the provider list and their data processing terms]].\n' +
        '- Government authorities, when the law requires it.\n\n' +
        'We do not sell personal information.'
    },
    {
      id: 'transfers',
      heading: 'Where it is stored and processed',
      body: 'Your personal information is stored and processed on the servers of our service providers, which may be located outside ' +
        'the Philippines [[confirm the storage regions]]. We remain responsible for personal information we transfer to them, as ' +
        'required by Section 21 of the Data Privacy Act, and we rely on their contractual and security commitments.'
    },
    {
      id: 'retention',
      heading: 'How long we keep it',
      body: 'We keep personal information only as long as needed for the purposes above:\n' +
        '- Your account: while it is active in an organization, then as your organization instructs.\n' +
        '- Tickets and form answers: for as long as your organization subscribes and as it instructs; when a subscription ends, we ' +
        'return or delete the organization\'s data within [[90]] days.\n' +
        '- Security and sign-in logs: [[1 year]].\n' +
        '- Email delivery records: [[90 days]] after sending.\n' +
        '- Billing records: for the period required by tax law [[confirm the period]].\n\n' +
        'Where records must be kept for accountability (for example, who approved a request), we remove or replace the personal ' +
        'details instead of deleting the record.'
    },
    {
      id: 'security',
      heading: 'How we protect it',
      body: 'We use organizational, physical and technical measures to protect personal information, including: sign-in through ' +
        'Google verified on our servers; access by invitation only; permissions by role, with administrator functions limited to ' +
        'administrators; tickets and fields marked Restricted shown only to the people in their approval chain; audit logs of ' +
        'administrator actions; encrypted connections (HTTPS); and sessions that end after [[12]] hours. No system is completely ' +
        'secure, and we review these measures regularly.'
    },
    {
      id: 'rights',
      heading: 'Your rights as a data subject and how to exercise them',
      body: 'Under the Data Privacy Act you have the right to be informed, to access your personal information, to object, to have ' +
        'inaccurate information corrected, to have it erased or blocked, to data portability, to claim damages, and to file a ' +
        'complaint with the National Privacy Commission (privacy.gov.ph).\n\n' +
        'To exercise a right, contact our DPO at jarvis.dpo@blueknight.xyz. For content your organization put into TicketFlow, you may also ' +
        'contact your organization\'s administrator. We will verify your identity and respond within [[15 working days - confirm the ' +
        'period]]. Where a record must be kept, erasure means we remove or replace your personal details while keeping the record.'
    },
    {
      id: 'breach',
      heading: 'What we do if a personal data breach happens',
      body: 'If a personal data breach occurs that the law requires us to report, we will notify the National Privacy Commission and ' +
        'the affected individuals within 72 hours of becoming aware of it. For personal information we process on behalf of an ' +
        'organization, we will notify that organization without delay so it can meet its own obligations.'
    },
    {
      id: 'cookies',
      heading: 'Cookies and browser storage',
      body: 'We do not use advertising or analytics cookies. The application stores, in your browser, what it needs to keep you ' +
        'signed in (through Google Firebase) and your display preferences.'
    },
    {
      id: 'children',
      heading: 'Children',
      body: 'TicketFlow is meant for business users aged 18 and over. It is not intended for children, and we do not knowingly ' +
        'collect their personal information. If you believe a child\'s information was provided to us, contact our DPO.'
    },
    {
      id: 'changes',
      heading: 'Changes to this policy',
      body: 'We may update this policy. The version and effective date at the top show the latest one. For important changes, we ' +
        'will tell you in the application or by email [[at least 15 days]] before they take effect.'
    }
  ]
};
