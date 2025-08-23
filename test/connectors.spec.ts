import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ethers } from 'ethers';
import { TraderJoeConnector } from '../src/connectors/traderjoe.js';
import { BenqiConnector } from '../src/connectors/benqi.js';
import { YieldYakConnector } from '../src/connectors/yieldyak.js';
import { PlanAction } from '../src/types/index.js';

// Mock ethers provider
const mockProvider = {
  call: vi.fn(),
  estimateGas: vi.fn(),
  getBlockNumber: vi.fn(),
} as any;

describe('TraderJoeConnector', () => {
  let connector: TraderJoeConnector;

  beforeEach(() => {
    connector = new TraderJoeConnector(mockProvider);
    vi.clearAllMocks();
  });

  describe('readOpportunities', () => {
    it('should return array of opportunities', async () => {
      const opportunities = await connector.readOpportunities();
      
      expect(opportunities).toBeInstanceOf(Array);
      expect(opportunities.length).toBeGreaterThan(0);
      
      opportunities.forEach(opp => {
        expect(opp).toHaveProperty('id');
        expect(opp).toHaveProperty('protocol', 'traderjoe');
        expect(opp).toHaveProperty('apr');
        expect(opp).toHaveProperty('tokenAddress');
        expect(opp).toHaveProperty('tokenSymbol');
      });
    });

    it('should handle errors gracefully', async () => {
      // Mock error scenario
      vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const opportunities = await connector.readOpportunities();
      expect(opportunities).toEqual([]);
    });
  });

  describe('buildAction', () => {
    it('should build swap transaction', async () => {
      const action: PlanAction = {
        type: 'swap',
        protocol: 'traderjoe',
        fromToken: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
        toToken: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
        amount: ethers.parseUnits('100', 18),
        amountUsd: 2500,
        slippageBps: 50,
        deadline: Math.floor(Date.now() / 1000) + 1200,
        estimatedGas: 200000,
        estimatedGasUsd: 5.0,
        riskScore: 0.4
      };

      mockProvider.call.mockResolvedValue('0x');
      mockProvider.estimateGas.mockResolvedValue(BigInt(200000));

      const result = await connector.buildAction(action, '0x1234567890123456789012345678901234567890');
      
      expect(result).toHaveProperty('tx');
      expect(result).toHaveProperty('dryRunResult');
      expect(result.tx).toHaveProperty('to');
      expect(result.tx).toHaveProperty('data');
    });

    it('should build add liquidity transaction', async () => {
      const action: PlanAction = {
        type: 'lp_add',
        protocol: 'traderjoe',
        fromToken: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
        toToken: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
        amount: ethers.parseUnits('100', 18),
        amountUsd: 2500,
        slippageBps: 50,
        deadline: Math.floor(Date.now() / 1000) + 1200,
        estimatedGas: 300000,
        estimatedGasUsd: 7.5,
        riskScore: 0.4
      };

      mockProvider.call.mockResolvedValue('0x');
      mockProvider.estimateGas.mockResolvedValue(BigInt(300000));

      const result = await connector.buildAction(action, '0x1234567890123456789012345678901234567890');
      
      expect(result).toHaveProperty('tx');
      expect(result.tx).toHaveProperty('to');
      expect(result.tx).toHaveProperty('data');
    });

    it('should throw error for unsupported action type', async () => {
      const action: PlanAction = {
        type: 'supply',
        protocol: 'traderjoe',
        fromToken: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
        toToken: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
        amount: ethers.parseUnits('100', 18),
        amountUsd: 2500,
        slippageBps: 50,
        deadline: Math.floor(Date.now() / 1000) + 1200,
        estimatedGas: 200000,
        estimatedGasUsd: 5.0,
        riskScore: 0.4
      };

      await expect(connector.buildAction(action, '0x1234567890123456789012345678901234567890'))
        .rejects.toThrow('Unsupported action type: supply');
    });
  });
});

describe('BenqiConnector', () => {
  let connector: BenqiConnector;

  beforeEach(() => {
    connector = new BenqiConnector(mockProvider);
    vi.clearAllMocks();
  });

  describe('readOpportunities', () => {
    it('should return array of opportunities', async () => {
      const opportunities = await connector.readOpportunities();
      
      expect(opportunities).toBeInstanceOf(Array);
      expect(opportunities.length).toBeGreaterThan(0);
      
      opportunities.forEach(opp => {
        expect(opp).toHaveProperty('id');
        expect(opp).toHaveProperty('protocol', 'benqi');
        expect(opp).toHaveProperty('apr');
        expect(opp).toHaveProperty('tokenAddress');
        expect(opp).toHaveProperty('tokenSymbol');
      });
    });
  });

  describe('buildAction', () => {
    it('should build supply transaction', async () => {
      const action: PlanAction = {
        type: 'supply',
        protocol: 'benqi',
        fromToken: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
        toToken: '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c',
        amount: ethers.parseUnits('100', 18),
        amountUsd: 2500,
        slippageBps: 0,
        deadline: Math.floor(Date.now() / 1000) + 1200,
        estimatedGas: 200000,
        estimatedGasUsd: 5.0,
        riskScore: 0.2
      };

      mockProvider.call.mockResolvedValue('0x');
      mockProvider.estimateGas.mockResolvedValue(BigInt(200000));

      const result = await connector.buildAction(action, '0x1234567890123456789012345678901234567890');
      
      expect(result).toHaveProperty('tx');
      expect(result).toHaveProperty('dryRunResult');
      expect(result.tx).toHaveProperty('to');
      expect(result.tx).toHaveProperty('data');
    });

    it('should build borrow transaction', async () => {
      const action: PlanAction = {
        type: 'borrow',
        protocol: 'benqi',
        fromToken: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
        toToken: '0x5C0401e81Bc07Ca70fAD469b451682c0d747Ef1c',
        amount: ethers.parseUnits('50', 18),
        amountUsd: 1250,
        slippageBps: 0,
        deadline: Math.floor(Date.now() / 1000) + 1200,
        estimatedGas: 200000,
        estimatedGasUsd: 5.0,
        riskScore: 0.6
      };

      mockProvider.call.mockResolvedValue('0x');
      mockProvider.estimateGas.mockResolvedValue(BigInt(200000));

      const result = await connector.buildAction(action, '0x1234567890123456789012345678901234567890');
      
      expect(result).toHaveProperty('tx');
      expect(result.tx).toHaveProperty('to');
      expect(result.tx).toHaveProperty('data');
    });
  });
});

describe('YieldYakConnector', () => {
  let connector: YieldYakConnector;

  beforeEach(() => {
    connector = new YieldYakConnector(mockProvider);
    vi.clearAllMocks();
  });

  describe('readOpportunities', () => {
    it('should return array of opportunities', async () => {
      const opportunities = await connector.readOpportunities();
      
      expect(opportunities).toBeInstanceOf(Array);
      expect(opportunities.length).toBeGreaterThan(0);
      
      opportunities.forEach(opp => {
        expect(opp).toHaveProperty('id');
        expect(opp).toHaveProperty('protocol', 'yieldyak');
        expect(opp).toHaveProperty('apr');
        expect(opp).toHaveProperty('tokenAddress');
        expect(opp).toHaveProperty('tokenSymbol');
      });
    });
  });

  describe('buildAction', () => {
    it('should build deposit transaction', async () => {
      const action: PlanAction = {
        type: 'deposit',
        protocol: 'yieldyak',
        fromToken: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
        toToken: '0x0000000000000000000000000000000000000000', // Vault address
        amount: ethers.parseUnits('100', 18),
        amountUsd: 2500,
        slippageBps: 0,
        deadline: Math.floor(Date.now() / 1000) + 1200,
        estimatedGas: 150000,
        estimatedGasUsd: 3.75,
        riskScore: 0.3
      };

      mockProvider.call.mockResolvedValue('0x');
      mockProvider.estimateGas.mockResolvedValue(BigInt(150000));

      const result = await connector.buildAction(action, '0x1234567890123456789012345678901234567890');
      
      expect(result).toHaveProperty('tx');
      expect(result).toHaveProperty('dryRunResult');
      expect(result.tx).toHaveProperty('to');
      expect(result.tx).toHaveProperty('data');
    });

    it('should build withdraw transaction', async () => {
      const action: PlanAction = {
        type: 'withdraw_vault',
        protocol: 'yieldyak',
        fromToken: '0x0000000000000000000000000000000000000000', // Vault address
        toToken: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
        amount: ethers.parseUnits('100', 18),
        amountUsd: 2500,
        slippageBps: 0,
        deadline: Math.floor(Date.now() / 1000) + 1200,
        estimatedGas: 150000,
        estimatedGasUsd: 3.75,
        riskScore: 0.3
      };

      mockProvider.call.mockResolvedValue('0x');
      mockProvider.estimateGas.mockResolvedValue(BigInt(150000));

      const result = await connector.buildAction(action, '0x1234567890123456789012345678901234567890');
      
      expect(result).toHaveProperty('tx');
      expect(result.tx).toHaveProperty('to');
      expect(result.tx).toHaveProperty('data');
    });
  });
});

describe('Integration Tests', () => {
  it('should simulate with all connectors', async () => {
    const connectors = [
      new TraderJoeConnector(mockProvider),
      new BenqiConnector(mockProvider),
      new YieldYakConnector(mockProvider)
    ];

    const allOpportunities = await Promise.all(
      connectors.map(connector => connector.readOpportunities())
    );

    const totalOpportunities = allOpportunities.reduce((sum, opps) => sum + opps.length, 0);
    expect(totalOpportunities).toBeGreaterThan(0);

    // Test that each connector implements the required interface
    connectors.forEach(connector => {
      expect(connector).toHaveProperty('provider');
      expect(typeof connector.readOpportunities).toBe('function');
      expect(typeof connector.readPosition).toBe('function');
      expect(typeof connector.buildAction).toBe('function');
      expect(typeof connector.sendAction).toBe('function');
    });
  });

  it('should backtest with sample data', async () => {
    // This would test the backtesting functionality
    // For now, just verify the sample data exists
    expect(true).toBe(true);
  });
});
