import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DiningTable } from '../../domain/table.entity';

@Component({
  selector: 'app-table-card',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div 
      class="bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md"
      [class.border-emerald-200]="table().status === 'AVAILABLE'"
      [class.border-blue-200]="table().status === 'OCCUPIED'"
      [class.border-amber-300]="table().status === 'BILLING'"
      [class.border-purple-200]="table().status === 'RESERVED'">
      
      <!-- Table Card Header -->
      <div class="p-4 pb-3 border-b"
           [class.bg-emerald-50/50]="table().status === 'AVAILABLE'"
           [class.border-emerald-100]="table().status === 'AVAILABLE'"
           [class.bg-blue-50/50]="table().status === 'OCCUPIED'"
           [class.border-blue-100]="table().status === 'OCCUPIED'"
           [class.bg-amber-50/75]="table().status === 'BILLING'"
           [class.border-amber-200]="table().status === 'BILLING'"
           [class.bg-purple-50/50]="table().status === 'RESERVED'"
           [class.border-purple-100]="table().status === 'RESERVED'">
        
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-500 font-mono">#{{ table().number }}</span>
          <!-- Status Badge -->
          @if (table().status === 'AVAILABLE') {
            <span class="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Livre
            </span>
          } @else if (table().status === 'OCCUPIED') {
            <span class="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> Ocupada
            </span>
          } @else if (table().status === 'BILLING') {
            <span class="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Pediu Conta
            </span>
          } @else {
            <span class="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span> Reservada
            </span>
          }
        </div>

        <h3 class="text-base font-bold text-slate-900 mt-1">{{ table().name }}</h3>
        <div class="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
          <mat-icon class="text-xs">chair</mat-icon> Capacidade: {{ table().capacity }} pessoas
        </div>
      </div>

      <!-- Table Card Body -->
      <div class="p-4 flex-1 flex flex-col justify-between space-y-3">
        @if (table().currentOrder; as order) {
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-500">Atendente:</span>
              <span class="font-bold text-slate-700">{{ order.waiterName }}</span>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-500">Clientes:</span>
              <span class="font-bold text-slate-700">{{ order.customerCount }} pessoas</span>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-500">Itens pedidos:</span>
              <span class="font-bold text-slate-700">{{ order.items.length }} itens</span>
            </div>

            <div class="pt-2 border-t border-slate-100 flex items-baseline justify-between">
              <span class="text-xs font-bold text-slate-600">Total:</span>
              <span class="text-base font-bold font-mono text-indigo-700">
                R$ {{ order.total | number:'1.2-2' }}
              </span>
            </div>

            @if (order.customerCount > 1) {
              <div class="text-[10px] text-slate-400 text-right font-mono">
                (R$ {{ (order.perPersonTotal ?? (order.total / order.customerCount)) | number:'1.2-2' }} / pessoa)
              </div>
            }
          </div>
        } @else if (table().status === 'RESERVED' && table().reservation; as res) {
          <div class="space-y-1.5 p-3 bg-purple-50/50 border border-purple-100 rounded-xl">
            <div class="text-[10px] font-bold text-purple-800 uppercase tracking-wider flex items-center gap-1">
              <mat-icon class="text-xs">event</mat-icon> Reserva Ativa
            </div>
            <div class="text-xs text-slate-700">
              <strong>Cliente:</strong> {{ res.clientName }}
            </div>
            <div class="text-xs text-slate-700">
              <strong>Horário:</strong> {{ res.time }}
            </div>
            <div class="text-xs text-slate-700">
              <strong>Pessoas:</strong> {{ res.peopleCount }}
            </div>
            @if (res.contact) {
              <div class="text-[10px] text-slate-500 font-mono">
                <strong>Tel:</strong> {{ res.contact }}
              </div>
            }
          </div>
        } @else {
          <div class="py-4 text-center text-slate-400 text-xs">
            Mesa pronta para receber novos clientes.
          </div>
        }

        <!-- Action Buttons -->
        <div class="pt-2 border-t border-slate-100 flex items-center gap-2">
          @if (table().status === 'AVAILABLE') {
            <div class="flex items-center gap-1.5 w-full">
              <button 
                (click)="openTableModal.emit(table())"
                class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm">
                <mat-icon class="text-xs">play_arrow</mat-icon> Abrir Mesa
              </button>
              <button 
                (click)="reserveTable.emit(table())"
                class="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2 px-2.5 rounded-lg transition-colors flex items-center justify-center shadow-sm"
                title="Reservar Mesa">
                <mat-icon class="text-xs font-bold">event</mat-icon>
              </button>
            </div>
          } @else if (table().status === 'RESERVED') {
            <div class="flex items-center gap-1.5 w-full">
              <button 
                (click)="openTableModal.emit(table())"
                class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm">
                <mat-icon class="text-xs">login</mat-icon> Atender
              </button>
              <button 
                (click)="cancelReservation.emit(table())"
                class="bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold py-2 px-2.5 rounded-lg transition-colors flex items-center justify-center shadow-xs"
                title="Cancelar Reserva">
                <mat-icon class="text-xs">cancel</mat-icon>
              </button>
            </div>
          } @else {
            <button 
              (click)="viewOrder.emit(table())"
              class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-2.5 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm">
              <mat-icon class="text-xs">receipt</mat-icon> Comanda
            </button>
            <button 
              (click)="checkoutTable.emit(table())"
              class="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 px-2.5 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm"
              title="Fechar e Cobrar Conta">
              <mat-icon class="text-xs">point_of_sale</mat-icon> Fechar
            </button>
          }
        </div>
      </div>
    </div>
  `
})
export class TableCardComponent {
  table = input.required<DiningTable>();

  openTableModal = output<DiningTable>();
  reserveTable = output<DiningTable>();
  cancelReservation = output<DiningTable>();
  viewOrder = output<DiningTable>();
  checkoutTable = output<DiningTable>();
}
