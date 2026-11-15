import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import InfiniteLoopMonitor from './InfiniteLoopMonitor';

// Mock Icons - the component imports the DEFAULT export (15 Nov 2026 fix: the mock had none, so Icons was undefined)
jest.mock('./Icons', () => {
  const icons = {
    CheckCircle: ({ className }) => <div data-testid="check-circle" className={className}>✓</div>,
    Warning: ({ className }) => <div data-testid="warning" className={className}>⚠</div>,
    ChevronDown: ({ className }) => <div data-testid="chevron-down" className={className}>⌄</div>
  };
  return { __esModule: true, default: icons, Icons: icons };
});

// Mock the infinite loop prevention hook. Create React App resets every mock's implementation before each test
// (resetMocks: true), so the implementations are set again in beforeEach (15 Nov 2026 fix - they were only set here)
const statsNow = () => ({ api: {}, renders: {}, timestamp: new Date() });
const mockHook = {
  getSystemStats: jest.fn(statsNow),
  reset: jest.fn(),
  isSystemHealthy: jest.fn(() => true),
  config: {
    MAX_CALLS_PER_SECOND: 5,
    MAX_CALLS_PER_MINUTE: 50,
    MAX_RENDERS_PER_SECOND: 20,
    CIRCUIT_BREAKER_FAILURE_THRESHOLD: 10
  }
};

jest.mock('../../utils/infiniteLoopPrevention', () => ({
  useInfiniteLoopMonitor: () => mockHook
}));

describe('InfiniteLoopMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHook.getSystemStats.mockImplementation(statsNow);
    mockHook.isSystemHealthy.mockImplementation(() => true);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders without crashing', async () => {
    let component;
    await act(async () => {
      component = render(<InfiniteLoopMonitor />);
    });

    // Now the component should have called getSystemStats and set stats
    expect(screen.getByText('System Healthy')).toBeInTheDocument();
  });

  it('does not cause infinite renders', () => {
    const renderCount = mockHook.getSystemStats.mock.calls.length;

    render(<InfiniteLoopMonitor />);

    // Fast-forward time to trigger multiple intervals
    act(() => {
      jest.advanceTimersByTime(10000); // 10 seconds
    });

    // Should have reasonable number of calls (initial + ~5 intervals)
    expect(mockHook.getSystemStats.mock.calls.length).toBeLessThan(renderCount + 10);
  });

  it('displays system stats when expanded', async () => {
    mockHook.isSystemHealthy.mockReturnValue(false);

    await act(async () => {
      render(<InfiniteLoopMonitor minimized={false} />);
    });

    expect(screen.getByText('Infinite Loop Monitor')).toBeInTheDocument();
    expect(screen.getByText('API Call Statistics')).toBeInTheDocument();
    expect(screen.getByText('Component Render Statistics')).toBeInTheDocument();
  });

  it('memoizes properly to prevent unnecessary re-renders', () => {
    const { rerender } = render(<InfiniteLoopMonitor minimized={true} />);

    const initialCallCount = mockHook.getSystemStats.mock.calls.length;

    // Re-render with same props
    rerender(<InfiniteLoopMonitor minimized={true} />);

    // Should not trigger additional calls due to memoization
    expect(mockHook.getSystemStats.mock.calls.length).toBe(initialCallCount);
  });

  it('cleans up interval on unmount', () => {
    const { unmount } = render(<InfiniteLoopMonitor />);

    // Spy on clearInterval
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
  });
});