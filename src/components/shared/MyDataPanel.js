import React, { useState } from 'react';
import { API } from '../../api/googleSheet';
import Icons from './Icons';

/**
 * MyDataPanel - Profile → Your data: "Download my data" (Data Privacy Act right of access / portability;
 * docs/guides/GUIDE_Privacy_RightsRequests.md §4). One call to /api/rpc exportMyData (Postgres): the user's own profile,
 * preferences, privacy acknowledgements, role assignments, notifications and the tickets they requested, as a JSON
 * file. Until the server can answer (migration Phase 4) it says so and points to the DPO.
 * Layer: shared component (api + shared).
 */

const fileName = () => `daloy-my-data-${new Date().toISOString().slice(0, 10)}.json`;

const MyDataPanel = () => {
  const [state, setState] = useState({ busy: false, message: '', error: '' });

  const download = async () => {
    setState({ busy: true, message: '', error: '' });
    try {
      const data = await API.Privacy.exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setState({ busy: false, message: 'Downloaded. The file holds your own data in Daloy.', error: '' });
    } catch (error) {
      setState({
        busy: false, message: '',
        error: 'Download my data isn\'t available yet on this server. Until it is, ask our Data Protection Officer at ' +
          'KRATIV.dpo@blueknight.xyz and we will send it to the email of your account.'
      });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Your data</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Get a copy of your own data in Daloy: your profile, settings, roles, notifications and the tickets you requested.
          Data about you inside your organization's tickets is held for your organization - ask its administrator.
        </p>
      </div>
      <button type="button" onClick={download} disabled={state.busy}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
        <Icons.Download size={16} /> {state.busy ? 'Preparing...' : 'Download my data'}
      </button>
      {state.message && <p className="mt-3 text-sm text-green-700 dark:text-green-300" role="status">{state.message}</p>}
      {state.error && <p className="mt-3 text-sm text-amber-800 dark:text-amber-200" role="status">{state.error}</p>}
    </div>
  );
};

export default MyDataPanel;
