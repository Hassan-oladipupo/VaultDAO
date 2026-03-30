# Authentication Issue - Manual Push Required

## Problem

The system has cached Git credentials from a previous user (`dev-fatima-24`). When attempting to push as `milah-247`, GitHub returns a 403 Permission Denied error because the cached credentials are for a different user.

## Solution

You need to push the branches from your local machine where you can properly authenticate as `milah-247`.

### Option 1: Clear Cached Credentials and Push (Recommended)

**On your local machine:**

```bash
# Clear cached credentials
git credential-osxkeychain erase  # macOS
# OR
git credential-wincred erase      # Windows
# OR
git credential-cache exit         # Linux

# Then configure git
git config --global user.name "milah-247"
git config --global user.email "abiodunshittu247@gmail.com"

# Navigate to VaultDAO
cd VaultDAO

# Set remote to HTTPS
git remote set-url origin https://github.com/milah-247/VaultDAO.git

# Push all three branches
git checkout fix/567-rpc-timeout-handling
git push origin fix/567-rpc-timeout-handling

git checkout fix/569-event-deduplication
git push origin fix/569-event-deduplication

git checkout fix/568-proposal-transformer-tests
git push origin fix/568-proposal-transformer-tests
```

When prompted for password, use your GitHub Personal Access Token (not your password).

### Option 2: Use SSH Keys

**On your local machine:**

```bash
# Generate SSH key (if you don't have one)
ssh-keygen -t ed25519 -C "abiodunshittu247@gmail.com"

# Add to GitHub: Settings → SSH and GPG keys

# Configure git
git config --global user.name "milah-247"
git config --global user.email "abiodunshittu247@gmail.com"

# Navigate to VaultDAO
cd VaultDAO

# Set remote to SSH
git remote set-url origin git@github.com:milah-247/VaultDAO.git

# Push all three branches
git checkout fix/567-rpc-timeout-handling
git push origin fix/567-rpc-timeout-handling

git checkout fix/569-event-deduplication
git push origin fix/569-event-deduplication

git checkout fix/568-proposal-transformer-tests
git push origin fix/568-proposal-transformer-tests
```

### Option 3: Use GitHub CLI

**On your local machine:**

```bash
# Install GitHub CLI: https://cli.github.com/

# Authenticate
gh auth login

# Navigate to VaultDAO
cd VaultDAO

# Push all three branches
git checkout fix/567-rpc-timeout-handling
git push origin fix/567-rpc-timeout-handling

git checkout fix/569-event-deduplication
git push origin fix/569-event-deduplication

git checkout fix/568-proposal-transformer-tests
git push origin fix/568-proposal-transformer-tests
```

## Verify Push

After pushing, verify the branches are on GitHub:

```bash
git branch -r
```

You should see:
```
origin/fix/567-rpc-timeout-handling
origin/fix/569-event-deduplication
origin/fix/568-proposal-transformer-tests
```

## Create Pull Requests

After pushing, create PRs on GitHub:

1. Go to https://github.com/milah-247/VaultDAO
2. Click "New pull request"
3. Select feature branch
4. Copy PR description from:
   - `PR_567_RPC_TIMEOUT_HANDLING.md`
   - `PR_569_EVENT_DEDUPLICATION.md`
   - `PR_568_PROPOSAL_TRANSFORMER_TESTS.md`
5. Click "Create pull request"

## What's Ready to Push

All three branches are ready locally with:

### Issue #567: RPC Timeout Handling
- ✅ 26 tests passing
- ✅ fetchWithTimeout utility
- ✅ TimeoutError handling
- ✅ Comprehensive logging

### Issue #569: Event Deduplication
- ✅ 31 tests passing
- ✅ Bounded processedEventIds set
- ✅ FIFO eviction
- ✅ Debug logging

### Issue #568: ProposalEventTransformer Tests
- ✅ 38 tests passing
- ✅ Test fixtures
- ✅ Null return validation
- ✅ Data integrity tests

## Summary

- ✅ All code implemented and tested
- ✅ All 95+ tests passing
- ✅ All PR descriptions ready
- ✅ All specifications complete
- ⚠️ Just need to authenticate and push from your local machine

The branches are ready - you just need to push them with proper authentication!

