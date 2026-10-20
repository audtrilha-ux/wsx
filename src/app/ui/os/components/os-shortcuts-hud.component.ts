import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-os-shortcuts-hud',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    @if (isOpen()) {
      <div class="fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
          
          <!-- Modal Header -->
          <div class="flex items-center justify-between border-b border-slate-800 pb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <mat-icon class="text-xl">keyboard</mat-icon>
              </div>
              <div>
                <h3 class="text-base font-bold text-white">Central de Atalhos de Teclado</h3>
                <p class="text-[11px] text-slate-400">Aumente sua produtividade operando o 3eatcru OS em alta velocidade</p>
              </div>
            </div>
            <button (click)="closeModal.emit()" class="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <!-- Shortcuts Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <!-- Column 1: Window Management -->
            <div class="space-y-3">
              <h4 class="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                <mat-icon class="text-xs">window</mat-icon>
                Controle de Janelas
              </h4>
              <div class="space-y-2">
                <div class="flex justify-between items-center bg-white/[0.02] border border-white/5 p-2 rounded-xl text-xs text-slate-300">
                  <span>Encaixar à Esquerda</span>
                  <span class="font-mono text-[10px] bg-white/10 px-2 py-1 rounded text-white font-bold">Alt + ◄</span>
                </div>
                <div class="flex justify-between items-center bg-white/[0.02] border border-white/5 p-2 rounded-xl text-xs text-slate-300">
                  <span>Encaixar à Direita</span>
                  <span class="font-mono text-[10px] bg-white/10 px-2 py-1 rounded text-white font-bold">Alt + ►</span>
                </div>
                <div class="flex justify-between items-center bg-white/[0.02] border border-white/5 p-2 rounded-xl text-xs text-slate-300">
                  <span>Maximizar Janela</span>
                  <span class="font-mono text-[10px] bg-white/10 px-2 py-1 rounded text-white font-bold">Alt + ▲</span>
                </div>
                <div class="flex justify-between items-center bg-white/[0.02] border border-white/5 p-2 rounded-xl text-xs text-slate-300">
                  <span>Minimizar / Restaurar</span>
                  <span class="font-mono text-[10px] bg-white/10 px-2 py-1 rounded text-white font-bold">Alt + ▼</span>
                </div>
              </div>
            </div>

            <!-- Column 2: System Shortcuts -->
            <div class="space-y-3">
              <h4 class="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                <mat-icon class="text-xs">settings_suggest</mat-icon>
                Ações do Sistema
              </h4>
              <div class="space-y-2">
                <div class="flex justify-between items-center bg-white/[0.02] border border-white/5 p-2 rounded-xl text-xs text-slate-300">
                  <span>Abrir Menu Iniciar</span>
                  <span class="font-mono text-[10px] bg-white/10 px-2 py-1 rounded text-white font-bold">Alt + Q <span class="text-slate-400 font-normal">ou</span> Espaço</span>
                </div>
                <div class="flex justify-between items-center bg-white/[0.02] border border-white/5 p-2 rounded-xl text-xs text-slate-300">
                  <span>Mostrar Área de Trabalho</span>
                  <span class="font-mono text-[10px] bg-white/10 px-2 py-1 rounded text-white font-bold">Alt + D</span>
                </div>
                <div class="flex justify-between items-center bg-white/[0.02] border border-white/5 p-2 rounded-xl text-xs text-slate-300">
                  <span>Abrir Navegador Web / Pesquisa</span>
                  <span class="font-mono text-[10px] bg-white/10 px-2 py-1 rounded text-white font-bold">Alt + S</span>
                </div>
                <div class="flex justify-between items-center bg-white/[0.02] border border-white/5 p-2 rounded-xl text-xs text-slate-300">
                  <span>Organizar em Grade</span>
                  <span class="font-mono text-[10px] bg-white/10 px-2 py-1 rounded text-white font-bold">Alt + G</span>
                </div>
                <div class="flex justify-between items-center bg-white/[0.02] border border-white/5 p-2 rounded-xl text-xs text-slate-300">
                  <span>Organizar em Cascata</span>
                  <span class="font-mono text-[10px] bg-white/10 px-2 py-1 rounded text-white font-bold">Alt + C</span>
                </div>
                <div class="flex justify-between items-center bg-white/[0.02] border border-white/5 p-2 rounded-xl text-xs text-slate-300">
                  <span>Auto-Ajustar Janelas</span>
                  <span class="font-mono text-[10px] bg-white/10 px-2 py-1 rounded text-white font-bold">Alt + A</span>
                </div>
                <div class="flex justify-between items-center bg-white/[0.02] border border-white/5 p-2 rounded-xl text-xs text-slate-300">
                  <span>Abrir Calendário e Notificações</span>
                  <span class="font-mono text-[10px] bg-white/10 px-2 py-1 rounded text-white font-bold">Alt + N</span>
                </div>
                <div class="flex justify-between items-center bg-white/[0.02] border border-white/5 p-2 rounded-xl text-xs text-slate-300">
                  <span>Gerenciador de Tarefas do OS</span>
                  <span class="font-mono text-[10px] bg-white/10 px-2 py-1 rounded text-white font-bold">Alt + T</span>
                </div>
                <div class="flex justify-between items-center bg-white/[0.02] border border-white/5 p-2 rounded-xl text-xs text-slate-300">
                  <span>Explorador de Arquivos</span>
                  <span class="font-mono text-[10px] bg-white/10 px-2 py-1 rounded text-white font-bold">Alt + E</span>
                </div>
                <div class="flex justify-between items-center bg-white/[0.02] border border-white/5 p-2 rounded-xl text-xs text-slate-300">
                  <span>Diagnóstico do Kernel</span>
                  <span class="font-mono text-[10px] bg-white/10 px-2 py-1 rounded text-white font-bold">Alt + H</span>
                </div>
                <div class="flex justify-between items-center bg-white/[0.02] border border-indigo-500/30 bg-indigo-500/5 p-2 rounded-xl text-xs text-slate-300">
                  <span class="font-semibold text-indigo-300">Exibir este Guia de Ajuda</span>
                  <span class="font-mono text-[10px] bg-indigo-600 px-2 py-1 rounded text-white font-bold">Alt + /</span>
                </div>
              </div>
            </div>

          </div>

          <!-- Tip Footer -->
          <div class="p-3 bg-white/5 rounded-xl border border-white/5 text-[11px] text-slate-400 flex items-center gap-2">
            <mat-icon class="text-xs text-amber-400 leading-none shrink-0">lightbulb</mat-icon>
            <span>Pressione <span class="font-mono text-xs text-white bg-slate-800 px-1 py-0.5 rounded border border-slate-700">ESC</span> para fechar painéis ou clique com o botão direito na Área de Trabalho para o menu de contexto.</span>
          </div>

        </div>
      </div>
    }
  `
})
export class OsShortcutsHudComponent {
  isOpen = input<boolean>(false);
  closeModal = output<void>();
}
