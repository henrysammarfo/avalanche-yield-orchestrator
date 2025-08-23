#!/bin/bash

# Avalanche Yield Orchestrator - Testnet Deployment Script
# This script deploys the system to Fuji testnet with real data

set -e

echo "🚀 Deploying Avalanche Yield Orchestrator to Fuji Testnet..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Load testnet configuration
if [ -f "config/testnet.env" ]; then
    echo "📋 Loading testnet configuration..."
    export $(cat config/testnet.env | grep -v '^#' | xargs)
else
    echo "❌ Error: testnet.env configuration file not found"
    exit 1
fi

# Build the project
echo "🔨 Building project..."
pnpm run build

# Initialize Prisma database
echo "🗄️  Initializing database..."
npx prisma generate
npx prisma db push

# Check if we have a real private key
if [ "$PRIVATE_KEY" = "0x0000000000000000000000000000000000000000000000000000000000000000" ]; then
    echo "⚠️  Warning: Using placeholder private key. For real deployment, update config/testnet.env"
    echo "   Set EXECUTION_MODE=demo for safe testing"
else
    echo "✅ Using configured private key"
    export EXECUTION_MODE=live
fi

# Test network connectivity
echo "🌐 Testing network connectivity..."
node -e "
import { ethers } from 'ethers';
const provider = new ethers.JsonRpcProvider('$RPC_URL');
provider.getNetwork().then(network => {
    console.log('Connected to network:', network.name, '(Chain ID:', network.chainId, ')');
    if (network.chainId !== $CHAIN_ID) {
        console.log('⚠️  Warning: Chain ID mismatch. Expected: $CHAIN_ID, Got:', network.chainId);
    }
}).catch(err => {
    console.error('❌ Network connection failed:', err.message);
    process.exit(1);
});
"

# Run demo scripts with real testnet data
echo "🧪 Running demo scripts with real testnet data..."

echo "1. Monitoring opportunities..."
pnpm run monitor

echo "2. Simulating actions..."
pnpm run simulate

echo "3. Running backtest..."
pnpm run backtest

echo ""
echo "🎉 Testnet deployment complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Update config/testnet.env with your real private key"
echo "   2. Set EXECUTION_MODE=live for real transactions"
echo "   3. Test with small amounts first"
echo "   4. Monitor logs and transactions"
echo ""
echo "🔗 Testnet Explorer: $EXPLORER_URL"
echo "🌐 RPC Endpoint: $RPC_URL"
echo "💰 Get testnet AVAX: https://faucet.avax.network/"
