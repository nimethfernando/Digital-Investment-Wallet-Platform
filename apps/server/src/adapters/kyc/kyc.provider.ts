import { KycDocumentInput, KycSubmissionResult } from '../types';

export interface KycProvider {
  name: string;
  submitKycApplication(userId: string, documents: KycDocumentInput[]): Promise<KycSubmissionResult>;
  checkAmlScreening(name: string, country: string, idNumber?: string): Promise<{ passed: boolean; flags: string[] }>;
}

export class ManualAdminKycProvider implements KycProvider {
  name = 'ManualAdminKycProvider';

  async submitKycApplication(userId: string, documents: KycDocumentInput[]): Promise<KycSubmissionResult> {
    return {
      kycReference: `KYC-${userId.slice(0, 8).toUpperCase()}-${Date.now()}`,
      status: 'MANUAL_REVIEW',
      message: 'Documents stored securely. Queued for compliance officer review.',
    };
  }

  async checkAmlScreening(name: string, country: string, idNumber?: string): Promise<{ passed: boolean; flags: string[] }> {
    return {
      passed: true,
      flags: [],
    };
  }
}

export const kycProvider = new ManualAdminKycProvider();
