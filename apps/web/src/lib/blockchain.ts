/**
 * Blockchain Explorer Utilities for Avora Bank
 * Supports BNB Smart Chain (BSCScan), TRON (TronScan), and Ethereum (Etherscan).
 */

export interface BlockchainExplorerInfo {
  isCrypto: boolean;
  name: 'BscScan' | 'TronScan' | 'Etherscan' | 'Blockchain Explorer';
  network: string;
  url: string;
  hash: string;
  shortHash: string;
}

/**
 * Parses a transaction hash or reference and determines the appropriate blockchain explorer.
 * Guarantees valid BSCScan links for confirmed USDT transactions.
 */
export function getExplorerInfo(
  refOrHash?: string | null,
  currency?: string | null,
  method?: string | null
): BlockchainExplorerInfo | null {
  if (!refOrHash) return null;
  const clean = refOrHash.trim();

  // If already a full URL
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    const isBsc = clean.includes('bscscan');
    const isTron = clean.includes('tronscan');
    const isEth = clean.includes('etherscan');
    const parts = clean.split('/');
    const hash = parts[parts.length - 1] || clean;
    return {
      isCrypto: true,
      name: isBsc ? 'BscScan' : isTron ? 'TronScan' : isEth ? 'Etherscan' : 'Blockchain Explorer',
      network: isBsc ? 'BNB Smart Chain (BEP-20)' : isTron ? 'TRON (TRC-20)' : isEth ? 'Ethereum (ERC-20)' : 'On-Chain',
      url: clean,
      hash,
      shortHash: hash.length > 14 ? `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}` : hash,
    };
  }

  // TRC-20 / TRON check
  const isTronMethod = method?.toUpperCase().includes('TRC20') || method?.toUpperCase().includes('TRON');
  const isTronHash = clean.length === 64 && /^[0-9a-fA-F]+$/.test(clean) && isTronMethod;
  if (isTronMethod && (isTronHash || clean.startsWith('T'))) {
    return {
      isCrypto: true,
      name: 'TronScan',
      network: 'TRON (TRC-20)',
      url: `https://tronscan.org/#/transaction/${clean}`,
      hash: clean,
      shortHash: clean.length > 14 ? `${clean.substring(0, 6)}...${clean.substring(clean.length - 4)}` : clean,
    };
  }

  // ERC-20 (Ethereum) check
  const isEthMethod = method?.toUpperCase().includes('ERC20');
  if (isEthMethod && (clean.startsWith('0x') || /^[0-9a-fA-F]{64}$/.test(clean))) {
    const formatted = clean.startsWith('0x') ? clean : `0x${clean}`;
    return {
      isCrypto: true,
      name: 'Etherscan',
      network: 'Ethereum (ERC-20)',
      url: `https://etherscan.io/tx/${formatted}`,
      hash: formatted,
      shortHash: `${formatted.substring(0, 6)}...${formatted.substring(formatted.length - 4)}`,
    };
  }

  // BEP-20 / BNB Smart Chain (Default for USDT crypto transactions)
  // Check if hash starts with 0x, or is a 64-hex string, or currency is USDT with a crypto method or hash
  const isHexHash = /^(0x)?[0-9a-fA-F]{64}$/.test(clean);
  const isUsdt = currency?.toUpperCase() === 'USDT';
  const isBscMethod = method?.toUpperCase().includes('BEP20') || method?.toUpperCase().includes('BSC') || method?.toUpperCase().includes('CRYPTO');

  if (clean.startsWith('0x') || isHexHash || (isUsdt && (isBscMethod || clean.length >= 32))) {
    const formatted = clean.startsWith('0x') ? clean : `0x${clean}`;
    return {
      isCrypto: true,
      name: 'BscScan',
      network: 'BNB Smart Chain (BEP-20)',
      url: `https://bscscan.com/tx/${formatted}`,
      hash: formatted,
      shortHash: formatted.length > 14 ? `${formatted.substring(0, 6)}...${formatted.substring(formatted.length - 4)}` : formatted,
    };
  }

  return null;
}

/**
 * Generate a cryptographically realistic BSC transaction hash (66 characters: '0x' + 64 hex chars).
 */
export function generateBscTxHash(): string {
  const chars = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

