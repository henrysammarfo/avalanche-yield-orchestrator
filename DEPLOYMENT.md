# Avalanche Yield Orchestrator - Deployment Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ 
- pnpm package manager
- Git
- Avalanche testnet AVAX (for testing)

### 1. Clone and Setup
```bash
git clone https://github.com/henrysammarfo/avalanche-yield-orchestrator.git
cd avalanche-yield-orchestrator
pnpm install
```

### 2. Build the Project
```bash
pnpm run build
```

### 3. Initialize Database
```bash
npx prisma generate
npx prisma db push
```

## 🌐 Testnet Deployment

### Fuji Testnet (Recommended for Testing)

The system is configured to connect to Avalanche Fuji testnet by default.

#### Configuration
- **Network**: Fuji Testnet
- **Chain ID**: 43113
- **RPC URL**: https://api.avax-test.network/ext/bc/C/rpc
- **Explorer**: https://testnet.snowtrace.io

#### Get Testnet AVAX
Visit the [Avalanche Faucet](https://faucet.avax.network/) to get free testnet AVAX.

#### Run Testnet Demo
```bash
# Run the testnet demo with real blockchain data
pnpm run testnet
```

This will:
- Connect to Fuji testnet
- Read real blockchain data (blocks, gas prices)
- Fetch real opportunities from DeFi protocols
- Simulate actions with real gas estimates
- Run in demo mode for safety

#### Deploy to Testnet
```bash
# Linux/Mac
./scripts/deploy-testnet.sh

# Windows
scripts\deploy-testnet.bat
```

## 🔧 Configuration

### Environment Variables
Create `config/testnet.env` for testnet configuration:

```bash
# Network Configuration
NETWORK=fuji
RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
CHAIN_ID=43113
EXPLORER_URL=https://testnet.snowtrace.io

# Execution Mode
EXECUTION_MODE=demo  # demo, dry-run, live

# Wallet Configuration
PRIVATE_KEY=your_private_key_here
WALLET_ADDRESS=your_wallet_address_here

# Safety Limits
MAX_NOTIONAL_CAP=1000
DAILY_CAP=100
MAX_SLIPPAGE_BPS=50
MIN_HEALTH_FACTOR=1.3
```

### Protocol Configuration
Edit `config/protocols.json` to configure DeFi protocols:

```json
{
  "traderjoe": {
    "router": "0x60ae616a2155ee3d9a6854ba5c7b92bd7bc7f6d1",
    "factory": "0x9ad6c38be94206ca50bb0d90783181662f0cfa10"
  },
  "benqi": {
    "comptroller": "0x486af39519b4dc9a7fccd318217352830e8ad9b4a"
  },
  "yieldyak": {
    "vaults": {
      "avax": "0x0000000000000000000000000000000000000000"
    }
  }
}
```

## 🧪 Testing

### Run All Tests
```bash
pnpm run test:run
```

### Run Specific Scripts
```bash
# Monitor opportunities
pnpm run monitor

# Simulate actions
pnpm run simulate

# Run backtest
pnpm run backtest

# Testnet demo with real data
pnpm run testnet
```

### Demo Scripts
- `scripts/demo.sh` / `scripts/demo.bat` - Overview and workflow
- `scripts/deploy-testnet.sh` / `scripts/deploy-testnet.bat` - Testnet deployment

## 🔒 Security Features

### Demo Mode (Default)
- No real transactions executed
- All actions are simulated
- Safe for testing and development

### Safety Checks
- Notional caps per transaction
- Daily transaction limits
- Slippage protection
- Health factor validation (for lending)

### Dry Run
- All transactions are dry-run first
- Gas estimation and validation
- Safety check validation

## 📊 Monitoring

### Logs
- Console output with emojis for easy reading
- Error handling and warnings
- Gas price and network status

### Database
- Prisma SQLite database for logging
- Transaction history and positions
- Performance metrics

### Network Status
- Current block number
- Gas prices
- Network connectivity
- Chain ID validation

## 🚨 Production Deployment

### Mainnet Configuration
1. Update `config/network.avalanche.json` for mainnet
2. Set `EXECUTION_MODE=live` in environment
3. Configure real private keys
4. Set appropriate safety limits
5. Test with small amounts first

### Security Checklist
- [ ] Private keys secured
- [ ] Safety limits configured
- [ ] Gas limits set
- [ ] Slippage protection enabled
- [ ] Health factor validation
- [ ] Notional caps enforced
- [ ] Daily limits configured

## 🆘 Troubleshooting

### Common Issues

#### Connection Errors
```bash
# Check RPC URL
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  https://api.avax-test.network/ext/bc/C/rpc
```

#### Build Errors
```bash
# Clean and rebuild
rm -rf dist/
pnpm run build
```

#### Database Issues
```bash
# Reset database
rm -f prisma/dev.db
npx prisma db push
```

#### Gas Estimation Failures
- Check if contracts exist on testnet
- Verify ABI compatibility
- Ensure sufficient testnet AVAX

### Support
- Check GitHub Issues
- Review logs and error messages
- Verify network configuration
- Test with known working addresses

## 📈 Performance

### Gas Optimization
- Default gas limit: 300,000
- Max gas limit: 1,000,000
- Priority fee: 2 gwei

### Network Latency
- Fuji testnet: ~2-5 seconds
- Mainnet: ~1-3 seconds
- RPC endpoint selection for optimal performance

### Scalability
- Batch transaction processing
- Concurrent opportunity scanning
- Efficient database queries
- Memory-optimized operations

## 🔄 Updates and Maintenance

### Regular Updates
```bash
git pull origin main
pnpm install
pnpm run build
```

### Database Migrations
```bash
npx prisma migrate dev
npx prisma generate
```

### Configuration Updates
- Monitor protocol addresses for changes
- Update safety parameters as needed
- Review and adjust gas limits
- Monitor performance metrics

---

## 🎯 Next Steps

1. **Test on Fuji testnet** with the demo scripts
2. **Configure your wallet** with testnet AVAX
3. **Customize parameters** for your use case
4. **Deploy to mainnet** when ready (with proper security)
5. **Monitor and optimize** performance

For more information, see the [README.md](README.md) and [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md).
