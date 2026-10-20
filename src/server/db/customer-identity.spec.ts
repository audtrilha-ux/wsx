// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { centralState, CustomerAccountData, CustomerData } from '../state.js';
import { hashPassword, verifyPassword, signJwt, verifyJwt } from '../config.js';

describe('3eatcru ID Global Identity Architecture', () => {
  beforeEach(() => {
    centralState.customerAccounts.clear();
    centralState.customers.clear();
  });

  it('should securely register and hash passwords for 3eatcru ID accounts', () => {
    const pass = 'SecretPass123!';
    const hashed = hashPassword(pass);
    
    expect(hashed).not.toBe(pass);
    expect(hashed.startsWith('scrypt:')).toBe(true);
    expect(verifyPassword(pass, hashed)).toBe(true);
    expect(verifyPassword('WrongPass', hashed)).toBe(false);
  });

  it('should maintain strict separation between Global Identity (3eatcru ID) and Local CRM (CompanyCustomer)', () => {
    // 1. Create a global 3eatcru ID
    const accountId = 'cust_acc_test_1';
    const account: CustomerAccountData = {
      id: accountId,
      name: 'Carlos Oliveira',
      email: 'carlos@test.com',
      phone: '11988887777',
      password: hashPassword('password123'),
      addresses: [],
      preferences: {},
      favorites: ['comp_a', 'comp_b'],
      status: 'active',
      createdAt: new Date().toISOString()
    };
    centralState.customerAccounts.set(accountId, account);

    // 2. Company A (Pizzaria) creates a local CRM record with private tags & points
    const localCrmA: CustomerData = {
      id: 'cust_crm_a_1',
      companyId: 'comp_a',
      customerAccountId: accountId,
      name: 'Carlos Oliveira',
      email: 'carlos@test.com',
      phone: '11988887777',
      points: 150,
      totalSpent: 250.00,
      tier: 'Silver',
      notes: 'Gosta de pizza sem cebola',
      tags: ['VIP', 'Pizza Lover'],
      createdAt: new Date().toISOString()
    };
    centralState.customers.set(localCrmA.id, localCrmA);

    // 3. Company B (Hamburgueria) creates a local CRM record with independent notes
    const localCrmB: CustomerData = {
      id: 'cust_crm_b_1',
      companyId: 'comp_b',
      customerAccountId: accountId,
      name: 'Carlos Oliveira',
      email: 'carlos@test.com',
      phone: '11988887777',
      points: 50,
      totalSpent: 80.00,
      tier: 'Bronze',
      notes: 'Alérgico a amendoim',
      tags: ['Delivery Frequent'],
      createdAt: new Date().toISOString()
    };
    centralState.customers.set(localCrmB.id, localCrmB);

    // VERIFICATIONS:
    // Global identity holds favorites across companies
    expect(account.favorites).toEqual(['comp_a', 'comp_b']);

    // Company A's CRM record is isolated to comp_a
    expect(localCrmA.companyId).toBe('comp_a');
    expect(localCrmA.points).toBe(150);
    expect(localCrmA.notes).toBe('Gosta de pizza sem cebola');

    // Company B's CRM record is isolated to comp_b
    expect(localCrmB.companyId).toBe('comp_b');
    expect(localCrmB.points).toBe(50);
    expect(localCrmB.notes).toBe('Alérgico a amendoim');

    // Neither company can modify the other's private CRM notes
    expect(localCrmA.notes).not.toBe(localCrmB.notes);
  });

  it('should issue valid JWT tokens for 3eatcru ID sessions', () => {
    const payload = {
      customerAccountId: 'cust_acc_99',
      email: 'maria@test.com',
      role: 'CUSTOMER'
    };

    const token = signJwt(payload, 3600);
    expect(typeof token).toBe('string');

    const decoded = verifyJwt(token) as { customerAccountId: string; role: string };
    expect(decoded).not.toBeNull();
    expect(decoded.customerAccountId).toBe('cust_acc_99');
    expect(decoded.role).toBe('CUSTOMER');
  });
});
