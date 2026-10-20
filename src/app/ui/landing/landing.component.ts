import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, MatIconModule, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen desk-wood-bg text-[#fef3c7] flex flex-col font-sans relative overflow-hidden select-none">
      
      <!-- Banker's Lamp Warm Raytraced Glow (DEsk Physical Atmosphere) -->
      @if (lampLit()) {
        <div class="absolute inset-0 pointer-events-none z-[1] bg-[radial-gradient(ellipse_75%_55%_at_78%_12%,rgba(245,158,11,0.28),transparent_72%)] mix-blend-screen transition-opacity duration-700 desk-lamp-raytrace"></div>
        <div class="absolute inset-0 pointer-events-none z-[1] bg-[radial-gradient(circle_at_78%_12%,rgba(254,243,199,0.22),transparent_40%)] transition-opacity duration-700"></div>
      }

      <!-- Physical Banker's Lamp Fixture (Emerald green glass shade + brass arm) -->
      <div class="absolute top-0 right-14 z-20 hidden md:flex flex-col items-center">
        <!-- Emerald Shade with Brass Bracket -->
        <div class="w-24 h-11 rounded-b-3xl bg-gradient-to-b from-[#064e3b] via-[#047857] to-[#022c22] border-t-2 border-amber-400/50 shadow-2xl flex items-center justify-center relative">
          <!-- Inner Warm Filament Glow -->
          <div [class.bg-amber-100]="lampLit()" [class.shadow-[0_0_20px_#fef08a]]="lampLit()" class="w-10 h-2 rounded-full transition-all duration-300"></div>
          <div class="absolute -top-1 px-2 py-0.5 rounded-full desk-brass-plate text-[7px] font-mono font-bold text-amber-950">BANKER 1928</div>
        </div>
        <!-- Brass Stem & Pull Chain -->
        <div class="w-2 h-4 bg-gradient-to-b from-amber-700 to-amber-900"></div>
        <button 
          type="button" 
          (click)="toggleLamp()" 
          title="Puxar cordinha da luminária de banqueiro"
          class="flex flex-col items-center group cursor-pointer active:translate-y-1 transition-transform">
          <div class="w-0.5 h-10 border-l border-dashed border-amber-400/80"></div>
          <div class="w-3.5 h-3.5 rounded-full desk-brass-plate shadow-md flex items-center justify-center group-hover:scale-110">
            <span class="w-1 h-1 rounded-full bg-amber-950"></span>
          </div>
        </button>
      </div>
      
      <!-- Main Workstation View -->
      <main class="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 relative z-10 max-w-6xl mx-auto w-full">
        
        <!-- Physical Brass Desk Nameplate Plaque -->
        <div class="mb-8 text-center space-y-3 relative max-w-2xl mx-auto">
          
          <div class="inline-flex items-center gap-2 px-4 py-1 rounded-full desk-brass-plate shadow-lg border border-amber-300/40 text-amber-950">
            <span class="desk-brass-screw"></span>
            <span class="text-[10px] font-mono font-bold tracking-widest uppercase">GABINETE SKEUOMÓRFICO EMPRESARIAL</span>
            <span class="desk-brass-screw"></span>
          </div>

          <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-amber-50 tracking-tight leading-tight font-serif">
            A Bancada de Negócios Inspirada no DEsk
          </h1>
          <p class="text-xs sm:text-sm text-amber-200/80 max-w-xl mx-auto leading-relaxed">
            Gavetas de carvalho esculpido, folhas de papel de contabilidade, selos de tinta autênticos e ferragens de latão com a robustez do ecossistema corporativo 3eatcru.
          </p>
        </div>

        <!-- Central Leather Desk Blotter with 3 Physical Filing Folders / Drawers -->
        <div class="w-full desk-leather-blotter p-6 sm:p-8 rounded-3xl relative">
          
          <!-- Golden perimeter stitching on blotter -->
          <div class="absolute inset-2 sm:inset-3 border border-dashed border-amber-500/25 rounded-2xl pointer-events-none"></div>

          <!-- Section Label: The 3 Physical Gateways -->
          <div class="flex items-center justify-between mb-6 pb-3 border-b border-amber-900/40 relative z-10">
            <div class="flex items-center gap-2">
              <span class="desk-brass-screw"></span>
              <span class="text-xs font-bold font-mono tracking-widest text-amber-300 uppercase">SETORES DA BANCADA DE TRABALHO</span>
            </div>
            <span class="desk-stamp-badge desk-stamp-official text-[9px]">REGISTRADO</span>
          </div>

          <!-- 3 Gateways as Skeuomorphic Dossiers / Folders -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
            
            <!-- Folder 1: Public Marketplace (Parchment Catalogue) -->
            <div class="desk-paper-sheet p-6 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1.5 group">
              <!-- Brass Clip on paper -->
              <div class="absolute -top-3 left-6 flex items-center gap-1.5">
                <div class="desk-paperclip"></div>
              </div>

              <div>
                <div class="flex items-center justify-between mb-4">
                  <div class="w-10 h-10 rounded-lg desk-brass-plate flex items-center justify-center text-amber-950 shadow-md group-hover:scale-105 transition-transform">
                    <mat-icon class="text-xl">storefront</mat-icon>
                  </div>
                  <span class="desk-stamp-badge desk-stamp-official text-[9px]">PÚBLICO</span>
                </div>
                
                <h3 class="text-base font-bold text-stone-900 font-serif mb-1 group-hover:text-amber-800 transition-colors">
                  Catálogo & Marketplace
                </h3>
                <p class="text-xs text-stone-600 leading-relaxed font-sans">
                  Fichário público dos estabelecimentos locais (Restaurantes, Varejos e Serviços). Consulta de raio em quilômetros, horários de balcão e vitrines públicas.
                </p>
              </div>

              <div class="mt-6 pt-4 border-t border-stone-200/80">
                <a routerLink="/marketplace" class="w-full flex items-center justify-center gap-2 desk-brass-button text-xs py-2.5 rounded-lg shadow">
                  Folhear Catálogo
                  <mat-icon class="text-sm">arrow_forward</mat-icon>
                </a>
              </div>
            </div>

            <!-- Folder 2: Client OS Operator Terminal (Walnut Workstation) -->
            <div class="desk-wood-panel p-6 rounded-2xl flex flex-col justify-between transition-all duration-200 hover:-translate-y-1.5 relative shadow-2xl border-amber-500/50 group ring-1 ring-amber-400/20">
              
              <!-- Brass Screw corners -->
              <div class="absolute top-2 left-2 desk-brass-screw"></div>
              <div class="absolute top-2 right-2 desk-brass-screw"></div>
              <div class="absolute bottom-2 left-2 desk-brass-screw"></div>
              <div class="absolute bottom-2 right-2 desk-brass-screw"></div>

              <div>
                <div class="flex items-center justify-between mb-4">
                  <div class="w-10 h-10 rounded-lg desk-brass-plate flex items-center justify-center text-amber-950 shadow-md group-hover:scale-105 transition-transform">
                    <mat-icon class="text-xl">point_of_sale</mat-icon>
                  </div>
                  <span class="desk-stamp-badge desk-stamp-approved text-[9px]">RUNTIME OS</span>
                </div>
                
                <h3 class="text-base font-bold text-amber-100 font-serif mb-1 group-hover:text-amber-300 transition-colors">
                  Bancada do Operador OS
                </h3>
                <p class="text-xs text-amber-200/80 leading-relaxed font-sans">
                  Estação de frente de caixa (PDV), salão e comandas de mesas, controle de inventário físico, livro razão financeiro e gaveta de aplicativos.
                </p>
              </div>

              <div class="mt-6 pt-4 border-t border-amber-800/60 flex flex-col sm:flex-row gap-2">
                <a routerLink="/access" class="flex-1 flex items-center justify-center gap-1.5 desk-brass-button text-xs py-2.5 rounded-lg shadow">
                  <mat-icon class="text-sm">login</mat-icon>
                  Abrir Terminal
                </a>
                <a routerLink="/onboarding" class="flex-1 flex items-center justify-center border border-amber-600/40 hover:bg-amber-950/60 text-amber-200 text-xs py-2.5 rounded-lg transition-colors font-medium">
                  Cadastrar Empresa
                </a>
              </div>
            </div>

            <!-- Folder 3: Executive HQ Cabinet (Mahogany Dossier) -->
            <div class="desk-manila-card p-6 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1.5 group">
              <div>
                <div class="flex items-center justify-between mb-4">
                  <div class="w-10 h-10 rounded-lg desk-brass-plate flex items-center justify-center text-amber-950 shadow-md group-hover:scale-105 transition-transform">
                    <mat-icon class="text-xl">shield</mat-icon>
                  </div>
                  <span class="desk-stamp-badge desk-stamp-security text-[9px]">CENTRAL HQ</span>
                </div>
                
                <h3 class="text-base font-bold text-stone-900 font-serif mb-1 group-hover:text-amber-800 transition-colors">
                  Gabinete de Governo HQ
                </h3>
                <p class="text-xs text-stone-600 leading-relaxed font-sans">
                  Painel executivo de administração do ecossistema: provisionamento de tenants, cobrança recorrente, pacotes de software OTA e telemetria de integridade.
                </p>
              </div>

              <div class="mt-6 pt-4 border-t border-stone-300/80">
                <a routerLink="/hq" class="w-full flex items-center justify-center gap-2 border border-stone-400 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs py-2.5 rounded-lg transition-all shadow-sm">
                  Gabinete Executivo
                  <mat-icon class="text-sm">arrow_forward</mat-icon>
                </a>
              </div>
            </div>

          </div>

          <!-- Bottom Sticky Note on the Desk with Physical Pushpin -->
          <div class="mt-8 pt-6 border-t border-amber-900/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-amber-300/70">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]"></span>
              <span class="font-mono text-[11px]">DEsk Engine · Sistema Tátil Zoneless & Offline-First para Linux & Web</span>
            </div>
            <div class="flex items-center gap-4 text-[11px] font-mono">
              <span class="hover:text-amber-200 cursor-pointer">Documento Reg. #1928-E</span>
              <span>·</span>
              <span class="hover:text-amber-200 cursor-pointer">Protocolo Dual-OS</span>
            </div>
          </div>

        </div>

      </main>

    </div>
  `
})
export class LandingComponent {
  readonly lampLit = signal<boolean>(true);

  toggleLamp(): void {
    this.lampLit.update(v => !v);
  }
}
