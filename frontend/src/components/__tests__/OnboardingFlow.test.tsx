/**
 * Tests for OnboardingFlow role-specific steps and per-wallet persistence
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingFlow } from '../OnboardingFlow';

// Mock react-joyride
vi.mock('react-joyride', () => ({
  default: () => null,
  STATUS: { FINISHED: 'finished', SKIPPED: 'skipped' },
  EVENTS: { STEP_AFTER: 'step:after' },
}));

// Mock useWallet
const mockWallet = {
  isConnected: false,
  address: null as string | null,
  accountRole: null as string | null,
};
vi.mock('../hooks/useWallet', () => ({
  useWallet: () => mockWallet,
}));

// Mock useOnboarding
const mockOnboarding = {
  isOnboardingActive: true,
  skipOnboarding: vi.fn(),
  completeStep: vi.fn(),
  restartOnboarding: vi.fn(),
};
vi.mock('../context/OnboardingProvider', () => ({
  useOnboarding: () => mockOnboarding,
}));

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('OnboardingFlow', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    mockWallet.isConnected = false;
    mockWallet.address = null;
    mockWallet.accountRole = null;
    mockOnboarding.isOnboardingActive = true;
  });

  it('renders onboarding when isOnboardingActive is true', () => {
    render(<OnboardingFlow />);
    expect(screen.getByText(/step 1/i)).toBeInTheDocument();
  });

  it('does not render when isOnboardingActive is false', () => {
    mockOnboarding.isOnboardingActive = false;
    const { container } = render(<OnboardingFlow />);
    expect(container.firstChild).toBeNull();
  });

  it('shows connect wallet step when wallet not connected', () => {
    render(<OnboardingFlow />);
    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
  });

  it('shows Treasurer-specific steps when role is Treasurer', () => {
    mockWallet.isConnected = true;
    mockWallet.accountRole = 'Treasurer';
    render(<OnboardingFlow />);
    // First step should be role explanation (connect step skipped since connected)
    expect(screen.getByText('You are a Treasurer')).toBeInTheDocument();
  });

  it('shows Admin-specific steps when role is Admin', () => {
    mockWallet.isConnected = true;
    mockWallet.accountRole = 'Admin';
    render(<OnboardingFlow />);
    expect(screen.getByText('You are an Admin')).toBeInTheDocument();
  });

  it('shows Member-specific steps when role is Member', () => {
    mockWallet.isConnected = true;
    mockWallet.accountRole = 'Member';
    render(<OnboardingFlow />);
    expect(screen.getByText('You are a Member')).toBeInTheDocument();
  });

  it('shows role permissions card on role step', () => {
    mockWallet.isConnected = true;
    mockWallet.accountRole = 'Treasurer';
    render(<OnboardingFlow />);
    expect(screen.getByText('Your permissions:')).toBeInTheDocument();
    expect(screen.getByText('Create proposals')).toBeInTheDocument();
  });

  it('skips onboarding for returning wallet (already completed)', () => {
    mockWallet.address = 'GABC123';
    localStorageMock.setItem('vaultdao_onboarding_done_GABC123', 'true');
    render(<OnboardingFlow />);
    expect(mockOnboarding.skipOnboarding).toHaveBeenCalled();
  });

  it('does not skip onboarding for new wallet', () => {
    mockWallet.address = 'GNEW456';
    render(<OnboardingFlow />);
    expect(mockOnboarding.skipOnboarding).not.toHaveBeenCalled();
  });

  it('Skip Tour button calls skipOnboarding', () => {
    render(<OnboardingFlow />);
    fireEvent.click(screen.getByRole('button', { name: /skip tour/i }));
    expect(mockOnboarding.skipOnboarding).toHaveBeenCalled();
  });

  it('Back button is not shown on first step', () => {
    render(<OnboardingFlow />);
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();
  });

  it('Next button advances to next step', () => {
    mockWallet.isConnected = true;
    mockWallet.accountRole = 'Treasurer';
    render(<OnboardingFlow />);
    // On role step, click Next
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    // Should advance to demo step
    expect(screen.getByText('Create Your First Proposal')).toBeInTheDocument();
  });
});
