#!/bin/bash

# VaultDAO Backend Issues - Push Commands
# Configure git and push all three branches

echo "=========================================="
echo "VaultDAO Backend - Push All Branches"
echo "=========================================="
echo ""

# Step 1: Configure git
echo "Step 1: Configuring git as milah-247..."
git config --global user.name "milah-247"
git config --global user.email "abiodunshittu247@gmail.com"
echo "✅ Git configured"
echo ""

# Step 2: Navigate to VaultDAO
echo "Step 2: Navigating to VaultDAO..."
cd VaultDAO || exit 1
echo "✅ In VaultDAO directory"
echo ""

# Step 3: Set remote to HTTPS (for Personal Access Token)
echo "Step 3: Setting remote to HTTPS..."
git remote set-url origin https://github.com/milah-247/VaultDAO.git
echo "✅ Remote set to HTTPS"
echo ""

# Step 4: Push Issue #567
echo "Step 4: Pushing Issue #567 (RPC Timeout Handling)..."
git checkout fix/567-rpc-timeout-handling
git push origin fix/567-rpc-timeout-handling
if [ $? -eq 0 ]; then
    echo "✅ Issue #567 pushed successfully"
else
    echo "❌ Failed to push Issue #567"
    echo "   Use Personal Access Token when prompted for password"
fi
echo ""

# Step 5: Push Issue #569
echo "Step 5: Pushing Issue #569 (Event Deduplication)..."
git checkout fix/569-event-deduplication
git push origin fix/569-event-deduplication
if [ $? -eq 0 ]; then
    echo "✅ Issue #569 pushed successfully"
else
    echo "❌ Failed to push Issue #569"
fi
echo ""

# Step 6: Push Issue #568
echo "Step 6: Pushing Issue #568 (ProposalEventTransformer Tests)..."
git checkout fix/568-proposal-transformer-tests
git push origin fix/568-proposal-transformer-tests
if [ $? -eq 0 ]; then
    echo "✅ Issue #568 pushed successfully"
else
    echo "❌ Failed to push Issue #568"
fi
echo ""

# Step 7: Verify
echo "Step 7: Verifying branches..."
echo "Remote branches:"
git branch -r | grep "fix/"
echo ""

echo "=========================================="
echo "Push Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Go to https://github.com/milah-247/VaultDAO"
echo "2. Create pull requests for each branch"
echo "3. Use descriptions from:"
echo "   - PR_567_RPC_TIMEOUT_HANDLING.md"
echo "   - PR_569_EVENT_DEDUPLICATION.md"
echo "   - PR_568_PROPOSAL_TRANSFORMER_TESTS.md"
echo ""
