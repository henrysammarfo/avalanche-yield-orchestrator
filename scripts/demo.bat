@echo off
echo 🚀 Avalanche Yield Orchestrator - Demo Script
echo ==============================================
echo.

echo 📋 Available Commands:
echo   pnpm run monitor    - Monitor current DeFi opportunities
echo   pnpm run simulate   - Simulate action planning
echo   pnpm run backtest   - Run strategy backtesting
echo   pnpm run test       - Run all tests
echo   pnpm run build      - Build the project
echo   pnpm run lint       - Check code quality
echo.

echo 🔧 Setup Commands:
echo   pnpm install        - Install dependencies
echo   pnpm run build      - Build TypeScript to JavaScript
echo.

echo 🧪 Testing Commands:
echo   pnpm run test       - Run tests in watch mode
echo   pnpm run test:run   - Run tests once and exit
echo.

echo 📊 Demo Workflow:
echo   1. pnpm run monitor    # Check current opportunities
echo   2. pnpm run simulate   # Generate action plans
echo   3. pnpm run backtest   # Test strategies with historical data
echo.

echo ⚠️  Important Notes:
echo   - Set EXECUTION_MODE=suggest in .env for safe demo mode
echo   - Use Fuji testnet addresses in production
echo   - All actions include safety checks and dry-runs
echo.

echo ✅ Ready to run! Start with: pnpm run monitor
pause
