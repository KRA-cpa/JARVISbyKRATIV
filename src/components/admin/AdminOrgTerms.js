import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { API } from '../../api/googleSheet';
import { TERMS_OF_SERVICE } from '../../config/legal/terms';
import { DATA_PROCESSING_AGREEMENT } from '../../config/legal/dpa';
import { IS_PREVIEW_BUILD } from '../../config/platform';
import { formatDateTime } from '../../utils/dateTime';

/**
 * AdminOrgTerms - Admin → Organization Terms: an organization admin accepts the General Terms of Service and the Data
 * Processing Agreement for a company, and sees who accepted which version when (docs/planning/CHECK_PrivacyCompliance_
 * 20261115.md #10). Server: /api/rpc getOrgTermsStatus / acceptOrgTerms (Postgres; admin of that company, checked on the
 * server). Accepting is offered when both documents are published - on previews also for the drafts (test data).
 * Until the server can record it (migration Phase 4) the screen says so; nothing is recorded in the browser.
 * Layer: admin component (context, api, config, utils).
 */

const docsReady = () => (TERMS_OF_SERVICE.status === 'published' && DATA_PROCESSING_AGREEMENT.status === 'published') || IS_PREVIEW_BUILD;

const Accepted = ({ label, entry, current }) => (
  <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
    <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
    {entry ? (
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        Version {entry.version} accepted {formatDateTime(entry.accepted_at)} by {entry.accepted_by_email || entry.accepted_by}
        {entry.version !== current && <span className="ml-1 font-semibold text-amber-700 dark:text-amber-300">(current version {current} - accept again)</span>}
      </p>
    ) : <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Not accepted yet (current version {current}).</p>}
  </div>
);

const AdminOrgTerms = () => {
  const { userCompanies } = useUser();
  const companies = userCompanies || [];
  const [companyId, setCompanyId] = useState(companies[0] ? String(companies[0].id) : '');
  const [status, setStatus] = useState(null);
  const [serverDown, setServerDown] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const company = companies.find(c => String(c.id) === companyId);
  const terms = TERMS_OF_SERVICE.version;
  const dpa = DATA_PROCESSING_AGREEMENT.version;

  const load = useCallback(async () => {
    if (!companyId) return;
    try {
      setStatus(await API.Privacy.getOrgTermsStatus(companyId));
      setServerDown(false);
    } catch (error) {
      setStatus(null);
      // An answer from the privacy server itself (refused / bad input) vs "not available yet" (no database, no /api/rpc)
      setServerDown(!['FORBIDDEN', 'NOT_SIGNED_IN', 'BAD_REQUEST', 'NOT_FOUND'].includes(error.code));
      if (error.code === 'FORBIDDEN') setMessage('Only an administrator of this organization can see or accept its terms.');
    }
  }, [companyId]);

  useEffect(() => { setChecked(false); setMessage(''); load(); }, [load]);

  const accept = async () => {
    setBusy(true);
    setMessage('');
    try {
      await API.Privacy.acceptOrgTerms(companyId, [{ document: 'terms', version: terms }, { document: 'dpa', version: dpa }]);
      setChecked(false);
      setMessage('Accepted and recorded.');
      await load();
    } catch (error) {
      setMessage(error.message || 'Could not record the acceptance.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Organization terms</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
          The agreement between your organization and KRAtiv Solutions: the{' '}
          <Link to="/terms" className="font-medium text-blue-600 hover:underline dark:text-blue-400">General Terms of Service</Link>
          {' '}and the <Link to="/admin/dpa" className="font-medium text-blue-600 hover:underline dark:text-blue-400">Data Processing Agreement</Link>
          {' '}(how KRAtiv handles your organization's data). An administrator accepts them for the organization; Daloy keeps
          who accepted which version and when.
        </p>
      </div>

      {companies.length > 1 && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          Organization
          <select value={companyId} onChange={e => setCompanyId(e.target.value)}
            className="mt-1 block w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700">
            {companies.map(c => <option key={c.id} value={String(c.id)}>{c.name || c.code || c.id}</option>)}
          </select>
        </label>
      )}

      {serverDown ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
          Recording acceptances needs Daloy's new server, which comes with the move to the new database. Nothing is recorded
          yet; your signed agreement with KRAtiv applies until then.
        </p>
      ) : status && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Accepted label="General Terms of Service" entry={status.terms} current={terms} />
          <Accepted label="Data Processing Agreement" entry={status.dpa} current={dpa} />
        </div>
      )}

      {!serverDown && status && docsReady() && company && (
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <label className="flex items-start gap-3 text-sm text-gray-800 dark:text-gray-100">
            <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="mt-1" />
            <span>
              I accept the General Terms of Service (version {terms}) and the Data Processing Agreement (version {dpa}) on
              behalf of <strong>{company.name || company.code || company.id}</strong>, and I am authorized to do so.
              {(TERMS_OF_SERVICE.status !== 'published' || DATA_PROCESSING_AGREEMENT.status !== 'published') && ' (Preview: drafts, test data only.)'}
            </span>
          </label>
          <button type="button" onClick={accept} disabled={!checked || busy}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? 'Saving...' : 'Accept for this organization'}
          </button>
        </div>
      )}
      {message && <p className="text-sm text-gray-700 dark:text-gray-200" role="status">{message}</p>}
    </div>
  );
};

export default AdminOrgTerms;
