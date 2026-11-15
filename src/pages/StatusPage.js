import React from 'react';
import { Link } from 'react-router-dom';
import PublicHeader from '../components/shared/PublicHeader';
import Footer from '../components/shared/Footer';
import Icons from '../components/shared/Icons';
import { STATUS } from '../config/site';

/**
 * StatusPage - /status, PUBLIC, no API call (General Terms §10.2; ServerCore plan §6b). Links the providers' own status
 * dashboards with what each one affects in Daloy - the list follows src/config/platform.js (before / after the full
 * migration; previews show the after list with a note). A live "Google reports an incident" banner from the providers'
 * feeds is a later step (plan §6b).
 * Layer: page (imports shared components + config only).
 */
const StatusPage = () => (
  <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
    <PublicHeader />
    <main className="flex-1">
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{STATUS.title}</h1>
        <p className="mt-3 text-gray-600 dark:text-gray-300">{STATUS.intro}</p>
        {STATUS.previewNote && (
          <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
            {STATUS.previewNote}
          </p>
        )}
        <ul className="mt-6 space-y-3">
          {STATUS.providers.map(p => (
            <li key={p.url} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <a href={p.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-blue-600 hover:underline dark:text-blue-400">
                {p.name} <Icons.ExternalLink size={14} />
              </a>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Affects: {p.affects}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-gray-600 dark:text-gray-300">{STATUS.ownStore}</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {STATUS.terms} <Link to="/terms" className="text-blue-600 hover:underline dark:text-blue-400">Read the terms</Link>
        </p>
      </article>
    </main>
    <Footer publicSite />
  </div>
);

export default StatusPage;
