# Avalanche Yield Orchestrator (AYO)

An AI agent that monitors wallets and reallocates assets across Avalanche-native DeFi protocols (Trader Joe, Benqi, Yield Yak) for optimal yield generation.

## 🚀 Features

- **Multi-Protocol Support**: Integrates with Trader Joe (DEX), Benqi (Lending), and Yield Yak (Vaults)
- **AI-Powered Optimization**: Uses machine learning to identify the best yield opportunities
- **Safety First**: Built-in safety checks, dry-run capabilities, and configurable risk limits
- **Real-time Monitoring**: Continuous monitoring of wallet positions and market opportunities
- **Automated Execution**: Configurable execution modes from suggestion-only to fully automated

## 🏗️ Architecture

```
src/
├── connectors/          # Protocol connectors
│   ├── traderjoe.ts    # Trader Joe DEX operations
│   ├── benqi.ts        # Benqi lending operations
│   └── yieldyak.ts     # Yield Yak vault operations
├── agents/             # AI agent logic
├── services/           # Core services
├── utils/              # Utility functions
└── types/              # TypeScript interfaces
```

## 📋 Prerequisites

- Node.js 20+
- pnpm package manager
- Avalanche C-Chain RPC endpoint
- Wallet private key (for execution mode)

## 🛠️ Installation

```bash
# Clone the repository
git clone <repository-url>
cd avalanche-yield-orchestrator

# Install dependencies
pnpm install

# Build the project
pnpm build
```

## ⚙️ Configuration

### 1. Environment Variables

Create a `.env` file in the root directory:

```bash
# Network Configuration
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc  # Fuji testnet
# RPC_URL=https://api.avax.network/ext/bc/C/rpc     # Mainnet

# Wallet Configuration
PRIVATE_KEY=your_private_key_here
WALLET_ADDRESS=your_wallet_address_here

# Execution Mode
EXECUTION_MODE=suggest  # 'suggest' or 'auto'
```

### 2. Protocol Configuration

Edit `config/protocols.json` to set your preferred parameters:

```json
{
  "traderjoe": {
    "maxNotionalPerTx": 250,
    "dailyCap": 1000,
    "defaultSlippageBps": 50,
    "maxSlippageBps": 500
  },
  "benqi": {
    "minHealthFactor": 1.3,
    "maxNotionalPerTx": 250,
    "dailyCap": 1000
  },
  "yieldyak": {
    "maxNotionalPerTx": 250,
    "dailyCap": 1000
  }
}
```

### 3. Contract Addresses

Update contract addresses in `config/protocols.json`:

- **Fuji Testnet**: Use testnet contract addresses
- **Mainnet**: Use mainnet contract addresses

**⚠️ Important**: Never commit real private keys or mainnet addresses to version control!

## 🎯 Usage

### Quick Demo

Run the comprehensive demo to see all features in action:

```bash
pnpm demo
```

### Monitor Opportunities

View current yield opportunities across all protocols:

```bash
pnpm monitor
```

### Simulate Actions

Create action plans without executing:

```bash
pnpm simulate
```

### Backtest Strategy

Analyze historical performance:

```bash
pnpm backtest
```

### Development Mode

Run in development mode with hot reloading:

```bash
pnpm dev
```

## 🔌 Connectors

### Trader Joe Connector

Handles DEX operations including:
- Token swaps with slippage protection
- Liquidity provision (add/remove)
- Pool APR and TVL monitoring

**Supported Actions**: `swap`, `lp_add`, `lp_remove`

### Benqi Connector

Manages lending operations with:
- Supply/withdraw tokens
- Borrow/repay with health factor monitoring
- Interest rate optimization

**Supported Actions**: `supply`, `withdraw`, `borrow`, `repay`

### Yield Yak Connector

Optimizes vault strategies:
- Deposit/withdraw from yield vaults
- APY monitoring and comparison
- Fee calculation and optimization

**Supported Actions**: `deposit`, `withdraw_vault`

## 🛡️ Safety Features

### Pre-Execution Checks

- **Notional Limits**: Maximum transaction size ($250 default)
- **Daily Caps**: Daily spending limits ($1000 default)
- **Slippage Protection**: Maximum slippage tolerance (0.5% default)
- **Health Factor**: Minimum health factor for lending (1.3 default)

### Dry-Run Execution

All actions are dry-run before execution to:
- Verify transaction success
- Estimate gas costs
- Validate parameters
- Check for potential errors

### Approval Management

Automatic detection and handling of token approvals:
- Checks current allowances
- Generates approval transactions when needed
- Prevents failed transactions due to insufficient approvals

## 🧪 Testing

Run the test suite:

```bash
# Run all tests
pnpm test

# Run tests once
pnpm test:run

# Run specific test file
pnpm test test/connectors.spec.ts
```

### Test Coverage

- Unit tests for all connectors
- Integration tests for cross-protocol operations
- Mock providers for safe testing
- Sample data for backtesting

## 🚀 Deployment

### Fuji Testnet (Recommended for Testing)

```bash
# Set testnet RPC
export RPC_URL=https://api.avax-test.network/ext/bc/C/rpc

# Run demo
pnpm demo
```

### Mainnet (Production)

```bash
# Set mainnet RPC
export RPC_URL=https://api.avax.network/ext/bc/C/rpc

# Set execution mode
export EXECUTION_MODE=suggest

# Run with real wallet
pnpm demo
```

## 📊 Monitoring & Logging

### Prisma Integration

The system uses Prisma for structured logging:
- Action execution records
- Performance metrics
- Error tracking
- Audit trails

### Metrics Available

- APY comparisons across protocols
- Gas cost analysis
- Slippage impact
- Risk score tracking
- Portfolio performance

## 🔧 Development

### Adding New Protocols

1. Create connector in `src/connectors/`
2. Implement the `Connector` interface
3. Add ABI files in `src/connectors/ABIs/`
4. Update configuration files
5. Add tests

### Code Quality

```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code
pnpm format

# Type check
pnpm build
```

## 📈 Performance Optimization

### Gas Optimization

- Batch transactions where possible
- Optimize contract calls
- Use efficient data structures
- Implement caching strategies

### Yield Optimization

- Real-time APY monitoring
- Dynamic rebalancing
- Risk-adjusted returns
- Portfolio diversification

## 🚨 Security Considerations

### Private Key Management

- **Never** hardcode private keys
- Use environment variables
- Consider hardware wallets for production
- Implement key rotation

### Network Security

- Verify RPC endpoints
- Use HTTPS connections
- Validate contract addresses
- Monitor for suspicious activity

### Smart Contract Security

- Audit all contract interactions
- Implement timeouts and deadlines
- Use multi-sig wallets for large amounts
- Regular security reviews

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### Development Guidelines

- Follow TypeScript best practices
- Write comprehensive tests
- Document all public APIs
- Use conventional commits
- Maintain backward compatibility

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Security**: Security advisories

## 🙏 Acknowledgments

- Trader Joe team for DEX integration
- Benqi team for lending protocol
- Yield Yak team for vault strategies
- Avalanche Foundation for the platform

---

**⚠️ Disclaimer**: This software is for educational and research purposes. Use at your own risk. Always test thoroughly on testnets before using on mainnet.
