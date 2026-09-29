export interface DepositInstructions {
  paymentMethod: string;
  depositAddressOrAccount: string;
  networkOrBankDetails: string;
  recipientName: string;
  referenceCode: string;
  instructions: string[];
}

export interface VerificationResult {
  verified: boolean;
  referenceId?: string;
  notes?: string;
}

export interface PayoutDispatchParams {
  settlementId: string;
  amount: number;
  currency: string;
  method: 'BANK_TRANSFER' | 'USDT_WALLET' | 'CASH_PICKUP_TBILISI';
  destination: Record<string, any>;
}

export interface PayoutResult {
  status: 'DISPATCHED' | 'MANUAL_PENDING' | 'FAILED';
  referenceId?: string;
  message?: string;
}

export interface KycDocumentInput {
  documentType: string;
  documentUrl: string;
  idNumber?: string;
}

export interface KycSubmissionResult {
  kycReference: string;
  status: 'PENDING' | 'AUTO_APPROVED' | 'MANUAL_REVIEW';
  message?: string;
}

export interface RateQuote {
  base: string;
  quote: string;
  baseRate: number;
  clientRate: number;
  feePercent: number;
  feeAmount: number;
  timestamp: number;
}
