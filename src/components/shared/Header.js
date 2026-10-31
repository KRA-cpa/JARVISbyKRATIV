import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import Icons from './Icons';
import { HeaderClock } from './LiveClock';
import DarkModeToggle from './DarkModeToggle';
import { useNotifications } from '../../hooks/useAPI';

// Notification times in Manila (compliance F3: Intl with the time zone, no hour arithmetic)
const manilaTime = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
const formatNotificationTime = iso => {
  const date = new Date(iso);
  return isNaN(date.getTime()) ? '' : manilaTime.format(date);
};

// The bell shows the signed-in user's own notifications from the backend (AppScript v9.5 getNotifications) -
// SLA warnings, overdue notices and escalations written by the server's escalation run
const Header = ({ user, userRole }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { notifications, unreadCount, markRead } = useNotifications(user?.uid || user?.id);

  const openNotification = async (notification) => {
    setShowNotifications(false);
    if (!notification.is_read) await markRead([notification.id]);
    if (notification.link) navigate(notification.link);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const getActiveClasses = (path) => {
    return isActive(path)
      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600'
      : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 border-transparent';
  };

  const unreadNotifications = unreadCount;

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Left side - Logo and Navigation */}
          <div className="flex items-center space-x-8">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center space-x-2">
              <Icons.Ticket size={28} className="text-blue-600" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                TicketFlow
              </span>
            </Link>

            {/* Main Navigation */}
            <nav className="hidden md:flex space-x-6">
              <Link
                to="/dashboard"
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors duration-200 ${getActiveClasses('/dashboard')}`}
              >
                <div className="flex items-center space-x-2">
                  <Icons.Dashboard size={16} />
                  <span>Dashboard</span>
                </div>
              </Link>

              <Link
                to="/tickets"
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors duration-200 ${getActiveClasses('/tickets')}`}
              >
                <div className="flex items-center space-x-2">
                  <Icons.Ticket size={16} />
                  <span>Tickets</span>
                </div>
              </Link>

              <Link
                to="/reports"
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors duration-200 ${getActiveClasses('/reports')}`}
              >
                <div className="flex items-center space-x-2">
                  <Icons.Documents size={16} />
                  <span>Reports</span>
                </div>
              </Link>

              {userRole === 'admin' && (
                <Link
                  to="/admin"
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors duration-200 ${getActiveClasses('/admin')}`}
                >
                  <div className="flex items-center space-x-2">
                    <Icons.Admin size={16} />
                    <span>Admin Panel</span>
                  </div>
                </Link>
              )}
            </nav>
          </div>

          {/* Right side - Clock, Notifications, User Menu */}
          <div className="flex items-center space-x-4">

            {/* Live Clock */}
            <HeaderClock className="hidden sm:flex" />

            {/* Dark Mode Toggle */}
            <DarkModeToggle size="sm" className="hidden sm:flex" />

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
              >
                <Icons.Notification size={20} />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">
                      Notifications ({unreadNotifications} unread)
                    </h3>
                    {unreadNotifications > 0 && (
                      <button
                        onClick={() => markRead()}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.slice(0, 8).map((notification) => (
                        <button
                          type="button"
                          key={notification.id}
                          onClick={() => openNotification(notification)}
                          className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 ${
                            !notification.is_read ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0">
                              {notification.type === 'sla_warning'
                                ? <Icons.Warning size={16} className="text-amber-500 mt-0.5" />
                                : (notification.type === 'sla_overdue' || notification.type === 'sla_escalated')
                                  ? <Icons.Warning size={16} className="text-red-600 mt-0.5" />
                                  : <Icons.Info size={16} className="text-blue-600 mt-0.5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 truncate">
                                {notification.title}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {formatNotificationTime(notification.created_at)}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        No notifications
                      </div>
                    )}
                  </div>

                  {notifications.length > 8 && (
                    <div className="p-3 border-t border-gray-200 text-center text-xs text-gray-500">
                      Showing the 8 newest of {notifications.length}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
              >
                <Icons.User size={20} />
                <span className="hidden sm:block text-sm font-medium">
                  {user?.displayName || user?.email?.split('@')[0] || 'User'}
                </span>
                <Icons.ChevronDown size={16} />
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Icons.User size={20} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {user?.displayName || 'User'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {user?.email}
                        </p>
                        <p className="text-xs text-blue-600 font-medium">
                          {userRole?.charAt(0).toUpperCase() + userRole?.slice(1)} Role
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="py-2">
                    <Link
                      to="/profile"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Icons.User size={16} />
                      <span>Profile Settings</span>
                    </Link>

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        navigate('/profile?tab=preferences');
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <Icons.Settings size={16} />
                      <span>Preferences</span>
                    </button>
                  </div>

                  <div className="py-2 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                    >
                      <Icons.Close size={16} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-gray-200 bg-gray-50">
        <div className="px-4 py-3 space-y-2">
          <Link
            to="/dashboard"
            className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
              isActive('/dashboard')
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:text-blue-600 hover:bg-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Icons.Dashboard size={16} />
              <span>Dashboard</span>
            </div>
          </Link>

          <Link
            to="/tickets"
            className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
              isActive('/tickets')
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:text-blue-600 hover:bg-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Icons.Ticket size={16} />
              <span>Tickets</span>
            </div>
          </Link>

          <Link
            to="/reports"
            className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
              isActive('/reports')
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:text-blue-600 hover:bg-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Icons.Documents size={16} />
              <span>Reports</span>
            </div>
          </Link>

          {userRole === 'admin' && (
            <Link
              to="/admin"
              className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                isActive('/admin')
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-blue-600 hover:bg-white'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Icons.Admin size={16} />
                <span>Admin Panel</span>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Click outside handler */}
      {(showUserMenu || showNotifications) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowUserMenu(false);
            setShowNotifications(false);
          }}
        />
      )}
    </header>
  );
};

export default Header;