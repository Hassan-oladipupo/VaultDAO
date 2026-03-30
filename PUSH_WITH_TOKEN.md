# Push Branches with Personal Access Token

## Step 1: Create Personal Access Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token"
3. Name it: `VaultDAO Push`
4. Select scope: `repo` (full control of private repositories)
5. Click "Generate token"
6. **Copy the token** (you won't see it again)

## Step 2: Push Branches

Use this command to push with your token:

```bash
cd VaultDAO

# Configure git
git config --global user.name "milah-247"
git config --global user.email "abiodunshittu247@gmail.com"

# Set remote with token (replace YOUR_TOKEN with your actual token)
git remote set-url origin https://milah-247:YOUR_TOKEN@github.com/milah-247/VaultDAO.git

# Push all three branches
git checkout fix/567-rpc-timeout-handling
git push origin fix/567-rpc-timeout-handling

git checkout fix/569-event-deduplication
git push origin fix/569-event-deduplication

git checkout fix/568-proposal-transformer-tests
git push origin fix/568-proposal-transformer-tests
```

## Step 3: Verify

```bash
git branch -r | grep fix/
```

You should see all three branches.

## Step 4: Create Pull Requests

1. Go to https://github.com/milah-247/VaultDAO
2. Create PR for each branch
3. Use descriptions from:
   - `PR_567_RPC_TIMEOUT_HANDLING.md`
   - `PR_569_EVENT_DEDUPLICATION.md`
   - `PR_568_PROPOSAL_TRANSFORMER_TESTS.md`

## Security Note

After pushing, you can revoke the token:
1. Go to https://github.com/settings/tokens
2. Click "Delete" next to the token

Or keep it for future use.

