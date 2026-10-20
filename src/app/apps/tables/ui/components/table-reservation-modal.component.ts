import { Component, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DiningTable } from '../../domain/table.entity';

@Component({
  selector: 'app-table-reservation-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-fade-in-up">
        <div class="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <mat-icon class="text-purple-400">event_upcoming</mat-icon>
            <h3 class="text-sm font-bold">Reservar {{ table().name }}</h3>
          </div>
          <button (click)="closeModal.emit()" class="text-slate-400 hover:text-white">
            <mat-icon class="text-sm">close</mat-icon>
          </button>
        </div>

        <form (submit)="onSubmit($event)" class="p-5 space-y-4">
          <div>
            <label for="res-client" class="block text-xs font-bold text-slate-700 mb-1">Nome do Cliente</label>
            <input 
              id="res-client"
              [value]="clientName()"
              (input)="clientName.set($any($event.target).value)"
              type="text" 
              required
              placeholder="Ex: João Silva"
              class="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
          </div>

          <div>
            <label for="res-contact" class="block text-xs font-bold text-slate-700 mb-1">Telefone / WhatsApp (Opcional)</label>
            <input 
              id="res-contact"
              [value]="contact()"
              (input)="contact.set($any($event.target).value)"
              type="text" 
              placeholder="Ex: (11) 99999-9999"
              class="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono">
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="res-time" class="block text-xs font-bold text-slate-700 mb-1">Horário</label>
              <input 
                id="res-time"
                [value]="time()"
                (input)="time.set($any($event.target).value)"
                type="time" 
                required
                class="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono">
            </div>

            <div>
              <label for="res-count" class="block text-xs font-bold text-slate-700 mb-1">Número de Pessoas</label>
              <input 
                id="res-count"
                [value]="peopleCount()"
                (input)="onPeopleCountInput($event)"
                type="number" 
                min="1" 
                required
                class="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono">
            </div>
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
              class="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors shadow-sm">
              Confirmar Reserva
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TableReservationModalComponent {
  table = input.required<DiningTable>();

  closeModal = output<void>();
  confirm = output<{ clientName: string; time: string; peopleCount: number; contact?: string }>();

  clientName = signal<string>('');
  contact = signal<string>('');
  time = signal<string>('19:30');
  peopleCount = signal<number>(2);

  onPeopleCountInput(event: Event) {
    this.peopleCount.set(Number((event.target as HTMLInputElement).value));
  }

  onSubmit(event: Event) {
    event.preventDefault();
    if (!this.clientName().trim() || !this.time().trim()) return;
    this.confirm.emit({
      clientName: this.clientName().trim(),
      time: this.time().trim(),
      peopleCount: this.peopleCount(),
      contact: this.contact().trim() || undefined
    });
  }
}
