import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { OsSdkService } from '../../../sdk/os-sdk.service';
import { OsContext } from '../../../contracts/os/os-context.contract';
import { InventoryItem, StockMovement } from '../domain/inventory.entity';
import { GetInventoryItemsUseCase, AdjustStockUseCase, GetStockMovementsUseCase, SaveInventoryItemUseCase } from '../application/inventory.usecases';
import { InventoryTableComponent } from './components/inventory-table.component';
import { InventoryAdjustModalComponent } from './components/inventory-adjust-modal.component';
import { InventoryCreateModalComponent } from './components/inventory-create-modal.component';
import { InventoryLedgerComponent } from './components/inventory-ledger.component';

@Component({
  selector: 'app-inventory',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, 
    MatIconModule, 
    InventoryTableComponent, 
    InventoryAdjustModalComponent,
    InventoryCreateModalComponent,
    InventoryLedgerComponent
  ],
  templateUrl: './inventory.component.html'
})
export class InventoryComponent implements OnInit, OnDestroy {
  private osSdk = inject(OsSdkService);
  private getInventoryItemsUseCase = inject(GetInventoryItemsUseCase);
  private adjustStockUseCase = inject(AdjustStockUseCase);
  private getStockMovementsUseCase = inject(GetStockMovementsUseCase);
  private saveInventoryItemUseCase = inject(SaveInventoryItemUseCase);

  // Bind soberano ao OS através do SDK
  app: OsContext = this.osSdk.bind('app_inventory');

  private subs: { unsubscribe: () => void }[] = [];

  activeTab = signal<'STOCK' | 'LEDGER'>('STOCK');
  items = signal<InventoryItem[]>([]);
  movements = signal<StockMovement[]>([]);
  selectedItemForAdjustment = signal<InventoryItem | null>(null);
  isCreateOpen = signal<boolean>(false);

  lowStockCount = computed(() => {
    return this.items().filter(i => i.stockQuantity <= i.minStock).length;
  });

  totalCostValue = computed(() => {
    return this.items().reduce((sum, item) => sum + (item.costPrice * item.stockQuantity), 0);
  });

  async ngOnInit() {
    await this.reloadItems();

    // Reload inventory on any sale completion or manual stock update
    this.subs.push(
      this.app.events.subscribe('sale.completed', () => {
        this.reloadItems();
      }),
      this.app.events.subscribe('stock.item.save', () => {
        this.reloadItems();
      }),
      this.app.events.subscribe('stock.adjust', () => {
        this.reloadItems();
      })
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  async reloadItems() {
    try {
      const list = await this.getInventoryItemsUseCase.execute(this.app.companyId);
      this.items.set(list);

      const movs = await this.getStockMovementsUseCase.execute(this.app.companyId);
      this.movements.set(movs);
    } catch (e: unknown) {
      this.app.notify('Falha no Estoque', `Erro ao carregar dados de estoque: ${String(e)}`, 'error');
    }
  }

  async handleAdjustStock(event: { itemId: string; delta: number; reason: string }) {
    try {
      const updated = await this.adjustStockUseCase.execute(event.itemId, event.delta, event.reason, this.app.companyId);
      this.selectedItemForAdjustment.set(null);
      await this.reloadItems();

      const typeLabel = event.delta >= 0 ? 'Entrada' : 'Saída';
      this.app.notify(
        'Estoque Atualizado',
        `${typeLabel} de ${Math.abs(event.delta)} un. para ${updated.name} (Novo saldo: ${updated.stockQuantity})`,
        'success'
      );
    } catch (err: unknown) {
      this.app.notify('Erro no Ajuste', `Falha ao ajustar estoque: ${String(err)}`, 'error');
    }
  }

  async handleCreateProduct(partial: Partial<InventoryItem>) {
    try {
      const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
      const item: InventoryItem = {
        id: `inv_${this.app.companyId}_${uuid}`,
        companyId: this.app.companyId,
        sku: partial.sku!,
        name: partial.name!,
        category: partial.category!,
        costPrice: partial.costPrice!,
        salePrice: partial.salePrice!,
        stockQuantity: partial.stockQuantity!,
        minStock: partial.minStock!,
        unit: partial.unit!,
        barcode: partial.barcode,
        status: partial.status || 'active',
        updatedAt: new Date().toISOString()
      };

      await this.saveInventoryItemUseCase.execute(item, this.app.companyId);
      this.isCreateOpen.set(false);
      await this.reloadItems();

      this.app.notify(
        'Produto Cadastrado',
        `Produto ${item.name} (${item.sku}) cadastrado no Product Master com sucesso!`,
        'success'
      );
    } catch (err: unknown) {
      this.app.notify('Erro ao Cadastrar', `Falha ao cadastrar no Product Master: ${String(err)}`, 'error');
    }
  }
}
