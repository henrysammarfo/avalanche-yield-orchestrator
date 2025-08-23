

import { ethers } from 'ethers';
import { TraderJoeConnector } from '../connectors/traderjoe.js';
import { BenqiConnector } from '../connectors/benqi.js';
import { YieldYakConnector } from '../connectors/yieldyak.js';

/**
 * Monitor script - demonstrates monitoring opportunities across all protocols
 */
async function main() {
  console.log('🚀 Avalanche Yield Orchestrator - Monitor Mode');
  console.log('================================================\n');

  // Initialize mock provider (in production, use real RPC)
  const mockProvider = {
    call: async () => '0x',
    estimateGas: async () => BigInt(200000),
    getBlockNumber: async () => 12345
  } as any;

  // Initialize connectors
  const connectors = {
    traderjoe: new TraderJoeConnector(mockProvider),
    benqi: new BenqiConnector(mockProvider),
    yieldyak: new YieldYakConnector(mockProvider)
  };

  try {
    // Monitor opportunities across all protocols
    console.log('📊 Monitoring DeFi Opportunities...\n');

    const allOpportunities = await Promise.all([
      connectors.traderjoe.readOpportunities(),
      connectors.benqi.readOpportunities(),
      connectors.yieldyak.readOpportunities()
    ]);

    const [tjOpportunities, benqiOpportunities, yyOpportunities] = allOpportunities;

    // Display Trader Joe opportunities
    console.log('🦎 Trader Joe Opportunities:');
    console.log('----------------------------');
    tjOpportunities.forEach(opp => {
      console.log(`  • ${opp.tokenSymbol}: ${opp.apr.toFixed(2)}% APR, Risk: ${opp.riskScore.toFixed(1)}`);
    });
    console.log('');

    // Display Benqi opportunities
    console.log('🏦 Benqi Lending Opportunities:');
    console.log('--------------------------------');
    benqiOpportunities.forEach(opp => {
      console.log(`  • ${opp.tokenSymbol}: ${opp.apr.toFixed(2)}% APR, Risk: ${opp.riskScore.toFixed(1)}`);
    });
    console.log('');

    // Display Yield Yak opportunities
    console.log('🐑 Yield Yak Vault Opportunities:');
    console.log('----------------------------------');
    yyOpportunities.forEach(opp => {
      console.log(`  • ${opp.tokenSymbol}: ${opp.apr.toFixed(2)}% APR, Risk: ${opp.riskScore.toFixed(1)}`);
    });
    console.log('');

    // Summary
    const totalOpportunities = allOpportunities.reduce((sum, opps) => sum + opps.length, 0);
    const avgRisk = allOpportunities.flat().reduce((sum, opp) => sum + opp.riskScore, 0) / totalOpportunities;
    const bestOpportunity = allOpportunities.flat().reduce((best, opp) => 
      opp.apr > best.apr ? opp : best
    );

    console.log('📈 Summary:');
    console.log('-----------');
    console.log(`  Total Opportunities: ${totalOpportunities}`);
    console.log(`  Average Risk Score: ${avgRisk.toFixed(2)}`);
    console.log(`  Best APR: ${bestOpportunity.apr.toFixed(2)}% (${bestOpportunity.tokenSymbol})`);
    console.log('');

    console.log('✅ Monitoring complete! Use "pnpm run simulate" to generate action plans.');
    console.log('   Use "pnpm run backtest" to test strategies with historical data.');

  } catch (error) {
    console.error('❌ Error during monitoring:', error);
    process.exit(1);
  }
}

// Run the monitor
main().catch(console.error);
