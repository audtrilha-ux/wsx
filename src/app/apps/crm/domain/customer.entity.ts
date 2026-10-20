export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold' | 'VIP';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyId: string;
  points: number;
  tier: LoyaltyTier;
  createdAt: string;
  totalSpent: number;
  purchasesCount: number;
}
