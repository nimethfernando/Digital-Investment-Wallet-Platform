import { DepositInstructions, VerificationResult } from '../types';

export interface PaymentProvider {
  name: string;
  createDepositInstructions(params: {
    orderId: string;
    amount: number;
    currency: string;
    method: 'BANK_TRANSFER' | 'USDT_TRC20' | 'USDT_ERC20' | 'CASH_OFFICE';
  }): Promise<DepositInstructions>;
  verifyDepositProof(reference: string, proofUrl?: string): Promise<VerificationResult>;
}

export class ManualAdminPaymentProvider implements PaymentProvider {
  name = 'ManualAdminPaymentProvider';

  async createDepositInstructions(params: {
    orderId: string;
    amount: number;
    currency: string;
    method: 'BANK_TRANSFER' | 'USDT_TRC20' | 'USDT_ERC20' | 'CASH_OFFICE';
  }): Promise<DepositInstructions> {
    switch (params.method) {
      case 'USDT_TRC20':
        return {
          paymentMethod: 'USDT (TRC-20)',
          depositAddressOrAccount: 'TPlatformReserveAccountTRC20Example99X',
          networkOrBankDetails: 'TRON Network (TRC-20)',
          recipientName: 'Nexis Liquidity Custody',
          referenceCode: params.orderId,
          instructions: [
            'Send exact amount in USDT via TRC-20 network.',
            'Include the reference code in transfer remarks if supported.',
            'Upload the transaction hash and a screenshot after sending.',
            'Admin review and ledger credit will be completed within 15-30 minutes during desk hours.'
          ]
        };

      case 'BANK_TRANSFER':
        return {
          paymentMethod: 'Bank Wire / SEPA / SWIFT',
          depositAddressOrAccount: 'GE29NB0000000123456789',
          networkOrBankDetails: 'Bank of Georgia / TBC Bank (SWIFT: BAGAGE22)',
          recipientName: 'Nexis Financial Group LLC',
          referenceCode: params.orderId,
          instructions: [
            `Deposit ${params.amount} ${params.currency} to the specified IBAN.`,
            `MANDATORY: Put Reference Code "${params.orderId}" into the payment details field.`,
            'Upload your bank payment confirmation receipt (PDF or JPG).',
            'Funds will be credited to your wallet once cleared on our bank statement.'
          ]
        };

      case 'CASH_OFFICE':
        return {
          paymentMethod: 'Cash Deposit at Tbilisi Desk',
          depositAddressOrAccount: 'Chavchavadze Ave 37M, Tbilisi, Georgia',
          networkOrBankDetails: 'Desk Working Hours: Mon-Fri 10:00 - 18:00 GET',
          recipientName: 'Nexis Counter Services Desk',
          referenceCode: params.orderId,
          instructions: [
            'Visit our Tbilisi counter during operating hours.',
            `Present your Order Code "${params.orderId}" and valid government ID.`,
            'Hand over the cash amount to our authorized teller.',
            'Your platform wallet or investment package will be activated instantly upon teller confirmation.'
          ]
        };

      default:
        return {
          paymentMethod: 'Standard Bank Deposit',
          depositAddressOrAccount: 'GE29NB0000000123456789',
          networkOrBankDetails: 'Bank Wire',
          recipientName: 'Nexis Group',
          referenceCode: params.orderId,
          instructions: ['Contact support or upload proof of deposit.']
        };
    }
  }

  async verifyDepositProof(reference: string, proofUrl?: string): Promise<VerificationResult> {
    return {
      verified: false,
      referenceId: reference,
      notes: 'Queued for administrative verification in operations queue.'
    };
  }
}

export const paymentProvider = new ManualAdminPaymentProvider();
