// Proposal Amendment Spending Limit Re-Validation Implementation
// This file contains the corrected amend_proposal function that addresses issue #905

use soroban_sdk::{Env, Address, Symbol};
use crate::types::{AuditAction, ProposalStatus, ProposalAmendment};
use crate::errors::VaultError;
use crate::storage;
use crate::events;
use core::cmp::Ordering;

impl VaultDAO {
    /// Amends a proposal with proper spending limit re-validation
    /// 
    /// Requirements addressed:
    /// - Re-validates recipient against whitelist/blacklist
    /// - Re-checks spending limits with delta calculation
    /// - Handles amount increases and decreases atomically
    /// - Creates audit entry for successful amendments
    /// - Emits proposal_amended event with old and new amounts
    pub fn amend_proposal(
        env: Env,
        proposer: Address,
        proposal_id: u64,
        new_recipient: Address,
        new_amount: i128,
        new_memo: Symbol,
    ) -> Result<(), VaultError> {
        proposer.require_auth();

        let config = storage::get_config(&env)?;
        let mut proposal = storage::get_proposal(&env, proposal_id)?;

        // Basic validation
        if proposal.proposer != proposer {
            return Err(VaultError::Unauthorized);
        }
        if proposal.status != ProposalStatus::Pending {
            return Err(VaultError::ProposalNotPending);
        }
        if new_amount <= 0 {
            return Err(VaultError::InvalidAmount);
        }

        // Re-validate new recipient against whitelist/blacklist
        Self::validate_recipient(&env, &new_recipient)?;

        // Get reputation-adjusted limits for validation
        let mut rep = storage::get_reputation(&env, &proposer);
        storage::apply_reputation_decay(&env, &mut rep);
        
        let adjusted_spending_limit = if rep.score >= 900 {
            config.spending_limit * 3
        } else if rep.score >= 800 {
            config.spending_limit * 2
        } else {
            config.spending_limit
        };
        
        // Validate new amount against spending limit
        if new_amount > adjusted_spending_limit {
            return Err(VaultError::ExceedsProposalLimit);
        }

        let adjusted_daily_limit = if rep.score >= 750 {
            (config.daily_limit * 3) / 2
        } else {
            config.daily_limit
        };
        
        let adjusted_weekly_limit = if rep.score >= 750 {
            (config.weekly_limit * 3) / 2
        } else {
            config.weekly_limit
        };

        // Handle spending limit adjustments atomically
        // Calculate delta and update limits based on amount change
        match new_amount.cmp(&proposal.amount) {
            Ordering::Greater => {
                // Amount increased - reserve additional spending
                let delta = new_amount - proposal.amount;
                let today = storage::get_day_number(&env);
                let week = storage::get_week_number(&env);

                let spent_today = storage::get_daily_spent(&env, today);
                if spent_today + delta > adjusted_daily_limit {
                    return Err(VaultError::ExceedsDailyLimit);
                }
                
                let spent_week = storage::get_weekly_spent(&env, week);
                if spent_week + delta > adjusted_weekly_limit {
                    return Err(VaultError::ExceedsWeeklyLimit);
                }

                // Reserve the additional amount
                storage::add_daily_spent(&env, today, delta);
                storage::add_weekly_spent(&env, week, delta);
            }
            Ordering::Less => {
                // Amount decreased - refund the difference
                let delta = proposal.amount - new_amount;
                storage::refund_spending_limits(&env, delta);
            }
            Ordering::Equal => {
                // Amount unchanged - no spending limit adjustment needed
            }
        }

        // Create amendment record for tracking
        let amendment = ProposalAmendment {
            proposal_id,
            amended_by: proposer.clone(),
            amended_at_ledger: env.ledger().sequence() as u64,
            old_recipient: proposal.recipient.clone(),
            new_recipient: new_recipient.clone(),
            old_amount: proposal.amount,
            new_amount,
            old_memo: proposal.memo.clone(),
            new_memo: new_memo.clone(),
        };

        // Update proposal with new values
        proposal.recipient = new_recipient;
        proposal.amount = new_amount;
        proposal.memo = new_memo;
        
        // Reset approvals and abstentions since proposal changed
        proposal.approvals = Vec::new(&env);
        proposal.abstentions = Vec::new(&env);
        proposal.status = ProposalStatus::Pending;
        proposal.unlock_ledger = 0;

        // Persist changes
        storage::set_proposal(&env, &proposal);
        storage::add_amendment_record(&env, &amendment);
        
        // Create audit entry for the amendment
        storage::create_audit_entry(
            &env,
            AuditAction::AmendProposal,
            &proposer,
            proposal_id,
        );
        
        storage::extend_instance_ttl(&env);

        // Emit event with both old and new amounts
        events::emit_proposal_amended(&env, &amendment);

        Ok(())
    }
}
