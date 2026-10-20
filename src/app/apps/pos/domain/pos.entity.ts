export interface Product {
  id: string;
  companyId: string;
  name: string;
  price: number;
  stock: number;
  barcode?: string;
  category?: string;
  imageUrl?: string;
}

export interface SaleItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

export type SaleStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface Sale {
  id: string;
  companyId: string;
  items: SaleItem[];
  total: number;
  paymentMethod: string;
  status: SaleStatus;
  createdAt: string;
  discount?: number;
  discountType?: 'PERCENT' | 'FIXED';
  discountValue?: number;
  originalTotal?: number;
}
