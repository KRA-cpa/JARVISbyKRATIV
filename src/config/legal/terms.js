/**
 * General Terms of Service content for the public /terms page.
 * Source: docs/planning/DRAFT_TermsOfService_20261101.md (v0.4 - its §0 holds the open decisions T1-T13 and the
 * acceptance-record requirements; change the text in both places together). PROPOSED DRAFT: not legal advice, not in
 * effect, to be reviewed by counsel. `[[...]]` marks a pending decision; the page highlights it.
 *
 * Which version a visitor sees (LegalPage, same rules as the Privacy Policy):
 *   - status 'draft'     -> the draft text on Vercel previews and local development, and on /terms/draft; production
 *                           /terms shows the placeholder with a link to the draft
 *   - status 'published' -> the text everywhere, with version + effective date (set them, and remove every [[...]])
 * Layer: config (no imports).
 */

export const TERMS_OF_SERVICE = {
  status: 'draft', // 'draft' | 'published'
  version: '0.10', // = the DRAFT_TermsOfService version; archive the old object before changing published text (termsArchive.js)
  effectiveDate: '',
  lastUpdated: '1 November 2026',
  title: 'General Terms of Service',
  draftPath: '/terms/draft',
  historyPath: '/terms/versions',
  // Notice of a MAJOR change (Terms §17: [[30]] days ahead; admins re-accept): null = none. When set, /terms shows an
  // "Upcoming change" box and every page footer links to it: { version, noticeDate, effectiveDate, summary: [...], path }
  pendingChange: null,
  placeholderIntro: 'Our General Terms of Service are being prepared. They will form part of the subscription contract of every company ' +
    'or organization that signs up for Daloy, and will be published here before paid plans start.',
  placeholderContact: 'For a question about subscribing in the meantime, use the Contact page or ask the administrator of your organization.',
  draftNotice: 'DRAFT for review - not in effect. This proposed text still has to be reviewed by counsel. Highlighted items are ' +
    'decisions that are still open.',
  sections: [
    {
      id: 'agreement',
      heading: 'The agreement',
      body: 'These General Terms of Service ("Terms") are between KRATIV Solutions [[placeholder - confirm the registered name]] ' +
        '("KRATIV", "we", "us"), with address at [[registered address]], and the company or organization that signs up for Daloy ' +
        '("Customer", "you").\n\n' +
        'These Terms form part of the Customer\'s subscription contract. When the Customer signs up (including a trial), the ' +
        'subscription contract is made up of the Subscription details shown and accepted at sign-up (plan, period, packs, ' +
        'allowances and prices), these Terms and the Data Processing Agreement. The person who accepts confirms they have ' +
        'authority to bind the Customer. If an organization signs up, the contract covers every company it adds to its account; ' +
        'an organization admin may accept on behalf of those companies. We keep a record of who accepted which versions and ' +
        'when, and the Customer can view it in the Service. The Data Processing Agreement is available to the ' +
        'Customer\'s administrators on the admin page of the Service, and to prospective customers on request.'
    },
    {
      id: 'definitions',
      heading: 'Definitions',
      body: '- Service or Daloy: the Daloy ticketing and workflow application, its website, templates and related support.\n' +
        '- Organization: the Customer\'s account that owns the data store and groups one or more Companies.\n' +
        '- Users: people the Customer allows to use the Service (employees, approvers, administrators, requesters).\n' +
        '- Customer Data: everything the Customer and its Users put into the Service - tickets, form answers, workflow history, ' +
        'attachment links, user lists and settings.\n' +
        '- Plan: the subscription level (Basic, Basic+, Advanced, Enterprise) with its features and allowances.\n' +
        '- Pack: a set of request templates for one area (for example the Payroll pack and the HR pack).\n' +
        '- Usage Add-ons: charges for use above a Plan\'s allowances.'
    },
    {
      id: 'service',
      heading: 'The Service',
      body: 'We provide the Service according to the Customer\'s Plan. A higher Plan includes the features of the lower Plans.\n\n' +
        'Proof-of-concept status. The Service currently stores data in Google Sheets through Google Apps Script. It is provided ' +
        'without a service-level commitment [[T6: no SLA for now]]. We will tell Customers before we move data to another storage ' +
        'system and will not reduce the protection of Customer Data when we do.\n\n' +
        'Templates and Packs are starting points. Their fields, lists (such as leave types) and steps are not legal, tax or HR ' +
        'advice. The Customer decides how to use them and is responsible for its own policies.\n\n' +
        'Payroll and leave rules are outside the Service. Daloy records, routes and exports requests (for example leave, overtime, ' +
        'non-punching and Manual DTR requests). It does not compute pay, hours, premiums, deductions or leave balances. Results ' +
        'computed by the Customer or its payroll system from Daloy exports are the Customer\'s responsibility.\n\n' +
        'We may improve, change or retire features. We will not remove a core feature of a paid Plan during a paid period ' +
        'without notice and a fair alternative or refund for the remaining period.'
    },
    {
      id: 'accounts',
      heading: 'Accounts and Users',
      body: 'The Customer names at least one administrator, controls who is invited, and assigns roles.\n\n' +
        'Users sign in with Google accounts. The Customer is responsible for its Users\' accounts, for keeping access current ' +
        '(removing people who leave) and for everything done under its Users\' accounts.\n\n' +
        'Users must be at least 18 years old (see Customer attestations).'
    },
    {
      id: 'attestations',
      heading: 'Customer attestations',
      body: 'By accepting these Terms - at sign-up, and again each time it renews, changes Plan or accepts a new version - the ' +
        'Customer confirms that:\n\n' +
        '- The Customer is a business, government office or other organization (not an individual consumer), validly existing and, where the law requires, registered (for example with the SEC, DTI or BIR).\n' +
        '- The person accepting these Terms is authorized to bind the Customer, and for an organization, each company it adds.\n' +
        '- The information given at sign-up and for billing (names, addresses, TIN, VAT status, withholding agent status and creditable withholding tax rates, contacts) is true and complete, and the Customer keeps it up to date.\n' +
        '- Every User is at least 18 years old and uses the Service for the Customer\'s business.\n' +
        '- The Customer has a lawful basis and has given the required notices for the personal information it and its Users put into the Service, including sensitive personal information (Data Privacy Act), and has the right to share the rest of the Customer Data.\n' +
        '- The Customer\'s use of the Service, its templates and its exports (for example leave, overtime and payroll requests) complies with the laws that apply to it, including labor, tax and data privacy laws; the Customer remains responsible for its own policies and decisions.\n' +
        '- The Customer keeps its administrator list and User access current and removes people who should no longer have access.\n' +
        '- The Customer will not use the Service in breach of the Acceptable use section, and is not barred by law or sanctions from using it.' +
        '\n\nIf any of these stops being true, the Customer tells us promptly. A materially false attestation is a material ' +
        'breach of these Terms.'
    },
    {
      id: 'plans',
      heading: 'Plans, trials and changes of Plan',
      body: 'Trials. We may offer a trial for a set period. A trial ends on its end date; without a paid Plan the account enters a ' +
        'short grace period and then becomes read-only.\n\n' +
        'Upgrades take effect when confirmed. Downgrades take effect at the end of the current period; nothing is deleted because ' +
        'of a downgrade, but creating more than the lower Plan allows is not possible.\n\n' +
        'Packs. Basic+ includes the Payroll and HR packs. On Advanced and Enterprise the Customer may turn each pack on or off. ' +
        'Turning a pack off stops new requests of its types; existing requests remain readable and can finish.'
    },
    {
      id: 'fees',
      heading: 'Fees, statements and taxes',
      body: 'Fees are as stated in the Subscription details [[T4: prices, VAT treatment]]. Plans are billed per period in advance; ' +
        'Usage Add-ons are billed in arrears.\n\n' +
        'We send a usage statement each month. Official invoices are issued [[through our accounting / billing system, in ' +
        'compliance with BIR rules]].\n\n' +
        'Payment is due within [[15]] days. Fees are [[exclusive]] of VAT and other taxes.\n\n' +
        'Philippine taxes. Daloy is provided by KRATIV, a Philippine taxpayer, from the Philippines. The fees and the income KRATIV earns from them are covered by the Philippine tax laws (the National Internal Revenue Code, as amended, and the rules of the Bureau of Internal Revenue), including income tax and VAT or percentage tax as they apply. Where the Customer is required by law to withhold creditable withholding tax on its payments to KRATIV, it withholds at the rate the law sets, pays it to the BIR, and gives KRATIV the certificate (BIR Form 2307) within the period the BIR requires; the amount withheld counts as paid once KRATIV receives the certificate. The Customer tells KRATIV, at sign-up and within [[15]] days of any change, whether it is a withholding agent (and its classification, for example a top withholding agent or a government office) and the creditable withholding tax rate(s) it applies to KRATIV\'s fees; statements show the expected amount net of that withholding. Until KRATIV is told, it treats the Customer as not withholding, and an amount withheld without notice and certificate remains due. The Customer is responsible for its own taxes.\n\n' +
        'Fees paid are non-refundable except where these Terms or the law say otherwise.'
    },
    {
      id: 'usage',
      heading: 'Usage allowances, add-ons, waivers and credits',
      body: 'Each Plan includes allowances (for example users and tickets per month). If the Customer goes above an allowance, it ' +
        'may keep working and pay Usage Add-ons in blocks, as published for its Plan, instead of being required to upgrade. ' +
        'Features of a higher Plan still require that Plan.\n\n' +
        'How usage is counted is shown next to each number on the Customer\'s Usage & charges page [[final counting rules]].\n\n' +
        'No surprises. The Customer\'s administrators can see current usage, a month-end projection and the list of counted users ' +
        'and tickets at any time, receive alerts as usage approaches and passes an allowance, and can choose to stop at the ' +
        'allowance or set a monthly spending cap. We do not charge Usage Add-ons that were not shown on the Usage & charges page ' +
        'during the month.\n\n' +
        'Technical limits of the storage system may cap usage regardless of Plan; we will tell the Customer before a technical ' +
        'limit is reached.\n\n' +
        'Waivers and credits. We may, at our discretion, raise or waive a limit, waive or reduce fees or Usage Add-ons, or give ' +
        'credits for a Customer. A waiver applies only as recorded in the Customer\'s Subscription details or on its Usage & ' +
        'charges page or statement, for the scope and period stated there (if no end is stated, until the end of the current ' +
        'subscription period). A waiver is not a change to the Plan or prices, does not entitle the Customer to the same waiver ' +
        'later, and can be ended for future periods with [[30]] days\' notice. A waiver or deduction of an amount is given either ' +
        'as a discount on the invoice for that period or by a credit memo issued to the Customer, which reduces amounts the ' +
        'Customer owes; it is not paid out in cash unless we agree otherwise in writing.'
    },
    {
      id: 'data',
      heading: 'Customer Data',
      body: 'Ownership. The Customer owns Customer Data. We use it only to provide, secure, support and improve the Service, as ' +
        'described in the Privacy Policy and the Data Processing Agreement.\n\n' +
        'Roles under the Data Privacy Act. For Customer Data that is personal information, the Customer is the personal ' +
        'information controller and we are its personal information processor (Republic Act No. 10173). The Data Processing ' +
        'Agreement forms part of the subscription contract.\n\n' +
        'Customer responsibilities. The Customer has a lawful basis for the personal information it puts into the Service, gives ' +
        'the notices its Users and requesters need, and marks sensitive requests (for example health or salary details) as ' +
        'Restricted where its Plan offers it.\n\n' +
        'Customer-owned storage. If the Customer keeps Customer Data in its own Google Sheet through a Daloy bridge in its Google ' +
        'Workspace: the Customer is responsible for its Google account, its Workspace settings, access to the Sheet and the ' +
        'bridge, and Google\'s terms; the Customer and its Users must not edit the Sheet directly - direct edits bypass the ' +
        'Service\'s permissions, audit log and locks, and we are not responsible for data changed or lost that way; and the ' +
        'Service still processes Customer Data while it works on it.\n\n' +
        'Limited access to Customer-owned storage. The Customer may limit or end the Service\'s access to its own data store at any time - for example by removing or changing the bridge, removing sharing, making the Sheet read-only, or a Workspace setting that blocks the bridge. This is the Customer\'s right and not a breach. While access is limited: the parts of the Service that need the data store do not work (new requests, approvals, notifications, escalations and exports may stop or be delayed), and this is not a failure of the Service and is excluded from any service level; fees and Usage Add-ons for the period remain due, and statements, invoices, payments and credit memos are issued, received and recorded as usual, because subscription, billing and payment records are kept by KRATIV outside the Customer\'s data store; we notify the Customer\'s administrators promptly when the data store stops answering; and the Customer answers requests from data subjects about data in its own data store directly, with our help for the data we hold. When access is restored, the Service checks the data store and resumes; overdue escalations are sent as a summary. If access is not restored within [[30]] days, we may suspend the subscription and later end it under Term and termination; the Customer keeps its data store, and we delete only the data we hold, under the retention rules.\n\n' +
        'Export. The Customer can export its data (reports, CSV exports) while its account is active or read-only.\n\n' +
        'Aggregated information. We may use anonymous, aggregated usage information (that identifies no Customer or person) to ' +
        'run and improve the Service.'
    },
    {
      id: 'read-only',
      heading: 'Grace period, read-only and suspension',
      body: 'If a period ends without renewal, or a statement or invoice is unpaid when due, the Customer keeps its Plan for a ' +
        'grace period ([[14]] days; [[7]] after a trial). After that the account becomes read-only: Users can sign in, view and ' +
        'export, but cannot create or approve requests. Requests already in progress may finish.\n\n' +
        'We may suspend access immediately, with notice, if needed to stop a security threat, unlawful use or use that harms the ' +
        'Service or other customers, limited to what is necessary.\n\n' +
        'Suspension or read-only status does not delete Customer Data.'
    },
    {
      id: 'acceptable-use',
      heading: 'Acceptable use',
      body: 'The Customer and its Users must not: break the law or others\' rights; upload malware or attack the Service; try to ' +
        'access other customers\' data or bypass plan limits, permissions or security; resell the Service without our written ' +
        'consent; use the Service to send spam; or put information in the Service that they have no right to share.'
    },
    {
      id: 'third-parties',
      heading: 'Third-party services',
      body: 'The Service relies on providers such as Google (Workspace, Sheets, Apps Script, Firebase sign-in), Vercel (hosting) ' +
        'and [[others]]. Their services are subject to their own terms. We choose providers with appropriate safeguards and remain ' +
        'responsible to the Customer for the parts of the Service we provide.'
    },
    {
      id: 'ip',
      heading: 'Intellectual property',
      body: 'We own the Service, the Daloy name and logo, and the templates as provided. The Customer receives a non-exclusive, ' +
        'non-transferable right to use the Service during its subscription.\n\n' +
        'The Customer owns its Customer Data and its own adapted templates\' content. Suggestions the Customer gives us may be ' +
        'used to improve the Service without obligation.'
    },
    {
      id: 'confidentiality',
      heading: 'Confidentiality',
      body: 'Each party keeps the other\'s non-public business information confidential, uses it only for these Terms, and shares ' +
        'it only with people who need it and are bound by similar duties - except information that is public, already known, ' +
        'independently developed, or required by law to be disclosed (with notice where allowed).'
    },
    {
      id: 'warranties',
      heading: 'Warranties and disclaimers',
      body: 'We will provide the Service with reasonable skill and care and keep reasonable security measures. Otherwise the ' +
        'Service is provided "as is" and "as available". We do not promise that it will be uninterrupted or error-free, or that ' +
        'templates meet any particular legal requirement.'
    },
    {
      id: 'liability',
      heading: 'Limitation of liability',
      body: 'Neither party is liable for indirect or consequential losses, lost profits or lost data that could have been avoided ' +
        'by the other party\'s reasonable measures (including keeping its own exports).\n\n' +
        'Each party\'s total liability under these Terms is limited to the fees the Customer paid in the 12 months before the ' +
        'event giving rise to the claim.\n\n' +
        'These limits do not apply to liability that the law does not allow to be limited, including fraud, bad faith or gross ' +
        'negligence, to the Customer\'s payment obligations, or to breaches of confidentiality or the Data Processing Agreement ' +
        '[[confirm carve-outs]].'
    },
    {
      id: 'indemnity',
      heading: 'Indemnity',
      body: 'The Customer will defend and hold us harmless from third-party claims arising from Customer Data or from use of the ' +
        'Service in breach of these Terms. We will defend the Customer from third-party claims that the Service, as we provide ' +
        'it, infringes their intellectual property rights.'
    },
    {
      id: 'termination',
      heading: 'Term and termination',
      body: 'These Terms apply from sign-up until the subscription ends. Either party may end the subscription at the end of a ' +
        'period by notice in the Service or in writing. Either party may terminate if the other materially breaches these Terms ' +
        'and does not fix the breach within [[30]] days of notice.\n\n' +
        'After termination the account stays read-only for [[30]] days so the Customer can export its data; Customer Data is then ' +
        'deleted within [[90]] days, except records we must keep by law (for example billing records).\n\n' +
        'Sections that by their nature should survive (fees owed, Customer Data, confidentiality, liability, governing law) ' +
        'survive termination.'
    },
    {
      id: 'changes',
      heading: 'Changes to these Terms',
      body: 'We may update these Terms. The "Last updated" date at the top shows when they last changed, and every version is ' +
        'kept unchanged in the version history.\n\n' +
        'A major change is one that materially diminishes the rights of the Customer or of KRATIV under these Terms. We give ' +
        'notice of a major change at least [[30]] days before it takes effect: on this page (an "Upcoming change" notice with a ' +
        'summary and the effective date), in the footer of every page, and in the Service or by email to the Customer\'s ' +
        'administrators, and we ask an administrator to accept the new version. If the Customer does not accept a major change, ' +
        'it may end its subscription before the change takes effect and receive a pro-rated refund of prepaid fees; until the ' +
        'change takes effect the earlier version applies.\n\n' +
        'Other changes (clarifications, corrections, new features, changes required by law) take effect when published; the ' +
        '"Last updated" date and the version history show them.'
    },
    {
      id: 'general',
      heading: 'General',
      body: '- Force majeure: neither party is liable for delay caused by events beyond its reasonable control, except payment obligations.\n' +
        '- Notices: to the Customer\'s administrators by email or in the Service; to us at [[legal / support address]].\n' +
        '- Electronic acceptance has the same effect as a signature (Electronic Commerce Act, RA 8792).\n' +
        '- Assignment: neither party may assign these Terms without consent, except to a successor of its business.\n' +
        '- Entire agreement: the subscription contract (the Subscription details, these Terms and the Data Processing Agreement) is ' +
        'the whole agreement; the Privacy Policy describes how we process personal information. If they conflict, the Subscription ' +
        'details prevail, then the Data Processing Agreement (for personal data), then these Terms.\n' +
        '- Severability and no waiver: an invalid clause does not affect the rest; not enforcing a right is not a waiver.\n' +
        '- Governing law and disputes: Philippine law. The parties first try to settle a dispute in good faith for [[30]] days; if ' +
        'not settled, the dispute goes exclusively to the proper courts of Mandaluyong City, Metro Manila.\n' +
        '- Language: English prevails over any translation.'
    },
    {
      id: 'contact',
      heading: 'Contact',
      body: 'KRATIV Solutions [[placeholder]], [[address]] - [[support email]]. Data Protection Officer: jarvis.dpo@blueknight.xyz.'
    }
  ]
};
