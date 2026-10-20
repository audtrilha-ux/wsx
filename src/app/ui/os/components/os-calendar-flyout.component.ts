import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { OsNotification } from '../os-shell.component';

@Component({
  selector: 'app-os-calendar-flyout',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    @if (isOpen()) {
      <div class="absolute bottom-16 right-4 sm:w-96 max-h-[calc(100vh-6rem)] overflow-y-auto z-50 rounded-2xl bg-slate-900/95 border border-white/10 shadow-2xl backdrop-blur-xl text-white p-5 space-y-4 animate-tray-slide">
        <!-- Header: Digital Clock and Full Date -->
        <div class="border-b border-white/10 pb-3 flex justify-between items-start">
          <div>
            <h2 class="text-2xl font-bold font-mono tracking-tight text-white leading-none">{{ currentTimeWithSeconds() }}</h2>
            <p class="text-xs text-indigo-300 font-medium capitalize mt-1.5">{{ formattedFullDate() }}</p>
          </div>
          <button 
            (click)="closeFlyout.emit()"
            class="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            type="button">
            <mat-icon class="text-sm">close</mat-icon>
          </button>
        </div>

        <!-- Interactive Monthly Calendar -->
        <div class="bg-slate-950/60 rounded-xl p-3 border border-white/5 space-y-3">
          <!-- Month Navigation -->
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-200 tracking-wide">{{ currentMonthYear() }}</span>
            <div class="flex items-center gap-1">
              <button 
                (click)="resetToToday()" 
                title="Voltar para hoje"
                class="px-2 py-0.5 text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/30 rounded border border-indigo-500/20 transition-colors mr-1"
                type="button">
                Hoje
              </button>
              <button 
                (click)="prevMonth()" 
                class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                type="button">
                <mat-icon class="text-sm">chevron_left</mat-icon>
              </button>
              <button 
                (click)="nextMonth()" 
                class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                type="button">
                <mat-icon class="text-sm">chevron_right</mat-icon>
              </button>
            </div>
          </div>

          <!-- Days of Week Header -->
          <div class="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 pb-1 border-b border-white/5">
            <span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span>
          </div>

          <!-- Calendar Day Grid -->
          <div class="grid grid-cols-7 gap-1 text-center">
            @for (d of calendarDays(); track $index) {
              @if (d.day === 0) {
                <div class="h-7"></div>
              } @else {
                <button 
                  (click)="selectDate(d.date)"
                  [class.bg-indigo-600]="d.isToday"
                  [class.text-white]="d.isToday || d.isSelected"
                  [class.font-bold]="d.isToday || d.isSelected"
                  [class.ring-2]="d.isSelected && !d.isToday"
                  [class.ring-indigo-400]="d.isSelected && !d.isToday"
                  [class.text-slate-300]="!d.isToday && !d.isSelected"
                  class="h-7 w-7 mx-auto rounded-lg text-xs flex items-center justify-center hover:bg-white/15 transition-all cursor-pointer"
                  type="button">
                  {{ d.day }}
                </button>
              }
            }
          </div>
        </div>

        <!-- Central de Notificações do Sistema -->
        <div class="space-y-2.5">
          <div class="flex items-center justify-between border-b border-white/5 pb-1.5">
            <div class="flex items-center gap-1.5">
              <mat-icon class="text-xs text-indigo-400">notifications</mat-icon>
              <h4 class="text-xs font-bold text-slate-200">Central de Notificações</h4>
              <span class="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/10 text-slate-300">{{ notificationHistory().length }}</span>
            </div>
            @if (notificationHistory().length > 0) {
              <button 
                (click)="clearNotifications.emit()"
                class="text-[10px] text-slate-400 hover:text-rose-400 transition-colors"
                type="button">
                Limpar todas
              </button>
            }
          </div>

          <!-- Notifications List -->
          <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
            @if (notificationHistory().length === 0) {
              <div class="py-6 text-center text-slate-500 space-y-1">
                <mat-icon class="text-2xl text-slate-600">notifications_none</mat-icon>
                <p class="text-xs">Nenhuma notificação arquivada.</p>
                <p class="text-[10px]">O sistema operacional está operando normalmente.</p>
              </div>
            } @else {
              @for (item of notificationHistory(); track item.id) {
                <div class="bg-slate-950/40 border border-white/5 rounded-xl p-2.5 flex items-start gap-2.5 text-left group hover:border-white/10 transition-colors">
                  <div class="p-1 rounded-lg shrink-0 mt-0.5"
                       [ngClass]="{
                         'bg-emerald-500/10 text-emerald-400': item.type === 'success',
                         'bg-amber-500/10 text-amber-400': item.type === 'warning',
                         'bg-indigo-500/10 text-indigo-400': item.type === 'info'
                       }">
                    <mat-icon class="text-sm leading-none">
                      {{ item.type === 'success' ? 'check_circle' : item.type === 'warning' ? 'warning' : 'info' }}
                    </mat-icon>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-baseline gap-2">
                      <h5 class="text-xs font-semibold text-slate-200 truncate">{{ item.title }}</h5>
                      <span class="text-[9px] font-mono text-slate-500 shrink-0">
                        {{ item.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }}
                      </span>
                    </div>
                    <p class="text-[11px] text-slate-400 leading-snug mt-0.5 line-clamp-2">{{ item.message }}</p>
                  </div>
                  <button 
                    (click)="dismissNotification.emit(item.id)"
                    title="Dispensar notificação"
                    class="text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    type="button">
                    <mat-icon class="text-[14px]">close</mat-icon>
                  </button>
                </div>
              }
            }
          </div>
        </div>
      </div>
    }
  `
})
export class OsCalendarFlyoutComponent {
  isOpen = input<boolean>(false);
  currentTimeWithSeconds = input<string>('');
  notificationHistory = input<OsNotification[]>([]);

  closeFlyout = output<void>();
  clearNotifications = output<void>();
  dismissNotification = output<string>();

  calendarViewDate = signal<Date>(new Date());
  selectedCalendarDate = signal<Date>(new Date());

  formattedFullDate = computed(() => {
    return this.selectedCalendarDate().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  });

  currentMonthYear = computed(() => {
    const d = this.calendarViewDate();
    const str = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  calendarDays = computed(() => {
    const view = this.calendarViewDate();
    const year = view.getFullYear();
    const month = view.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDate = now.getDate();

    const selected = this.selectedCalendarDate();
    const selYear = selected.getFullYear();
    const selMonth = selected.getMonth();
    const selDate = selected.getDate();

    const days: { day: number; date: Date; isToday: boolean; isSelected: boolean }[] = [];

    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ day: 0, date: new Date(year, month, 0), isToday: false, isSelected: false });
    }

    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      const d = new Date(year, month, dayNum);
      const isToday = year === todayYear && month === todayMonth && dayNum === todayDate;
      const isSelected = year === selYear && month === selMonth && dayNum === selDate;
      days.push({ day: dayNum, date: d, isToday, isSelected });
    }

    return days;
  });

  prevMonth() {
    this.calendarViewDate.update(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  nextMonth() {
    this.calendarViewDate.update(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  resetToToday() {
    const now = new Date();
    this.calendarViewDate.set(new Date(now.getFullYear(), now.getMonth(), 1));
    this.selectedCalendarDate.set(now);
  }

  selectDate(d: Date) {
    if (d.getDate() === 0) return;
    this.selectedCalendarDate.set(d);
  }
}
