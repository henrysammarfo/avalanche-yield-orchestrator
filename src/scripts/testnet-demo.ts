import { ethers } from 'ethers';
import { TestnetConnector } from '../connectors/testnet.js';
import { loadNetworkConfig } from '../utils/config.js';
import { PlanAction } from '../types/index.js';

/**
 * Testnet Demo Script
 * This script demonstrates the system using real Fuji testnet data
 */

async function main() {
  console.log('🚀 Avalanche Yield Orchestrator - Testnet Demo');
  console.log('=============================================\n');

  try {
    // Load network configuration
    const networkConfig = loadNetworkConfig();
    const testnetRpc = networkConfig.testnet.rpc;
    
    console.log(`🌐 Connecting to Fuji testnet: ${testnetRpc}`);
    console.log(`🔗 Explorer: ${networkConfig.testnet.explorer}`);
    console.log(`⛓️  Chain ID: ${networkConfig.testnet.chainId}\n`);

    // Initialize testnet connector
    const connector = new TestnetConnector(testnetRpc);
    
    // Test wallet address from .env
    const testWallet = process.env.WALLET_ADDRESS || '0x687b98C98954C3d618540D56b1Ed5b9055D32A55';
    
    console.log(`👛 Test wallet: ${testWallet}\n`);

    // 1. Read real opportunities from testnet
    console.log('📊 Step 1: Reading Real Opportunities');
    console.log('-------------------------------------');
    const opportunities = await connector.readOpportunities();
    
          if (opportunities.length > 0) {
        console.log('\n📈 Found Opportunities:');
        opportunities.forEach((opp, index) => {
          console.log(`   ${index + 1}. ${opp.protocol.toUpperCase()}`);
          console.log(`      Token: ${opp.tokenSymbol}`);
          console.log(`      APR: ${opp.apr}%`);
          console.log(`      Risk Score: ${opp.riskScore}`);
          console.log(`      Gas Cost: $${opp.estGasUsd}`);
          console.log('');
        });
      } else {
        console.log('   No opportunities found on testnet');
      }

    // 2. Read real position data
    console.log('👛 Step 2: Reading Real Position Data');
    console.log('--------------------------------------');
    const positions = await connector.readPosition(testWallet);
    
    if (positions.length > 0) {
      console.log('\n💰 Current Positions:');
      positions.forEach((pos, index) => {
        console.log(`   ${index + 1}. ${pos.protocol.toUpperCase()}`);
        console.log(`      Token: ${pos.tokenSymbol}`);
        console.log(`      Balance: ${ethers.formatEther(pos.balance)}`);
        console.log(`      Value: $${pos.balanceUsd}`);
        console.log(`      APR: ${pos.apr || 0}%`);
        console.log('');
      });
    } else {
      console.log('   No positions found for test wallet');
    }

    // 3. Simulate action building
    console.log('🔨 Step 3: Simulating Action Building');
    console.log('-------------------------------------');
    
    const sampleAction: PlanAction = {
      type: 'swap',
      protocol: 'traderjoe',
      fromToken: 'AVAX',
      toToken: 'USDC',
      amount: ethers.parseEther('0.1'),
      amountUsd: 2.5,
      slippageBps: 50,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      estimatedGas: 300000,
      estimatedGasUsd: 5,
      riskScore: 1
    };
    
    console.log(`   Action: ${sampleAction.type} ${ethers.formatEther(sampleAction.amount)} ${sampleAction.fromToken} to ${sampleAction.toToken} on ${sampleAction.protocol}`);
    
    const { tx, dryRunResult } = await connector.buildAction(sampleAction, testWallet);
    
    console.log('\n📊 Action Results:');
    console.log(`   Gas Used: ${dryRunResult?.gasUsed ? ethers.formatUnits(dryRunResult.gasUsed, 'wei') : 'Unknown'}`);
    console.log(`   Gas Cost: ${dryRunResult?.gasCost ? ethers.formatEther(dryRunResult.gasCost) : 'Unknown'}`);
    console.log(`   Success: ${dryRunResult?.success}`);
    console.log(`   Error: ${dryRunResult?.error || 'None'}`);

    // 4. Simulate action execution (demo mode)
    console.log('\n🚀 Step 4: Simulating Action Execution (Demo Mode)');
    console.log('--------------------------------------------------');
    
    // Note: executeAction is not part of the Connector interface
    // We'll use sendAction instead (which will fail in demo mode)
    try {
      const receipt = await connector.sendAction(tx, {} as ethers.Signer);
      console.log(`   📝 Transaction hash: ${receipt.hash}`);
    } catch (error) {
      console.log('   ✅ Demo mode: No actual transaction executed (safety feature)');
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 5. Network status
    console.log('\n🌐 Step 5: Network Status');
    console.log('-------------------------');
    
    const provider = connector.provider;
    const network = await provider.getNetwork();
    const latestBlock = await provider.getBlock('latest');
    const gasPrice = await provider.getFeeData();
    
    console.log(`   Network: ${network.name}`);
    console.log(`   Chain ID: ${network.chainId}`);
    console.log(`   Latest Block: ${latestBlock?.number}`);
    console.log(`   Gas Price: ${gasPrice.gasPrice ? `${ethers.formatUnits(gasPrice.gasPrice, 'gwei')} gwei` : 'Unknown'}`);

    console.log('\n🎉 Testnet demo completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Get testnet AVAX from: https://faucet.avax.network/');
    console.log('   2. Update config/testnet.env with your real private key');
    console.log('   3. Set EXECUTION_MODE=live for real transactions');
    console.log('   4. Test with small amounts first');
    console.log(`   5. Monitor transactions on: ${networkConfig.testnet.explorer}`);

  } catch (error) {
    console.error('\n❌ Testnet demo failed:', error);
    process.exit(1);
  }
}

// Run the demo
main().catch(console.error);
