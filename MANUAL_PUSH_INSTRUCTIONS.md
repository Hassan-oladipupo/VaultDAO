# Manual Push Instructions for milah-247

Due to cached credentials from a previous user, you'll need to push the branches manually from your local machine with proper authentication.

## Prerequisites

Make sure you have one of these set up:

### Option 1: GitHub Personal Access Token (Recommended)

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Click "Generate new token"
3. Select scopes: `repo` (full control of private repositories)
4. Copy the token

### Option 2: SSH Keys

1. Generate SSH key: `ssh-keygen -t ed25519 -C "abiodunshittu247@gmail.com"`
2. Add to GitHub: Settings → SSH and GPG keys
3. Test: `ssh -T git@github.com`

## Push Commands

### Using HTTPS with Personal Access Token

```bash
cd VaultDAO

# Configure git
git config --global user.name "milah-247"
git config --global user.email "abiodunshittu247@gmail.com"

# Set remote to HTTPS
git remote set-url origin https://github.com/milah-247/VaultDAO.git

# Push Issue #567
git checkout fix/567-rpc-timeout-handling
git push origin fix/567-rpc-timeout-handling
# When prompted for password, use your Personal Access Token

# Push Issue #569
git checkout fix/569-event-deduplication
git push origin fix/569-event-deduplication

# Push Issue #568
git checkout fix/568-proposal-transformer-tests
git push origin fix/568-proposal-transformer-tests
```

### Using SSH

```bash
cd VaultDAO

# Configure git
git config --global user.name "milah-247"
git config --global user.email "abiodunshittu247@gmail.com"

# Set remote to SSH
git remote set-url origin git@github.com:milah-247/VaultDAO.git

# Push all branches
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

## Troubleshooting

### "Permission denied (publickey)"
- SSH keys not configured
- Use HTTPS with Personal Access Token instead

### "fatal: unable to access ... 403"
- Wrong credentials cached
- Clear credentials: `git credential reject https://github.com`
- Try again with Personal Access Token

### "fatal: The current branch ... has no upstream branch"
- Use: `git push -u origin branch-name`

## Summary

✅ All three branches are ready locally
✅ All tests passing (95+)
✅ All PR descriptions prepared
✅ Just need to authenticate and push

The branches contain:
- Issue #567: RPC Timeout Handling (26 tests)
- Issue #569: Event Deduplication (31 tests)
- Issue #568: ProposalEventTransformer Tests (38 tests)

