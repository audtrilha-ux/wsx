import { Injectable, inject } from '@angular/core';
import { OsProductRepository, OsSaleRepository } from '../infrastructure/os-pos.repository';
import { Product, Sale } from '../domain/pos.entity';

@Injectable({
  providedIn: 'root'
})
export class GetProductsUseCase {
  private repo = inject(OsProductRepository);
  execute(companyId: string): Promise<Product[]> {
    return this.repo.getProducts(companyId);
  }
}

@Injectable({
  providedIn: 'root'
})
export class RegisterSaleUseCase {
  private repo = inject(OsSaleRepository);
  execute(sale: Omit<Sale, 'id' | 'createdAt'>, companyId: string): Promise<Sale> {
    return this.repo.createSale(sale, companyId);
  }
}

@Injectable({
  providedIn: 'root'
})
export class GetSalesUseCase {
  private repo = inject(OsSaleRepository);
  execute(companyId: string): Promise<Sale[]> {
    return this.repo.getSales(companyId);
  }
}

@Injectable({
  providedIn: 'root'
})
export class CancelSaleUseCase {
  private repo = inject(OsSaleRepository);
  execute(id: string, companyId: string): Promise<Sale> {
    return this.repo.updateSaleStatus(id, 'CANCELLED', companyId);
  }
}
