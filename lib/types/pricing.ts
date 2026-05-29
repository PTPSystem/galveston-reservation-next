export interface BookingPricing {
  // Guest-facing
  baseNightlyTotal: number;
  weeklyDiscount: number;
  jamaicaBeachTax: number;   // 9%
  texasStateTax: number;     // 6%
  cleaningFee: number;       // $300
  totalGuestPrice: number;

  // Internal
  managementFee: number;     // 22%
  ownerProceeds: number;
}

export interface PricingAdjustmentInput {
  adjustmentType: 'daily' | 'stay';
  amount: number;
  reason: string;
}
