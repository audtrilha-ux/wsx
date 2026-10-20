import { Customer } from './customer.entity';

export interface AddPointsResult {
  success: boolean;
  customer: Customer;
  earnedPoints: number;
}

export interface CustomerRepository {
  getCustomers(companyId: string): Promise<Customer[]>;
  createCustomer(customer: Omit<Customer, 'id' | 'points' | 'tier' | 'createdAt' | 'totalSpent' | 'purchasesCount'>): Promise<Customer>;
  addPoints(customerId: string, amount: number): Promise<AddPointsResult>;
}
