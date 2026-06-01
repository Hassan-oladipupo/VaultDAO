/**
 * OnboardingFlow — role-specific guided onboarding with react-joyride product tour.
 *
 * Steps:
 *  1. Connect wallet (auto-advances when wallet connects)
 *  2. Role explanation card with permissions summary
 *  3. Interactive demo — create a test proposal (optional, skippable)
 *  4. Set notification preferences via NotificationSettings
 *  5. Completion with confetti animation and "You're ready!" message
 *
 * Persists completion state per wallet address in localStorage.
 * Can be re-triggered from Settings page via startOnboarding().
 */

import React, { useEffect, useState, useCallback } from 'react';
import Joyride, { type CallBackProps, STATUS, EVENTS } from 'react-joyride';
import { ChevronRight, ChevronLeft, X, CheckCircle } from 'lucide-react';
import { useOnboarding } from '../context/OnboardingProvider';
import { useWallet } from '../hooks/useWallet';

// ─── Per-wallet completion storage ───────────────────────────────────────────

const ONBOARDING_DONE_PREFIX = 'vaultdao_onboarding_done_';

function isOnboardingDone(address: string | null): boolean {
  if (!address) return false;
  try { return localStorage.getItem(`${ONBOARDING_DONE_PREFIX}${address}`) === 'true'; } catch { return false; }
}

function markOnboardingDone(address: string | null): void {
  if (!address) return;
  try { localStorage.setItem(`${ONBOARDING_DONE_PREFIX}${address}`, 'true'); } catch { /* ignore */ }
}

// ─── Role-specific step definitions ──────────────────────────────────────────

interface RoleStep {
  id: string;
  title: string;
  description: string;
  skippable?: boolean;
  joyrideTarget?: string;
}

const COMMON_STEPS: RoleStep[] = [
  {
    id: 'connect',
    title: 'Connect Your Wallet',
    description: 'Connect your Freighter, Albedo, or Rabet wallet to get started with VaultDAO.',
    joyrideTarget: '[data-tour="wallet-connect"]',
  },
];

const ROLE_STEPS: Record<string, RoleStep[]> = {
  Admin: [
    {
      id: 'role-admin',
      title: 'You are an Admin',
      description: 'As Admin you can manage signers, update vault configuration, set spending limits, and execute emergency controls.',
      joyrideTarget: '[data-tour="role-badge"]',
    },
    {
      id: 'demo-admin',
      title: 'Manage Signers',
      description: 'Head to Settings → Role Management to add or remove signers. You can also set M-of-N thresholds.',
      skippable: true,
      joyrideTarget: '[data-tour="settings-nav"]',
    },
  ],
  Treasurer: [
    {
      id: 'role-treasurer',
      title: 'You are a Treasurer',
      description: 'As Treasurer you can create proposals, approve transfers, and monitor spending limits.',
      joyrideTarget: '[data-tour="role-badge"]',
    },
    {
      id: 'demo-treasurer',
      title: 'Create Your First Proposal',
      description: 'Click "New Proposal" to create a test transfer on testnet. This step is optional.',
      skippable: true,
      joyrideTarget: '[data-tour="new-proposal-btn"]',
    },
  ],
  Member: [
    {
      id: 'role-member',
      title: 'You are a Member',
      description: 'As Member you can view proposals and cast votes. Your vote counts toward the M-of-N threshold.',
      joyrideTarget: '[data-tour="role-badge"]',
    },
    {
      id: 'demo-member',
      title: 'Cast Your First Vote',
      description: 'Browse the Proposals page and approve or reject pending proposals.',
      skippable: true,
      joyrideTarget: '[data-tour="proposals-nav"]',
    },
  ],
};

const NOTIFICATION_STEP: RoleStep = {
  id: 'notifications',
  title: 'Set Notification Preferences',
  description: 'Choose how you want to be notified about proposals, approvals, and executions.',
  joyrideTarget: '[data-tour="notification-settings"]',
};

const COMPLETE_STEP: RoleStep = {
  id: 'complete',
  title: "You're Ready! 🎉",
  description: 'You have completed the VaultDAO onboarding. Explore the dashboard and start managing your treasury.',
};

function buildSteps(role: string | null, walletConnected: boolean): RoleStep[] {
  const steps: RoleStep[] = [];
  if (!walletConnected) steps.push(COMMON_STEPS[0]);
  const roleKey = role && ROLE_STEPS[role] ? role : 'Member';
  steps.push(...ROLE_STEPS[roleKey]);
  steps.push(NOTIFICATION_STEP);
  steps.push(COMPLETE_STEP);
  return steps;
}

// ─── Role permissions summary ─────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<string, string[]> = {
  Admin: ['Manage signers', 'Update vault config', 'Set spending limits', 'Emergency controls', 'Create & approve proposals'],
  Treasurer: ['Create proposals', 'Approve transfers', 'Monitor spending limits', 'View analytics'],
  Member: ['View proposals', 'Cast votes', 'View treasury balance'],
};

// ─── Confetti component ───────────────────────────────────────────────────────

const Confetti: React.FC = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
    {Array.from({ length: 30 }).map((_, i) => (
      <span
        key={i}
        className="absolute block h-2 w-2 rounded-sm opacity-0"
        style={{
          left: `${Math.random() * 100}%`,
          top: '-8px',
          backgroundColor: ['#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'][i % 5],
          animation: `confetti-fall ${1.5 + Math.random()}s ease-in ${Math.random() * 0.8}s forwards`,
          transform: `rotate(${Math.random() * 360}deg)`,
        }}
      />
    ))}
    <style>{`
      @keyframes confetti-fall {
        0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
      }
    `}</style>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

interface OnboardingFlowProps {
  onComplete?: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const { isOnboardingActive, skipOnboarding, completeStep, restartOnboarding } = useOnboarding();
  const { isConnected, address, accountRole } = useWallet();

  const steps = buildSteps(accountRole ?? null, isConnected);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [runTour, setRunTour] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Auto-advance step 0 (connect wallet) when wallet connects
  useEffect(() => {
    if (isConnected && steps[currentIdx]?.id === 'connect') {
      setCurrentIdx(1);
    }
  }, [isConnected, currentIdx, steps]);

  // Skip onboarding for returning wallets
  useEffect(() => {
    if (isOnboardingActive && address && isOnboardingDone(address)) {
      skipOnboarding();
    }
  }, [isOnboardingActive, address, skipOnboarding]);

  const currentStep = steps[currentIdx];
  const isLastStep = currentIdx === steps.length - 1;
  const isFirstStep = currentIdx === 0;

  const handleNext = useCallback(() => {
    if (currentStep) completeStep(currentStep.id);
    if (isLastStep) {
      markOnboardingDone(address ?? null);
      setShowConfetti(true);
      setTimeout(() => {
        skipOnboarding();
        onComplete?.();
      }, 2500);
    } else {
      setCurrentIdx((i) => i + 1);
    }
  }, [currentStep, isLastStep, address, completeStep, skipOnboarding, onComplete]);

  const handleBack = () => setCurrentIdx((i) => Math.max(0, i - 1));

  const handleSkip = () => {
    skipOnboarding();
    onComplete?.();
  };

  // Joyride steps for the product tour
  const joyrideSteps = steps
    .filter((s) => s.joyrideTarget)
    .map((s) => ({
      target: s.joyrideTarget!,
      content: s.description,
      title: s.title,
      disableBeacon: true,
    }));

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) setRunTour(false);
    if (type === EVENTS.STEP_AFTER) setCurrentIdx((i) => Math.min(i + 1, steps.length - 1));
  };

  if (!isOnboardingActive) return null;
  if (!currentStep) return null;

  const roleKey = accountRole && ROLE_PERMISSIONS[accountRole] ? accountRole : null;
  const isRoleStep = currentStep.id.startsWith('role-');
  const isCompleteStep = currentStep.id === 'complete';

  return (
    <>
      {showConfetti && <Confetti />}

      {/* Joyride product tour */}
      <Joyride
        steps={joyrideSteps}
        run={runTour}
        continuous
        showSkipButton
        showProgress
        callback={handleJoyrideCallback}
        styles={{
          options: {
            primaryColor: '#9333ea',
            backgroundColor: '#1f2937',
            textColor: '#f9fafb',
            arrowColor: '#1f2937',
          },
        }}
      />

      {/* Modal overlay */}
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleSkip} />
        <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
          {/* Close */}
          <button
            onClick={handleSkip}
            className="absolute right-4 top-4 rounded-lg p-2 text-white/70 hover:bg-white/10 transition-colors"
            aria-label="Skip onboarding"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="p-8">
            {/* Progress */}
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-purple-400">
                Step {currentIdx + 1} of {steps.length}
              </span>
              <span className="text-sm text-white/50">
                {Math.round(((currentIdx + 1) / steps.length) * 100)}%
              </span>
            </div>
            <div className="mb-6 h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                style={{ width: `${((currentIdx + 1) / steps.length) * 100}%` }}
              />
            </div>

            {/* Step content */}
            {isCompleteStep ? (
              <div className="text-center">
                <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-400" />
                <h2 className="mb-3 text-2xl font-bold text-white">{currentStep.title}</h2>
                <p className="mb-6 leading-relaxed text-white/70">{currentStep.description}</p>
              </div>
            ) : (
              <>
                <h2 className="mb-3 text-2xl font-bold text-white">{currentStep.title}</h2>
                <p className="mb-4 leading-relaxed text-white/70">{currentStep.description}</p>

                {/* Role permissions card */}
                {isRoleStep && roleKey && (
                  <div className="mb-4 rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
                    <p className="mb-2 text-sm font-semibold text-purple-300">Your permissions:</p>
                    <ul className="space-y-1">
                      {ROLE_PERMISSIONS[roleKey].map((perm) => (
                        <li key={perm} className="flex items-center gap-2 text-sm text-white/80">
                          <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-400" />
                          {perm}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {!isFirstStep && (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-white transition-colors hover:bg-white/20"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
              )}
              {currentStep.skippable && (
                <button
                  onClick={() => setCurrentIdx((i) => i + 1)}
                  className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/20"
                >
                  Skip step
                </button>
              )}
              <button
                onClick={handleSkip}
                className="flex-1 rounded-lg bg-white/10 px-4 py-2 text-white/70 transition-colors hover:bg-white/20"
              >
                Skip Tour
              </button>
              <button
                onClick={handleNext}
                disabled={currentStep.id === 'connect' && !isConnected}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2 font-semibold text-white transition-all hover:from-purple-700 hover:to-pink-700 disabled:opacity-40"
              >
                {isLastStep ? 'Finish' : 'Next'}
                {!isLastStep && <ChevronRight className="h-4 w-4" />}
              </button>
            </div>

            {/* Product tour trigger */}
            {joyrideSteps.length > 0 && !isCompleteStep && (
              <button
                onClick={() => setRunTour(true)}
                className="mt-3 w-full text-center text-xs text-purple-400 hover:text-purple-300 underline"
              >
                Start interactive tour
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
