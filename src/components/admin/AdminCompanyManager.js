import React, { useState, useEffect } from 'react';
import { useCompanies } from '../../hooks/useAPI';
import { companyAPI } from '../../api/googleSheet';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../shared/Toast';
import Icons from '../shared/Icons';
import CompanyEmailSettings from './CompanyEmailSettings';

// Only true / 'TRUE' is locked - before AppScript v9.1, editing a company wrote a date into code_locked
const isCodeLocked = company => company?.code_locked === true || String(company?.code_locked).toUpperCase() === 'TRUE';

const AdminCompanyManager = () => {
  const { user } = useUser();
  const { data: companies, loading, error, refetch } = useCompanies();
  const toast = useToast();
  const { ToastContainer, success, error: showError } = toast;
  // v9.6: the company whose email settings are open
  const [emailCompany, setEmailCompany] = useState(null);
  const notify = (type, message) => (toast[type] || toast.info)(message);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [formData, setFormData] = useState({ name: '', code: '' });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');

  // Admin override (spec 3.3): unlock a locked code with a logged reason; new tickets use the new code
  const handleUnlock = async () => {
    if (!unlockReason.trim()) {
      setFormError('Enter a reason to unlock the company code');
      return;
    }
    setIsSubmitting(true);
    try {
      const unlocked = await companyAPI.unlock(editingCompany.id, unlockReason, user?.uid || user?.id);
      setEditingCompany(prev => ({ ...prev, ...unlocked, code_locked: false }));
      setUnlockReason('');
      setFormError('');
      refetch();
      success('Company code unlocked - existing ticket numbers keep the old code');
    } catch (err) {
      setFormError(err.message || 'Failed to unlock the company code');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form when closing
  useEffect(() => {
    if (!showCreateForm && !editingCompany) {
      setFormData({ name: '', code: '' });
      setFormError('');
    }
  }, [showCreateForm, editingCompany]);

  // Populate form when editing
  useEffect(() => {
    if (editingCompany) {
      setFormData({
        name: editingCompany.name || '',
        code: editingCompany.code || ''
      });
    }
  }, [editingCompany]);

  const validateForm = () => {
    if (!formData.name.trim()) {
      setFormError('Company name is required');
      return false;
    }
    if (!formData.code.trim()) {
      setFormError('Company code is required');
      return false;
    }
    if (formData.code.length < 2 || formData.code.length > 10) {
      setFormError('Company code must be 2-10 characters');
      return false;
    }
    if (!/^[A-Z0-9]+$/.test(formData.code)) {
      setFormError('Company code must contain only uppercase letters and numbers');
      return false;
    }

    // Check if editing a locked company's code
    if (editingCompany && isCodeLocked(editingCompany) && formData.code !== editingCompany.code) {
      setFormError('Cannot change code for locked company. Contact admin to unlock.');
      return false;
    }

    // Check for duplicate codes
    const existingCompany = companies?.find(c =>
      c.code.toUpperCase() === formData.code.toUpperCase() &&
      c.id !== editingCompany?.id
    );
    if (existingCompany) {
      setFormError('Company code already exists');
      return false;
    }

    setFormError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      if (editingCompany) {
        // Update existing company
        await companyAPI.update(editingCompany.id, {
          name: formData.name.trim(),
          code: formData.code.trim()
        });
      } else {
        // Create new company
        await companyAPI.create({
          name: formData.name.trim(),
          code: formData.code.trim()
        });
      }

      // Close form and refresh data
      setShowCreateForm(false);
      setEditingCompany(null);
      refetch();

      // Show success message
      success(editingCompany ? 'Company updated successfully!' : 'Company created successfully!');
    } catch (error) {
      console.error('Company operation failed:', error);
      const errorMessage = error.message || 'Failed to save company. Please try again.';
      setFormError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (company) => {
    if (!window.confirm(`Are you sure you want to delete "${company.name}"?`)) {
      return;
    }

    try {
      await companyAPI.delete(company.id);
      refetch();
      success(`Company "${company.name}" deleted successfully!`);
    } catch (error) {
      console.error('Delete company failed:', error);
      const errorMessage = error.message || 'Failed to delete company. Please try again.';
      showError(errorMessage);
    }
  };

  const renderForm = () => (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          {editingCompany ? 'Edit Company' : 'Create New Company'}
        </h3>
        <button
          onClick={() => {
            setShowCreateForm(false);
            setEditingCompany(null);
          }}
          className="text-gray-400 hover:text-gray-600"
        >
          <Icons.Close size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Icons.Warning size={16} className="text-red-600" />
              <span className="text-sm text-red-700">{formError}</span>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Company Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter company name"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Company Code *
          </label>
          <input
            type="text"
            value={formData.code}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
            }))}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              isCodeLocked(editingCompany) ? 'border-gray-300 bg-gray-100 text-gray-500' : 'border-gray-300'
            }`}
            placeholder="Enter company code (e.g., MAIN, DEV)"
            maxLength={10}
            disabled={isSubmitting || isCodeLocked(editingCompany)}
          />
          {isCodeLocked(editingCompany) ? (
            <div className="mt-2 space-y-2">
              <div className="flex items-center">
                <Icons.Warning size={14} className="text-orange-500 mr-1" />
                <p className="text-xs text-orange-600">
                  Code is locked because tickets use it in their numbers. Unlocking is an admin override and is logged.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  placeholder="Reason for unlocking (required)"
                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={handleUnlock}
                  disabled={isSubmitting || !unlockReason.trim()}
                  className="px-3 py-1.5 text-sm font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-lg disabled:opacity-50"
                >
                  Unlock Code
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500 mt-1">
              2-10 characters, uppercase letters and numbers only. Used in ticket numbering.
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => {
              setShowCreateForm(false);
              setEditingCompany(null);
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            {isSubmitting && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            <span>{editingCompany ? 'Update Company' : 'Create Company'}</span>
          </button>
        </div>
      </form>
    </div>
  );

  const renderCompanyList = () => (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Companies</h3>
      </div>

      {loading ? (
        <div className="p-6 text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading companies...</p>
        </div>
      ) : error ? (
        <div className="p-6 text-center">
          <Icons.Warning size={32} className="mx-auto text-red-400 mb-4" />
          <p className="text-red-600 mb-4">Failed to load companies</p>
          <button
            onClick={refetch}
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
      ) : companies?.length > 0 ? (
        <div className="divide-y divide-gray-200">
          {companies.map((company) => (
            <div key={company.id} className="px-6 py-4 hover:bg-gray-50">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <Icons.Company size={20} className="text-gray-400" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-medium text-gray-900">{company.name}</h4>
                        {isCodeLocked(company) && (
                          <div className="flex items-center" title="Code locked - tickets exist">
                            <Icons.Warning size={14} className="text-orange-500" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <p className="text-sm text-gray-500">Code: {company.code}</p>
                        {isCodeLocked(company) && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                            Locked
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {company.created_at && (
                    <p className="text-xs text-gray-400 mt-1">
                      Created: {new Date(company.created_at).toLocaleDateString()}
                      {isCodeLocked(company) && company.code_locked_at && (
                        <span className="ml-2">
                          • Locked: {new Date(company.code_locked_at).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2 self-end sm:self-auto">
                  <button
                    onClick={() => setEmailCompany(company)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                    title="Email settings"
                    aria-label={`Email settings for ${company.name}`}
                  >
                    <Icons.Bell size={16} />
                  </button>
                  <button
                    onClick={() => setEditingCompany(company)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                    title="Edit Company"
                  >
                    <Icons.Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(company)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                    title="Delete Company"
                  >
                    <Icons.Close size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 text-center">
          <Icons.Company size={32} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 mb-4">No companies found</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
          >
            Create First Company
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <ToastContainer />
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Company Management</h2>
          <p className="text-gray-600">Manage multi-tenant company configurations</p>
        </div>
        {!showCreateForm && !editingCompany && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center sm:justify-start space-x-2"
          >
            <Icons.Create size={16} />
            <span>Add Company</span>
          </button>
        )}
      </div>

      {/* Form */}
      {(showCreateForm || editingCompany) && renderForm()}

      {/* v9.6: company email settings */}
      {emailCompany && (
        <CompanyEmailSettings company={emailCompany} onClose={() => setEmailCompany(null)} notify={notify} />
      )}

      {/* Company List */}
      {renderCompanyList()}
    </div>
    </>
  );
};

export default AdminCompanyManager;