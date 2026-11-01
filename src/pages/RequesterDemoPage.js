import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icons from '../components/shared/Icons';
import BrandMark from '../components/shared/BrandMark';
import { BRAND_NAME } from '../config/site';
import { DEMO_COMPANY, DEMO_USER, DEMO_TYPES, DEMO_REQUESTS, DEMO_STATUS_STYLES } from '../config/requesterDemo';

/**
 * RequesterDemoPage - /r/demo: a SAMPLE of the requester one-pager (docs/planning/PLAN_RequesterOnePager_20261101.md §2).
 * One screen, phone first: pick a request type -> fill its form -> send; "My requests" with where each one is.
 * Sample only: no API call, made-up data (src/config/requesterDemo.js). "Send" adds the request to this page's own list
 * and nothing leaves the browser - the page says so at the top (compliance F4: no simulated save, no fake success).
 * Kept out of search results (noindex). Layer: page (shared components + config).
 */

const DEMO_YEAR = 2026;
const typeById = id => DEMO_TYPES.find(type => type.id === id);

/** Keep the sample out of search results while it is open. */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);
}

const inputClass = 'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 ' +
  'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';

const Field = ({ field, value, onChange }) => {
  const id = `f-${field.id}`;
  const common = { id, name: field.id, value: value || '', required: !!field.required, onChange: e => onChange(field.id, e.target.value) };
  let control;
  if (field.type === 'paragraph') control = <textarea rows={3} className={inputClass} {...common} />;
  else if (field.type === 'dropdown') {
    control = (
      <select className={inputClass} {...common}>
        <option value="">Choose…</option>
        {field.options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  } else if (field.type === 'amount') control = <input type="number" min="0" step="0.01" inputMode="decimal" className={inputClass} {...common} />;
  else if (field.type === 'date') control = <input type="date" className={inputClass} {...common} />;
  else control = <input type="text" placeholder={field.placeholder} className={inputClass} {...common} />;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-800 dark:text-gray-100">
        {field.label}{field.required && <span className="text-red-600"> *</span>}
      </label>
      {control}
    </div>
  );
};

/** Dots for the steps: done, current, waiting. */
const StepDots = ({ steps, stepIndex, done }) => (
  <ol className="mt-3 flex items-center gap-2" aria-label="Steps">
    {steps.map((step, index) => {
      const state = done || index < stepIndex ? 'done' : index === stepIndex ? 'now' : 'next';
      return (
        <li key={step} className="flex items-center gap-2 text-xs">
          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${state === 'done'
            ? 'bg-green-600 text-white' : state === 'now' ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-400 dark:border-gray-600'}`}>
            {state === 'done' ? <Icons.CheckCircle size={12} /> : index + 1}
          </span>
          <span className={state === 'next' ? 'text-gray-400' : 'text-gray-700 dark:text-gray-200'}>{step}</span>
          {index < steps.length - 1 && <span className="h-px w-4 bg-gray-300 dark:bg-gray-600" aria-hidden="true" />}
        </li>
      );
    })}
  </ol>
);

const RequestCard = ({ request }) => {
  const [open, setOpen] = useState(false);
  const type = typeById(request.typeId);
  const done = request.status === 'Done';
  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{request.number}</p>
            <p className="mt-0.5 font-medium text-gray-900 dark:text-white">{request.title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{type.name}</p>
          </div>
          <span className={`flex-none rounded-full px-2.5 py-1 text-xs font-medium ${DEMO_STATUS_STYLES[request.status]}`}>{request.status}</span>
        </div>
        <StepDots steps={type.steps} stepIndex={request.stepIndex} done={done} />
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {request.withWho && <>With <span className="font-medium">{request.withWho}</span> · </>}{request.due}
          <span className="float-right text-blue-600 dark:text-blue-400">{open ? 'Hide' : 'Details'}</span>
        </p>
      </button>
      {open && (
        <ol className="mt-3 space-y-2 border-t border-gray-100 pt-3 text-sm dark:border-gray-700">
          {request.history.map((entry, index) => (
            <li key={index} className="flex gap-3">
              <span className="w-28 flex-none text-xs text-gray-500 dark:text-gray-400">{entry.when}</span>
              <span className="text-gray-700 dark:text-gray-200">{entry.what}</span>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
};

const RequesterDemoPage = () => {
  useNoIndex();
  const [typeId, setTypeId] = useState(null);
  const [values, setValues] = useState({});
  const [requests, setRequests] = useState(DEMO_REQUESTS);
  const [sent, setSent] = useState(null);
  const type = typeId ? typeById(typeId) : null;

  const pick = id => { setTypeId(id === typeId ? null : id); setValues({}); setSent(null); };
  const change = (id, value) => setValues(current => ({ ...current, [id]: value }));

  const send = event => {
    event.preventDefault();
    // Sample: the next number is made up here; the real page gets it from createTicket
    const last = requests.filter(r => r.typeId === type.id).map(r => Number(r.number.split('-')[2])).reduce((a, b) => Math.max(a, b), 0);
    const number = `${type.prefix}-${DEMO_YEAR}-${String(last + 1).padStart(8, '0')}`;
    const title = values[type.fields[0].id] || type.name;
    const request = {
      number, typeId: type.id, title, status: 'Sent', stepIndex: 0, withWho: type.firstApprover, due: 'Just now',
      history: [{ when: 'Just now', what: 'You sent the request (sample - nothing was sent)' }]
    };
    setRequests(current => [request, ...current]);
    setSent({ number, to: type.firstApprover });
    setTypeId(null);
    setValues({});
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-amber-100 px-4 py-2 text-center text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-100" role="note">
        <strong>Sample page.</strong> Made-up company and requests - nothing you type is sent or saved.
      </div>

      <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-gray-900 text-sm font-bold text-white dark:bg-gray-100 dark:text-gray-900">
              {DEMO_COMPANY.initials}
            </span>
            <span className="truncate font-semibold text-gray-900 dark:text-white">{DEMO_COMPANY.name}</span>
          </div>
          <span className="flex-none text-sm text-gray-600 dark:text-gray-300">{DEMO_USER.name}</span>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-8 px-4 py-6">
        <section aria-labelledby="new-request">
          <h1 id="new-request" className="text-2xl font-bold text-gray-900 dark:text-white">Hi {DEMO_USER.firstName}, what do you need?</h1>

          {sent && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900 dark:border-green-800 dark:bg-green-900/30 dark:text-green-100" role="status">
              <Icons.CheckCircle size={20} className="mt-0.5 flex-none" />
              <p><strong>{sent.number}</strong> sent to {sent.to}. You'll get an email when it moves. <em>(Sample - nothing was sent.)</em></p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            {DEMO_TYPES.map(item => {
              const Icon = Icons[item.icon] || Icons.Document;
              const active = item.id === typeId;
              return (
                <button key={item.id} type="button" onClick={() => pick(item.id)} aria-pressed={active}
                  className={`rounded-xl border p-4 text-left transition-colors ${active
                    ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200 dark:bg-blue-900/30 dark:ring-blue-800'
                    : 'border-gray-200 bg-white hover:border-blue-300 dark:border-gray-700 dark:bg-gray-800'}`}>
                  <Icon size={22} className="text-blue-600 dark:text-blue-400" />
                  <p className="mt-2 font-medium text-gray-900 dark:text-white">{item.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{item.blurb}</p>
                </button>
              );
            })}
          </div>

          {type && (
            <form onSubmit={send} className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-white">{type.name}</h2>
                <button type="button" onClick={() => pick(type.id)} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">Cancel</button>
              </div>
              {type.fields.map(field => <Field key={field.id} field={field} value={values[field.id]} onChange={change} />)}
              <p className="text-xs text-gray-500 dark:text-gray-400">Goes to: {type.steps.join(' → ')}</p>
              <button type="submit" className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">
                Send request
              </button>
            </form>
          )}
        </section>

        <section aria-labelledby="my-requests">
          <h2 id="my-requests" className="text-lg font-semibold text-gray-900 dark:text-white">My requests</h2>
          <ul className="mt-3 space-y-3">
            {requests.map(request => <RequestCard key={request.number} request={request} />)}
          </ul>
        </section>
      </main>

      <footer className="mx-auto max-w-xl px-4 pb-8 text-center text-xs text-gray-500 dark:text-gray-400">
        <p>Need help? Contact your administrator at {DEMO_COMPANY.helpEmail}</p>
        <p className="mt-2 flex items-center justify-center gap-1.5">
          <BrandMark size={14} /> Powered by <Link to="/" className="font-medium text-gray-700 hover:underline dark:text-gray-200">{BRAND_NAME}</Link>
          {' · '}<Link to="/privacy" className="hover:underline">Privacy</Link>
        </p>
      </footer>
    </div>
  );
};

export default RequesterDemoPage;
