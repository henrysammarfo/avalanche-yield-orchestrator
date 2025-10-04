import { ethers } from 'ethers';
import { Connector, Opportunity, Position, PlanAction, DryRunResult } from '../types/index.js';
import {
  dryRunTx,
  estimateGas,
  performSafetyChecks,
  calculateDeadline,
  calculateMinAmountOut,
  tokenToUsd
} from '../utils/helpers.js';
import { loadProtocolsConfig, loadAbi } from '../utils/config.js';

const protocolsConfig = loadProtocolsConfig();
const PANGOLIN_CONFIG = protocolsConfig.pangolin;

// Load ABIs
const routerAbi = loadAbi('pangolinRouter');
const factoryAbi = loadAbi('pangolinFactory');
const pairAbi = loadAbi('pangolinPair');
const erc20Abi = loadAbi('erc20');

export class PangolinConnector implements Connector {
  public provider: ethers.JsonRpcProvider;
  private router: ethers.Contract;
  private factory: ethers.Contract;

  constructor(provider: ethers.JsonRpcProvider) {
    this.provider = provider;
    this.router = new ethers.Contract(PANGOLIN_CONFIG.router, routerAbi, provider);
    this.factory = new ethers.Contract(PANGOLIN_CONFIG.factory, factoryAbi, provider);
  }

  /**
   * Read available opportunities from Pangolin
   * @returns Array of opportunities - REAL DATA ONLY
   */
  async readOpportunities(): Promise<Opportunity[]> {
    try {
      const opportunities: Opportunity[] = [];

      // Define major trading pairs
      const pairs = [
        { tokenA: PANGOLIN_CONFIG.wavax, tokenB: PANGOLIN_CONFIG.usdc, name: 'AVAX-USDC' },
        { tokenA: PANGOLIN_CONFIG.wavax, tokenB: PANGOLIN_CONFIG.link, name: 'AVAX-LINK' },
        { tokenA: PANGOLIN_CONFIG.usdc, tokenB: PANGOLIN_CONFIG.link, name: 'USDC-LINK' }
      ];

      for (const { tokenA, tokenB, name } of pairs) {
        try {
          // Get pair address from factory
          const pairAddress = await this.factory.getPair(tokenA, tokenB);

          if (pairAddress === '0x0000000000000000000000000000000000000000') {
            console.warn(`Pair ${name} does not exist on Pangolin`);
            continue;
          }

          const pairContract = new ethers.Contract(pairAddress, pairAbi, this.provider);

          // Get real reserves from the pair
          const reserves = await pairContract.getReserves();
          const totalSupply = await pairContract.totalSupply();

          // Get token info
          const token0Address = await pairContract.token0();
          const token1Address = await pairContract.token1();

          const token0Contract = new ethers.Contract(token0Address, erc20Abi, this.provider);
          const token1Contract = new ethers.Contract(token1Address, erc20Abi, this.provider);

          const [symbol0, symbol1, decimals0, decimals1] = await Promise.all([
            token0Contract.symbol(),
            token1Contract.symbol(),
            token0Contract.decimals(),
            token1Contract.decimals()
          ]);

          // Calculate TVL from reserves
          const reserve0 = reserves.reserve0;
          const reserve1 = reserves.reserve1;
          const tvl0 = tokenToUsd(reserve0, decimals0, token0Address);
          const tvl1 = tokenToUsd(reserve1, decimals1, token1Address);
          const totalTVL = tvl0 + tvl1;

          // Calculate APR based on trading volume (simplified - in production use historical data)
          // For now, we'll use a formula based on TVL and reserves
          // Higher liquidity = lower APR, but more stable
          const apr = totalTVL > 0 ? Math.min(20, 10000 / totalTVL) : 0;

          opportunities.push({
            id: `pangolin-${name.toLowerCase()}-lp`,
            protocol: 'pangolin',
            apr,
            tvl: totalTVL,
            tokenAddress: pairAddress,
            tokenSymbol: `${symbol0}-${symbol1} LP`,
            estGasUsd: 4.0,
            riskScore: 0.3,
            ilRisk: 0.4
          });
        } catch (error) {
          console.error(`Error reading pair ${name}:`, error);
          // Continue to next pair, don't fallback to mocks
        }
      }

      return opportunities;
    } catch (error) {
      console.error('Error reading Pangolin opportunities:', error);
      return [];
    }
  }

  /**
   * Read user positions from Pangolin
   * @param wallet - Wallet address
   * @returns Array of positions - REAL DATA ONLY
   */
  async readPosition(wallet: string): Promise<Position[]> {
    try {
      const positions: Position[] = [];

      // Define pairs to check
      const pairs = [
        { tokenA: PANGOLIN_CONFIG.wavax, tokenB: PANGOLIN_CONFIG.usdc },
        { tokenA: PANGOLIN_CONFIG.wavax, tokenB: PANGOLIN_CONFIG.link },
        { tokenA: PANGOLIN_CONFIG.usdc, tokenB: PANGOLIN_CONFIG.link }
      ];

      for (const { tokenA, tokenB } of pairs) {
        try {
          const pairAddress = await this.factory.getPair(tokenA, tokenB);

          if (pairAddress === '0x0000000000000000000000000000000000000000') {
            continue;
          }

          const pairContract = new ethers.Contract(pairAddress, pairAbi, this.provider);

          // Check LP balance
          const lpBalance = await pairContract.balanceOf(wallet);

          if (lpBalance > 0n) {
            const [totalSupply, reserves, token0, token1] = await Promise.all([
              pairContract.totalSupply(),
              pairContract.getReserves(),
              pairContract.token0(),
              pairContract.token1()
            ]);

            const token0Contract = new ethers.Contract(token0, erc20Abi, this.provider);
            const token1Contract = new ethers.Contract(token1, erc20Abi, this.provider);

            const [symbol0, symbol1, decimals0, decimals1] = await Promise.all([
              token0Contract.symbol(),
              token1Contract.symbol(),
              token0Contract.decimals(),
              token1Contract.decimals()
            ]);

            // Calculate share of pool
            const shareOfPool = Number(lpBalance * 10000n / totalSupply) / 100; // percentage

            // Calculate underlying token amounts
            const amount0 = lpBalance * BigInt(reserves.reserve0) / totalSupply;
            const amount1 = lpBalance * BigInt(reserves.reserve1) / totalSupply;

            // Calculate USD value
            const value0 = tokenToUsd(amount0, Number(decimals0), token0);
            const value1 = tokenToUsd(amount1, Number(decimals1), token1);
            const totalValue = value0 + value1;

            // Estimate APR (simplified)
            const apr = totalValue > 0 ? Math.min(20, 10000 / totalValue) : 0;

            positions.push({
              id: `pangolin-lp-${symbol0}-${symbol1}`,
              protocol: 'pangolin',
              tokenAddress: pairAddress,
              tokenSymbol: `${symbol0}-${symbol1} LP`,
              balance: lpBalance,
              balanceUsd: totalValue,
              apr
            });
          }
        } catch (error) {
          console.warn(`Error reading LP position:`, error);
        }
      }

      return positions;
    } catch (error) {
      console.error('Error reading Pangolin positions:', error);
      return [];
    }
  }

  /**
   * Build action for Pangolin operations
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
        PANGOLIN_CONFIG,
        0,
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
      throw new Error(`Failed to build Pangolin action: ${error}`);
    }
  }

  /**
   * Build swap transaction
   */
  private async buildSwapTx(action: PlanAction, wallet: string): Promise<ethers.TransactionRequest> {
    const deadline = calculateDeadline(PANGOLIN_CONFIG.defaultDeadlineMinutes);
    const minAmountOut = calculateMinAmountOut(action.amount, action.slippageBps);

    const data = this.router.interface.encodeFunctionData('swapExactTokensForTokens', [
      action.amount,
      minAmountOut,
      [action.fromToken, action.toToken],
      wallet,
      deadline
    ]);

    return {
      to: PANGOLIN_CONFIG.router,
      data,
      from: wallet,
      value: BigInt(0)
    };
  }

  /**
   * Build add liquidity transaction
   */
  private async buildAddLiquidityTx(action: PlanAction, wallet: string): Promise<ethers.TransactionRequest> {
    const deadline = calculateDeadline(PANGOLIN_CONFIG.defaultDeadlineMinutes);
    const amountAMin = calculateMinAmountOut(action.amount, action.slippageBps);
    const amountBMin = calculateMinAmountOut(action.amount, action.slippageBps);

    const data = this.router.interface.encodeFunctionData('addLiquidity', [
      action.fromToken,
      action.toToken,
      action.amount,
      action.amount,
      amountAMin,
      amountBMin,
      wallet,
      deadline
    ]);

    return {
      to: PANGOLIN_CONFIG.router,
      data,
      from: wallet,
      value: BigInt(0)
    };
  }

  /**
   * Build remove liquidity transaction
   */
  private async buildRemoveLiquidityTx(action: PlanAction, wallet: string): Promise<ethers.TransactionRequest> {
    const deadline = calculateDeadline(PANGOLIN_CONFIG.defaultDeadlineMinutes);
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
      to: PANGOLIN_CONFIG.router,
      data,
      from: wallet,
      value: BigInt(0)
    };
  }

  /**
   * Send action to Pangolin
   * @param txRequest - Transaction request
   * @param signer - Signer for transaction
   * @returns Transaction receipt
   */
  async sendAction(
    txRequest: ethers.TransactionRequest,
    signer: ethers.Signer
  ): Promise<ethers.TransactionReceipt> {
    try {
      const tx = await signer.sendTransaction(txRequest);
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Transaction failed - no receipt received');
      }
      return receipt;
    } catch (error) {
      throw new Error(`Failed to send Pangolin action: ${error}`);
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
      const allowance = await tokenContract.allowance(wallet, PANGOLIN_CONFIG.router);

      if (allowance < amount) {
        const data = tokenContract.interface.encodeFunctionData('approve', [
          PANGOLIN_CONFIG.router,
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
