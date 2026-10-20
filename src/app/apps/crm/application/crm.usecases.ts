import { Injectable, inject } from '@angular/core';
import { OsCustomerRepository } from '../infrastructure/os-customer.repository';
import { Customer } from '../domain/customer.entity';
import { AddPointsResult } from '../domain/customer.repository';

@Injectable({
  providedIn: 'root'
})
export class GetCustomersUseCase {
  private repo = inject(OsCustomerRepository);
  execute(companyId: string): Promise<Customer[]> {
    return this.repo.getCustomers(companyId);
  }
}

@Injectable({
  providedIn: 'root'
})
export class CreateCustomerUseCase {
  private repo = inject(OsCustomerRepository);
  execute(customer: Omit<Customer, 'id' | 'points' | 'tier' | 'createdAt' | 'totalSpent' | 'purchasesCount'>): Promise<Customer> {
    return this.repo.createCustomer(customer);
  }
}

@Injectable({
  providedIn: 'root'
})
export class AddCustomerPointsUseCase {
  private repo = inject(OsCustomerRepository);
  execute(customerId: string, amount: number): Promise<AddPointsResult> {
    return this.repo.addPoints(customerId, amount);
  }
}
