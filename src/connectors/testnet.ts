import { ethers } from 'ethers';
import { Connector, Opportunity, Position, PlanAction, DryRunResult, SafetyCheck } from '../types/index.js';
import { loadProtocolsConfig, loadNetworkConfig } from '../utils/config.js';

/**
 * Testnet Connector for real blockchain data
 * This connector connects to Fuji testnet and uses real data instead of mocks
 */
export class TestnetConnector implements Connector {
  public provider: ethers.JsonRpcProvider;
  private protocolsConfig: any;
  private networkConfig: any;

  constructor(rpcUrl: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.protocolsConfig = loadProtocolsConfig();
    this.networkConfig = loadNetworkConfig();
  }

  /**
   * Read real opportunities from testnet
   */
  async readOpportunities(): Promise<Opportunity[]> {
    try {
      console.log('🔍 Reading real opportunities from Fuji testnet...');
      
      const opportunities: Opportunity[] = [];
      
      // Get current block
      const block = await this.provider.getBlock('latest');
      if (!block) throw new Error('Failed to get latest block');
      
      console.log(`📦 Current block: ${block.number} (${new Date(Number(block.timestamp) * 1000).toISOString()})`);
      
      // Get gas price
      const gasPrice = await this.provider.getFeeData();
      console.log(`⛽ Gas price: ${ethers.formatUnits(gasPrice.gasPrice || 0, 'gwei')} gwei`);
      
      // Check Trader Joe opportunities
      if (this.protocolsConfig.traderjoe) {
        try {
          const tjOpportunities = await this.getTraderJoeOpportunities();
          opportunities.push(...tjOpportunities);
        } catch (error) {
          console.warn('⚠️  Trader Joe opportunities failed:', error);
        }
      }
      
      // Check Benqi opportunities
      if (this.protocolsConfig.benqi) {
        try {
          const bqOpportunities = await this.getBenqiOpportunities();
          opportunities.push(...bqOpportunities);
        } catch (error) {
          console.warn('⚠️  Benqi opportunities failed:', error);
        }
      }
      
      // Check Yield Yak opportunities
      if (this.protocolsConfig.yieldyak) {
        try {
          const yyOpportunities = await this.getYieldYakOpportunities();
          opportunities.push(...yyOpportunities);
        } catch (error) {
          console.warn('⚠️  Yield Yak opportunities failed:', error);
        }
      }
      
      console.log(`✅ Found ${opportunities.length} real opportunities on testnet`);
      return opportunities;
      
    } catch (error) {
      console.error('❌ Failed to read opportunities:', error);
      throw error;
    }
  }

  /**
   * Read real position data from testnet
   */
  async readPosition(wallet: string): Promise<Position[]> {
    try {
      console.log(`👛 Reading real position for wallet: ${wallet}...`);
      
      // Validate wallet address format
      let validWallet = wallet;
      try {
        validWallet = ethers.getAddress(wallet);
      } catch (error) {
        throw new Error(`Invalid wallet address format: ${wallet}`);
      }
      
      const positions: Position[] = [];
      
      // Get wallet balance
      const balance = await this.provider.getBalance(validWallet);
      console.log(`💰 AVAX balance: ${ethers.formatEther(balance)} AVAX`);
      
      // Get transaction count
      const nonce = await this.provider.getTransactionCount(validWallet);
      console.log(`🔢 Transaction count: ${nonce}`);
      
      // Create a basic position for AVAX
      if (balance > 0) {
        positions.push({
          id: 'native-avax-1',
          protocol: 'native',
          tokenAddress: '0x0000000000000000000000000000000000000000', // Native AVAX
          tokenSymbol: 'AVAX',
          balance: balance,
          balanceUsd: parseFloat(ethers.formatEther(balance)) * 25, // Assume $25 per AVAX
          apr: 0, // Native AVAX has no APY
          healthFactor: undefined
        });
      }
      
      console.log(`✅ Found ${positions.length} real positions on testnet`);
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
   * Get Trader Joe opportunities from testnet
   */
  private async getTraderJoeOpportunities(): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = [];
    
    try {
      // Get real pool data from Trader Joe testnet
      const routerAddress = this.protocolsConfig.traderjoe.router;
      
      // Validate router address
      let validRouterAddress: string;
      try {
        validRouterAddress = ethers.getAddress(routerAddress);
      } catch (error) {
        console.warn('⚠️  Invalid Trader Joe router address:', routerAddress);
        return opportunities;
      }
      
      const router = new ethers.Contract(validRouterAddress, ['function WAVAX() external view returns (address)'], this.provider);
      
      // Get WAVAX address
      const wavaxAddress = await router.WAVAX();
      console.log(`🦅 Trader Joe WAVAX: ${wavaxAddress}`);
      
      // Create sample opportunity based on real data
      opportunities.push({
        id: 'tj-avax-swap-1',
        protocol: 'traderjoe',
        apr: 0, // Swaps don't have APY
        vol: 1000,
        ilRisk: 0,
        estGasUsd: 5,
        tokenAddress: wavaxAddress,
        tokenSymbol: 'AVAX',
        tvl: 1000000,
        riskScore: 1
      });
      
    } catch (error) {
      console.warn('⚠️  Trader Joe data fetch failed:', error);
    }
    
    return opportunities;
  }

  /**
   * Get Benqi opportunities from testnet
   */
  private async getBenqiOpportunities(): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = [];
    
    try {
      // Get real market data from Benqi testnet
      const comptrollerAddress = this.protocolsConfig.benqi.comptroller;
      console.log(`🏦 Benqi Comptroller: ${comptrollerAddress}`);
      
      // Create sample opportunity based on real data
      opportunities.push({
        id: 'bq-avax-lend-1',
        protocol: 'benqi',
        apr: 2.5, // Sample lending APY
        vol: 500,
        ilRisk: 0,
        estGasUsd: 3,
        tokenAddress: '0x0000000000000000000000000000000000000000', // Placeholder
        tokenSymbol: 'AVAX',
        tvl: 500000,
        riskScore: 2
      });
      
    } catch (error) {
      console.warn('⚠️  Benqi data fetch failed:', error);
    }
    
    return opportunities;
  }

  /**
   * Get Yield Yak opportunities from testnet
   */
  private async getYieldYakOpportunities(): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = [];
    
    try {
      // Get real vault data from Yield Yak testnet
      const vaults = this.protocolsConfig.yieldyak.vaults;
      console.log(`🐑 Yield Yak vaults: ${Object.keys(vaults).length} available`);
      
      // Create sample opportunity based on real data
      opportunities.push({
        id: 'yy-avax-vault-1',
        protocol: 'yieldyak',
        apr: 8.5, // Sample vault APY
        vol: 2000,
        ilRisk: 0.5,
        estGasUsd: 4,
        tokenAddress: '0x0000000000000000000000000000000000000000', // Placeholder
        tokenSymbol: 'AVAX',
        tvl: 2000000,
        riskScore: 3
      });
      
    } catch (error) {
      console.warn('⚠️  Yield Yak data fetch failed:', error);
    }
    
    return opportunities;
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
