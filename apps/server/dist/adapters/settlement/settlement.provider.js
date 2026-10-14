"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settlementProvider = exports.ManualAdminSettlementProvider = void 0;
class ManualAdminSettlementProvider {
    name = 'ManualAdminSettlementProvider';
    async dispatchPayout(params) {
        return {
            status: 'MANUAL_PENDING',
            referenceId: `ST-${Date.now()}`,
            message: 'Settlement request logged in Admin Settlement Desk queue.'
        };
    }
}
exports.ManualAdminSettlementProvider = ManualAdminSettlementProvider;
exports.settlementProvider = new ManualAdminSettlementProvider();
