/**
 * Data Processing Agreement (DPA) - DRAFT. Part of every customer's subscription contract (Terms "The agreement",
 * docs/planning/PLAN_PrivacyPolicy_DPA_20261101.md D3). Shown ONLY to company / organization admins, on /admin/dpa
 * (user, 1 Nov 2026: "Data processing agreement available only at company/org admin page"); prospects get it on request.
 * PROPOSED DRAFT: not legal advice, not in effect, for counsel / the DPO. `[[...]]` = pending decision.
 * Structure follows the processor-contract contents of the Data Privacy Act IRR (outsourcing / subcontracting
 * provisions) - counsel to confirm the current references.
 * Versioning as the Terms: raise version + lastUpdated on every change; a major change (one that materially diminishes
 * the customer's or KRATIV's rights) needs notice and admin re-acceptance.
 * v0.3 (15 Nov 2026, migration step 0.10 - docs/planning/PLAN_Migration_Unified_20261108.md): Annex B / C, transfers
 * and deletion describe the platform AFTER the full migration (Neon + Cloud Run Singapore, sign-in on our own server,
 * D11 / D13 customer-connected Drive and mail). Publish it in step 3.1, together with src/config/platform.js
 * MIGRATION_COMPLETE; new clients get the statement in docs/planning/DISCLOSURE_DataLocation_NewClients_20261115.md.
 * v0.4 (15 Nov 2026, privacy check): Vercel off Annex C (user: "exclude Vercel in any platforms we use" - previews
 * run on test data only, so Vercel processes no Customer Data).
 * Layer: config (no imports).
 */

export const DATA_PROCESSING_AGREEMENT = {
  status: 'draft',
  version: '0.4',
  effectiveDate: '',
  lastUpdated: '15 November 2026',
  title: 'Data Processing Agreement',
  pendingChange: null,
  draftNotice: 'DRAFT for review - not in effect. This proposed agreement still has to be reviewed by counsel and our Data ' +
    'Protection Officer. Highlighted items are decisions that are still open.',
  sections: [
    {
      id: 'parties',
      heading: 'Parties and purpose',
      body: 'This Data Processing Agreement ("DPA") is between the Customer (the company or organization subscribed to Daloy) as ' +
        'personal information controller, and KRATIV Solutions [[placeholder - confirm the registered name]] ("KRATIV") as ' +
        'personal information processor, under the Data Privacy Act of 2012 (Republic Act No. 10173), its Implementing Rules and ' +
        'Regulations and the issuances of the National Privacy Commission.\n\n' +
        'It forms part of the Customer\'s subscription contract together with the Subscription details and the General Terms of Service. ' +
        'For personal data, this DPA prevails over the Terms.'
    },
    {
      id: 'definitions',
      heading: 'Definitions',
      body: '- Personal Data: personal information and sensitive personal information (and privileged information) in Customer ' +
        'Data, as defined in the Data Privacy Act.\n' +
        '- Processing, Data Subject, Personal Data Breach: as defined in the Data Privacy Act and its rules.\n' +
        '- Sub-processor: a third party KRATIV engages to process Personal Data for the Service.\n' +
        '- Customer Data, Service, Users: as defined in the General Terms of Service.'
    },
    {
      id: 'roles',
      heading: 'Roles and instructions',
      body: 'The Customer decides why and how Personal Data in the Service is processed and is responsible for the lawful basis, ' +
        'for notices to its Users and requesters, and for the accuracy of the data it enters.\n\n' +
        'KRATIV processes Personal Data only on the Customer\'s documented instructions. The Customer\'s instructions are these ' +
        'Terms and this DPA, the Customer\'s configuration of the Service (ticket types, fields, workflows, visibility, ' +
        'Restricted settings) and actions of its administrators in the Service. KRATIV tells the Customer promptly if it believes ' +
        'an instruction breaks the law.\n\n' +
        'KRATIV does not sell Personal Data and does not use it for its own purposes, except anonymous, aggregated usage ' +
        'information that identifies no person or Customer.'
    },
    {
      id: 'details',
      heading: 'Details of the processing (Annex A)',
      body: '- Subject matter and purpose: providing the Daloy ticketing and workflow service - forms, approvals, notifications, ' +
        'reports, exports and support.\n' +
        '- Duration: the subscription, plus the read-only and deletion periods after it ends.\n' +
        '- Data Subjects: the Customer\'s Users (employees, approvers, administrators) and requesters, and people named in ' +
        'tickets.\n' +
        '- Personal Data: names, work email, role and approver relationships, sign-in records, ticket contents and form answers, ' +
        'attachment links, comments and workflow history.\n' +
        '- Sensitive personal information the Customer may enter (for example health details in leave requests, government ID ' +
        'numbers, salary in certificate or payroll requests): only in fields and ticket types the Customer chooses; the Customer ' +
        'should mark them Restricted where its Plan offers it.\n' +
        '- Processing operations: collection through forms, storage, routing to approvers, notifications, reporting, export, ' +
        'deletion.'
    },
    {
      id: 'confidentiality',
      heading: 'Confidentiality of personnel',
      body: 'KRATIV allows access to Personal Data only to personnel who need it to provide or support the Service and who are ' +
        'bound by confidentiality obligations that continue after their engagement ends.'
    },
    {
      id: 'security',
      heading: 'Security measures (Annex B)',
      body: 'KRATIV keeps organizational, physical and technical security measures appropriate to the risk, including:\n\n' +
        '- Sign-in with Google accounts, verified by KRATIV\'s own server; sessions are kept in the KRATIV database and carried ' +
        'by a secure, HTTP-only session cookie, and every request to the backend is checked for a valid session on the server.\n' +
        '- Access by role and ticket visibility (private by default), Restricted tickets and fields, and administrator-only ' +
        'functions.\n' +
        '- Audit logs of administrative and ticket actions.\n' +
        '- Encryption in transit (HTTPS / TLS, including the connection between the application server and the database) and ' +
        'at rest (Google Cloud; Neon on Amazon Web Services).\n' +
        '- Database and service credentials kept in a secrets manager (Google Secret Manager), never in code or messages.\n' +
        '- Session limits (inactivity sign-out and a maximum session length).\n' +
        '- Separation of customers\' data: every database query is limited to the Customer\'s company / organization ' +
        '[[database row-level security on company and organization - planned with the move, step 3.3]] [[note: per-organization ' +
        'admin scoping is planned - PLAN_ServerCore §2; until then the measures in that plan apply]].\n' +
        '- Backups: the database can be restored to any point in the last [[7]] days (the database provider\'s restore window) ' +
        '[[plus a nightly backup - retention to decide]].\n' +
        '- [[Incident response and access reviews - describe the current practice]].\n\n' +
        'KRATIV reviews these measures as the Service changes and will not reduce the overall level of protection.'
    },
    {
      id: 'subprocessors',
      heading: 'Sub-processors (Annex C)',
      body: 'The Customer authorizes KRATIV to use these Sub-processors:\n\n' +
        '- Google LLC - the application server and scheduled jobs (Google Cloud Run and Cloud Scheduler, region asia-southeast1, ' +
        'Singapore); delivery of the website (Firebase Hosting, on Google\'s global network - no Customer Data is stored there); ' +
        'secrets and service logs (Secret Manager, Cloud Logging [[set the log storage region to Singapore before publishing]]); ' +
        'sign-in with Google accounts; and KRATIV\'s own Google Workspace mailbox, which sends invitations and account emails ' +
        '(for example trial and invoice notices).\n' +
        '- Neon, Inc. - the database (managed Postgres, region aws-ap-southeast-1, Singapore). Neon runs on Amazon Web Services, ' +
        'Inc. infrastructure in the same region.\n\n' +
        'Services the Customer connects itself are not KRATIV Sub-processors: its own Google Workspace Drive for attachments, its ' +
        'own mail service for notification emails (Google Workspace, Microsoft 365 or its own mail server), and its own Google ' +
        'Sheet if it keeps its data there (through the Daloy bridge or a dedicated Daloy copy in its Google account). They process ' +
        'data under the Customer\'s own agreements with those providers, and KRATIV accesses them only as far as the Customer\'s ' +
        'connection allows.\n\n' +
        'KRATIV binds each Sub-processor to data-protection obligations no less protective than this DPA and remains responsible ' +
        'to the Customer for them. KRATIV gives the Customer\'s administrators [[30]] days\' notice of a new Sub-processor; the ' +
        'Customer may object on reasonable data-protection grounds and, if no solution is found, end the affected subscription ' +
        'with a pro-rated refund.'
    },
    {
      id: 'transfers',
      heading: 'Transfers outside the Philippines',
      body: 'KRATIV stores Customer Data in Singapore: the database (Neon, region aws-ap-southeast-1) and the application server ' +
        '(Google Cloud, region asia-southeast1). No provider offers a Philippine region for these services today, and Singapore ' +
        'is the nearest.\n\n' +
        'Some processing takes place outside Singapore by the nature of the service: signing in with Google and the delivery of ' +
        'the website use Google\'s global network; emails pass through the mailbox that sends them (KRATIV\'s Google Workspace ' +
        'mailbox, or for notifications the Customer\'s own mail service); and storage the Customer connects itself stays where ' +
        'the Customer\'s provider keeps it.\n\n' +
        'KRATIV remains accountable for Personal Data it transfers (Data Privacy Act, Section 21) and uses contractual and other ' +
        'reasonable means to give it a comparable level of protection.'
    },
    {
      id: 'rights',
      heading: 'Data Subject requests',
      body: 'The Service lets the Customer\'s administrators find, export, correct and delete Personal Data in tickets and user ' +
        'records. If KRATIV receives a request from a Data Subject about Customer Data, it forwards it to the Customer without ' +
        'undue delay and does not answer it itself unless the Customer instructs it to. KRATIV gives reasonable help where the ' +
        'Customer cannot handle a request with the Service\'s own functions.'
    },
    {
      id: 'breach',
      heading: 'Personal Data Breaches',
      body: 'KRATIV notifies the Customer\'s administrators of a Personal Data Breach affecting Customer Data without undue delay ' +
        'and no later than [[24]] hours after becoming aware of it, so that the Customer can meet its own notification duties to ' +
        'the National Privacy Commission and affected Data Subjects [[confirm: 72 hours under the NPC breach rules]].\n\n' +
        'The notice describes, as far as known: what happened, the data and Data Subjects affected, likely consequences, the ' +
        'measures taken or proposed, and a contact person. KRATIV updates the Customer as it learns more, takes reasonable steps ' +
        'to contain the breach, and keeps a record of it.'
    },
    {
      id: 'assistance',
      heading: 'Assistance and compliance information',
      body: 'KRATIV gives reasonable help with the Customer\'s privacy impact assessments, security questions and dealings with ' +
        'the National Privacy Commission about the Service. On request, KRATIV makes available the information needed to show ' +
        'compliance with this DPA (for example this Annex B and a summary of its controls) [[and allows audits by the Customer or ' +
        'its auditor with reasonable notice, at the Customer\'s cost, no more than once a year unless after a breach]].'
    },
    {
      id: 'end',
      heading: 'Return and deletion',
      body: 'When the subscription ends, the Customer can export its data during the [[30]]-day read-only period. KRATIV then ' +
        'deletes the Customer\'s Personal Data within [[90]] days, including copies held by Sub-processors (the database\'s ' +
        'restore history ends [[7]] days after the deletion; service logs expire after [[30]] days), except data it must ' +
        'keep by law (for example billing records), which it keeps protected and only as long as required. On request KRATIV ' +
        'confirms the deletion in writing.\n\n' +
        'For Customer-owned storage (its own Google Sheet), the Customer keeps the Sheet; KRATIV deletes what it holds (sign-in ' +
        'records, logs, cached data) and stops accessing the bridge.'
    },
    {
      id: 'liability',
      heading: 'Liability',
      body: 'Each party\'s liability under this DPA follows the General Terms of Service, except where the law does not allow it to be ' +
        'limited [[confirm the carve-outs with the Terms]].'
    },
    {
      id: 'term',
      heading: 'Term, changes and contact',
      body: 'This DPA applies as long as KRATIV processes Customer Data. Changes follow the General Terms of Service: a major change - one ' +
        'that materially diminishes the rights of the Customer or of KRATIV - is notified at least [[30]] days ahead and an ' +
        'administrator accepts the new version; earlier versions are kept.\n\n' +
        'Data Protection Officer: KRATIV.dpo@blueknight.xyz, [[mailing address]].'
    }
  ]
};
