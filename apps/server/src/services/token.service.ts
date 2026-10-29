import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export const TOKEN_SPEC = {
  tokenName: 'Avora Token',
  tokenSymbol: 'AVR',
  currentStatus: 'Testnet (Avora Sepolia L2)',
  proposedEarlyAccessPriceUsd: 1.00,
  targetMainnetLaunch: 'Q4 2027',
  totalSupply: '1,000,000,000',
  faucetClaimAmount: 100.0,
  tokenomics: [
    { category: 'Community & Liquidity Ecosystem', percentage: 40, tokens: '400,000,000 AVR' },
    { category: 'Avora Platform Treasury', percentage: 25, tokens: '250,000,000 AVR' },
    { category: 'Early Access & Private Seed', percentage: 15, tokens: '150,000,000 AVR' },
    { category: 'Core Contributors & Engineering', percentage: 12, tokens: '120,000,000 AVR' },
    { category: 'Validator Staking & Security Reserve', percentage: 8, tokens: '80,000,000 AVR' },
  ],
  roadmap: [
    { phase: 'Phase 1: Q1 2026', title: 'Avora Testnet v1 & Ledger Faucet', status: 'ACTIVE', description: 'Testnet deployment, cryptographic wallet generation, and faucet testing.' },
    { phase: 'Phase 2: Q3 2026', title: 'Smart Contract Audits & Early Access Whitelist', status: 'UPCOMING', description: 'CertiK and OpenZeppelin security reviews, early-access whitelist registration.' },
    { phase: 'Phase 3: Q1 2027', title: 'Devnet & Institutional Validator Staking', status: 'UPCOMING', description: 'Decentralized node testing and proof-of-stake consensus validation.' },
    { phase: 'Phase 4: Q4 2027', title: 'Target Mainnet Launch & TGE', status: 'TARGET', description: 'Token Generation Event (TGE), mainnet genesis block, and ecosystem liquidity migration.' }
  ],
};

export class TokenService {
  /**
   * Get public token specifications and roadmap
   */
  getTokenInfo() {
    return TOKEN_SPEC;
  }

  /**
   * Get authenticated user's testnet token and early access status
   */
  async getUserTokenStatus(userId: string) {
    let access = await prisma.tokenEarlyAccess.findUnique({
      where: { userId },
    });

    if (!access) {
      access = await prisma.tokenEarlyAccess.create({
        data: {
          userId,
          testnetBalance: 0,
          registeredInterest: false,
          requestedAllocationUsd: 0,
          status: 'REGISTERED',
          walletAddress: `0xAvoraTestnet${userId.replace(/-/g, '').slice(0, 32)}`,
        },
      });
    }

    // Check if faucet can be claimed (24h cooldown)
    const now = new Date();
    let canClaimFaucet = true;
    let nextClaimAllowedAt: Date | null = null;

    if (access.lastFaucetClaimAt) {
      const cooldownEnd = new Date(access.lastFaucetClaimAt.getTime() + 24 * 60 * 60 * 1000);
      if (now < cooldownEnd) {
        canClaimFaucet = false;
        nextClaimAllowedAt = cooldownEnd;
      }
    }

    return {
      spec: TOKEN_SPEC,
      wallet: {
        walletAddress: access.walletAddress,
        testnetBalance: Number(access.testnetBalance),
        tokenSymbol: 'AVR',
        network: 'Avora Sepolia L2 (Testnet)',
        lastFaucetClaimAt: access.lastFaucetClaimAt,
        canClaimFaucet,
        nextClaimAllowedAt,
      },
      earlyAccess: {
        registeredInterest: access.registeredInterest,
        requestedAllocationUsd: Number(access.requestedAllocationUsd),
        status: access.status,
      },
    };
  }

  /**
   * Claim Testnet Faucet Tokens (100 AVR / 24h)
   */
  async claimFaucet(userId: string) {
    const status = await this.getUserTokenStatus(userId);
    if (!status.wallet.canClaimFaucet) {
      throw new Error(`Faucet cooldown active. Next claim available at ${status.wallet.nextClaimAllowedAt?.toLocaleTimeString()}`);
    }

    const FAUCET_AMOUNT = new Decimal(TOKEN_SPEC.faucetClaimAmount);

    const updated = await prisma.tokenEarlyAccess.update({
      where: { userId },
      data: {
        testnetBalance: { increment: FAUCET_AMOUNT.toFixed(8) },
        lastFaucetClaimAt: new Date(),
      },
    });

    return {
      success: true,
      message: `Successfully claimed ${TOKEN_SPEC.faucetClaimAmount} Testnet AVR! (Testnet assets have $0 monetary value).`,
      newBalance: Number(updated.testnetBalance),
    };
  }

  /**
   * Register interest in the early-access allocation programme ($1.00 USD reference price)
   */
  async registerEarlyAccess(userId: string, requestedAllocationUsd: number, notes?: string) {
    if (!requestedAllocationUsd || requestedAllocationUsd < 100) {
      throw new Error('Minimum requested allocation is $100 USD (100 AVR).');
    }

    const updated = await prisma.tokenEarlyAccess.upsert({
      where: { userId },
      update: {
        registeredInterest: true,
        requestedAllocationUsd: new Decimal(requestedAllocationUsd),
        notes: notes || null,
        status: 'WHITELISTED',
      },
      create: {
        userId,
        registeredInterest: true,
        requestedAllocationUsd: new Decimal(requestedAllocationUsd),
        notes: notes || null,
        status: 'WHITELISTED',
        walletAddress: `0xAvoraTestnet${userId.replace(/-/g, '').slice(0, 32)}`,
      },
    });

    return {
      success: true,
      message: `Interest registered for $${requestedAllocationUsd} USD allocation (approx. ${requestedAllocationUsd} AVR @ $1.00 reference price). Our token allocations desk has whitelisted your profile.`,
      status: updated.status,
      requestedAllocationUsd: Number(updated.requestedAllocationUsd),
    };
  }
}

export const tokenService = new TokenService();

