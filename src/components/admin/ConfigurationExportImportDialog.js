import React, { useState } from 'react';
import { useCompanies, useTicketTypes } from '../../hooks/useAPI';
import { useUser } from '../../contexts/UserContext';
import { API } from '../../api/googleSheet';
import { useToast } from '../shared/Toast';
import Icons from '../shared/Icons';
import { formatDateOnly } from '../../utils/dateTime';

/**
 * ConfigurationExportImportDialog Component
 *
 * Handles export and import of complete configurations between companies:
 * - Export workflows, custom fields, SLA rules, and roles from source company
 * - Import configurations to target companies
 * - Preview and selective import capabilities
 */
const ConfigurationExportImportDialog = ({ isOpen, onClose, onSuccess, mode: initialMode = 'export' }) => {
  const { user } = useUser();
  const userId = user?.uid || user?.id;
  const { data: companies } = useCompanies();
  const { data: ticketTypes } = useTicketTypes();
  const { ToastContainer, success, error: showError } = useToast();

  const [formData, setFormData] = useState({
    sourceCompanyId: '',
    targetCompanyIds: [],
    ticketTypeIds: [],
    exportWorkflows: true,
    exportCustomFields: true,
    exportSLARules: true,
    exportRoles: true,
    exportDropdowns: true,
    overwriteExisting: false,
    createBackup: true
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [formError, setFormError] = useState('');
  const [exportedData, setExportedData] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [mode, setMode] = useState(initialMode);
  const [currentStep, setCurrentStep] = useState(initialMode === 'export' ? 'configure-export' : 'configure-import');

  const exportableItems = [
    { key: 'exportWorkflows', label: 'Workflow Steps & Configurations', description: 'Complete workflow definitions including steps, approvers, and conditions' },
    { key: 'exportCustomFields', label: 'Custom Fields', description: 'Field definitions, types, and validation rules' },
    { key: 'exportSLARules', label: 'SLA Rules & Escalations', description: 'Service level agreements and escalation policies' },
    { key: 'exportRoles', label: 'Roles & Permissions', description: 'User roles and their associated permissions' },
    { key: 'exportDropdowns', label: 'Dropdown Lists & Options', description: 'Reusable dropdown configurations and dependencies' }
  ];

  const validateForm = () => {
    if (!formData.sourceCompanyId) {
      setFormError('Please select a source company');
      return false;
    }

    if (mode === 'import' && formData.targetCompanyIds.length === 0) {
      setFormError('Please select at least one target company');
      return false;
    }

    if (formData.ticketTypeIds.length === 0) {
      setFormError('Please select at least one ticket type');
      return false;
    }

    const selectedItems = exportableItems.filter(item => formData[item.key]);
    if (selectedItems.length === 0) {
      setFormError('Please select at least one configuration type to export/import');
      return false;
    }

    setFormError('');
    return true;
  };

  const handleExport = async () => {
    if (!validateForm()) return;

    setIsProcessing(true);
    try {
      const exportResponse = await API.System.exportConfiguration({
        user_id: userId,
        company_id: formData.sourceCompanyId,
        ticket_type_ids: formData.ticketTypeIds,
        include_workflows: formData.exportWorkflows,
        include_custom_fields: formData.exportCustomFields,
        include_sla_rules: formData.exportSLARules,
        include_roles: formData.exportRoles,
        include_dropdowns: formData.exportDropdowns
      });

      setExportedData(exportResponse.data);
      setCurrentStep('export-complete');

      const sourceCompany = companies?.find(c => c.id === formData.sourceCompanyId);
      success(`Configuration exported successfully from ${sourceCompany?.name}`);
    } catch (err) {
      console.error('Export failed:', err);
      setFormError(err.message || 'Failed to export configuration');
      showError(err.message || 'Failed to export configuration');
    } finally {
      setIsProcessing(false);
    }
  };

  // dryRun (AppScript v9.3): list what would happen per target company, change nothing
  const handleImport = async (dryRun = true) => {
    if (!validateForm()) return;

    setIsProcessing(true);
    try {
      const results = [];

      for (const targetCompanyId of formData.targetCompanyIds) {
        const targetCompany = companies?.find(c => c.id === targetCompanyId);

        try {
          // Create backup if requested (a JSON file in the script owner's Drive)
          if (formData.createBackup && !dryRun) {
            await API.System.createConfigurationBackup({
              user_id: userId,
              company_id: targetCompanyId,
              backup_name: `pre-import-${new Date().toISOString().split('T')[0]}`
            });
          }

          // Import configuration
          const importResponse = await API.System.importConfiguration({
            user_id: userId,
            dry_run: dryRun,
            source_company_id: formData.sourceCompanyId,
            target_company_id: targetCompanyId,
            ticket_type_ids: formData.ticketTypeIds,
            include_workflows: formData.exportWorkflows,
            include_custom_fields: formData.exportCustomFields,
            include_sla_rules: formData.exportSLARules,
            include_roles: formData.exportRoles,
            include_dropdowns: formData.exportDropdowns,
            overwrite_existing: formData.overwriteExisting
          });

          results.push({
            company: targetCompany?.name,
            success: true,
            data: importResponse.data
          });
        } catch (error) {
          console.error(`Import failed for ${targetCompany?.name}:`, error);
          results.push({
            company: targetCompany?.name,
            success: false,
            error: error.message
          });
        }
      }

      setImportPreview(results);
      if (dryRun) {
        setCurrentStep('import-preview');
        return;
      }

      // Show results summary
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      if (failureCount === 0) {
        success(`Configuration successfully imported to ${successCount} companies`);
      } else {
        showError(`Import completed: ${successCount} succeeded, ${failureCount} failed`);
      }

      setCurrentStep('import-complete');
      onSuccess?.();
    } catch (err) {
      console.error('Import operation failed:', err);
      setFormError(err.message || 'Failed to import configuration');
      showError(err.message || 'Failed to import configuration');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadExport = () => {
    if (!exportedData) return;

    const sourceCompany = companies?.find(c => c.id === formData.sourceCompanyId);
    const filename = `config-export-${sourceCompany?.code || 'company'}-${new Date().toISOString().split('T')[0]}.json`;

    const blob = new Blob([JSON.stringify(exportedData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (formError) {
      setFormError('');
    }
  };

  const handleTicketTypeSelection = (ticketTypeId) => {
    setFormData(prev => ({
      ...prev,
      ticketTypeIds: prev.ticketTypeIds.includes(ticketTypeId)
        ? prev.ticketTypeIds.filter(id => id !== ticketTypeId)
        : [...prev.ticketTypeIds, ticketTypeId]
    }));
  };

  const handleCompanySelection = (companyId) => {
    setFormData(prev => ({
      ...prev,
      targetCompanyIds: prev.targetCompanyIds.includes(companyId)
        ? prev.targetCompanyIds.filter(id => id !== companyId)
        : [...prev.targetCompanyIds, companyId]
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <ToastContainer />
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        ></div>

        {/* Center the modal */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        {/* Modal content */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                  {mode === 'export' ? (
                    <Icons.Download size={20} className="text-green-600" />
                  ) : (
                    <Icons.Upload size={20} className="text-green-600" />
                  )}
                </div>
                <div className="ml-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Configuration {mode === 'export' ? 'Export' : 'Import'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {mode === 'export'
                      ? 'Export complete configurations from a company'
                      : 'Import configurations from another company'
                    }
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icons.Close size={20} />
              </button>
            </div>

            {/* Error message */}
            {formError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Icons.Warning size={16} className="text-red-600" />
                  <span className="text-sm text-red-700">{formError}</span>
                </div>
              </div>
            )}

            {/* Step content */}
            {(currentStep === 'configure-export' || currentStep === 'configure-import') && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left column */}
                <div className="space-y-4">
                  {/* Source Company */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Source Company *
                    </label>
                    <select
                      name="sourceCompanyId"
                      value={formData.sourceCompanyId}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      disabled={isProcessing}
                    >
                      <option value="">Select source company</option>
                      {companies?.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name} ({company.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Target Companies (for import) */}
                  {mode === 'import' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Target Companies * ({formData.targetCompanyIds.length} selected)
                      </label>
                      <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-1">
                        {companies?.filter(c => c.id !== formData.sourceCompanyId).map((company) => (
                          <div key={company.id} className="flex items-center">
                            <input
                              type="checkbox"
                              id={`target-${company.id}`}
                              checked={formData.targetCompanyIds.includes(company.id)}
                              onChange={() => handleCompanySelection(company.id)}
                              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                              disabled={isProcessing}
                            />
                            <label htmlFor={`target-${company.id}`} className="ml-2 block text-sm text-gray-900">
                              {company.name} ({company.code})
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ticket Types */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ticket Types * ({formData.ticketTypeIds.length} selected)
                    </label>
                    <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-1">
                      {ticketTypes?.map((ticketType) => (
                        <div key={ticketType.id} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`ticket-${ticketType.id}`}
                            checked={formData.ticketTypeIds.includes(ticketType.id)}
                            onChange={() => handleTicketTypeSelection(ticketType.id)}
                            className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                            disabled={isProcessing}
                          />
                          <label htmlFor={`ticket-${ticketType.id}`} className="ml-2 block text-sm text-gray-900">
                            {ticketType.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right column */}
                <div className="space-y-4">
                  {/* Configuration Types */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Configuration Types to {mode === 'export' ? 'Export' : 'Import'}
                    </label>
                    <div className="space-y-3">
                      {exportableItems.map((item) => (
                        <div key={item.key} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-start">
                            <input
                              type="checkbox"
                              name={item.key}
                              checked={formData[item.key]}
                              onChange={handleInputChange}
                              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded mt-1"
                              disabled={isProcessing}
                            />
                            <div className="ml-3">
                              <label className="block text-sm font-medium text-gray-900">
                                {item.label}
                              </label>
                              <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Import Options */}
                  {mode === 'import' && (
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          name="overwriteExisting"
                          checked={formData.overwriteExisting}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                          disabled={isProcessing}
                        />
                        <label className="ml-2 block text-sm text-gray-900">
                          Overwrite existing configurations
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          name="createBackup"
                          checked={formData.createBackup}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                          disabled={isProcessing}
                        />
                        <label className="ml-2 block text-sm text-gray-900">
                          Create backup before import
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Export Complete Step */}
            {currentStep === 'export-complete' && exportedData && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <Icons.CheckCircle size={20} className="text-green-600 mr-3" />
                    <div>
                      <h4 className="text-lg font-medium text-green-900">Export Completed Successfully</h4>
                      <p className="text-sm text-green-700 mt-1">
                        Configuration has been exported and is ready for download or import.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Export Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h5 className="font-medium text-gray-900 mb-3">Export Summary</h5>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Source Company:</span>
                      <span className="ml-2 font-medium">{companies?.find(c => c.id === formData.sourceCompanyId)?.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Ticket Types:</span>
                      <span className="ml-2 font-medium">{formData.ticketTypeIds.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Export Size:</span>
                      <span className="ml-2 font-medium">{(JSON.stringify(exportedData).length / 1024).toFixed(1)} KB</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Export Date:</span>
                      <span className="ml-2 font-medium">{formatDateOnly(new Date())}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Import preview (dry run) / result: what happens per target company */}
            {(currentStep === 'import-preview' || currentStep === 'import-complete') && importPreview && (
              <div className="space-y-4">
                <p className="text-sm text-gray-700">
                  {currentStep === 'import-preview'
                    ? 'Dry run - nothing has changed yet. Check the list, then apply.'
                    : 'Import finished.'}
                </p>
                {importPreview.map(result => (
                  <div key={result.company} className="border border-gray-200 rounded-lg p-3">
                    <h5 className="font-medium text-gray-900 mb-2">{result.company}</h5>
                    {!result.success ? (
                      <p className="text-sm text-red-600">{result.error}</p>
                    ) : (result.data?.actions || []).length === 0 ? (
                      <p className="text-sm text-gray-500">Nothing to copy</p>
                    ) : (
                      <ul className="text-sm space-y-1">
                        {result.data.actions.map((action, index) => (
                          <li key={index} className="flex gap-2">
                            <span className={`px-1.5 rounded text-xs font-medium ${{
                              copy: 'bg-green-100 text-green-800',
                              replace: 'bg-yellow-100 text-yellow-800',
                              refused: 'bg-red-100 text-red-800',
                              error: 'bg-red-100 text-red-800'
                            }[action.action] || 'bg-gray-100 text-gray-700'}`}>{action.action}</span>
                            <span className="text-gray-500">{action.area}</span>
                            <span className="text-gray-800">{action.detail}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Warning note */}
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Icons.Warning size={16} className="text-yellow-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <strong>Important:</strong> {mode === 'export'
                      ? 'This will export all configurations for the selected ticket types. Ticket data is not included.'
                      : 'Import copies the source company\'s setup into each target company. Existing workflows are kept unless you tick overwrite; custom fields are shared by every company already.'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            {currentStep === 'export-complete' ? (
              <>
                <button
                  onClick={handleDownloadExport}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  <Icons.Download size={16} className="mr-2" />
                  Download Export
                </button>
                <button
                  onClick={() => { setMode('import'); setCurrentStep('configure-import'); }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Import to Companies
                </button>
              </>
            ) : currentStep === 'import-preview' ? (
              <>
                <button
                  onClick={() => handleImport(false)}
                  disabled={isProcessing}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  <Icons.Upload size={16} className="mr-2" />
                  {isProcessing ? 'Importing...' : 'Apply Import'}
                </button>
                <button
                  onClick={() => setCurrentStep('configure-import')}
                  disabled={isProcessing}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Back
                </button>
              </>
            ) : currentStep === 'import-complete' ? null : (
              <>
                <button
                  onClick={mode === 'export' ? handleExport : () => handleImport(true)}
                  disabled={isProcessing}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {mode === 'export' ? 'Exporting...' : 'Importing...'}
                    </>
                  ) : (
                    <>
                      {mode === 'export' ? <Icons.Download size={16} className="mr-2" /> : <Icons.Upload size={16} className="mr-2" />}
                      {mode === 'export' ? 'Export Configuration' : 'Preview Import (dry run)'}
                    </>
                  )}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              {currentStep === 'export-complete' || currentStep === 'import-complete' ? 'Close' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigurationExportImportDialog;