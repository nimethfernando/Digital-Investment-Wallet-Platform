export interface BlockchainProvider {
  network: string;
  validateAddress(address: string, network: string): boolean;
  verifyTransactionHash(txHash: string, expectedAmount: number, toAddress: string): Promise<{ confirmed: boolean; confirmations: number; hash: string }>;
}

export class ExplorerStubBlockchainProvider implements BlockchainProvider {
  network = 'TRON / ETH / BSC';

  validateAddress(address: string, network: string): boolean {
    if (!address || address.trim().length < 10) return false;
    if (network === 'TRC-20' || network === 'TRON') {
      return address.startsWith('T') && address.length === 34;
    }
    if (network === 'ERC-20' || network === 'BEP-20') {
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    return true;
  }

  async verifyTransactionHash(txHash: string, expectedAmount: number, toAddress: string): Promise<{ confirmed: boolean; confirmations: number; hash: string }> {
    const isValidFormat = txHash.length >= 32;
    return {
      confirmed: isValidFormat,
      confirmations: isValidFormat ? 12 : 0,
      hash: txHash,
    };
  }
}

export const blockchainProvider = new ExplorerStubBlockchainProvider();
