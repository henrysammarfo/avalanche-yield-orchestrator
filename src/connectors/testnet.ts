import { ethers } from 'ethers';
import { Connector, Opportunity, Position, PlanAction, DryRunResult, SafetyCheck } from '../types/index.js';
import { loadProtocolsConfig, loadNetworkConfig } from '../utils/config.js';
import { AaveConnector } from './aave.js';
import { PangolinConnector } from './pangolin.js';
import { TraderJoeConnector } from './traderjoe.js';

/**
 * Testnet Connector for real blockchain data
 * This connector aggregates data from real protocol connectors
 */
export class TestnetConnector implements Connector {
  public provider: ethers.JsonRpcProvider;
  private protocolsConfig: any;
  private networkConfig: any;
  private aaveConnector: AaveConnector;
  private pangolinConnector: PangolinConnector;
  private traderJoeConnector: TraderJoeConnector;

  constructor(rpcUrl: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.protocolsConfig = loadProtocolsConfig();
    this.networkConfig = loadNetworkConfig();

    // Initialize real protocol connectors
    this.aaveConnector = new AaveConnector(this.provider);
    this.pangolinConnector = new PangolinConnector(this.provider);
    this.traderJoeConnector = new TraderJoeConnector(this.provider);
  }

  /**
   * Read real opportunities from testnet - NO MOCKS
   */
  async readOpportunities(): Promise<Opportunity[]> {
    try {
      console.log('🔍 Reading REAL opportunities from Fuji testnet...');

      const opportunities: Opportunity[] = [];

      // Get current block
      const block = await this.provider.getBlock('latest');
      if (!block) throw new Error('Failed to get latest block');

      console.log(`📦 Current block: ${block.number} (${new Date(Number(block.timestamp) * 1000).toISOString()})`);

      // Get gas price
      const gasPrice = await this.provider.getFeeData();
      console.log(`⛽ Gas price: ${ethers.formatUnits(gasPrice.gasPrice || 0, 'gwei')} gwei`);

      // Read REAL data from Aave V3
      try {
        console.log('📊 Fetching Aave V3 opportunities...');
        const aaveOpps = await this.aaveConnector.readOpportunities();
        opportunities.push(...aaveOpps);
        console.log(`✅ Found ${aaveOpps.length} Aave opportunities`);
      } catch (error) {
        console.warn('⚠️  Aave opportunities failed:', error);
      }

      // Read REAL data from Pangolin DEX
      try {
        console.log('📊 Fetching Pangolin DEX opportunities...');
        const pangolinOpps = await this.pangolinConnector.readOpportunities();
        opportunities.push(...pangolinOpps);
        console.log(`✅ Found ${pangolinOpps.length} Pangolin opportunities`);
      } catch (error) {
        console.warn('⚠️  Pangolin opportunities failed:', error);
      }

      // Read REAL data from Trader Joe (LFJ)
      try {
        console.log('📊 Fetching Trader Joe opportunities...');
        const tjOpps = await this.traderJoeConnector.readOpportunities();
        opportunities.push(...tjOpps);
        console.log(`✅ Found ${tjOpps.length} Trader Joe opportunities`);
      } catch (error) {
        console.warn('⚠️  Trader Joe opportunities failed:', error);
      }

      console.log(`✅ Found ${opportunities.length} REAL opportunities on testnet (NO MOCKS)`);
      return opportunities;

    } catch (error) {
      console.error('❌ Failed to read opportunities:', error);
      throw error;
    }
  }

  /**
   * Read real position data from testnet - NO MOCKS
   */
  async readPosition(wallet: string): Promise<Position[]> {
    try {
      console.log(`👛 Reading REAL positions for wallet: ${wallet}...`);

      // Validate wallet address format
      let validWallet = wallet;
      try {
        validWallet = ethers.getAddress(wallet);
      } catch (error) {
        throw new Error(`Invalid wallet address format: ${wallet}`);
      }

      const positions: Position[] = [];

      // Get wallet native AVAX balance
      const balance = await this.provider.getBalance(validWallet);
      console.log(`💰 Native AVAX balance: ${ethers.formatEther(balance)} AVAX`);

      // Get transaction count
      const nonce = await this.provider.getTransactionCount(validWallet);
      console.log(`🔢 Transaction count: ${nonce}`);

      // Add native AVAX position if exists
      if (balance > 0) {
        positions.push({
          id: 'native-avax',
          protocol: 'native',
          tokenAddress: '0x0000000000000000000000000000000000000000',
          tokenSymbol: 'AVAX',
          balance: balance,
          balanceUsd: parseFloat(ethers.formatEther(balance)) * 25, // Price estimation
          apr: 0 // Native AVAX doesn't earn APR
        });
      }

      // Read REAL positions from Aave V3
      try {
        console.log('📊 Fetching Aave V3 positions...');
        const aavePositions = await this.aaveConnector.readPosition(validWallet);
        positions.push(...aavePositions);
        console.log(`✅ Found ${aavePositions.length} Aave positions`);
      } catch (error) {
        console.warn('⚠️  Aave positions failed:', error);
      }

      // Read REAL positions from Pangolin
      try {
        console.log('📊 Fetching Pangolin positions...');
        const pangolinPositions = await this.pangolinConnector.readPosition(validWallet);
        positions.push(...pangolinPositions);
        console.log(`✅ Found ${pangolinPositions.length} Pangolin positions`);
      } catch (error) {
        console.warn('⚠️  Pangolin positions failed:', error);
      }

      // Read REAL positions from Trader Joe
      try {
        console.log('📊 Fetching Trader Joe positions...');
        const tjPositions = await this.traderJoeConnector.readPosition(validWallet);
        positions.push(...tjPositions);
        console.log(`✅ Found ${tjPositions.length} Trader Joe positions`);
      } catch (error) {
        console.warn('⚠️  Trader Joe positions failed:', error);
      }

      console.log(`✅ Found ${positions.length} REAL positions on testnet (NO MOCKS)`);
      return positions;

    } catch (error) {
      console.error('❌ Failed to read position:', error);
      throw error;
    }
  }

  /**
   * Build action for testnet execution
   */
  async buildAction(action: PlanAction, wallet: string): Promise<{
    tx: ethers.TransactionRequest; dryRunResult?: any }> {
    try {
      console.log(`🔨 Building real action for ${action.type} on testnet...`);
      
      // Validate wallet
      if (!ethers.isAddress(wallet)) {
        throw new Error('Invalid wallet address');
      }
      
      // Create a simple transaction (this is just for demo - real actions would be more complex)
      const tx: ethers.TransactionRequest = {
        to: wallet, // Self-transfer for demo
        value: 0,
        data: '0x', // No data
        gasLimit: this.networkConfig.gas.default
      };
      
      // Dry run the transaction
      const dryRun = await this.dryRunTx(tx);
      
      console.log('✅ Action built successfully for testnet');
      
      return { tx, dryRunResult: dryRun };
      
    } catch (error) {
      console.error('❌ Failed to build action:', error);
      throw error;
    }
  }

  /**
   * Send action to testnet
   */
  async sendAction(txRequest: ethers.TransactionRequest, signer: ethers.Signer): Promise<ethers.TransactionReceipt> {
    try {
      console.log('🚀 Sending action to testnet...');
      
      // In demo mode, we don't actually send transactions
      console.log('⚠️  DEMO MODE: Transaction sending is disabled for safety');
      
      // Simulate transaction
      const tx = await signer.populateTransaction(txRequest);
      console.log(`📝 Simulated transaction: ${tx.hash || 'No hash in demo mode'}`);
      
      // Return a mock receipt
      throw new Error('DEMO MODE: Cannot send real transactions');
      
    } catch (error) {
      console.error('❌ Failed to send action:', error);
      throw error;
    }
  }


  /**
   * Dry run transaction on testnet
   */
  private async dryRunTx(tx: ethers.TransactionRequest): Promise<DryRunResult> {
    try {
      const gasEstimate = await this.provider.estimateGas(tx);
      const feeData = await this.provider.getFeeData();
      
      return {
        success: true,
        gasUsed: gasEstimate,
        gasCost: gasEstimate * (feeData.gasPrice || 0n),
        error: undefined
      };
    } catch (error) {
      return {
        success: false,
        gasUsed: 0n,
        gasCost: 0n,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
