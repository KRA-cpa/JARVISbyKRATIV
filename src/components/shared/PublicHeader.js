import React from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import Icons from './Icons';

/**
 * PublicHeader - the header of public pages (v10.2: /plans; later the platform website). Makes no API call, so it works
 * for visitors who aren't signed in: brand, Plans, and Sign in (signed out) or Go to dashboard (signed in).
 * Layer: shared component (context + Icons only).
 */
const PublicHeader = () => {
  const { isAuthenticated } = useUser();

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link to="/plans" className="flex items-center space-x-2">
              <Icons.Ticket size={28} className="text-blue-600" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">TicketFlow</span>
            </Link>
            <nav className="flex space-x-4">
              <Link to="/plans" className="px-3 py-2 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-200">
                Plans
              </Link>
            </nav>
          </div>
          {isAuthenticated ? (
            <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Icons.Dashboard size={16} />
              <span>Go to dashboard</span>
            </Link>
          ) : (
            <Link to="/login" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Icons.Key size={16} />
              <span>Sign in</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default PublicHeader;
