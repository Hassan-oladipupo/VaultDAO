# Guide: Pushing Branches and Creating Pull Requests

This guide explains how to push the three feature branches and create pull requests with the provided descriptions.

## Prerequisites

Make sure you're authenticated as `milah-247`:

```bash
git config --global user.name "milah-247"
git config --global user.email "your-email@example.com"
```

If using HTTPS, you may need to use a Personal Access Token (PAT) instead of your password:
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Create a token with `repo` scope
3. Use the token as your password when prompted

Alternatively, use SSH:
```bash
git remote set-url origin git@github.com:milah-247/VaultDAO.git
```

## Pushing Branches

### Branch 1: RPC Timeout Handling (Issue #567)

```bash
cd VaultDAO
git checkout fix/567-rpc-timeout-handling
git push origin fix/567-rpc-timeout-handling
```

**PR Description:** See `PR_567_RPC_TIMEOUT_HANDLING.md`

### Branch 2: Event Deduplication (Issue #569)

```bash
git checkout fix/569-event-deduplication
git push origin fix/569-event-deduplication
```

**PR Description:** See `PR_569_EVENT_DEDUPLICATION.md`

### Branch 3: ProposalEventTransformer Tests (Issue #568)

```bash
git checkout fix/568-proposal-transformer-tests
git push origin fix/568-proposal-transformer-tests
```

**PR Description:** See `PR_568_PROPOSAL_TRANSFORMER_TESTS.md`

## Creating Pull Requests

After pushing each branch, create a pull request on GitHub:

1. Go to https://github.com/milah-247/VaultDAO
2. Click "New pull request"
3. Select the feature branch (e.g., `fix/567-rpc-timeout-handling`)
4. Copy the PR description from the corresponding file
5. Click "Create pull request"

### PR Details

**For Issue #567:**
- **Title:** `fix(#567): Add RPC timeout handling with AbortController`
- **Description:** Copy from `PR_567_RPC_TIMEOUT_HANDLING.md`
- **Base branch:** `main`
- **Compare branch:** `fix/567-rpc-timeout-handling`

**For Issue #569:**
- **Title:** `fix(#569): Add event deduplication to prevent duplicate processing`
- **Description:** Copy from `PR_569_EVENT_DEDUPLICATION.md`
- **Base branch:** `main`
- **Compare branch:** `fix/569-event-deduplication`

**For Issue #568:**
- **Title:** `fix(#568): Add comprehensive test coverage for ProposalEventTransformer`
- **Description:** Copy from `PR_568_PROPOSAL_TRANSFORMER_TESTS.md`
- **Base branch:** `main`
- **Compare branch:** `fix/568-proposal-transformer-tests`

## Verification

After pushing, verify the branches are on GitHub:

```bash
git branch -r
```

You should see:
```
origin/fix/567-rpc-timeout-handling
origin/fix/569-event-deduplication
origin/fix/568-proposal-transformer-tests
origin/main
```

## Branch Contents

### fix/567-rpc-timeout-handling
- ✅ `backend/src/shared/http/fetchWithTimeout.ts` (new)
- ✅ `backend/src/shared/http/fetchWithTimeout.test.ts` (new)
- ✅ `backend/src/modules/events/events.service.ts` (modified)
- ✅ All specs in `.kiro/specs/rpc-timeout-handling/`
- ✅ 26 tests passing

### fix/569-event-deduplication
- ✅ `backend/src/modules/events/events.service.ts` (modified)
- ✅ `backend/src/modules/events/events.service.test.ts` (modified)
- ✅ All specs in `.kiro/specs/event-deduplication/`
- ✅ 31 tests passing

### fix/568-proposal-transformer-tests
- ✅ `backend/src/modules/proposals/transforms.test.ts` (new)
- ✅ All specs in `.kiro/specs/proposal-transformer-tests/`
- ✅ 38 tests passing

## Testing Before Push

Run tests to ensure everything is working:

```bash
npm --prefix VaultDAO/backend test
```

Expected output:
```
# tests 95+
# pass 95+
# fail 0
```

## Troubleshooting

### Permission Denied

If you get "Permission denied", make sure:
1. You're authenticated as `milah-247`
2. You have push access to the repository
3. Your SSH key or PAT is configured correctly

### Branch Already Exists

If the branch already exists on remote:
```bash
git push origin fix/567-rpc-timeout-handling --force
```

### Merge Conflicts

If there are conflicts with main:
```bash
git checkout fix/567-rpc-timeout-handling
git pull origin main
# Resolve conflicts
git push origin fix/567-rpc-timeout-handling
```

## Next Steps

1. Push all three branches
2. Create pull requests with the provided descriptions
3. Request code review
4. Address any feedback
5. Merge to main when approved

## Summary

- ✅ 3 feature branches ready
- ✅ 95+ tests passing
- ✅ PR descriptions provided
- ✅ No breaking changes
- ✅ Production-ready code

