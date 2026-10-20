import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DiningTable } from '../../domain/table.entity';

@Component({
  selector: 'app-table-open-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-fade-in-up">
        <div class="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <mat-icon class="text-emerald-400">table_restaurant</mat-icon>
            <h3 class="text-sm font-bold">Abrir {{ table().name }}</h3>
          </div>
          <button (click)="closeModal.emit()" class="text-slate-400 hover:text-white">
            <mat-icon class="text-sm">close</mat-icon>
          </button>
        </div>

        <form (submit)="onSubmit($event)" class="p-5 space-y-4">
          <div>
            <label for="open-count" class="block text-xs font-bold text-slate-700 mb-1">Quantidade de Clientes</label>
            <input 
              id="open-count"
              [value]="customerCount()"
              (input)="onCountInput($event)"
              name="count" 
              type="number" 
              min="1" 
              max="20"
              required
              class="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono">
          </div>

          <div>
            <label for="open-waiter" class="block text-xs font-bold text-slate-700 mb-1">Nome do Garçom / Atendente</label>
            <input 
              id="open-waiter"
              [value]="waiterName()"
              (input)="onWaiterInput($event)"
              name="waiter" 
              type="text" 
              required
              class="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
          </div>

          <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button 
              type="button" 
              (click)="closeModal.emit()"
              class="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              Cancelar
            </button>
            <button 
              type="submit"
              class="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm">
              Confirmar Abertura
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class TableOpenModalComponent {
  table = input.required<DiningTable>();

  closeModal = output<void>();
  confirm = output<{ customerCount: number; waiterName: string }>();

  customerCount = signal<number>(2);
  waiterName = signal<string>('Garçom 01');

  onCountInput(event: Event) {
    this.customerCount.set(Number((event.target as HTMLInputElement).value));
  }

  onWaiterInput(event: Event) {
    this.waiterName.set((event.target as HTMLInputElement).value);
  }

  onSubmit(event?: Event) {
    if (event) {
      event.preventDefault();
    }
    this.confirm.emit({
      customerCount: this.customerCount(),
      waiterName: this.waiterName().trim() || 'Garçom 01'
    });
  }
}
