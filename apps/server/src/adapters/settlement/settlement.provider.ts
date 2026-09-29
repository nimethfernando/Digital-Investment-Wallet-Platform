import { PayoutDispatchParams, PayoutResult } from '../types';

export interface SettlementProvider {
  name: string;
  dispatchPayout(params: PayoutDispatchParams): Promise<PayoutResult>;
}

export class ManualAdminSettlementProvider implements SettlementProvider {
  name = 'ManualAdminSettlementProvider';

  async dispatchPayout(params: PayoutDispatchParams): Promise<PayoutResult> {
    return {
      status: 'MANUAL_PENDING',
      referenceId: `ST-${Date.now()}`,
      message: 'Settlement request logged in Admin Settlement Desk queue.'
    };
  }
}

export const settlementProvider = new ManualAdminSettlementProvider();
