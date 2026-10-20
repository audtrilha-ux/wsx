export type StockUnit = 'UN' | 'KG' | 'L' | 'CX' | 'G' | 'ML' | 'M' | 'PCT';

export interface ProductVariantOption {
  name: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  options: ProductVariantOption[];
  barcodes: string[];
  costPrice: number;
  salePrice: number;
  stockQuantity: number;
  minStock: number;
  status: 'active' | 'inactive';
}

export interface WarehouseLocation {
  id: string;
  code: string;
  name: string;
  branchId: string;
  isMain: boolean;
}

export interface ProductMaster {
  id: string;
  companyId: string;
  branchId: string;
  sku: string;
  canonicalSku: string;
  name: string;
  category: string;
  costPrice: number;
  salePrice: number;
  stockQuantity: number;
  reservedQuantity: number;
  minStock: number;
  unit: StockUnit;
  barcodes: string[];
  warehouses: {
    warehouseId: string;
    warehouseName: string;
    stockQuantity: number;
    reservedQuantity: number;
  }[];
  hasVariants: boolean;
  variants: ProductVariant[];
  status: 'active' | 'inactive';
  links: {
    pos: boolean;
    inventory: boolean;
    publicSpace: boolean;
    delivery: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}
