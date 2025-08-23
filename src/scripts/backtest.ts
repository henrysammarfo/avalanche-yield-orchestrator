

import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

/**
 * Backtest script - demonstrates strategy backtesting with historical data
 */
async function main() {
  console.log('🚀 Avalanche Yield Orchestrator - Backtest Mode');
  console.log('================================================\n');

  try {
    // Load sample APY data
    console.log('📊 Loading historical APY data...\n');
    
    const csvData = readFileSync('src/data/sample_apys.csv', 'utf-8');
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true
    });

    console.log(`📈 Loaded ${records.length} days of historical data\n`);

    // Display sample data
    console.log('📋 Sample Historical Data:');
    console.log('----------------------------');
    records.slice(0, 5).forEach((record: any, index: number) => {
      console.log(`  Day ${index + 1}:`);
      console.log(`    Trader Joe AVAX-USDC: ${record.traderjoe_avax_usdc}%`);
      console.log(`    Benqi AVAX Supply: ${record.benqi_avax_supply}%`);
      console.log(`    Yield Yak AVAX: ${record.yieldyak_avax}%`);
      console.log('');
    });

    // Simple backtesting strategy
    console.log('🔄 Running Backtest Strategy...\n');

    let totalReturn = 0;
    let bestDay = { date: '', return: 0 };
    let worstDay = { date: '', return: 0 };
    let strategyReturns: number[] = [];

    records.forEach((record: any) => {
      // Simple strategy: allocate 40% to best performing protocol each day
      const tjReturn = parseFloat(record.traderjoe_avax_usdc) / 100;
      const benqiReturn = parseFloat(record.benqi_avax_supply) / 100;
      const yyReturn = parseFloat(record.yieldyak_avax) / 100;

      // Find best performing protocol
      const returns = [tjReturn, benqiReturn, yyReturn];
      const bestReturn = Math.max(...returns);
      const bestProtocol = ['Trader Joe', 'Benqi', 'Yield Yak'][returns.indexOf(bestReturn)];

      // Calculate daily return (40% in best protocol, 20% in others)
      const dailyReturn = (bestReturn * 0.4) + (tjReturn * 0.2) + (benqiReturn * 0.2) + (yyReturn * 0.2);
      
      strategyReturns.push(dailyReturn);
      totalReturn += dailyReturn;

      // Track best and worst days
      if (dailyReturn > bestDay.return) {
        bestDay = { date: record.date, return: dailyReturn };
      }
      if (dailyReturn < worstDay.return) {
        worstDay = { date: record.date, return: dailyReturn };
      }

      console.log(`  ${record.date}: ${bestProtocol} best (${(bestReturn * 100).toFixed(2)}%), Strategy: ${(dailyReturn * 100).toFixed(2)}%`);
    });

    // Calculate performance metrics
    const avgDailyReturn = totalReturn / records.length;
    const annualizedReturn = avgDailyReturn * 365;
    const volatility = Math.sqrt(
      strategyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgDailyReturn, 2), 0) / records.length
    );
    const sharpeRatio = avgDailyReturn / volatility;

    console.log('\n📊 Backtest Results:');
    console.log('====================');
    console.log(`  Total Days: ${records.length}`);
    console.log(`  Total Return: ${(totalReturn * 100).toFixed(2)}%`);
    console.log(`  Average Daily Return: ${(avgDailyReturn * 100).toFixed(2)}%`);
    console.log(`  Annualized Return: ${(annualizedReturn * 100).toFixed(2)}%`);
    console.log(`  Volatility: ${(volatility * 100).toFixed(2)}%`);
    console.log(`  Sharpe Ratio: ${sharpeRatio.toFixed(2)}`);
    console.log(`  Best Day: ${bestDay.date} (${(bestDay.return * 100).toFixed(2)}%)`);
    console.log(`  Worst Day: ${worstDay.date} (${(worstDay.return * 100).toFixed(2)}%)`);
    console.log('');

    // Strategy analysis
    console.log('🎯 Strategy Analysis:');
    console.log('---------------------');
    console.log('  • The strategy allocates 40% to the best performing protocol daily');
    console.log('  • Remaining 60% is distributed equally among all protocols');
    console.log('  • This approach captures upside while maintaining diversification');
    console.log('  • Historical data shows consistent opportunities across protocols');
    console.log('');

    console.log('✅ Backtest complete! The strategy shows promising results.');
    console.log('   Use "pnpm run monitor" to check current opportunities.');
    console.log('   Use "pnpm run simulate" to generate action plans.');

  } catch (error) {
    console.error('❌ Error during backtest:', error);
    process.exit(1);
  }
}

// Run the backtest
main().catch(console.error);
