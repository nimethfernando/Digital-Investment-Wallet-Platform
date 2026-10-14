import { KycStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface KycSubmissionInput {
  documentType: 'PASSPORT' | 'NATIONAL_ID' | 'DRIVERS_LICENSE' | 'PROOF_OF_ADDRESS';
  documentUrl: string;
  idNumber?: string;
  country?: string;
  provider?: 'SUMSUB' | 'ONFIDO' | 'MANUAL';
}

export class KycService {
  /**
   * Submit KYC document for identity verification
   */
  async submitKyc(userId: string, input: KycSubmissionInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found.');
    }

    if (user.kycStatus === 'APPROVED') {
      throw new Error('Your identity verification (KYC) is already fully approved.');
    }

    const document = await prisma.kycDocument.create({
      data: {
        userId,
        documentType: input.documentType,
        documentUrl: input.documentUrl,
        status: KycStatus.PENDING,
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: KycStatus.PENDING,
      },
    });

    return {
      documentId: document.id,
      documentType: document.documentType,
      status: document.status,
      message: 'KYC documents submitted successfully. Verification queued for compliance review.',
    };
  }

  /**
   * Get user's KYC verification status and documents
   */
  async getKycStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        kycStatus: true,
        kycDocuments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new Error('User not found.');
    }

    return {
      kycStatus: user.kycStatus,
      isVerified: user.kycStatus === 'APPROVED',
      documents: user.kycDocuments.map((doc) => ({
        id: doc.id,
        documentType: doc.documentType,
        documentUrl: doc.documentUrl,
        status: doc.status,
        rejectionReason: doc.rejectionReason,
        verifiedAt: doc.verifiedAt,
        createdAt: doc.createdAt,
      })),
    };
  }

  /**
   * Generate third-party biometric verification session token (Sumsub / Onfido)
   */
  async generateProviderToken(userId: string, provider: 'SUMSUB' | 'ONFIDO' = 'SUMSUB') {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found.');

    const applicantId = `app_${provider.toLowerCase()}_${userId.slice(0, 8)}`;
    const accessToken = `tok_${provider.toLowerCase()}_${Buffer.from(`${userId}:${Date.now()}`).toString('base64')}`;

    return {
      provider,
      applicantId,
      accessToken,
      workflow: 'IDENTITY_AND_LIVENESS_CHECK',
      expiresIn: 3600,
    };
  }

  /**
   * Admin: List pending KYC submissions
   */
  async getPendingKyc() {
    return prisma.kycDocument.findMany({
      where: { status: KycStatus.PENDING },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Admin: Approve KYC submission
   */
  async approveKyc(documentId: string, adminId: string) {
    const doc = await prisma.kycDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new Error('KYC document not found.');

    const updatedDoc = await prisma.kycDocument.update({
      where: { id: documentId },
      data: {
        status: KycStatus.APPROVED,
        verifiedAt: new Date(),
        reviewedBy: adminId,
      },
    });

    await prisma.user.update({
      where: { id: doc.userId },
      data: {
        kycStatus: KycStatus.APPROVED,
      },
    });

    return {
      success: true,
      documentId: updatedDoc.id,
      kycStatus: KycStatus.APPROVED,
      message: 'KYC document approved. User identity is now verified for institutional trading.',
    };
  }

  /**
   * Admin: Reject KYC submission
   */
  async rejectKyc(documentId: string, adminId: string, reason: string) {
    const doc = await prisma.kycDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new Error('KYC document not found.');

    const updatedDoc = await prisma.kycDocument.update({
      where: { id: documentId },
      data: {
        status: KycStatus.REJECTED,
        rejectionReason: reason || 'Document image unclear or expired.',
        reviewedBy: adminId,
      },
    });

    await prisma.user.update({
      where: { id: doc.userId },
      data: {
        kycStatus: KycStatus.REJECTED,
      },
    });

    return {
      success: true,
      documentId: updatedDoc.id,
      kycStatus: KycStatus.REJECTED,
      message: 'KYC document rejected.',
    };
  }
}

export const kycService = new KycService();

