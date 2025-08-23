import { ethers } from 'ethers';

export interface Opportunity {
  id: string;
  protocol: string;
  apr: number;
  vol?: number;
  ilRisk?: number;
  estGasUsd: number;
  tokenAddress: string;
  tokenSymbol: string;
  tvl?: number;
  riskScore: number;
}

export interface Position {
  id: string;
  protocol: string;
  tokenAddress: string;
  tokenSymbol: string;
  balance: bigint;
  balanceUsd: number;
  apr?: number;
  healthFactor?: number;
}

export interface PlanAction {
  type: 'swap' | 'lp_add' | 'lp_remove' | 'supply' | 'withdraw' | 'borrow' | 'repay' | 'deposit' | 'withdraw_vault';
  protocol: string;
  fromToken: string;
  toToken: string;
  amount: bigint;
  amountUsd: number;
  slippageBps: number;
  deadline: number;
  estimatedGas: number;
  estimatedGasUsd: number;
  riskScore: number;
}

export interface Connector {
  provider: ethers.JsonRpcProvider;
  readOpportunities(): Promise<Opportunity[]>;
  readPosition(wallet: string): Promise<Position[]>;
  buildAction(action: PlanAction, wallet: string): Promise<{ tx: ethers.TransactionRequest; dryRunResult?: any }>;
  sendAction(txRequest: ethers.TransactionRequest, signer: ethers.Signer): Promise<ethers.TransactionReceipt>;
}

export interface DryRunResult {
  success: boolean;
  gasUsed?: bigint;
  gasCost?: bigint;
  error?: string;
  logs?: any[];
}

export interface SafetyCheck {
  passed: boolean;
  reason?: string;
  notionalCheck: boolean;
  dailyCapCheck: boolean;
  slippageCheck: boolean;
  healthFactorCheck?: boolean;
}

export interface ProtocolConfig {
  name: string;
  maxNotionalPerTx: number;
  dailyCap: number;
  defaultSlippageBps: number;
  maxSlippageBps: number;
  [key: string]: any;
}

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpc: string;
  explorer: string;
  gas: {
    default: number;
    max: number;
    maxPriorityFeePerGas: string;
  };
}
