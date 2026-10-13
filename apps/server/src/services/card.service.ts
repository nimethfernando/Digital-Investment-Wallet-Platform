import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

const prisma = new PrismaClient();
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export class CardService {
  /**
   * Retrieves or automatically provisions a VirtualCard for the user
   */
  async getOrCreateCard(userId: string) {
    let card = await prisma.virtualCard.findUnique({
      where: { userId },
    });

    if (!card) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const fullName = `${user?.firstName || 'Avora'} ${user?.lastName || 'Client'}`.trim();
      
      // Generate deterministic last 4 digits from userId
      let hash = 0;
      for (let i = 0; i < userId.length; i++) {
        hash = (hash << 5) - hash + userId.charCodeAt(i);
        hash |= 0;
      }
      const last4 = Math.abs(hash % 9000 + 1000).toString();

      card = await prisma.virtualCard.create({
        data: {
          userId,
          cardNumberMask: `4820 •••• •••• ${last4}`,
          cardHolderName: fullName,
          expiryDate: '08/29',
          cvvEncrypted: 'enc:v1:742',
          cardTheme: 'redot',
          cardNetwork: 'visa',
          isFrozen: false,
          dailyLimit: new Decimal('10000.00'),
          monthlyLimit: new Decimal('50000.00'),
          onlineEnabled: true,
          intlEnabled: true,
          atmEnabled: true,
        },
      });
    }

    return {
      ...card,
      dailyLimit: new Decimal(card.dailyLimit.toString()).toNumber(),
      monthlyLimit: new Decimal(card.monthlyLimit.toString()).toNumber(),
    };
  }

  /**
   * Toggle Freeze status
   */
  async toggleFreeze(userId: string) {
    const card = await this.getOrCreateCard(userId);
    const updated = await prisma.virtualCard.update({
      where: { userId },
      data: { isFrozen: !card.isFrozen },
    });

    return {
      isFrozen: updated.isFrozen,
      message: updated.isFrozen ? 'Card has been frozen. All transactions blocked.' : 'Card has been unfrozen and is active.',
    };
  }

  /**
   * Update Spending Limits
   */
  async updateLimits(userId: string, dailyLimit: number, monthlyLimit: number) {
    await this.getOrCreateCard(userId);
    const updated = await prisma.virtualCard.update({
      where: { userId },
      data: {
        dailyLimit: new Decimal(dailyLimit.toString()).toFixed(2),
        monthlyLimit: new Decimal(monthlyLimit.toString()).toFixed(2),
      },
    });

    return {
      dailyLimit: new Decimal(updated.dailyLimit.toString()).toNumber(),
      monthlyLimit: new Decimal(updated.monthlyLimit.toString()).toNumber(),
      message: 'Card spending limits updated successfully.',
    };
  }

  /**
   * Update Card Security Controls (Online, International, ATM)
   */
  async updateSettings(userId: string, data: {
    onlineEnabled?: boolean;
    intlEnabled?: boolean;
    atmEnabled?: boolean;
    cardTheme?: string;
  }) {
    await this.getOrCreateCard(userId);
    const updated = await prisma.virtualCard.update({
      where: { userId },
      data: {
        ...(data.onlineEnabled !== undefined ? { onlineEnabled: data.onlineEnabled } : {}),
        ...(data.intlEnabled !== undefined ? { intlEnabled: data.intlEnabled } : {}),
        ...(data.atmEnabled !== undefined ? { atmEnabled: data.atmEnabled } : {}),
        ...(data.cardTheme ? { cardTheme: data.cardTheme } : {}),
      },
    });

    return {
      onlineEnabled: updated.onlineEnabled,
      intlEnabled: updated.intlEnabled,
      atmEnabled: updated.atmEnabled,
      cardTheme: updated.cardTheme,
      message: 'Card security settings saved.',
    };
  }

  /**
   * Get card-specific transaction feed from real transaction records
   */
  async getCardTransactions(userId: string) {
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return transactions.map((t) => ({
      id: t.id,
      transactionCode: t.transactionCode,
      merchant: t.notes || (t.type === 'DEPOSIT' ? 'Deposit Clearance' : t.type === 'P2P_TRANSFER_OUT' ? 'P2P Outgoing' : 'POS Terminal Payment'),
      amount: `${new Decimal(t.amount.toString()).toFixed(2)} ${t.currency}`,
      type: t.type,
      status: t.status,
      date: t.createdAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      timestamp: t.createdAt,
    }));
  }
}

export const cardService = new CardService();

