import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Footer Component
 *
 * Copyright masthead for all pages
 * Displays proof of concept attribution and copyright notice, and the Privacy Policy link (public /privacy - every page
 * links to it, docs/planning/PLAN_PrivacyPolicy_DPA_20261101.md §3)
 */
const Footer = ({ className = "" }) => {
  return (
    <footer className={`bg-white border-t border-gray-200 ${className}`}>
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="text-sm text-gray-500">
            <p className="font-medium">Proof of Concept</p>
            <p className="mt-1">
              Designed by <span className="font-medium text-gray-700">Kenneth Advento</span>
            </p>
            <p className="mt-1">
              Developed through <span className="font-medium text-gray-700">Claude.ai and Claude CLI</span>
            </p>
            <p className="mt-1">Copyright © 2025. All rights reserved.</p>
            <p className="mt-2">
              <Link to="/privacy" className="font-medium text-blue-600 hover:underline">Privacy Policy</Link>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;