import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface CustomerAddress {
  id: string;
  label?: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault?: boolean;
}

export interface CustomerAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
  photoUrl?: string;
  addresses: CustomerAddress[];
  preferences: Record<string, unknown>;
  favorites: string[];
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt?: string;
}

export interface CustomerActivity {
  profile: CustomerAccount;
  orders: {
    id: string;
    publicTrackingToken?: string;
    companyId: string;
    companyName: string;
    total: number;
    status: string;
    channel: string;
    createdAt: string;
    items: { name: string; quantity: number; unitPrice: number; total: number }[];
  }[];
  companyRelationships: {
    companyId: string;
    companyName: string;
    logoUrl: string;
    points: number;
    totalSpent: number;
    tier: 'Bronze' | 'Silver' | 'Gold' | 'VIP';
    memberSince: string;
    lastPurchaseAt?: string;
  }[];
  favoriteCompanies: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string;
    bannerUrl: string;
    category: string;
  }[];
  addresses: CustomerAddress[];
}

@Injectable({
  providedIn: 'root'
})
export class CustomerIdentityService {
  private http = inject(HttpClient);

  readonly currentCustomer = signal<CustomerAccount | null>(null);
  readonly customerToken = signal<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('3eatcru_customer_token') : null
  );
  readonly activity = signal<CustomerActivity | null>(null);
  readonly isAuthenticated = computed(() => !!this.currentCustomer());
  readonly totalPoints = computed(() => {
    const rels = this.activity()?.companyRelationships || [];
    return rels.reduce((acc, r) => acc + (r.points || 0), 0);
  });

  constructor() {
    if (this.customerToken()) {
      void this.fetchMe();
    }
  }

  private get headers() {
    const token = this.customerToken();
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  async register(data: { name: string; email: string; phone: string; password: string }): Promise<CustomerAccount> {
    const res = await firstValueFrom(
      this.http.post<{ token: string; customer: CustomerAccount }>('/api/v1/customer/auth/register', data)
    );
    this.setSession(res.token, res.customer);
    return res.customer;
  }

  async login(data: { email: string; password: string }): Promise<CustomerAccount> {
    const res = await firstValueFrom(
      this.http.post<{ token: string; customer: CustomerAccount }>('/api/v1/customer/auth/login', data)
    );
    this.setSession(res.token, res.customer);
    return res.customer;
  }

  logout(): void {
    if (this.customerToken()) {
      firstValueFrom(this.http.post('/api/v1/customer/auth/logout', {}, this.headers)).catch(() => undefined);
    }
    this.clearSession();
  }

  async fetchMe(): Promise<CustomerAccount | null> {
    if (!this.customerToken()) return null;
    try {
      const res = await firstValueFrom(
        this.http.get<{ customer: CustomerAccount }>('/api/v1/customer/auth/me', this.headers)
      );
      this.currentCustomer.set(res.customer);
      void this.fetchActivity();
      return res.customer;
    } catch {
      this.clearSession();
      return null;
    }
  }

  async updateProfile(data: Partial<CustomerAccount>): Promise<CustomerAccount> {
    const res = await firstValueFrom(
      this.http.put<{ customer: CustomerAccount }>('/api/v1/customer/profile', data, this.headers)
    );
    this.currentCustomer.set(res.customer);
    return res.customer;
  }

  async addAddress(address: Omit<CustomerAddress, 'id'>): Promise<CustomerAddress[]> {
    const res = await firstValueFrom(
      this.http.post<{ addresses: CustomerAddress[] }>('/api/v1/customer/addresses', address, this.headers)
    );
    if (this.currentCustomer()) {
      this.currentCustomer.update(c => c ? { ...c, addresses: res.addresses } : null);
    }
    return res.addresses;
  }

  async deleteAddress(addressId: string): Promise<CustomerAddress[]> {
    const res = await firstValueFrom(
      this.http.delete<{ addresses: CustomerAddress[] }>(`/api/v1/customer/addresses/${addressId}`, this.headers)
    );
    if (this.currentCustomer()) {
      this.currentCustomer.update(c => c ? { ...c, addresses: res.addresses } : null);
    }
    return res.addresses;
  }

  async toggleFavorite(companyId: string): Promise<boolean> {
    const res = await firstValueFrom(
      this.http.post<{ isFavorite: boolean; favorites: string[] }>('/api/v1/customer/favorites/toggle', { companyId }, this.headers)
    );
    if (this.currentCustomer()) {
      this.currentCustomer.update(c => c ? { ...c, favorites: res.favorites } : null);
    }
    return res.isFavorite;
  }

  async fetchActivity(): Promise<CustomerActivity> {
    const act = await firstValueFrom(
      this.http.get<CustomerActivity>('/api/v1/customer/activity', this.headers)
    );
    this.activity.set(act);
    return act;
  }

  private setSession(token: string, customer: CustomerAccount) {
    this.customerToken.set(token);
    this.currentCustomer.set(customer);
    if (typeof window !== 'undefined') {
      localStorage.setItem('3eatcru_customer_token', token);
    }
    void this.fetchActivity();
  }

  private clearSession() {
    this.customerToken.set(null);
    this.currentCustomer.set(null);
    this.activity.set(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('3eatcru_customer_token');
    }
  }
}
