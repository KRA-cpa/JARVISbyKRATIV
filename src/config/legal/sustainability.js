/**
 * "Sustainability & responsibility" - the public ESG page (docs/planning/PLAN_ESGPage_20261115.md, phase E1).
 * PROPOSED DRAFT, shown like the legal drafts (LegalPage): the text on previews / local development and on
 * /sustainability/draft; production /sustainability shows the placeholder until published (E3, after counsel's look at
 * the environmental wording). `[[...]]` = pending item.
 * Honesty rules (plan §3): only what is true for Daloy; Google's figures attributed to Google with their year; no
 * "green" / "carbon neutral" / "net zero" claims; the Singapore trade-off stated; estimates labelled.
 * Figures: Google region data 2024 (GoogleCloudPlatform/region-carbon-info) - update yearly.
 * Layer: config (no imports).
 */

export const SUSTAINABILITY_STATEMENT = {
  status: 'draft', // 'draft' | 'published'
  version: '0.1',
  effectiveDate: '',
  lastUpdated: '15 November 2026',
  title: 'Sustainability & responsibility',
  draftPath: '/sustainability/draft',
  pendingChange: null,
  placeholderIntro: 'This page will set out how Daloy handles the environment, people and accountability (ESG), with the ' +
    'source of every figure. It is being prepared.',
  placeholderContact: 'Questions: our Data Protection Officer at KRATIV.dpo@blueknight.xyz.',
  draftNotice: 'DRAFT for review - not published. Plain facts about Daloy with their sources; highlighted items are still open.',
  sections: [
    {
      id: 'intro',
      heading: 'About this page',
      body: 'How Daloy handles the environment, people and accountability - often called ESG (environmental, social, ' +
        'governance). We state what is true for Daloy today, with the source and year of each figure, including the parts ' +
        'that are not flattering.'
    },
    {
      id: 'environment-where',
      heading: 'Environmental: where Daloy runs and what powers it',
      body: 'Daloy runs on Google Cloud and a Neon database, both in Singapore. No provider offers a Philippine region for ' +
        'these services; Singapore is the nearest, which keeps Daloy fast for users in the Philippines and keeps data in Asia.\n\n' +
        'Singapore\'s electricity is mostly gas-fired. Google reports that 4% of the energy its Singapore region used in 2024 ' +
        'was carbon-free, hour by hour, and that the local grid emitted about 367 g CO2e per kWh. Some other Google regions ' +
        'are far cleaner (for example Oregon and Iowa in the United States: 87% carbon-free in 2024). We chose Singapore for ' +
        'speed and data location, and we say so plainly: per unit of computing, Daloy\'s region is not a low-carbon one.'
    },
    {
      id: 'environment-light',
      heading: 'Environmental: small by design',
      body: '- The application server runs only while it handles requests and scales to zero when idle.\n' +
        '- The database pauses after five minutes without use.\n' +
        '- No advertising, no analytics and no tracking scripts: nothing runs in your browser or on our servers to profile users.\n' +
        '- Attachments stay in your organization\'s own Google Drive - Daloy keeps no second copy.'
    },
    {
      id: 'environment-footprint',
      heading: 'Environmental: our footprint',
      body: 'Daloy\'s computing use is small. [[Measured monthly emissions from Google Cloud\'s Carbon Footprint report - added ' +
        'after the first full month of data]]. The database runs on Amazon Web Services, which does not publish figures per ' +
        'region; we will show that part as an estimate and label it as one.\n\n' +
        'We buy no carbon offsets and make no "carbon neutral" or "net zero" claim.'
    },
    {
      id: 'environment-next',
      heading: 'Environmental: what we will do',
      body: '- Review our hosting regions every year, with Google\'s new figures.\n' +
        '- Move to a Philippine region, or a lower-carbon Asian region, when one fits on speed, price and data location.\n' +
        '- Keep the service light: no feature that needs servers running around the clock without a reason.'
    },
    {
      id: 'social',
      heading: 'Social: people and their data',
      body: '- Privacy: we follow the Philippine Data Privacy Act of 2012. Your organization decides how its data is used; we ' +
        'process it for your organization, keep it in Singapore, and never sell it. See the Privacy Policy and "Where your ' +
        'data is stored".\n' +
        '- Sensitive information: organizations can mark request types and fields as Restricted, so only the people in the ' +
        'approval chain see them.\n' +
        '- Your own data: every user can download a copy of their own data from their Profile.\n' +
        '- If something goes wrong: we tell the organizations concerned about security incidents, including incidents at our ' +
        'providers that did not affect them, and keep every notice available to their administrators.\n' +
        '- Accessibility: keyboard use, labels for screen readers, light and dark modes [[accessibility check of the main ' +
        'screens - results and known gaps to be listed here]].\n' +
        '- Local: Daloy is built and supported in the Philippines by KRAtiv Solutions.'
    },
    {
      id: 'governance',
      heading: 'Governance: who is accountable, and how',
      body: '- Responsible: KRAtiv Solutions, and its Data Protection Officer (KRATIV.dpo@blueknight.xyz).\n' +
        '- Agreements: the General Terms of Service and, for each organization, a Data Processing Agreement that lists our ' +
        'service providers (Google and Neon).\n' +
        '- Access by our staff: staff do not open an organization\'s tickets without that organization\'s permission; staff ' +
        'actions are recorded.\n' +
        '- Records: every approval, change and administrator action is logged; sessions end after inactivity and can be ' +
        'ended by us during a security incident.\n' +
        '- Service status: provider outages and maintenance are shown on our Service status page.'
    },
    {
      id: 'sources',
      heading: 'Sources and method',
      body: '- Carbon-free energy and grid emissions per Google Cloud region: Google, "region-carbon-info" data for 2024 ' +
        '(Singapore: 0.04 carbon-free energy, 366.85 g CO2e per kWh).\n' +
        '- Daloy\'s own emissions: Google Cloud Carbon Footprint report for our project [[from the first full month]]; the ' +
        'database part estimated from its running hours and the Singapore grid figure.\n' +
        '- Reviewed once a year and whenever our hosting changes.'
    },
    {
      id: 'contact',
      heading: 'Contact',
      body: 'Questions about this page: KRATIV.dpo@blueknight.xyz.'
    }
  ]
};
