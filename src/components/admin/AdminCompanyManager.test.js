/**
 * Tests for AdminCompanyManager - rewritten 15 Nov 2026 (session 461f9ea9) against the current screen. The old test
 * mocked useCompanyMutations (removed - the screen saves through companyAPI), looked for labels tied to inputs and texts
 * the screen no longer has, and failed on every case. Mocks are set in beforeEach: Create React App resets mock
 * implementations before each test (resetMocks).
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminCompanyManager from './AdminCompanyManager';
import { useCompanies } from '../../hooks/useAPI';
import { companyAPI } from '../../api/googleSheet';
import { useUser } from '../../contexts/UserContext';
import { useToast } from '../shared/Toast';

jest.mock('../../hooks/useAPI', () => ({ useCompanies: jest.fn() }));
jest.mock('../../api/googleSheet', () => ({
  companyAPI: { create: jest.fn(), update: jest.fn(), delete: jest.fn(), unlock: jest.fn() }
}));
jest.mock('../../contexts/UserContext', () => ({ useUser: jest.fn() }));
jest.mock('../shared/Toast', () => ({ useToast: jest.fn() }));
jest.mock('./CompanyEmailSettings', () => ({ __esModule: true, default: () => null }));
jest.mock('./CompanyRegionSettings', () => ({ __esModule: true, default: () => null }));

const COMPANIES = [
  { id: 'c1', name: 'Acme Trading', code: 'ACME', code_locked: false },
  { id: 'c2', name: 'Beta Foods', code: 'BETA', code_locked: true, code_locked_at: '2026-11-01T00:00:00Z' }
];

let refetch;
let toast;

const setup = (overrides = {}) => {
  refetch = jest.fn();
  toast = { ToastContainer: () => null, success: jest.fn(), error: jest.fn() };
  useCompanies.mockReturnValue({ data: COMPANIES, loading: false, error: null, refetch, ...overrides });
  useUser.mockReturnValue({ user: { uid: 'admin1' } });
  useToast.mockReturnValue(toast);
  companyAPI.create.mockResolvedValue({ id: 'c3' });
  companyAPI.update.mockResolvedValue({});
  companyAPI.delete.mockResolvedValue({});
  return render(<AdminCompanyManager />);
};

const openCreate = () => fireEvent.click(screen.getAllByText('Add Company')[0]);
const fill = (name, code) => {
  fireEvent.change(screen.getByPlaceholderText('Enter company name'), { target: { value: name } });
  fireEvent.change(screen.getByPlaceholderText('Enter company code (e.g., MAIN, DEV)'), { target: { value: code } });
};

describe('AdminCompanyManager', () => {
  afterEach(() => jest.restoreAllMocks());

  test('lists the companies with their codes', () => {
    setup();
    expect(screen.getByText('Acme Trading')).toBeInTheDocument();
    expect(screen.getByText('Code: ACME')).toBeInTheDocument();
    expect(screen.getByText('Beta Foods')).toBeInTheDocument();
    expect(screen.getByTitle('Code locked - tickets exist')).toBeInTheDocument();
  });

  test('a load error offers a retry that refetches', () => {
    setup({ data: [], error: 'Network down' });
    fireEvent.click(screen.getAllByRole('button').find(b => /retry|refresh|try again/i.test(b.textContent)));
    expect(refetch).toHaveBeenCalled();
  });

  test('creates a company and refreshes the list', async () => {
    setup();
    openCreate();
    fill('  Gamma Logistics ', 'GAMMA');
    fireEvent.click(screen.getByText('Create Company'));
    await waitFor(() => expect(companyAPI.create).toHaveBeenCalledWith({ name: 'Gamma Logistics', code: 'GAMMA' }));
    expect(refetch).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Company created successfully!');
  });

  test.each([
    ['', 'GAMMA', 'Company name is required'],
    ['Gamma', '', 'Company code is required'],
    ['Gamma', 'G', 'Company code must be 2-10 characters'],
    ['Gamma', 'ACME', 'Company code already exists']
  ])('validation: name "%s", code "%s" → %s', (name, code, message) => {
    setup();
    openCreate();
    fill(name, code);
    fireEvent.click(screen.getByText('Create Company'));
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(companyAPI.create).not.toHaveBeenCalled();
  });

  test('the code field uppercases what is typed and drops other characters', () => {
    setup();
    openCreate();
    fill('Gamma', 'ga-m ma_1');
    expect(screen.getByPlaceholderText('Enter company code (e.g., MAIN, DEV)').value).toBe('GAMMA1');
  });

  test('a save error is shown in the form and as a toast', async () => {
    setup();
    companyAPI.create.mockRejectedValue(new Error('Backend refused'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    openCreate();
    fill('Gamma', 'GAMMA');
    fireEvent.click(screen.getByText('Create Company'));
    expect(await screen.findByText('Backend refused')).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('Backend refused');
  });

  test('edits a company: the form is filled and Update saves it', async () => {
    setup();
    fireEvent.click(screen.getAllByTitle('Edit Company')[0]);
    expect(screen.getByDisplayValue('Acme Trading')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Enter company name'), { target: { value: 'Acme Trading Inc' } });
    fireEvent.click(screen.getByText('Update Company'));
    await waitFor(() => expect(companyAPI.update).toHaveBeenCalledWith('c1', { name: 'Acme Trading Inc', code: 'ACME' }));
  });

  test('a locked company code cannot be changed', () => {
    setup();
    fireEvent.click(screen.getAllByTitle('Edit Company')[1]);
    fireEvent.change(screen.getByPlaceholderText('Enter company code (e.g., MAIN, DEV)'), { target: { value: 'BETA2' } });
    fireEvent.click(screen.getByText('Update Company'));
    expect(screen.getByText('Cannot change code for locked company. Contact admin to unlock.')).toBeInTheDocument();
    expect(companyAPI.update).not.toHaveBeenCalled();
  });

  test('deletes only after confirmation', async () => {
    setup();
    const confirm = jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    fireEvent.click(screen.getAllByTitle('Delete Company')[0]);
    expect(companyAPI.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByTitle('Delete Company')[0]);
    await waitFor(() => expect(companyAPI.delete).toHaveBeenCalledWith('c1'));
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});
