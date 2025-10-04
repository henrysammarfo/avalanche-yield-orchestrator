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
import { loadProtocolsConfig, loadAbi } from '../utils/config.js';

const protocolsConfig = loadProtocolsConfig();
const AAVE_CONFIG = protocolsConfig.aave;

// Load ABIs
const poolAbi = loadAbi('aavePool');
const erc20Abi = loadAbi('erc20');

export class AaveConnector implements Connector {
  public provider: ethers.JsonRpcProvider;
  private pool: ethers.Contract;
  private supportedAssets: string[];

  constructor(provider: ethers.JsonRpcProvider) {
    this.provider = provider;
    this.pool = new ethers.Contract(AAVE_CONFIG.pool, poolAbi, provider);
    this.supportedAssets = [
      AAVE_CONFIG.wavax,
      AAVE_CONFIG.usdc,
      AAVE_CONFIG.link
    ];
  }

  /**
   * Read available opportunities from Aave V3
   * @returns Array of opportunities - REAL DATA ONLY
   */
  async readOpportunities(): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = [];

    try {
      // Fetch real data for each supported asset
      for (const assetAddress of this.supportedAssets) {
        try {
          // Get reserve data from Aave V3 Pool contract
          const reserveData = await this.pool.getReserveData(assetAddress);

          // Get token info
          const tokenContract = new ethers.Contract(assetAddress, erc20Abi, this.provider);
          const symbol = await tokenContract.symbol();
          const decimals = await tokenContract.decimals();

          // Calculate real APR from liquidity rate (Aave uses Ray units: 1e27)
          const RAY = BigInt(10 ** 27);
          const SECONDS_PER_YEAR = 31536000n;
          const liquidityRate = reserveData.currentLiquidityRate;
          const supplyAPR = Number(liquidityRate * 100n * SECONDS_PER_YEAR / RAY) / 100;

          // Calculate borrow APR
          const borrowRate = reserveData.currentVariableBorrowRate;
          const borrowAPR = Number(borrowRate * 100n * SECONDS_PER_YEAR / RAY) / 100;

          // Add supply opportunity with REAL APR
          opportunities.push({
            id: `aave-${symbol}-supply`,
            protocol: 'aave',
            apr: supplyAPR,
            tokenAddress: assetAddress,
            tokenSymbol: `${symbol} Supply`,
            estGasUsd: 3.0,
            riskScore: 0.2
          });

          // Add borrow opportunity with REAL APR (negative for cost)
          opportunities.push({
            id: `aave-${symbol}-borrow`,
            protocol: 'aave',
            apr: -borrowAPR, // Negative because it's a cost
            tokenAddress: assetAddress,
            tokenSymbol: `${symbol} Borrow`,
            estGasUsd: 2.5,
            riskScore: 0.6
          });
        } catch (error) {
          console.error(`Error reading reserve data for ${assetAddress}:`, error);
          // Continue to next asset, don't fallback to mocks
        }
      }
    } catch (error) {
      console.error('Error reading Aave opportunities:', error);
    }

    return opportunities;
  }

  /**
   * Read user positions from Aave V3
   * @param wallet - Wallet address
   * @returns Array of positions - REAL DATA ONLY
   */
  async readPosition(wallet: string): Promise<Position[]> {
    try {
      const positions: Position[] = [];

      // Get user account data from Aave
      const accountData = await this.pool.getUserAccountData(wallet);
      const healthFactor = Number(accountData.healthFactor) / 1e18;

      // Read real balances for each asset
      for (const assetAddress of this.supportedAssets) {
        try {
          const reserveData = await this.pool.getReserveData(assetAddress);
          const aTokenAddress = reserveData.aTokenAddress;
          const debtTokenAddress = reserveData.variableDebtTokenAddress;

          const tokenContract = new ethers.Contract(assetAddress, erc20Abi, this.provider);
          const aTokenContract = new ethers.Contract(aTokenAddress, erc20Abi, this.provider);
          const debtTokenContract = new ethers.Contract(debtTokenAddress, erc20Abi, this.provider);

          const [symbol, decimals, supplyBalance, borrowBalance] = await Promise.all([
            tokenContract.symbol(),
            tokenContract.decimals(),
            aTokenContract.balanceOf(wallet),
            debtTokenContract.balanceOf(wallet)
          ]);

          // Add supply position if exists
          if (supplyBalance > 0n) {
            const balanceUsd = tokenToUsd(supplyBalance, decimals, assetAddress);
            const liquidityRate = reserveData.currentLiquidityRate;
            const RAY = BigInt(10 ** 27);
            const SECONDS_PER_YEAR = 31536000n;
            const apr = Number(liquidityRate * 100n * SECONDS_PER_YEAR / RAY) / 100;

            positions.push({
              id: `aave-supply-${symbol}`,
              protocol: 'aave',
              tokenAddress: assetAddress,
              tokenSymbol: `${symbol} Supply`,
              balance: supplyBalance,
              balanceUsd,
              apr,
              healthFactor
            });
          }

          // Add borrow position if exists
          if (borrowBalance > 0n) {
            const balanceUsd = tokenToUsd(borrowBalance, decimals, assetAddress);
            const borrowRate = reserveData.currentVariableBorrowRate;
            const RAY = BigInt(10 ** 27);
            const SECONDS_PER_YEAR = 31536000n;
            const apr = Number(borrowRate * 100n * SECONDS_PER_YEAR / RAY) / 100;

            positions.push({
              id: `aave-borrow-${symbol}`,
              protocol: 'aave',
              tokenAddress: assetAddress,
              tokenSymbol: `${symbol} Borrow`,
              balance: borrowBalance,
              balanceUsd,
              apr: -apr, // Negative for borrow cost
              healthFactor
            });
          }
        } catch (error) {
          console.warn(`Error reading position for ${assetAddress}:`, error);
        }
      }

      return positions;
    } catch (error) {
      console.error('Error reading Aave positions:', error);
      return [];
    }
  }

  /**
   * Build action for Aave V3 operations
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
        AAVE_CONFIG,
        0,
        {}
      );

      if (!safetyCheck.passed) {
        throw new Error(`Safety check failed: ${safetyCheck.reason}`);
      }

      // Additional health factor check for borrow/repay actions
      if (action.type === 'borrow' || action.type === 'repay') {
        const accountData = await this.pool.getUserAccountData(wallet);
        const currentHF = Number(accountData.healthFactor) / 1e18;
        if (currentHF < AAVE_CONFIG.minHealthFactor && currentHF !== 0) {
          throw new Error(`Health factor ${currentHF} below minimum ${AAVE_CONFIG.minHealthFactor}`);
        }
      }

      let tx: ethers.TransactionRequest;

      switch (action.type) {
        case 'supply':
          tx = await this.buildSupplyTx(action, wallet);
          break;
        case 'withdraw':
          tx = await this.buildWithdrawTx(action, wallet);
          break;
        case 'borrow':
          tx = await this.buildBorrowTx(action, wallet);
          break;
        case 'repay':
          tx = await this.buildRepayTx(action, wallet);
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
      throw new Error(`Failed to build Aave action: ${error}`);
    }
  }

  /**
   * Build supply transaction
   */
  private async buildSupplyTx(action: PlanAction, wallet: string): Promise<ethers.TransactionRequest> {
    const data = this.pool.interface.encodeFunctionData('supply', [
      action.toToken,
      action.amount,
      wallet,
      0 // referralCode
    ]);

    return {
      to: AAVE_CONFIG.pool,
      data,
      from: wallet,
      value: BigInt(0)
    };
  }

  /**
   * Build withdraw transaction
   */
  private async buildWithdrawTx(action: PlanAction, wallet: string): Promise<ethers.TransactionRequest> {
    const data = this.pool.interface.encodeFunctionData('withdraw', [
      action.fromToken,
      action.amount,
      wallet
    ]);

    return {
      to: AAVE_CONFIG.pool,
      data,
      from: wallet,
      value: BigInt(0)
    };
  }

  /**
   * Build borrow transaction
   */
  private async buildBorrowTx(action: PlanAction, wallet: string): Promise<ethers.TransactionRequest> {
    const data = this.pool.interface.encodeFunctionData('borrow', [
      action.toToken,
      action.amount,
      2, // interestRateMode: 2 = variable rate
      0, // referralCode
      wallet
    ]);

    return {
      to: AAVE_CONFIG.pool,
      data,
      from: wallet,
      value: BigInt(0)
    };
  }

  /**
   * Build repay transaction
   */
  private async buildRepayTx(action: PlanAction, wallet: string): Promise<ethers.TransactionRequest> {
    const data = this.pool.interface.encodeFunctionData('repay', [
      action.fromToken,
      action.amount,
      2, // interestRateMode: 2 = variable rate
      wallet
    ]);

    return {
      to: AAVE_CONFIG.pool,
      data,
      from: wallet,
      value: BigInt(0)
    };
  }

  /**
   * Send action to Aave V3
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
      throw new Error(`Failed to send Aave action: ${error}`);
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
      const allowance = await tokenContract.allowance(wallet, AAVE_CONFIG.pool);

      if (allowance < amount) {
        const data = tokenContract.interface.encodeFunctionData('approve', [
          AAVE_CONFIG.pool,
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
