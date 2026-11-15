import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { API } from '../../api/googleSheet';
import { PRIVACY_POLICY } from '../../config/legal/privacy';
import { IS_PREVIEW_BUILD } from '../../config/platform';

/**
 * PrivacyNoticeGate - the privacy notice at first sign-in, and again when the Privacy Policy version changes
 * (docs/planning/CHECK_PrivacyCompliance_20261115.md #10). An ACKNOWLEDGEMENT, not consent: the user's organization is
 * the controller of their data (no checkbox; "Continue" records that the notice was shown and read).
 *   - Active when the policy is published, and on previews (draft text, for review).
 *   - Recorded on the server (/api/rpc acknowledgePrivacyNotice, Postgres). Until the server can record it (migration
 *     Phase 4) the browser remembers it (localStorage `daloy.privacyAck.<uid>`), marked unrecorded; the next visit sends
 *     it to the server quietly once that works - the user is not asked again.
 * Layer: shared component (context, api, config).
 */

/** The version string the user acknowledges: the published version, or "draft <last updated>" on previews. */
export const noticeVersion = (policy = PRIVACY_POLICY, preview = IS_PREVIEW_BUILD) => {
  if (policy.status === 'published' && policy.version) return String(policy.version);
  if (!preview) return null;
  return `draft ${policy.lastUpdated || ''}`.trim().replace(/[^A-Za-z0-9._ -]/g, '').slice(0, 40);
};

const keyFor = uid => `daloy.privacyAck.${uid}`;
const readLocal = uid => {
  try { return JSON.parse(window.localStorage.getItem(keyFor(uid)) || 'null'); } catch (e) { return null; }
};
const writeLocal = (uid, value) => {
  try { window.localStorage.setItem(keyFor(uid), JSON.stringify(value)); } catch (e) { /* blocked: this visit only */ }
};

const PrivacyNoticeGate = () => {
  const { user } = useUser();
  const uid = user?.uid || user?.id;
  const version = noticeVersion();
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [doneNow, setDoneNow] = useState(false);

  useEffect(() => {
    if (!uid || !version) return undefined;
    let active = true;
    const local = readLocal(uid);
    (async () => {
      try {
        const status = await API.Privacy.getMyStatus();
        if (!active) return;
        if (status && status.version === version) {
          writeLocal(uid, { version, recorded: true });
          return;
        }
        if (local && local.version === version) {
          // acknowledged earlier while the server couldn't record it: record it now, quietly
          await API.Privacy.acknowledgeNotice(version);
          writeLocal(uid, { version, recorded: true });
          return;
        }
        setShow(true);
      } catch (error) {
        // server can't answer (no database yet / preview): fall back to this browser
        if (active && !(local && local.version === version)) setShow(true);
      }
    })();
    return () => { active = false; };
  }, [uid, version]);

  if (!show || doneNow || !version) return null;

  const acknowledge = async () => {
    setSaving(true);
    let recorded = false;
    try {
      await API.Privacy.acknowledgeNotice(version);
      recorded = true;
    } catch (error) {
      recorded = false;
    }
    writeLocal(uid, { version, recorded });
    setSaving(false);
    setDoneNow(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="privacy-notice-title"
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <h2 id="privacy-notice-title" className="text-xl font-bold text-gray-900 dark:text-white">Your privacy in Daloy</h2>
        <div className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-200">
          <p>
            Daloy keeps the information your organization and you put into it - your profile, your tickets and approvals -
            so your organization's requests can move. Your organization decides how it is used; KRAtiv Solutions runs
            Daloy for it and keeps the data in Singapore.
          </p>
          <p>
            We don't sell your information, we don't use advertising or analytics, and you can download your own data from
            your Profile. Questions: your administrator, or our Data Protection Officer at KRATIV.dpo@blueknight.xyz.
          </p>
          <p>
            Read the full <Link to="/privacy" target="_blank" className="font-medium text-blue-600 hover:underline dark:text-blue-400">Privacy Policy</Link>
            {' '}and the <Link to="/terms" target="_blank" className="font-medium text-blue-600 hover:underline dark:text-blue-400">Terms of Service</Link>.
          </p>
          {PRIVACY_POLICY.status !== 'published' && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">
              Preview: the policy is still a draft ({version}).
            </p>
          )}
        </div>
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={acknowledge} disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
            {saving ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyNoticeGate;
