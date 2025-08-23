import { ethers } from 'ethers';
import { DryRunResult, SafetyCheck, PlanAction, ProtocolConfig } from '../types/index.js';

/**
 * Dry run a transaction using provider.call()
 * @param provider - Ethers provider
 * @param tx - Transaction request
 * @returns Dry run result
 */
export async function dryRunTx(
  provider: ethers.JsonRpcProvider,
  tx: ethers.TransactionRequest
): Promise<DryRunResult> {
  try {
    const result = await provider.call(tx);
    return {
      success: true,
      gasUsed: BigInt(0), // Will be updated with actual gas estimation
      gasCost: BigInt(0),
      logs: []
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.reason || error.message || 'Unknown error',
      gasUsed: BigInt(0),
      gasCost: BigInt(0)
    };
  }
}

/**
 * Estimate gas for a transaction
 * @param provider - Ethers provider
 * @param tx - Transaction request
 * @returns Gas estimate
 */
export async function estimateGas(
  provider: ethers.JsonRpcProvider,
  tx: ethers.TransactionRequest
): Promise<bigint> {
  try {
    return await provider.estimateGas(tx);
  } catch (error) {
    throw new Error(`Gas estimation failed: ${error}`);
  }
}

/**
 * Perform safety checks before executing an action
 * @param action - Plan action to check
 * @param config - Protocol configuration
 * @param dailyUsage - Daily usage so far
 * @param currentPrices - Current token prices
 * @returns Safety check result
 */
export function performSafetyChecks(
  action: PlanAction,
  config: ProtocolConfig,
  dailyUsage: number,
  currentPrices: Record<string, number>
): SafetyCheck {
  const notionalCheck = action.amountUsd <= config.maxNotionalPerTx;
  const dailyCapCheck = (dailyUsage + action.amountUsd) <= config.dailyCap;
  const slippageCheck = action.slippageBps <= config.maxSlippageBps;

  const passed = notionalCheck && dailyCapCheck && slippageCheck;
  let reason = '';

  if (!notionalCheck) {
    reason = `Amount ${action.amountUsd} exceeds max notional per tx ${config.maxNotionalPerTx}`;
  } else if (!dailyCapCheck) {
    reason = `Daily usage ${dailyUsage + action.amountUsd} exceeds daily cap ${config.dailyCap}`;
  } else if (!slippageCheck) {
    reason = `Slippage ${action.slippageBps} bps exceeds max ${config.maxSlippageBps} bps`;
  }

  return {
    passed,
    reason,
    notionalCheck,
    dailyCapCheck,
    slippageCheck
  };
}

/**
 * Get current block timestamp
 * @returns Current block timestamp
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Calculate deadline for transactions
 * @param minutesFromNow - Minutes from now
 * @returns Deadline timestamp
 */
export function calculateDeadline(minutesFromNow: number = 20): number {
  return getCurrentTimestamp() + (minutesFromNow * 60);
}

/**
 * Convert basis points to percentage
 * @param bps - Basis points
 * @returns Percentage
 */
export function bpsToPercentage(bps: number): number {
  return bps / 10000;
}

/**
 * Convert percentage to basis points
 * @param percentage - Percentage
 * @returns Basis points
 */
export function percentageToBps(percentage: number): number {
  return Math.round(percentage * 10000);
}

/**
 * Calculate minimum amount out with slippage
 * @param amountIn - Amount in
 * @param slippageBps - Slippage in basis points
 * @returns Minimum amount out
 */
export function calculateMinAmountOut(amountIn: bigint, slippageBps: number): bigint {
  const slippageMultiplier = BigInt(10000 - slippageBps);
  return (amountIn * slippageMultiplier) / BigInt(10000);
}

/**
 * Mock price service - replace with Chainlink oracles in production
 * @param tokenAddress - Token address
 * @returns Mock price in USD
 */
export function getMockPrice(tokenAddress: string): number {
  const mockPrices: Record<string, number> = {
    '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7': 25.0, // WAVAX
    '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E': 1.0,  // USDC
    '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7': 1.0,  // USDT
    '0x0000000000000000000000000000000000000000': 1.0,  // Default
  };

  return mockPrices[tokenAddress] || 1.0;
}

/**
 * Convert token amount to USD
 * @param amount - Token amount
 * @param decimals - Token decimals
 * @param tokenAddress - Token address
 * @returns USD value
 */
export function tokenToUsd(amount: bigint, decimals: number, tokenAddress: string): number {
  const price = getMockPrice(tokenAddress);
  const amountFloat = parseFloat(ethers.formatUnits(amount, decimals));
  return amountFloat * price;
}

/**
 * Convert USD to token amount
 * @param usdAmount - USD amount
 * @param decimals - Token decimals
 * @param tokenAddress - Token address
 * @returns Token amount
 */
export function usdToToken(usdAmount: number, decimals: number, tokenAddress: string): bigint {
  const price = getMockPrice(tokenAddress);
  const tokenAmount = usdAmount / price;
  return ethers.parseUnits(tokenAmount.toString(), decimals);
}
