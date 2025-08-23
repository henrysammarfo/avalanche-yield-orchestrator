import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Load configuration files in a Node.js compatible way
 */
export function loadConfig<T>(relativePath: string): T {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const configPath = join(__dirname, '..', '..', relativePath);
  const configContent = readFileSync(configPath, 'utf-8');
  return JSON.parse(configContent);
}

/**
 * Load ABI files in a Node.js compatible way
 */
export function loadAbi(abiName: string): any {
  return loadConfig(`src/connectors/ABIs/${abiName}.json`);
}

/**
 * Load protocols configuration
 */
export function loadProtocolsConfig() {
  return loadConfig<any>('config/protocols.json');
}

/**
 * Load network configuration
 */
export function loadNetworkConfig() {
  return loadConfig<any>('config/network.avalanche.json');
}
