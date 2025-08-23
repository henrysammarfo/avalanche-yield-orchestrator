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
   * Read available opportunities from Trader Joe
   * @returns Array of opportunities
   */
  async readOpportunities(): Promise<Opportunity[]> {
    try {
      // Mock opportunities - in production, fetch from Trader Joe API or on-chain
      const opportunities: Opportunity[] = [
        {
          id: 'tj-avax-usdc',
          protocol: 'traderjoe',
          apr: 12.5,
          vol: 0.8,
          ilRisk: 0.3,
          estGasUsd: 2.5,
          tokenAddress: TRADER_JOE_CONFIG.wavax,
          tokenSymbol: 'AVAX-USDC LP',
          tvl: 5000000,
          riskScore: 0.4
        },
        {
          id: 'tj-avax-usdt',
          protocol: 'traderjoe',
          apr: 11.8,
          vol: 0.7,
          ilRisk: 0.4,
          estGasUsd: 2.5,
          tokenAddress: TRADER_JOE_CONFIG.wavax,
          tokenSymbol: 'AVAX-USDT LP',
          tvl: 3000000,
          riskScore: 0.5
        }
      ];

      return opportunities;
    } catch (error) {
      console.error('Error reading Trader Joe opportunities:', error);
      return [];
    }
  }

  /**
   * Read user positions from Trader Joe
   * @param wallet - Wallet address
   * @returns Array of positions
   */
  async readPosition(wallet: string): Promise<Position[]> {
    try {
      const positions: Position[] = [];
      
      // Check LP token balances
      const lpTokens = [TRADER_JOE_CONFIG.wavax, TRADER_JOE_CONFIG.usdc, TRADER_JOE_CONFIG.usdt];
      
      for (const tokenAddress of lpTokens) {
        try {
          const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
          const balance = await tokenContract.balanceOf(wallet);
          const decimals = await tokenContract.decimals();
          
          if (balance > BigInt(0)) {
            const balanceUsd = tokenToUsd(balance, decimals, tokenAddress);
            positions.push({
              id: `tj-${tokenAddress}`,
              protocol: 'traderjoe',
              tokenAddress,
              tokenSymbol: await tokenContract.symbol(),
              balance,
              balanceUsd,
              apr: 12.0 // Mock APR
            });
          }
        } catch (error) {
          console.warn(`Error reading token ${tokenAddress}:`, error);
        }
      }

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
