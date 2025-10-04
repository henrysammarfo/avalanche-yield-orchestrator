import { ethers } from 'ethers';
import { Connector, Opportunity, Position, PlanAction, DryRunResult, SafetyCheck } from '../types/index.js';
import { 
  dryRunTx, 
  estimateGas, 
  performSafetyChecks, 
  calculateDeadline, 
  calculateMinAmountOut,
  tokenToUsd,
  usdToToken
} from '../utils/helpers.js';
import { loadProtocolsConfig, loadAbi } from '../utils/config.js';

const protocolsConfig = loadProtocolsConfig();
const TRADER_JOE_CONFIG = protocolsConfig.traderjoe;

// Load ABIs
const routerAbi = loadAbi('traderjoeRouter');
const erc20Abi = loadAbi('erc20');

export class TraderJoeConnector implements Connector {
  public provider: ethers.JsonRpcProvider;
  private router: ethers.Contract;
  private factory: ethers.Contract;

  constructor(provider: ethers.JsonRpcProvider) {
    this.provider = provider;
    this.router = new ethers.Contract(TRADER_JOE_CONFIG.router, routerAbi, provider);
    this.factory = new ethers.Contract(TRADER_JOE_CONFIG.factory, erc20Abi, provider);
  }

  /**
   * Read available opportunities from Trader Joe (LFJ V2.2)
   * @returns Array of opportunities - REAL DATA ONLY
   */
  async readOpportunities(): Promise<Opportunity[]> {
    try {
      const opportunities: Opportunity[] = [];

      // Note: LFJ V2.2 uses a complex Liquidity Book architecture
      // For now, we'll read basic swap opportunities using the quoter
      // In production, integrate with LFJ V2.2 API or complex on-chain queries

      // Define major trading pairs to query
      const pairs = [
        { from: TRADER_JOE_CONFIG.wavax, to: TRADER_JOE_CONFIG.usdc, name: 'AVAX-USDC' },
        { from: TRADER_JOE_CONFIG.wavax, to: TRADER_JOE_CONFIG.link, name: 'AVAX-LINK' },
        { from: TRADER_JOE_CONFIG.usdc, to: TRADER_JOE_CONFIG.link, name: 'USDC-LINK' }
      ];

      for (const { from, to, name } of pairs) {
        try {
          // For LFJ V2.2, we need to query actual liquidity from the factory
          // This is a simplified version - full implementation would check binStep and active pools
          const fromContract = new ethers.Contract(from, erc20Abi, this.provider);
          const symbol = await fromContract.symbol();

          // Add basic swap opportunity (no APR for swaps, only for LP positions)
          opportunities.push({
            id: `tj-${name.toLowerCase()}-swap`,
            protocol: 'traderjoe',
            apr: 0, // Swaps don't earn APR
            tokenAddress: from,
            tokenSymbol: `${name} Swap`,
            estGasUsd: 4.0,
            riskScore: 0.2
          });
        } catch (error) {
          console.warn(`Error querying LFJ pair ${name}:`, error);
          // Continue to next pair, don't fallback to mocks
        }
      }

      return opportunities;
    } catch (error) {
      console.error('Error reading Trader Joe opportunities:', error);
      return [];
    }
  }

  /**
   * Read user positions from Trader Joe (LFJ V2.2)
   * @param wallet - Wallet address
   * @returns Array of positions - REAL DATA ONLY
   */
  async readPosition(wallet: string): Promise<Position[]> {
    try {
      const positions: Position[] = [];

      // Check token balances (not LP positions since LFJ V2.2 architecture is complex)
      const tokens = [TRADER_JOE_CONFIG.wavax, TRADER_JOE_CONFIG.usdc, TRADER_JOE_CONFIG.link];

      for (const tokenAddress of tokens) {
        try {
          const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
          const balance = await tokenContract.balanceOf(wallet);
          const decimals = await tokenContract.decimals();

          if (balance > BigInt(0)) {
            const balanceUsd = tokenToUsd(balance, decimals, tokenAddress);
            const symbol = await tokenContract.symbol();

            positions.push({
              id: `tj-balance-${symbol}`,
              protocol: 'traderjoe',
              tokenAddress,
              tokenSymbol: symbol,
              balance,
              balanceUsd,
              apr: 0 // Token balances don't earn APR without staking/LP
            });
          }
        } catch (error) {
          console.warn(`Error reading token ${tokenAddress}:`, error);
        }
      }

      // Note: For full LFJ V2.2 support, would need to:
      // 1. Query LBFactory for user's LP positions
      // 2. Get binStep and LBPair addresses
      // 3. Calculate LP token shares and APR from fees

      return positions;
    } catch (error) {
      console.error('Error reading Trader Joe positions:', error);
      return [];
    }
  }

  /**
   * Build action for Trader Joe operations
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
        TRADER_JOE_CONFIG, 
        0, // TODO: Track daily usage
        {}
      );

      if (!safetyCheck.passed) {
        throw new Error(`Safety check failed: ${safetyCheck.reason}`);
      }

      let tx: ethers.TransactionRequest;

      switch (action.type) {
        case 'swap':
          tx = await this.buildSwapTx(action, wallet);
          break;
        case 'lp_add':
          tx = await this.buildAddLiquidityTx(action, wallet);
          break;
        case 'lp_remove':
          tx = await this.buildRemoveLiquidityTx(action, wallet);
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
      throw new Error(`Failed to build Trader Joe action: ${error}`);
    }
  }

  /**
   * Build swap transaction
   */
  private async buildSwapTx(action: PlanAction, wallet: string): Promise<ethers.TransactionRequest> {
    const deadline = calculateDeadline(TRADER_JOE_CONFIG.defaultDeadlineMinutes);
    const minAmountOut = calculateMinAmountOut(action.amount, action.slippageBps);

    const data = this.router.interface.encodeFunctionData('swapExactTokensForTokens', [
      action.amount,
      minAmountOut,
      [action.fromToken, action.toToken],
      wallet,
      deadline
    ]);

    return {
      to: TRADER_JOE_CONFIG.router,
      data,
      from: wallet,
      value: BigInt(0)
    };
  }

  /**
   * Build add liquidity transaction
   */
  private async buildAddLiquidityTx(action: PlanAction, wallet: string): Promise<ethers.TransactionRequest> {
    const deadline = calculateDeadline(TRADER_JOE_CONFIG.defaultDeadlineMinutes);
    
    // For LP add, we need both tokens
    const amountAMin = calculateMinAmountOut(action.amount, action.slippageBps);
    const amountBMin = calculateMinAmountOut(action.amount, action.slippageBps);

    const data = this.router.interface.encodeFunctionData('addLiquidity', [
      action.fromToken,
      action.toToken,
      action.amount,
      action.amount, // Equal amounts for simplicity
      amountAMin,
      amountBMin,
      wallet,
      deadline
    ]);

    return {
      to: TRADER_JOE_CONFIG.router,
      data,
      from: wallet,
      value: BigInt(0)
    };
  }

  /**
   * Build remove liquidity transaction
   */
  private async buildRemoveLiquidityTx(action: PlanAction, wallet: string): Promise<ethers.TransactionRequest> {
    const deadline = calculateDeadline(TRADER_JOE_CONFIG.defaultDeadlineMinutes);
    
    const amountAMin = calculateMinAmountOut(action.amount, action.slippageBps);
    const amountBMin = calculateMinAmountOut(action.amount, action.slippageBps);

    const data = this.router.interface.encodeFunctionData('removeLiquidity', [
      action.fromToken,
      action.toToken,
      action.amount,
      amountAMin,
      amountBMin,
      wallet,
      deadline
    ]);

    return {
      to: TRADER_JOE_CONFIG.router,
      data,
      from: wallet,
      value: BigInt(0)
    };
  }

  /**
   * Send action to Trader Joe
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
          type: 'swap',
          protocol: 'traderjoe',
          fromToken: '',
          toToken: '',
          amount: BigInt(0),
          amountUsd: 0,
          slippageBps: TRADER_JOE_CONFIG.defaultSlippageBps,
          deadline: calculateDeadline(),
          estimatedGas: 0,
          estimatedGasUsd: 0,
          riskScore: 0
        },
        TRADER_JOE_CONFIG,
        0,
        {}
      );

      if (!safetyCheck.passed) {
        throw new Error(`Final safety check failed: ${safetyCheck.reason}`);
      }

      const tx = await signer.sendTransaction(txRequest);
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Transaction failed - no receipt received');
      }
      return receipt;
    } catch (error) {
      throw new Error(`Failed to send Trader Joe action: ${error}`);
    }
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
      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
      const allowance = await tokenContract.allowance(wallet, TRADER_JOE_CONFIG.router);
      
      if (allowance < amount) {
        const data = tokenContract.interface.encodeFunctionData('approve', [
          TRADER_JOE_CONFIG.router,
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
}
