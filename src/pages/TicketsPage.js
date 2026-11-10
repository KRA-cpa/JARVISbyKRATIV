import React from 'react';
import { useUser } from '../contexts/UserContext';
import Header from '../components/shared/Header';
import Footer from '../components/shared/Footer';
import TicketDashboard from '../components/tickets/TicketDashboard';

/**
 * TicketsPage - /tickets
 *
 * The requester / approver side of the system: list and filter tickets, create one (TicketForm), open one
 * (TicketDetail -> WorkflowStep to approve, reject or return), and "Waiting for my approval".
 * Layer: page (imports shared + tickets components only, per docs/reference/DEPENDENCY_MAPPING.md).
 */
const TicketsPage = () => {
  const { user, userRoles } = useUser();

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      <Header user={user} userRole={userRoles?.[0]?.name} />
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TicketDashboard />
      </div>
      <Footer />
    </div>
  );
};

export default TicketsPage;
