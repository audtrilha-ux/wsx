import { Injectable, inject } from '@angular/core';
import { OsSdkService } from '../../../sdk/os-sdk.service';
import { AddPointsResult, CustomerRepository } from '../domain/customer.repository';
import { Customer, LoyaltyTier } from '../domain/customer.entity';
import { OsDatabaseNamespace } from '../../../contracts/os/os-database.contract';

@Injectable({
  providedIn: 'root'
})
export class OsCustomerRepository implements CustomerRepository {
  private osSdk = inject(OsSdkService);
  private ns: OsDatabaseNamespace;

  constructor() {
    // Bind canônico ao OS SDK. Garante isolamento por tenant no storage: tenant.[companyId].app.app_crm
    const app = this.osSdk.bind('app_crm');
    this.ns = app.storage;
  }

  async getCustomers(companyId: string): Promise<Customer[]> {
    const items = await this.ns.query<Customer>();
    const filtered = items.map((i) => i.value).filter((c) => c.companyId === companyId);
    if (filtered.length > 0) return filtered;

    // Check if we can fetch from simulation customers endpoint
    try {
      const res = await fetch(`/api/v1/simulation/customers?companyId=${encodeURIComponent(companyId)}`);
      if (res.ok) {
        const json = await res.json() as { customers: Customer[] };
        if (json?.customers && json.customers.length > 0) {
          for (const c of json.customers) {
            await this.ns.put(c.id, c);
          }
          return json.customers;
        }
      }
    } catch {
      // offline or network unavailable, continue to local seed
    }

    // Auto-seed if in demo workspace or simulation
    if (companyId !== 'comp_1' && companyId !== 'comp_sim_retail') {
      return [];
    }

    const seed: Customer[] = [
      { id: `cust_${companyId}_1`, companyId, name: 'Mariana Silva', phone: '(43) 98765-4321', email: 'mariana@email.com', points: 420, tier: 'Silver', createdAt: new Date().toISOString(), totalSpent: 4200.00, purchasesCount: 15 },
      { id: `cust_${companyId}_2`, companyId, name: 'Carlos Eduardo Oliveira', phone: '(43) 97654-3210', email: 'carlos.edu@email.com', points: 180, tier: 'Bronze', createdAt: new Date().toISOString(), totalSpent: 1800.00, purchasesCount: 8 },
      { id: `cust_${companyId}_3`, companyId, name: 'Ana Paula Rocha', phone: '(43) 96543-2109', email: 'anapaula@email.com', points: 1150, tier: 'Gold', createdAt: new Date().toISOString(), totalSpent: 11500.00, purchasesCount: 42 },
      { id: `cust_${companyId}_4`, companyId, name: 'Dr. Roberto Valença', phone: '(43) 95432-1098', email: 'roberto.valenca@email.com', points: 2150, tier: 'VIP', createdAt: new Date().toISOString(), totalSpent: 21500.00, purchasesCount: 30 }
    ];

    for (const c of seed) {
      await this.ns.put(c.id, c);
    }
    return seed;
  }

  async createCustomer(data: Omit<Customer, 'id' | 'points' | 'tier' | 'createdAt' | 'totalSpent' | 'purchasesCount'>): Promise<Customer> {
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
    const newId = `cust_${uuid}`;
    const newCustomer: Customer = {
      ...data,
      id: newId,
      points: 0,
      tier: 'Bronze',
      createdAt: new Date().toISOString(),
      totalSpent: 0,
      purchasesCount: 0
    };
    
    await this.ns.put(newId, newCustomer);

    const app = this.osSdk.bind('app_crm');
    app.events.publish('customer.created', newCustomer);
    await app.sync.queueOperation('customer.create', newCustomer);
    app.logger.info(`Cliente #${newCustomer.id} cadastrado com sucesso`, { customerId: newCustomer.id, name: newCustomer.name });

    return newCustomer;
  }

  async addPoints(customerId: string, amount: number): Promise<AddPointsResult> {
    // Transação ACID para garantir consistência e atomicidade na atualização de pontos de fidelidade
    return this.ns.transaction<AddPointsResult>(async (tx) => {
      const customer = await tx.get<Customer>(customerId);
      if (!customer) throw new Error('Cliente não encontrado');

      const pts = (customer.points || 0) + amount;
      
      let tier: LoyaltyTier = 'Bronze';
      if (pts > 2000) tier = 'VIP';
      else if (pts > 1000) tier = 'Gold';
      else if (pts > 300) tier = 'Silver';

      const updatedCustomer: Customer = {
        ...customer,
        points: pts,
        tier,
        purchasesCount: (customer.purchasesCount || 0) + 1,
        totalSpent: (customer.totalSpent || 0) + (amount * 10) // Atualização do consumo histórico proporcional
      };

      await tx.put(customerId, updatedCustomer);
      
      const app = this.osSdk.bind('app_crm');
      app.events.publish('customer.points.added', { customer: updatedCustomer, amount });
      await app.sync.queueOperationTransacted(tx, 'customer.points.adjust', {
        customerId,
        amount,
        newPoints: updatedCustomer.points,
        newTier: updatedCustomer.tier
      });
      app.logger.info(`Pontos adicionados para ${updatedCustomer.name}`, { customerId, amount, totalPoints: updatedCustomer.points });

      return {
        success: true,
        customer: updatedCustomer,
        earnedPoints: amount
      };
    });
  }
}
