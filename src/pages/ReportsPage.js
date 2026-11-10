import React from 'react';
import { useUser } from '../contexts/UserContext';
import Header from '../components/shared/Header';
import Footer from '../components/shared/Footer';
import TicketReport from '../components/tickets/TicketReport';

/**
 * ReportsPage - /reports (spec 3.4 Reporting)
 *
 * Ticket status reports per ticket type with the columns set in Admin -> Reports, links to each ticket's
 * details and workflow history, and CSV export.
 * Layer: page (imports shared + tickets components only, per docs/reference/DEPENDENCY_MAPPING.md).
 */
const ReportsPage = () => {
  const { user, userRoles } = useUser();

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      <Header user={user} userRole={userRoles?.[0]?.name} />
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TicketReport />
      </div>
      <Footer />
    </div>
  );
};

export default ReportsPage;
