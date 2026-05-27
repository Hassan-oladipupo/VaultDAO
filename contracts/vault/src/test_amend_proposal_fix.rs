#[cfg(test)]
mod test_amend_proposal_spending_limits {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env, Symbol, Vec};
    use crate::types::{Config, Role, Priority, ConditionLogic, ListMode};
    use crate::errors::VaultError;

    fn setup_test_env() -> (Env, VaultDAOClient<'static>, Address, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(VaultDAO, ());
        let client = VaultDAOClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let proposer = Address::generate(&env);
        let recipient = Address::generate(&env);
        let token = env.register_stellar_asset_contract_v2(admin.clone()).address();
        
        let token_client = soroban_sdk::token::StellarAssetClient::new(&env, &token);
        token_client.mint(&contract_id, &10000);

        let mut signers = Vec::new(&env);
        signers.push_back(admin.clone());
        signers.push_back(proposer.clone());

        let config = Config {
            signers,
            threshold: 1,
            spending_limit: 1000,
            daily_limit: 500,
            weekly_limit: 2000,
            proposal_duration: 86400,
            timelock_duration: 3600,
            native_token: token.clone(),
            list_mode: ListMode::None,
        };

        client.initialize(&admin, &config);
        client.set_role(&admin, &proposer, &Role::Treasurer);

        (env, client, admin, proposer, recipient, token)
    }

    #[test]
    fn test_amend_proposal_increase_amount_within_limit() {
        let (env, client, _admin, proposer, recipient, token) = setup_test_env();

        // Create initial proposal
        let proposal_id = client.propose_transfer(
            &proposer,
            &recipient,
            &token,
            &100_i128,
            &Symbol::new(&env, "memo"),
            &Priority::Normal,
            &Vec::new(&env),
            &ConditionLogic::And,
            &0_i128,
        );

        // Increase amount within limits should succeed
        client.amend_proposal(
            &proposer,
            &proposal_id,
            &recipient,
            &200_i128,
            &Symbol::new(&env, "edited"),
        );

        let proposal = client.get_proposal(&proposal_id);
        assert_eq!(proposal.amount, 200_i128);
        assert_eq!(proposal.memo, Symbol::new(&env, "edited"));
    }

    #[test]
    fn test_amend_proposal_increase_beyond_daily_limit() {
        let (env, client, admin, proposer, recipient, token) = setup_test_env();

        // Set low daily limit
        let mut config = client.get_config();
        config.daily_limit = 150;
        client.update_config(&admin, &config);

        // Create initial proposal
        let proposal_id = client.propose_transfer(
            &proposer,
            &recipient,
            &token,
            &100_i128,
            &Symbol::new(&env, "memo"),
            &Priority::Normal,
            &Vec::new(&env),
            &ConditionLogic::And,
            &0_i128,
        );

        // Try to increase beyond daily limit
        let res = client.try_amend_proposal(
            &proposer,
            &proposal_id,
            &recipient,
            &200_i128, // Would exceed daily limit of 150
            &Symbol::new(&env, "edited"),
        );
        assert_eq!(res.err(), Some(Ok(VaultError::ExceedsDailyLimit)));
    }

    #[test]
    fn test_amend_proposal_increase_beyond_weekly_limit() {
        let (env, client, admin, proposer, recipient, token) = setup_test_env();

        // Set low weekly limit
        let mut config = client.get_config();
        config.weekly_limit = 150;
        client.update_config(&admin, &config);

        // Create initial proposal
        let proposal_id = client.propose_transfer(
            &proposer,
            &recipient,
            &token,
            &100_i128,
            &Symbol::new(&env, "memo"),
            &Priority::Normal,
            &Vec::new(&env),
            &ConditionLogic::And,
            &0_i128,
        );

        // Try to increase beyond weekly limit
        let res = client.try_amend_proposal(
            &proposer,
            &proposal_id,
            &recipient,
            &200_i128, // Would exceed weekly limit of 150
            &Symbol::new(&env, "edited"),
        );
        assert_eq!(res.err(), Some(Ok(VaultError::ExceedsWeeklyLimit)));
    }

    #[test]
    fn test_amend_proposal_decrease_amount() {
        let (env, client, _admin, proposer, recipient, token) = setup_test_env();

        // Create initial proposal with higher amount
        let proposal_id = client.propose_transfer(
            &proposer,
            &recipient,
            &token,
            &300_i128,
            &Symbol::new(&env, "memo"),
            &Priority::Normal,
            &Vec::new(&env),
            &ConditionLogic::And,
            &0_i128,
        );

        // Get initial spending amounts
        let today = storage::get_day_number(&env);
        let initial_daily_spent = storage::get_daily_spent(&env, today);

        // Decrease amount should succeed and refund limits
        client.amend_proposal(
            &proposer,
            &proposal_id,
            &recipient,
            &150_i128,
            &Symbol::new(&env, "edited"),
        );

        let proposal = client.get_proposal(&proposal_id);
        assert_eq!(proposal.amount, 150_i128);

        // Verify spending limits were refunded
        let final_daily_spent = storage::get_daily_spent(&env, today);
        assert_eq!(final_daily_spent, initial_daily_spent - 150); // Refunded 150
    }

    #[test]
    fn test_amend_proposal_change_to_blacklisted_recipient() {
        let (env, client, admin, proposer, recipient, token) = setup_test_env();

        let blacklisted_recipient = Address::generate(&env);

        // Set up blacklist mode and blacklist a recipient
        client.set_list_mode(&admin, &ListMode::Blacklist);
        client.add_to_blacklist(&admin, &blacklisted_recipient);

        // Create initial proposal
        let proposal_id = client.propose_transfer(
            &proposer,
            &recipient,
            &token,
            &100_i128,
            &Symbol::new(&env, "memo"),
            &Priority::Normal,
            &Vec::new(&env),
            &ConditionLogic::And,
            &0_i128,
        );

        // Try to change to blacklisted recipient
        let res = client.try_amend_proposal(
            &proposer,
            &proposal_id,
            &blacklisted_recipient,
            &100_i128,
            &Symbol::new(&env, "edited"),
        );
        assert_eq!(res.err(), Some(Ok(VaultError::RecipientBlacklisted)));
    }

    #[test]
    fn test_amend_proposal_change_to_whitelisted_recipient() {
        let (env, client, admin, proposer, recipient, token) = setup_test_env();

        let whitelisted_recipient = Address::generate(&env);

        // Set up whitelist mode and whitelist a recipient
        client.set_list_mode(&admin, &ListMode::Whitelist);
        client.add_to_whitelist(&admin, &whitelisted_recipient);

        // Create initial proposal (this should fail since recipient not whitelisted)
        // But let's assume we can create it for testing amendment
        let proposal_id = client.propose_transfer(
            &proposer,
            &whitelisted_recipient, // Use whitelisted for initial
            &token,
            &100_i128,
            &Symbol::new(&env, "memo"),
            &Priority::Normal,
            &Vec::new(&env),
            &ConditionLogic::And,
            &0_i128,
        );

        // Try to change to non-whitelisted recipient
        let res = client.try_amend_proposal(
            &proposer,
            &proposal_id,
            &recipient, // Not whitelisted
            &100_i128,
            &Symbol::new(&env, "edited"),
        );
        assert_eq!(res.err(), Some(Ok(VaultError::RecipientNotWhitelisted)));
    }

    #[test]
    fn test_amend_proposal_resets_approvals() {
        let (env, client, admin, proposer, recipient, token) = setup_test_env();

        // Add another signer for multi-sig
        let signer2 = Address::generate(&env);
        client.add_signer(&admin, &signer2);
        client.set_role(&admin, &signer2, &Role::Treasurer);

        // Update threshold to require 2 signatures
        let mut config = client.get_config();
        config.threshold = 2;
        client.update_config(&admin, &config);

        // Create initial proposal
        let proposal_id = client.propose_transfer(
            &proposer,
            &recipient,
            &token,
            &100_i128,
            &Symbol::new(&env, "memo"),
            &Priority::Normal,
            &Vec::new(&env),
            &ConditionLogic::And,
            &0_i128,
        );

        // Get approval from second signer
        client.approve_proposal(&signer2, &proposal_id);

        let proposal_before = client.get_proposal(&proposal_id);
        assert_eq!(proposal_before.approvals.len(), 1);

        // Amend proposal
        client.amend_proposal(
            &proposer,
            &proposal_id,
            &recipient,
            &150_i128,
            &Symbol::new(&env, "edited"),
        );

        // Verify approvals were reset
        let proposal_after = client.get_proposal(&proposal_id);
        assert_eq!(proposal_after.approvals.len(), 0);
        assert_eq!(proposal_after.amount, 150_i128);
    }

    #[test]
    fn test_amend_proposal_creates_audit_entry() {
        let (env, client, _admin, proposer, recipient, token) = setup_test_env();

        // Create initial proposal
        let proposal_id = client.propose_transfer(
            &proposer,
            &recipient,
            &token,
            &100_i128,
            &Symbol::new(&env, "memo"),
            &Priority::Normal,
            &Vec::new(&env),
            &ConditionLogic::And,
            &0_i128,
        );

        let initial_audit_count = client.get_audit_entries().len();

        // Amend proposal
        client.amend_proposal(
            &proposer,
            &proposal_id,
            &recipient,
            &150_i128,
            &Symbol::new(&env, "edited"),
        );

        // Verify audit entry was created
        let final_audit_count = client.get_audit_entries().len();
        assert_eq!(final_audit_count, initial_audit_count + 1);

        let audit_entries = client.get_audit_entries();
        let last_entry = audit_entries.last().unwrap();
        assert_eq!(last_entry.action, AuditAction::AmendProposal);
        assert_eq!(last_entry.actor, proposer);
        assert_eq!(last_entry.target, proposal_id);
    }

    #[test]
    fn test_amend_proposal_emits_event() {
        let (env, client, _admin, proposer, recipient, token) = setup_test_env();

        // Create initial proposal
        let proposal_id = client.propose_transfer(
            &proposer,
            &recipient,
            &token,
            &100_i128,
            &Symbol::new(&env, "memo"),
            &Priority::Normal,
            &Vec::new(&env),
            &ConditionLogic::And,
            &0_i128,
        );

        // Amend proposal
        client.amend_proposal(
            &proposer,
            &proposal_id,
            &recipient,
            &150_i128,
            &Symbol::new(&env, "edited"),
        );

        // Verify event was emitted
        let events = env.events().all();
        let amendment_events: Vec<_> = events
            .iter()
            .filter(|e| e.0.as_tuple().unwrap().0.as_symbol().unwrap() == Symbol::new(&env, "proposal_amended"))
            .collect();
        
        assert_eq!(amendment_events.len(), 1);
        
        let event_data = amendment_events[0].1.as_tuple().unwrap();
        assert_eq!(event_data.3.as_i128().unwrap(), 100_i128); // old_amount
        assert_eq!(event_data.4.as_i128().unwrap(), 150_i128); // new_amount
    }

    #[test]
    fn test_amend_proposal_unauthorized() {
        let (env, client, _admin, proposer, recipient, token) = setup_test_env();

        let unauthorized_user = Address::generate(&env);

        // Create initial proposal
        let proposal_id = client.propose_transfer(
            &proposer,
            &recipient,
            &token,
            &100_i128,
            &Symbol::new(&env, "memo"),
            &Priority::Normal,
            &Vec::new(&env),
            &ConditionLogic::And,
            &0_i128,
        );

        // Try to amend with unauthorized user
        let res = client.try_amend_proposal(
            &unauthorized_user,
            &proposal_id,
            &recipient,
            &150_i128,
            &Symbol::new(&env, "edited"),
        );
        assert_eq!(res.err(), Some(Ok(VaultError::Unauthorized)));
    }

    #[test]
    fn test_amend_proposal_non_pending_status() {
        let (env, client, admin, proposer, recipient, token) = setup_test_env();

        // Create and execute a proposal
        let proposal_id = client.propose_transfer(
            &proposer,
            &recipient,
            &token,
            &100_i128,
            &Symbol::new(&env, "memo"),
            &Priority::Normal,
            &Vec::new(&env),
            &ConditionLogic::And,
            &0_i128,
        );

        // Execute the proposal to change its status
        client.execute_proposal(&admin, &proposal_id);

        // Try to amend executed proposal
        let res = client.try_amend_proposal(
            &proposer,
            &proposal_id,
            &recipient,
            &150_i128,
            &Symbol::new(&env, "edited"),
        );
        assert_eq!(res.err(), Some(Ok(VaultError::ProposalNotPending)));
    }
}
