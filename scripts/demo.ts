#!/usr/bin/env ts-node --esm

import { ethers } from 'ethers';
import { TraderJoeConnector } from '../src/connectors/traderjoe.js';
import { BenqiConnector } from '../src/connectors/benqi.js';
import { YieldYakConnector } from '../src/connectors/yieldyak.js';
import { PlanAction } from '../src/types/index.js';
import { calculateDeadline, usdToToken } from '../src/utils/helpers.js';

// Configuration
const RPC_URL = process.env.RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc'; // Fuji testnet
const WALLET_ADDRESS = process.env.WALLET_ADDRESS || '0x1234567890123456789012345678901234567890';
const EXECUTION_MODE = process.env.EXECUTION_MODE || 'suggest'; // 'suggest' or 'auto'

async function main() {
  console.log('🚀 Avalanche Yield Orchestrator Demo');
  console.log('=====================================\n');

  try {
    // Initialize provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log(`✅ Connected to ${RPC_URL.includes('test') ? 'Fuji Testnet' : 'Avalanche Mainnet'}\n`);

    // Initialize connectors
    const connectors = {
      traderjoe: new TraderJoeConnector(provider),
      benqi: new BenqiConnector(provider),
      yieldyak: new YieldYakConnector(provider)
    };

    console.log('📊 Step 1: Reading Opportunities');
    console.log('--------------------------------');

    // Read opportunities from all protocols
    const allOpportunities = await Promise.all([
      connectors.traderjoe.readOpportunities(),
      connectors.benqi.readOpportunities(),
      connectors.yieldyak.readOpportunities()
    ]);

    const [tjOpps, benqiOpps, yyOpps] = allOpportunities;
    
    console.log(`Trader Joe: ${tjOpps.length} opportunities`);
    tjOpps.forEach(opp => {
      console.log(`  - ${opp.tokenSymbol}: ${opp.apr.toFixed(2)}% APR, Risk: ${opp.riskScore}`);
    });

    console.log(`\nBenqi: ${benqiOpps.length} opportunities`);
    benqiOpps.forEach(opp => {
      console.log(`  - ${opp.tokenSymbol}: ${opp.apr.toFixed(2)}% APR, Risk: ${opp.riskScore}`);
    });

    console.log(`\nYield Yak: ${yyOpps.length} opportunities`);
    yyOpps.forEach(opp => {
      console.log(`  - ${opp.tokenSymbol}: ${opp.apr.toFixed(2)}% APR, Risk: ${opp.riskScore}`);
    });

    console.log('\n📈 Step 2: Reading Current Positions');
    console.log('------------------------------------');

    // Read current positions
    const allPositions = await Promise.all([
      connectors.traderjoe.readPosition(WALLET_ADDRESS),
      connectors.benqi.readPosition(WALLET_ADDRESS),
      connectors.yieldyak.readPosition(WALLET_ADDRESS)
    ]);

    const [tjPos, benqiPos, yyPos] = allPositions;
    
    console.log(`Trader Joe: ${tjPos.length} positions`);
    tjPos.forEach(pos => {
      console.log(`  - ${pos.tokenSymbol}: $${pos.balanceUsd.toFixed(2)}`);
    });

    console.log(`\nBenqi: ${benqiPos.length} positions`);
    benqiPos.forEach(pos => {
      console.log(`  - ${pos.tokenSymbol}: $${pos.balanceUsd.toFixed(2)}`);
    });

    console.log(`\nYield Yak: ${yyPos.length} positions`);
    yyPos.forEach(pos => {
      console.log(`  - ${pos.tokenSymbol}: $${pos.balanceUsd.toFixed(2)}`);
    });

    console.log('\n🎯 Step 3: Simulating Actions');
    console.log('-----------------------------');

    // Find best opportunity
    const allOpps = [...tjOpps, ...benqiOpps, ...yyOpps];
    const bestOpp = allOpps.reduce((best, current) => 
      current.apr > best.apr ? current : best
    );

    console.log(`Best opportunity: ${bestOpp.tokenSymbol} with ${bestOpp.apr.toFixed(2)}% APR`);

    // Create a sample action
    const sampleAction: PlanAction = {
      type: 'deposit',
      protocol: bestOpp.protocol,
      fromToken: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', // WAVAX
      toToken: bestOpp.tokenAddress,
      amount: usdToToken(250, 18, '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7'), // $250 worth
      amountUsd: 250,
      slippageBps: 50, // 0.5%
      deadline: calculateDeadline(20), // 20 minutes
      estimatedGas: 200000,
      estimatedGasUsd: 5.0,
      riskScore: bestOpp.riskScore
    };

    console.log(`\nSample action: Deposit $250 to ${bestOpp.tokenSymbol}`);
    console.log(`Protocol: ${bestOpp.protocol}`);
    console.log(`Slippage: ${sampleAction.slippageBps / 100}%`);
    console.log(`Risk Score: ${sampleAction.riskScore}`);

    console.log('\n🔍 Step 4: Building and Dry-Running Action');
    console.log('-------------------------------------------');

    // Build the action
    let connector;
    switch (bestOpp.protocol) {
      case 'traderjoe':
        connector = connectors.traderjoe;
        break;
      case 'benqi':
        connector = connectors.benqi;
        break;
      case 'yieldyak':
        connector = connectors.yieldyak;
        break;
      default:
        throw new Error(`Unknown protocol: ${bestOpp.protocol}`);
    }

    const { tx, dryRunResult } = await connector.buildAction(sampleAction, WALLET_ADDRESS);
    
    console.log('✅ Action built successfully');
    console.log(`Transaction to: ${tx.to}`);
    console.log(`Gas limit: ${tx.gasLimit?.toString()}`);
    console.log(`Dry run result: ${dryRunResult.success ? 'SUCCESS' : 'FAILED'}`);
    
    if (!dryRunResult.success) {
      console.log(`Dry run error: ${dryRunResult.error}`);
    }

    console.log('\n📋 Step 5: Checking Approvals');
    console.log('-------------------------------');

    // Check if approval is needed
    const approvalTx = await connector.checkApproval(
      sampleAction.fromToken,
      WALLET_ADDRESS,
      sampleAction.amount
    );

    if (approvalTx) {
      console.log('⚠️  Approval needed before executing action');
      console.log(`Approval transaction: ${approvalTx.to}`);
      console.log(`Approval data: ${approvalTx.data.substring(0, 66)}...`);
    } else {
      console.log('✅ No approval needed');
    }

    console.log('\n🎮 Step 6: Execution Mode');
    console.log('---------------------------');

    if (EXECUTION_MODE === 'auto') {
      console.log('🚨 EXECUTION_MODE=auto - Transactions will be sent automatically');
      console.log('⚠️  WARNING: This is dangerous in production!');
    } else {
      console.log('💡 EXECUTION_MODE=suggest - Only showing suggested actions');
      console.log('📝 To enable auto-execution, set EXECUTION_MODE=auto');
    }

    console.log('\n📊 Step 7: Backtest Simulation');
    console.log('--------------------------------');

    // Simulate backtest with sample data
    console.log('Loading historical APY data...');
    console.log('Sample data available at: src/data/sample_apys.csv');
    console.log('Backtest would analyze performance over time');

    console.log('\n✅ Demo completed successfully!');
    console.log('\n📚 Next steps:');
    console.log('1. Set RPC_URL to your preferred endpoint');
    console.log('2. Set WALLET_ADDRESS to your wallet');
    console.log('3. Run: pnpm monitor (to see live opportunities)');
    console.log('4. Run: pnpm simulate (to create action plans)');
    console.log('5. Run: pnpm backtest (to analyze historical performance)');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run demo
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
