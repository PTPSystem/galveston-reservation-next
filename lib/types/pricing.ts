export type DepositStatus = 'REQUESTED' | 'RECEIVED' | 'WAIVED';

export interface BookingPricing {
  // Guest-facing
  baseNightlyTotal: number;
  weeklyDiscount: number;
  jamaicaBeachTax: number;   // 9%
  texasStateTax: number;     // 6%
  cleaningFee: number;       // $300
  totalGuestPrice: number;

  // Deposit (manual invoice tracking — no Stripe)
  depositAmount?: number;
  depositStatus?: DepositStatus;
  depositReceivedAt?: string | null;
  depositNote?: string | null;

  // Internal
  managementFee: number;     // 22%
  ownerProceeds: number;
}

export interface PricingAdjustmentInput {
  adjustmentType: 'daily' | 'stay';
  amount: number;
  reason: string;
}

/** Default deposit = 50% of guest total, rounded to nearest dollar (min $0). */
export function defaultDepositAmount(totalGuestPrice: number): number {
  if (!Number.isFinite(totalGuestPrice) || totalGuestPrice <= 0) return 0;
  return Math.max(0, Math.round(totalGuestPrice * 0.5));
}
