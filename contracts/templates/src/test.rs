use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::Env;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn setup(e: &Env) -> (Address, Address, TemplateContractClient<'_>) {
    let admin = Address::generate(e);
    let contract_id = e.register(TemplateContract, ());
    let client = TemplateContractClient::new(e, &contract_id);
    client.initialize(&admin);
    (admin, contract_id, client)
}

fn advance_time(e: &Env, secs: u64) {
    e.ledger().set(soroban_sdk::testutils::LedgerInfo {
        timestamp: e.ledger().timestamp() + secs,
        protocol_version: 22,
        sequence_number: e.ledger().sequence() + 1,
        network_id: [0; 32],
        base_reserve: 10,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 1000,
    });
}

// ---------------------------------------------------------------------------
// initialize
// ---------------------------------------------------------------------------

#[test]
fn test_initialize_sets_admin() {
    let e = Env::default();
    e.mock_all_auths();
    let (admin, _, client) = setup(&e);
    assert_eq!(client.get_admin(), admin);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_initialize_twice_panics() {
    let e = Env::default();
    e.mock_all_auths();
    let (admin, _, client) = setup(&e);
    client.initialize(&admin); // second call must panic
}

// ---------------------------------------------------------------------------
// set_record
// ---------------------------------------------------------------------------

#[test]
fn test_set_record_stores_value_and_timestamp() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    advance_time(&e, 100);

    client.set_record(&owner, &42, &0);

    let rec = client.get_record(&owner);
    assert_eq!(rec.value, 42);
    assert_eq!(rec.updated_at, e.ledger().timestamp());
}

#[test]
fn test_set_record_overwrites_previous() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    client.set_record(&owner, &10, &0);
    advance_time(&e, 50);
    client.set_record(&owner, &99, &0);

    assert_eq!(client.get_record(&owner).value, 99);
}

#[test]
fn test_set_record_requires_admin_auth() {
    let e = Env::default();
    // Do NOT mock_all_auths — let the SDK enforce auth.
    let admin = Address::generate(&e);
    let contract_id = e.register(TemplateContract, ());
    let client = TemplateContractClient::new(&e, &contract_id);

    // initialize needs auth for the event publish path; mock just for setup.
    e.mock_all_auths();
    client.initialize(&admin);

    // Now clear mocks and verify that set_record checks admin auth.
    // The easiest way in the Soroban test harness is to confirm the auth
    // requirement is present by inspecting auths after a mocked call.
    let owner = Address::generate(&e);
    client.set_record(&owner, &1, &0);

    let auths = e.auths();
    // At least one auth entry must be for the admin address.
    assert!(auths.iter().any(|(addr, _)| addr == &admin));
}

// ---------------------------------------------------------------------------
// has_record / get_record
// ---------------------------------------------------------------------------

#[test]
fn test_has_record_false_before_set() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    assert!(!client.has_record(&owner));
}

#[test]
fn test_has_record_true_after_set() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    client.set_record(&owner, &7, &0);
    assert!(client.has_record(&owner));
}

#[test]
#[should_panic(expected = "record not found")]
fn test_get_record_panics_when_missing() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    client.get_record(&owner); // must panic
}

// ---------------------------------------------------------------------------
// remove_record
// ---------------------------------------------------------------------------

#[test]
fn test_remove_record_clears_entry() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    client.set_record(&owner, &5, &0);
    assert!(client.has_record(&owner));

    client.remove_record(&owner);
    assert!(!client.has_record(&owner));
}

#[test]
fn test_remove_nonexistent_record_is_noop() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    // Should not panic — removing a key that doesn't exist is a no-op.
    client.remove_record(&owner);
    assert!(!client.has_record(&owner));
}

// ---------------------------------------------------------------------------
// get_admin
// ---------------------------------------------------------------------------

#[test]
#[should_panic(expected = "not initialized")]
fn test_get_admin_panics_before_init() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(TemplateContract, ());
    let client = TemplateContractClient::new(&e, &contract_id);
    client.get_admin(); // must panic
}

// ---------------------------------------------------------------------------
// Timestamp advancement
// ---------------------------------------------------------------------------

#[test]
fn test_updated_at_reflects_ledger_time() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);

    advance_time(&e, 1_000);
    client.set_record(&owner, &1, &0);
    let t1 = client.get_record(&owner).updated_at;

    advance_time(&e, 500);
    client.set_record(&owner, &2, &0);
    let t2 = client.get_record(&owner).updated_at;

    assert!(t2 > t1);
}

// ---------------------------------------------------------------------------
// Negative values
// ---------------------------------------------------------------------------

#[test]
fn test_set_record_accepts_negative_value() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    client.set_record(&owner, &-100, &0);
    assert_eq!(client.get_record(&owner).value, -100);
}

// ---------------------------------------------------------------------------
// Multiple independent owners
// ---------------------------------------------------------------------------

#[test]
fn test_multiple_owners_are_independent() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let a = Address::generate(&e);
    let b = Address::generate(&e);

    client.set_record(&a, &10, &0);
    client.set_record(&b, &20, &0);

    assert_eq!(client.get_record(&a).value, 10);
    assert_eq!(client.get_record(&b).value, 20);

    client.remove_record(&a);
    assert!(!client.has_record(&a));
    assert!(client.has_record(&b));
}

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

#[test]
fn test_expiry_pattern() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    let now = e.ledger().timestamp();

    // Set a record that expires in 100 seconds
    client.set_record(&owner, &100, &(now + 100));

    assert!(client.has_record(&owner));
    assert!(!client.is_expired(&owner));

    // Advance exactly to expiry
    advance_time(&e, 100);

    assert!(client.is_expired(&owner));
    assert!(!client.has_record(&owner)); // has_record should purge and return false

    // Now it's truly gone
    assert!(!client.is_expired(&owner));
}

#[test]
#[should_panic(expected = "Error(Contract, #222)")]
fn test_get_expired_record_panics() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    let now = e.ledger().timestamp();
    client.set_record(&owner, &100, &(now + 10));

    advance_time(&e, 10);
    client.get_record(&owner); // panics and purges
  }

// ===========================================================================
// Boundary + recovery coverage (issue #1389)
// ===========================================================================

// ---------------------------------------------------------------------------
// Value boundaries (i128)
// ---------------------------------------------------------------------------

#[test]
fn test_set_record_accepts_zero_value() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    client.set_record(&owner, &0, &0);
    assert_eq!(client.get_record(&owner).value, 0);
    assert!(client.has_record(&owner));
}

#[test]
fn test_set_record_accepts_i128_max() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    client.set_record(&owner, &i128::MAX, &0);
    assert_eq!(client.get_record(&owner).value, i128::MAX);
}

#[test]
fn test_set_record_accepts_i128_min() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    client.set_record(&owner, &i128::MIN, &0);
    assert_eq!(client.get_record(&owner).value, i128::MIN);
}

// ---------------------------------------------------------------------------
// expires_at boundaries
// ---------------------------------------------------------------------------

#[test]
fn test_expires_at_zero_never_expires() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    client.set_record(&owner, &1, &0); // 0 = never expires

    advance_time(&e, 1_000_000);
    assert!(!client.is_expired(&owner));
    assert!(client.has_record(&owner));
    assert_eq!(client.get_record(&owner).value, 1);
}

#[test]
fn test_record_not_expired_one_second_before_deadline() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    let now = e.ledger().timestamp();
    client.set_record(&owner, &7, &(now + 10));

    advance_time(&e, 9);
    assert!(!client.is_expired(&owner));
    assert!(client.has_record(&owner));
    assert_eq!(client.get_record(&owner).value, 7);
}

#[test]
fn test_set_record_already_expired_at_write_time() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    let now = e.ledger().timestamp();
    // expires_at in the past relative to current ledger time
    if now > 0 {
        client.set_record(&owner, &3, &(now - 1));
    } else {
        // timestamp starts at 0 in default env; advance then set past expiry
        advance_time(&e, 50);
        let t = e.ledger().timestamp();
        client.set_record(&owner, &3, &(t - 1));
    }

    assert!(client.is_expired(&owner));
    assert!(!client.has_record(&owner)); // purge on has_record
}

// ---------------------------------------------------------------------------
// Uninitialized / permission failure paths
// ---------------------------------------------------------------------------

#[test]
#[should_panic(expected = "not initialized")]
fn test_set_record_panics_before_init() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(TemplateContract, ());
    let client = TemplateContractClient::new(&e, &contract_id);
    let owner = Address::generate(&e);
    client.set_record(&owner, &1, &0);
}

#[test]
#[should_panic(expected = "not initialized")]
fn test_remove_record_panics_before_init() {
    let e = Env::default();
    e.mock_all_auths();
    let contract_id = e.register(TemplateContract, ());
    let client = TemplateContractClient::new(&e, &contract_id);
    let owner = Address::generate(&e);
    client.remove_record(&owner);
}

#[test]
fn test_remove_record_requires_admin_auth() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let contract_id = e.register(TemplateContract, ());
    let client = TemplateContractClient::new(&e, &contract_id);

    e.mock_all_auths();
    client.initialize(&admin);

    let owner = Address::generate(&e);
    client.set_record(&owner, &1, &0);
    client.remove_record(&owner);

    let auths = e.auths();
    assert!(auths.iter().any(|(addr, _)| addr == &admin));
}

// ---------------------------------------------------------------------------
// Admin transfer (success + auth invariant)
// ---------------------------------------------------------------------------

#[test]
fn test_transfer_admin_updates_admin() {
    let e = Env::default();
    e.mock_all_auths();
    let (admin, _, client) = setup(&e);

    let new_admin = Address::generate(&e);
    client.transfer_admin(&new_admin);

    assert_eq!(client.get_admin(), new_admin);
    assert_ne!(client.get_admin(), admin);
}

#[test]
fn test_transfer_admin_requires_current_admin_auth() {
    let e = Env::default();
    let admin = Address::generate(&e);
    let contract_id = e.register(TemplateContract, ());
    let client = TemplateContractClient::new(&e, &contract_id);

    e.mock_all_auths();
    client.initialize(&admin);

    let new_admin = Address::generate(&e);
    client.transfer_admin(&new_admin);

    let auths = e.auths();
    assert!(auths.iter().any(|(addr, _)| addr == &admin));
}

#[test]
fn test_new_admin_can_mutate_after_transfer() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let new_admin = Address::generate(&e);
    client.transfer_admin(&new_admin);

    let owner = Address::generate(&e);
    client.set_record(&owner, &55, &0);
    assert_eq!(client.get_record(&owner).value, 55);
}

// ---------------------------------------------------------------------------
// Duplicate / idempotent ops
// ---------------------------------------------------------------------------

#[test]
fn test_duplicate_set_record_same_value_is_idempotent() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    client.set_record(&owner, &42, &0);
    client.set_record(&owner, &42, &0);

    assert_eq!(client.get_record(&owner).value, 42);
    assert!(client.has_record(&owner));
}

#[test]
fn test_double_remove_is_safe() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    client.set_record(&owner, &1, &0);
    client.remove_record(&owner);
    client.remove_record(&owner); // second remove must not panic

    assert!(!client.has_record(&owner));
}

// ---------------------------------------------------------------------------
// Recovery after expiry purge (no silent data loss for other owners)
// ---------------------------------------------------------------------------

#[test]
fn test_recovery_set_record_after_expiry_purge() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    let now = e.ledger().timestamp();
    client.set_record(&owner, &10, &(now + 5));

    advance_time(&e, 5);
    // Purge via has_record
    assert!(!client.has_record(&owner));

    // Recover: write a fresh non-expiring record
    client.set_record(&owner, &99, &0);
    assert!(client.has_record(&owner));
    assert_eq!(client.get_record(&owner).value, 99);
    assert!(!client.is_expired(&owner));
}

#[test]
fn test_get_expired_purges_then_recovery_succeeds() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    let now = e.ledger().timestamp();
    client.set_record(&owner, &10, &(now + 3));

    advance_time(&e, 3);

    // get_record panics and purges — exercise via try then recover
    // We cannot catch panic in the client easily; purge via has_record instead,
    // then prove storage is clean and writable again.
    assert!(!client.has_record(&owner));
    client.set_record(&owner, &20, &0);
    assert_eq!(client.get_record(&owner).value, 20);
}

#[test]
fn test_expiry_of_one_owner_does_not_affect_another() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let a = Address::generate(&e);
    let b = Address::generate(&e);
    let now = e.ledger().timestamp();

    client.set_record(&a, &1, &(now + 10)); // will expire
    client.set_record(&b, &2, &0); // never expires

    advance_time(&e, 10);

    assert!(!client.has_record(&a));
    assert!(client.has_record(&b));
    assert_eq!(client.get_record(&b).value, 2);
}

// ---------------------------------------------------------------------------
// Stale / sequential "concurrent" style ops (same owner)
// ---------------------------------------------------------------------------

#[test]
fn test_sequential_overwrites_keep_last_write_wins() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);

    client.set_record(&owner, &1, &0);
    client.set_record(&owner, &2, &0);
    client.set_record(&owner, &3, &0);

    assert_eq!(client.get_record(&owner).value, 3);
}

#[test]
fn test_remove_then_set_recovers_clean_state() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    client.set_record(&owner, &11, &0);
    client.remove_record(&owner);
    assert!(!client.has_record(&owner));

    client.set_record(&owner, &22, &0);
    assert_eq!(client.get_record(&owner).value, 22);
}

// ---------------------------------------------------------------------------
// Read helpers on missing / stale keys
// ---------------------------------------------------------------------------

#[test]
fn test_is_expired_false_when_no_record() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    assert!(!client.is_expired(&owner));
}

#[test]
fn test_is_expired_false_for_never_expiring_record() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    client.set_record(&owner, &1, &0);
    assert!(!client.is_expired(&owner));
}

#[test]
fn test_has_record_after_explicit_remove() {
    let e = Env::default();
    e.mock_all_auths();
    let (_, _, client) = setup(&e);

    let owner = Address::generate(&e);
    client.set_record(&owner, &1, &0);
    client.remove_record(&owner);
    assert!(!client.has_record(&owner));
    assert!(!client.is_expired(&owner));
      }
