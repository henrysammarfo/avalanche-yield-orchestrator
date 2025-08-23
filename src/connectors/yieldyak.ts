import { ethers } from 'ethers';
import { Connector, Opportunity, Position, PlanAction, DryRunResult, SafetyCheck } from '../types/index.js';
import { 
  dryRunTx, 
  estimateGas, 
  performSafetyChecks, 
  calculateDeadline,
  tokenToUsd,
  usdToToken
} from '../utils/helpers.js';
import protocolsConfig from '../../config/protocols.json' assert { type: 'json' };

const YIELD_YAK_CONFIG = protocolsConfig.yieldyak;

// Import ABIs
import vaultAbi from './ABIs/yieldyakVault.json' assert { type: 'json' };
import erc20Abi from './ABIs/erc20.json' assert { type: 'json' };

export class YieldYakConnector implements Connector {
  public provider: ethers.JsonRpcProvider;
  private vaults: Map<string, ethers.Contract>;

  constructor(provider: ethers.JsonRpcProvider) {
    this.provider = provider;
    this.vaults = new Map();
    
    // Initialize vault contracts
    Object.entries(YIELD_YAK_CONFIG.vaults).forEach(([key, address]) => {
      if (address !== '0x0000000000000000000000000000000000000000') {
        this.vaults.set(key, new ethers.Contract(address, vaultAbi, provider));
      }
    });
  }

  /**
   * Read available opportunities from Yield Yak
   * @returns Array of opportunities
   */
  async readOpportunities(): Promise<Opportunity[]> {
    try {
      const opportunities: Opportunity[] = [];
      
      for (const [vaultKey, vaultContract] of this.vaults) {
        try {
          // Get vault info
          const [tokenAddress, totalSupply, pricePerShare] = await Promise.all([
            vaultContract.token(),
            vaultContract.totalSupply(),
            vaultContract.pricePerShare()
          ]);
          
          const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
          const [decimals, symbol] = await Promise.all([
            tokenContract.decimals(),
            tokenContract.symbol()
          ]);
          
          // Calculate TVL
          const tvl = tokenToUsd(totalSupply * pricePerShare, decimals, tokenAddress);
          
          // Mock APY - in production, fetch from Yield Yak API
          const apy = this.getMockVaultAPY(vaultKey);
          
          opportunities.push({
            id: `yieldyak-${vaultKey}`,
            protocol: 'yieldyak',
            apr: apy,
            estGasUsd: 2.0,
            tokenAddress,
            tokenSymbol: `${symbol} Vault`,
            tvl,
            riskScore: 0.3
          });
        } catch (error) {
          console.warn(`Error reading ${vaultKey} vault opportunities:`, error);
        }
      }

      return opportunities;
    } catch (error) {
      console.error('Error reading Yield Yak opportunities:', error);
      return [];
    }
  }

  /**
   * Read user positions from Yield Yak
   * @param wallet - Wallet address
   * @returns Array of positions
   */
  async readPosition(wallet: string): Promise<Position[]> {
    try {
      const positions: Position[] = [];
      
      for (const [vaultKey, vaultContract] of this.vaults) {
        try {
          const [balance, pricePerShare] = await Promise.all([
            vaultContract.balanceOf(wallet),
            vaultContract.pricePerShare()
          ]);
          
          if (balance > BigInt(0)) {
            const tokenAddress = await vaultContract.token();
            const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
            const decimals = await tokenContract.decimals();
            const symbol = await tokenContract.symbol();
            
            // Calculate underlying token balance
            const underlyingBalance = balance * pricePerShare;
            const balanceUsd = tokenToUsd(underlyingBalance, decimals, tokenAddress);
            
            // Get APY for this vault
            const apy = this.getMockVaultAPY(vaultKey);
            
            positions.push({
              id: `yieldyak-${vaultKey}`,
              protocol: 'yieldyak',
              tokenAddress,
              tokenSymbol: `${symbol} Vault`,
              balance: underlyingBalance,
              balanceUsd,
              apr: apy
            });
          }
        } catch (error) {
          console.warn(`Error reading ${vaultKey} vault position:`, error);
        }
      }

      return positions;
    } catch (error) {
      console.error('Error reading Yield Yak positions:', error);
      return [];
    }
  }

  /**
   * Build action for Yield Yak operations
   * @param action - Plan action
   * @param wallet - Wallet address
   * @returns Transaction request and dry run result
   */
  async buildAction(
    action: PlanAction, 
    wallet: string
  ): Promise<{ tx: ethers.TransactionRequest; dryRunResult?: any }> {
    try {
      // Perform safety checks
      const safetyCheck = performSafetyChecks(
        action, 
        YIELD_YAK_CONFIG, 
        0, // TODO: Track daily usage
        {}
      );

      if (!safetyCheck.passed) {
        throw new Error(`Safety check failed: ${safetyCheck.reason}`);
      }

      let tx: ethers.TransactionRequest;

      switch (action.type) {
        case 'deposit':
          tx = await this.buildDepositTx(action, wallet);
          break;
        case 'withdraw_vault':
          tx = await this.buildWithdrawTx(action, wallet);
          break;
        default:
          throw new Error(`Unsupported action type: ${action.type}`);
      }

      // Dry run the transaction
      const dryRunResult = await dryRunTx(this.provider, tx);
      
      // Estimate gas
      const gasEstimate = await estimateGas(this.provider, tx);
      tx.gasLimit = gasEstimate;

      return { tx, dryRunResult };
    } catch (error) {
      throw new Error(`Failed to build Yield Yak action: ${error}`);
    }
  }

  /**
   * Build deposit transaction
   */
  private async buildDepositTx(action: PlanAction, wallet: string): Promise<ethers.TransactionRequest> {
    const vault = this.getVaultForToken(action.toToken);
    if (!vault) {
      throw new Error(`No vault found for token ${action.toToken}`);
    }

    const data = vault.interface.encodeFunctionData('deposit', [action.amount]);

    return {
      to: vault.target,
      data,
      from: wallet,
      value: BigInt(0)
    };
  }

  /**
   * Build withdraw transaction
   */
  private async buildWithdrawTx(action: PlanAction, wallet: string): Promise<ethers.TransactionRequest> {
    const vault = this.getVaultForToken(action.fromToken);
    if (!vault) {
      throw new Error(`No vault found for token ${action.fromToken}`);
    }

    // For withdrawal, we need to calculate shares from underlying amount
    const pricePerShare = await vault.pricePerShare();
    const shares = action.amount / pricePerShare;

    const data = vault.interface.encodeFunctionData('withdraw', [shares]);

    return {
      to: vault.target,
      data,
      from: wallet,
      value: BigInt(0)
    };
  }

  /**
   * Send action to Yield Yak
   * @param txRequest - Transaction request
   * @param signer - Signer for transaction
   * @returns Transaction receipt
   */
  async sendAction(
    txRequest: ethers.TransactionRequest, 
    signer: ethers.Signer
  ): Promise<ethers.TransactionReceipt> {
    try {
      // Final safety check before sending
      const safetyCheck = performSafetyChecks(
        {
          type: 'deposit',
          protocol: 'yieldyak',
          fromToken: '',
          toToken: '',
          amount: BigInt(0),
          amountUsd: 0,
          slippageBps: 0,
          deadline: calculateDeadline(),
          estimatedGas: 0,
          estimatedGasUsd: 0,
          riskScore: 0
        },
        YIELD_YAK_CONFIG,
        0,
        {}
      );

      if (!safetyCheck.passed) {
        throw new Error(`Final safety check failed: ${safetyCheck.reason}`);
      }

      const tx = await signer.sendTransaction(txRequest);
      return await tx.wait();
    } catch (error) {
      throw new Error(`Failed to send Yield Yak action: ${error}`);
    }
  }

  /**
   * Get vault contract for a given token
   * @param tokenAddress - Token address
   * @returns Vault contract or null
   */
  private getVaultForToken(tokenAddress: string): ethers.Contract | null {
    for (const [_, vaultContract] of this.vaults) {
      try {
        if (vaultContract.token && vaultContract.token() === tokenAddress) {
          return vaultContract;
        }
      } catch (error) {
        console.warn('Error checking vault token:', error);
      }
    }
    return null;
  }

  /**
   * Get mock vault APY - replace with API call in production
   * @param vaultKey - Vault key
   * @returns APY percentage
   */
  private getMockVaultAPY(vaultKey: string): number {
    const mockAPYs: Record<string, number> = {
      'avax': 15.2,
      'usdc': 8.5,
      'usdt': 8.3
    };
    
    return mockAPYs[vaultKey] || 10.0;
  }

  /**
   * Check if approval is needed for a token
   * @param tokenAddress - Token address
   * @param wallet - Wallet address
   * @param amount - Amount to approve
   * @returns Approval transaction if needed
   */
  async checkApproval(
    tokenAddress: string, 
    wallet: string, 
    amount: bigint
  ): Promise<ethers.TransactionRequest | null> {
    try {
      const vault = this.getVaultForToken(tokenAddress);
      if (!vault) return null;
      
      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
      const allowance = await tokenContract.allowance(wallet, vault.target);
      
      if (allowance < amount) {
        const data = tokenContract.interface.encodeFunctionData('approve', [
          vault.target,
          amount
        ]);

        return {
          to: tokenAddress,
          data,
          from: wallet,
          value: BigInt(0)
        };
      }

      return null;
    } catch (error) {
      console.error('Error checking approval:', error);
      return null;
    }
  }

  /**
   * Get vault fees for a specific vault
   * @param vaultKey - Vault key
   * @returns Object with deposit and withdrawal fees
   */
  async getVaultFees(vaultKey: string): Promise<{ depositFee: number; withdrawalFee: number }> {
    try {
      const vault = this.vaults.get(vaultKey);
      if (!vault) {
        throw new Error(`Vault ${vaultKey} not found`);
      }

      const [depositFee, withdrawalFee] = await Promise.all([
        vault.depositFee(),
        vault.withdrawalFee()
      ]);

      return {
        depositFee: parseFloat(ethers.formatUnits(depositFee, 18)),
        withdrawalFee: parseFloat(ethers.formatUnits(withdrawalFee, 18))
      };
    } catch (error) {
      console.error(`Error getting vault fees for ${vaultKey}:`, error);
      return { depositFee: 0, withdrawalFee: 0 };
    }
  }

  /**
   * Calculate shares for a given deposit amount
   * @param vaultKey - Vault key
   * @param amount - Amount to deposit
   * @returns Estimated shares
   */
  async calculateSharesForDeposit(vaultKey: string, amount: bigint): Promise<bigint> {
    try {
      const vault = this.vaults.get(vaultKey);
      if (!vault) {
        throw new Error(`Vault ${vaultKey} not found`);
      }

      const pricePerShare = await vault.pricePerShare();
      return amount / pricePerShare;
    } catch (error) {
      console.error(`Error calculating shares for deposit:`, error);
      return BigInt(0);
    }
  }

  /**
   * Calculate underlying amount for given shares
   * @param vaultKey - Vault key
   * @param shares - Number of shares
   * @returns Underlying token amount
   */
  async calculateUnderlyingForShares(vaultKey: string, shares: bigint): Promise<bigint> {
    try {
      const vault = this.vaults.get(vaultKey);
      if (!vault) {
        throw new Error(`Vault ${vaultKey} not found`);
      }

      const pricePerShare = await vault.pricePerShare();
      return shares * pricePerShare;
    } catch (error) {
      console.error(`Error calculating underlying for shares:`, error);
      return BigInt(0);
    }
  }
}
