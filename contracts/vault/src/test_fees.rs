//! Tests for the tiered recurring-payment fee system.
//!
//! Covers:
//!  - Default tier applies when payer has no volume history
//!  - Tier upgrade once cumulative volume crosses a threshold
//!  - Tier is retained within the same window after an upgrade
//!  - Volume and tier reset after the window expires
//!  - Fee is deducted from vault balance and credited to treasury
//!  - Volume accumulates correctly across multiple payments
//!  - Validation: max 5 tiers, minimum 1 bps, strictly ascending thresholds
//!  - Admin-only access to set_fee_tiers
//!  - get_applicable_fee returns 0 when no config exists
//!  - No fee collected when tier config is absent

use crate::types::{FeeStructure, FeeTier, RetryConfig, ThresholdStrategy, VelocityConfig};
use crate::{InitConfig, VaultDAO, VaultDAOClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::StellarAssetClient,
    Address, Env, Symbol, Vec,
};

// ============================================================================
// Constants matching contract constraints
// ============================================================================
const MIN_INTERVAL: u64 = 720; // 1-hour minimum enforced by schedule_payment

// ============================================================================
// Test helpers
// ============================================================================

fn default_init_config(env: &Env, admin: &Address) -> InitConfig {
    let mut signers = Vec::new(env);
    signers.push_back(admin.clone());

    InitConfig {
        signers,
        threshold: 1,
        quorum: 0,
        default_voting_deadline: 0,
        spending_limit: 100_000_000,
        daily_limit: 1_000_000_000,
        weekly_limit: 5_000_000_000,
        timelock_threshold: 900_000_000,
        timelock_delay: 100,
        velocity_limit: VelocityConfig {
            limit: 1_000_000_000,
            window: 3600,
        },
        threshold_strategy: ThresholdStrategy::Fixed,
        pre_execution_hooks: Vec::new(env),
        post_execution_hooks: Vec::new(env),
        veto_addresses: Vec::new(env),
        retry_config: RetryConfig {
            enabled: false,
            max_retries: 0,
            initial_backoff_ledgers: 0,
        },
        recovery_config: crate::types::RecoveryConfig::default(env),
        staking_config: crate::types::StakingConfig::default(),
        admin_rotation_delay: 1440,
    }
}

/// Shared setup: fresh env, registered contract, initialised vault, funded token,
/// and a fee structure with a known treasury.
/// Returns (env, client, admin_address, token_address, treasury_address).
fn setup() -> (Env, VaultDAOClient<'static>, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultDAO, ());
    let client = VaultDAOClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin, &default_init_config(&env, &admin));

    // Create a SAC token and fund the vault with a generous balance
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token = token_contract.address();
    let sac = StellarAssetClient::new(&env, &token);
    sac.mint(&contract_id, &500_000_000i128);

    // Configure a FeeStructure so the treasury address is known to the contract.
    // The tier fee system re-uses this treasury as the fee destination.
    let treasury = Address::generate(&env);
    let fee_structure = FeeStructure {
        tiers: Vec::new(&env),
        base_fee_bps: 50,
        reputation_discount_threshold: 750,
        reputation_discount_percentage: 0,
        treasury: treasury.clone(),
        enabled: true,
    };
    client.set_fee_structure(&admin, &fee_structure);

    (env, client, admin, token, treasury)
}

fn one_tier(env: &Env, threshold: i128, bps: u32) -> Vec<FeeTier> {
    let mut tiers = Vec::new(env);
    tiers.push_back(FeeTier {
        volume_threshold: threshold,
        fee_bps: bps,
    });
    tiers
}

fn two_tiers(env: &Env, t1: i128, bps1: u32, t2: i128, bps2: u32) -> Vec<FeeTier> {
    let mut tiers = Vec::new(env);
    tiers.push_back(FeeTier {
        volume_threshold: t1,
        fee_bps: bps1,
    });
    tiers.push_back(FeeTier {
        volume_threshold: t2,
        fee_bps: bps2,
    });
    tiers
}

/// Schedule a recurring payment with the minimum allowed interval.
/// `proposer` must be an admin or treasurer.
fn schedule(
    client: &VaultDAOClient,
    proposer: &Address,
    recipient: &Address,
    token: &Address,
    amount: i128,
    memo: &str,
) -> u64 {
    let env = &client.env;
    client.schedule_payment(
        proposer,
        recipient,
        token,
        &amount,
        &Symbol::new(env, memo),
        &MIN_INTERVAL,
    )
}

/// Advance the ledger far enough to make the next payment executable
/// (past next_payment_ledger = current + MIN_INTERVAL).
fn advance_past_interval(env: &Env) {
    env.ledger()
        .with_mut(|li| li.sequence_number += MIN_INTERVAL as u32 + 1);
}

// ============================================================================
// Test 1 – get_applicable_fee returns 0 when no tier config exists
// ============================================================================

#[test]
fn test_no_tier_config_returns_zero() {
    let (env, client, _admin, _token, _treasury) = setup();
    let payer = Address::generate(&env);
    // No set_fee_tiers call → should return 0
    assert_eq!(client.get_applicable_fee(&payer), 0);
}

// ============================================================================
// Test 2 – default tier (no history): payer gets the first tier's rate
// ============================================================================

#[test]
fn test_default_tier_no_history() {
    let (env, client, admin, _token, _treasury) = setup();

    // Two tiers: 50 bps for everyone (threshold 0), 30 bps above 1_000_000
    let tiers = two_tiers(&env, 0, 50, 1_000_000, 30);
    client.set_fee_tiers(&admin, &tiers, &0u64);

    let payer = Address::generate(&env);
    // Zero volume meets threshold 0 → first tier applies
    assert_eq!(client.get_applicable_fee(&payer), 50);
}

// ============================================================================
// Test 3 – tier upgrade after crossing volume threshold
// ============================================================================

#[test]
fn test_tier_upgrade_after_threshold_crossed() {
    let (env, client, admin, token, _treasury) = setup();

    // Tiers: 50 bps (threshold 0), 30 bps (threshold 500_000)
    let tiers = two_tiers(&env, 0, 50, 500_000, 30);
    // Window of 5000 ledgers (well above MIN_INTERVAL) so we stay in the same window
    client.set_fee_tiers(&admin, &tiers, &5_000u64);

    let recipient = Address::generate(&env);

    // admin is proposer; payment of 600_000 crosses the 500_000 tier
    let id = schedule(&client, &admin, &recipient, &token, 600_000, "pay1");
    advance_past_interval(&env);
    client.execute_recurring_payment(&id);

    // Cumulative volume = 600_000 ≥ 500_000 → tier 2 (30 bps)
    assert_eq!(client.get_applicable_fee(&admin), 30);
}

// ============================================================================
// Test 4 – tier retained within the same window
// ============================================================================

#[test]
fn test_tier_retention_within_window() {
    let (env, client, admin, token, _treasury) = setup();

    let tiers = two_tiers(&env, 0, 50, 500_000, 30);
    // Window of 5000 ledgers; advance of 50 stays well within it
    client.set_fee_tiers(&admin, &tiers, &5_000u64);

    let recipient = Address::generate(&env);
    let id = schedule(&client, &admin, &recipient, &token, 600_000, "pay1");
    advance_past_interval(&env); // +721 ledgers
    client.execute_recurring_payment(&id);
    assert_eq!(client.get_applicable_fee(&admin), 30);

    // Advance a small number of ledgers (still inside the 5000-ledger window)
    env.ledger().with_mut(|li| li.sequence_number += 50);

    // Rate persists: volume was not reset
    assert_eq!(client.get_applicable_fee(&admin), 30);
}

// ============================================================================
// Test 5 – tier resets to default after window expires
// ============================================================================

#[test]
fn test_tier_resets_after_window_expiry() {
    let (env, client, admin, token, _treasury) = setup();

    // Short window: expires shortly after the first payment
    let window: u64 = 800;
    let tiers = two_tiers(&env, 0, 50, 500_000, 30);
    client.set_fee_tiers(&admin, &tiers, &window);

    let recipient = Address::generate(&env);
    let id = schedule(&client, &admin, &recipient, &token, 600_000, "pay1");
    // After advance_past_interval the ledger is at 721.
    // window_start is recorded as 721 during execute_recurring_payment.
    advance_past_interval(&env); // ledger → 721
    client.execute_recurring_payment(&id);
    assert_eq!(client.get_applicable_fee(&admin), 30); // tier 2 active

    // Jump past the window boundary: window=800, window_start=721 → expiry at 1521.
    // Current ledger is 721; we need to reach at least 1522 → advance 801 more.
    env.ledger().with_mut(|li| li.sequence_number += 801);

    // Volume window has elapsed → effective volume = 0 → first tier (50 bps)
    assert_eq!(client.get_applicable_fee(&admin), 50);
}

// ============================================================================
// Test 6 – fee amount deducted from vault and credited to treasury
// ============================================================================

#[test]
fn test_fee_collected_to_treasury() {
    let (env, client, admin, token, treasury) = setup();

    // 100 bps (1%) for all payers, threshold 0
    let tiers = one_tier(&env, 0, 100);
    client.set_fee_tiers(&admin, &tiers, &0u64);

    let token_client = soroban_sdk::token::TokenClient::new(&env, &token);
    let recipient = Address::generate(&env);

    // Payment of 10_000 → fee = 10_000 * 100 / 10_000 = 100
    let id = schedule(&client, &admin, &recipient, &token, 10_000, "pay1");
    advance_past_interval(&env);
    client.execute_recurring_payment(&id);

    // get_fees_collected tracks cumulative fees across the contract
    assert_eq!(client.get_fees_collected(&token), 100);

    // Treasury should hold exactly the fee
    assert_eq!(token_client.balance(&treasury), 100);

    // Recipient should hold the full payment (fee is a vault cost, not deducted from payment)
    assert_eq!(token_client.balance(&recipient), 10_000);
}

// ============================================================================
// Test 7 – volume accumulates across multiple payments within the window
// ============================================================================

#[test]
fn test_volume_accumulates_across_payments() {
    let (env, client, admin, token, _treasury) = setup();

    // Tier 2 unlocks at 1_000_000 cumulative volume
    let tiers = two_tiers(&env, 0, 50, 1_000_000, 20);
    // Window of 5000 ledgers; two advances of 721 stay well within it
    client.set_fee_tiers(&admin, &tiers, &5_000u64);

    let recipient = Address::generate(&env);

    // First payment: 600_000; cumulative = 600_000 < 1_000_000 → 50 bps
    let id = schedule(&client, &admin, &recipient, &token, 600_000, "pay1");
    advance_past_interval(&env); // ledger → 721
    client.execute_recurring_payment(&id);
    assert_eq!(client.get_applicable_fee(&admin), 50);

    // Second execution: next_payment_ledger = 721 + 720 = 1441 → advance past it
    advance_past_interval(&env); // ledger → 1442
    client.execute_recurring_payment(&id);

    // Cumulative volume = 1_200_000 ≥ 1_000_000 → 20 bps
    assert_eq!(client.get_applicable_fee(&admin), 20);
}

// ============================================================================
// Test 8 – validation: more than 5 tiers is rejected
// ============================================================================

#[test]
#[should_panic]
fn test_validation_max_five_tiers() {
    let (env, client, admin, _token, _treasury) = setup();

    let mut tiers = Vec::new(&env);
    for i in 0..6u32 {
        tiers.push_back(FeeTier {
            volume_threshold: (i as i128) * 100_000,
            fee_bps: 50 - i, // decreasing fee (higher volume = lower cost)
        });
    }
    client.set_fee_tiers(&admin, &tiers, &0u64);
}

// ============================================================================
// Test 9 – validation: fee_bps of 0 is rejected (minimum 1 bps)
// ============================================================================

#[test]
#[should_panic]
fn test_validation_zero_fee_bps_rejected() {
    let (env, client, admin, _token, _treasury) = setup();

    let tiers = one_tier(&env, 0, 0); // 0 bps must be rejected
    client.set_fee_tiers(&admin, &tiers, &0u64);
}

// ============================================================================
// Test 10 – only admin can call set_fee_tiers
// ============================================================================

#[test]
#[should_panic]
fn test_set_fee_tiers_requires_admin() {
    let (env, client, _admin, _token, _treasury) = setup();

    let non_admin = Address::generate(&env);
    let tiers = one_tier(&env, 0, 30);
    client.set_fee_tiers(&non_admin, &tiers, &0u64);
}

// ============================================================================
// Test 11 – no fee collected when tier config is absent
// ============================================================================

#[test]
fn test_no_fee_when_no_tier_config() {
    let (env, client, admin, token, _treasury) = setup();

    let recipient = Address::generate(&env);
    // No set_fee_tiers → fee_bps = 0 → no fee transfer
    let id = schedule(&client, &admin, &recipient, &token, 10_000, "pay1");
    advance_past_interval(&env);
    client.execute_recurring_payment(&id);

    assert_eq!(client.get_fees_collected(&token), 0);
}

// ============================================================================
// Test 12 – validation: tiers must be strictly ascending by volume_threshold
// ============================================================================

#[test]
#[should_panic]
fn test_validation_tiers_must_be_ascending() {
    let (env, client, admin, _token, _treasury) = setup();

    // Higher threshold comes first → invalid ordering
    let tiers = two_tiers(&env, 500_000, 30, 100_000, 50);
    client.set_fee_tiers(&admin, &tiers, &0u64);
}
