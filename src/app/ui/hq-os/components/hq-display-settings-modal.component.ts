import { Component, ChangeDetectionStrategy, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { 
  OsDisplayEngineService, 
  RESOLUTION_PRESETS, 
  SCALE_FACTORS 
} from '../../../core/application/display-engine.service';

@Component({
  selector: 'app-hq-display-settings-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        <!-- Header -->
        <div class="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <mat-icon class="text-lg">aspect_ratio</mat-icon>
            </div>
            <div>
              <h3 class="text-sm font-bold text-white uppercase tracking-wider">Resolução do Workspace & Escala</h3>
              <p class="text-xs text-slate-400">Configure a resolução lógica do ambiente de trabalho e o fator de escala visual.</p>
            </div>
          </div>
          <button (click)="closeModal.emit()" class="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800">
            <mat-icon class="text-sm">close</mat-icon>
          </button>
        </div>

        <!-- Body content -->
        <div class="p-6 overflow-y-auto max-h-[75vh] space-y-6 text-xs">

          <!-- Current Resolution Status Banner -->
          <div class="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span class="text-[10px] font-mono text-indigo-400 uppercase tracking-wider block">Perfil Ativo</span>
              <span class="text-sm font-bold text-white font-mono mt-0.5 block">{{ displayEngine.displayBadgeLabel() }}</span>
            </div>
            <div class="text-right font-mono text-[10px] text-slate-400">
              <div>Lógica: {{ displayEngine.targetWidth() }} × {{ displayEngine.targetHeight() }} px</div>
              <div>Escala Visual: {{ displayEngine.scaleFactor() }}%</div>
            </div>
          </div>

          <!-- Section 1: Resolution Presets -->
          <div>
            <span class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              1. Resolução do Workspace (Área Lógica)
            </span>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              @for (preset of presets; track preset.id) {
                <button 
                  (click)="displayEngine.setPreset(preset.id)"
                  [class]="displayEngine.selectedPresetId() === preset.id 
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'"
                  class="p-3 border rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between">
                  <div>
                    <div class="font-bold text-xs">{{ preset.category }}</div>
                    <div class="text-[10px] opacity-80 font-mono mt-0.5">
                      @if (preset.width) {
                        {{ preset.width }} × {{ preset.height }}
                      } @else if (preset.id === 'auto') {
                        Auto / Tela
                      } @else {
                        Personalizado
                      }
                    </div>
                  </div>
                  @if (displayEngine.selectedPresetId() === preset.id) {
                    <div class="mt-2 text-[9px] font-mono font-bold uppercase tracking-wider text-indigo-200 flex items-center gap-1">
                      <mat-icon class="text-[10px] w-2.5 h-2.5">check_circle</mat-icon> Ativo
                    </div>
                  }
                </button>
              }
            </div>
          </div>

          <!-- Custom Resolution Inputs if 'custom' is selected -->
          @if (displayEngine.selectedPresetId() === 'custom') {
            <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <span class="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Resolução Personalizada (px)</span>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="custom-workspace-width" class="block text-[10px] font-mono text-slate-500 uppercase mb-1">Largura (Width)</label>
                  <input id="custom-workspace-width" type="number" [value]="customWidthVal()" (input)="onWidthInput($event)" min="800" max="7680" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none focus:border-indigo-500">
                </div>
                <div>
                  <label for="custom-workspace-height" class="block text-[10px] font-mono text-slate-500 uppercase mb-1">Altura (Height)</label>
                  <input id="custom-workspace-height" type="number" [value]="customHeightVal()" (input)="onHeightInput($event)" min="600" max="4320" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none focus:border-indigo-500">
                </div>
              </div>
              <button (click)="applyCustomResolution()" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg text-xs transition-colors">
                Aplicar Resolução Personalizada
              </button>
            </div>
          }

          <!-- Section 2: Visual Scale Factor -->
          <div>
            <span class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              2. Fator de Escala Visual (DPI / Zoom)
            </span>
            <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
              @for (scale of scaleOptions; track scale) {
                <button 
                  (click)="displayEngine.setScale(scale)"
                  [class]="displayEngine.scaleFactor() === scale
                    ? 'bg-indigo-600 border-indigo-500 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'"
                  class="py-2.5 border rounded-xl text-center font-mono text-xs transition-colors cursor-pointer">
                  {{ scale }}%
                </button>
              }
            </div>
            <p class="text-[10px] text-slate-500 mt-2">
              Ajusta a proporção dos elementos de UI dentro do canvas virtual sem alterar a resolução lógica das janelas.
            </p>
          </div>

          <!-- Section 3: Viewport Adaptation Mode -->
          <div>
            <span class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              3. Modo de Enquadramento do Canvas
            </span>
            <div class="grid grid-cols-3 gap-2.5">
              <button 
                (click)="displayEngine.setFitMode('contain-scaled')"
                [class]="displayEngine.fitMode() === 'contain-scaled'
                  ? 'bg-indigo-600 border-indigo-500 text-white font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'"
                class="p-3 border rounded-xl text-left transition-colors cursor-pointer">
                <div class="font-bold text-xs flex items-center gap-1.5">
                  <mat-icon class="text-sm">fit_screen</mat-icon> Fit Viewport
                </div>
                <div class="text-[9px] opacity-75 mt-1 font-mono">Escala proporcional mantendo proporção</div>
              </button>

              <button 
                (click)="displayEngine.setFitMode('center-letterbox')"
                [class]="displayEngine.fitMode() === 'center-letterbox'
                  ? 'bg-indigo-600 border-indigo-500 text-white font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'"
                class="p-3 border rounded-xl text-left transition-colors cursor-pointer">
                <div class="font-bold text-xs flex items-center gap-1.5">
                  <mat-icon class="text-sm">crop_free</mat-icon> Pixel-Perfect
                </div>
                <div class="text-[9px] opacity-75 mt-1 font-mono">Moldura centrada sem esticar</div>
              </button>

              <button 
                (click)="displayEngine.setFitMode('scrollable')"
                [class]="displayEngine.fitMode() === 'scrollable'
                  ? 'bg-indigo-600 border-indigo-500 text-white font-bold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'"
                class="p-3 border rounded-xl text-left transition-colors cursor-pointer">
                <div class="font-bold text-xs flex items-center gap-1.5">
                  <mat-icon class="text-sm">unfold_more</mat-icon> Rolagem Nativa
                </div>
                <div class="text-[9px] opacity-75 mt-1 font-mono">Scrollbars no canvas se exceder</div>
              </button>
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div class="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-between items-center">
          <div class="text-[10px] text-slate-500 font-mono">
            3eatcru OS Display Resolution Engine
          </div>
          <button (click)="closeModal.emit()" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors shadow-sm">
            Concluído
          </button>
        </div>

      </div>
    </div>
  `
})
export class HqDisplaySettingsModalComponent {
  displayEngine = inject(OsDisplayEngineService);
  closeModal = output<void>();

  presets = RESOLUTION_PRESETS;
  scaleOptions = SCALE_FACTORS;

  customWidthVal = signal(this.displayEngine.customWidth());
  customHeightVal = signal(this.displayEngine.customHeight());

  onWidthInput(event: Event) {
    this.customWidthVal.set(Number((event.target as HTMLInputElement).value) || 1920);
  }

  onHeightInput(event: Event) {
    this.customHeightVal.set(Number((event.target as HTMLInputElement).value) || 1080);
  }

  applyCustomResolution() {
    this.displayEngine.setCustomResolution(this.customWidthVal(), this.customHeightVal());
  }
}
