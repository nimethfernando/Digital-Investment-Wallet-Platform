"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blockchainProvider = exports.ExplorerStubBlockchainProvider = void 0;
class ExplorerStubBlockchainProvider {
    network = 'TRON / ETH / BSC';
    validateAddress(address, network) {
        if (!address || address.trim().length < 10)
            return false;
        if (network === 'TRC-20' || network === 'TRON') {
            return address.startsWith('T') && address.length === 34;
        }
        if (network === 'ERC-20' || network === 'BEP-20') {
            return /^0x[a-fA-F0-9]{40}$/.test(address);
        }
        return true;
    }
    async verifyTransactionHash(txHash, expectedAmount, toAddress) {
        const isValidFormat = txHash.length >= 32;
        return {
            confirmed: isValidFormat,
            confirmations: isValidFormat ? 12 : 0,
            hash: txHash,
        };
    }
}
exports.ExplorerStubBlockchainProvider = ExplorerStubBlockchainProvider;
exports.blockchainProvider = new ExplorerStubBlockchainProvider();
