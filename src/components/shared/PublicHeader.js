import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import Icons from './Icons';
import { PUBLIC_NAV } from '../../config/site';

/**
 * PublicHeader - the header of the public website pages (/, /how-it-works, /plans, /contact, /privacy). Makes no API call, so
 * it works for visitors who aren't signed in: brand (-> /), the nav from src/config/site.js PUBLIC_NAV (How it works, Plans,
 * Contact, Privacy), and Sign in (signed out) or Go to dashboard (signed in). From md up the nav is inline; on phones it
 * folds into a menu button (docs/planning/PLAN_PlatformWebsite_20261101.md §2: "a mobile menu").
 * Layer: shared component (context + Icons + config only).
 */
const PublicHeader = () => {
  // review CR6-21: until Firebase answers, show neither button (a signed-in user shouldn't flash "Sign in")
  const { isAuthenticated, loading } = useUser();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // a link was followed (or back / forward): close the phone menu
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const isActive = item => pathname === item.path || (item.also || []).includes(pathname);
  const linkClass = (item, block = false) => `${block ? 'block px-3 py-3 text-base' : 'px-3 py-2 text-sm'} rounded-lg font-medium ${isActive(item)
    ? 'text-blue-700 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-200'
    : 'text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-300'}`;

  const account = loading ? <span aria-hidden="true" className="w-32" /> : isAuthenticated ? (
    <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
      <Icons.Dashboard size={16} />
      <span>Go to dashboard</span>
    </Link>
  ) : (
    <Link to="/login" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
      <Icons.Key size={16} />
      <span>Sign in</span>
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-3">
          <div className="flex items-center gap-8 min-w-0">
            <Link to="/" className="flex items-center gap-2">
              <Icons.Ticket size={28} className="text-blue-600" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">TicketFlow</span>
            </Link>
            <nav aria-label="Main" className="hidden md:flex gap-1 lg:gap-2">
              {PUBLIC_NAV.map(item => (
                <Link key={item.path} to={item.path} className={linkClass(item)} aria-current={isActive(item) ? 'page' : undefined}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {account}
            <button type="button" onClick={() => setMenuOpen(open => !open)}
              className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              aria-expanded={menuOpen} aria-controls="public-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
              {menuOpen ? <Icons.Close size={22} /> : <Icons.Menu size={22} />}
            </button>
          </div>
        </div>
      </div>
      {menuOpen && (
        <nav id="public-menu" aria-label="Main" className="md:hidden border-t border-gray-200 dark:border-gray-700 px-4 py-2">
          {PUBLIC_NAV.map(item => (
            <Link key={item.path} to={item.path} className={linkClass(item, true)} aria-current={isActive(item) ? 'page' : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
};

export default PublicHeader;
