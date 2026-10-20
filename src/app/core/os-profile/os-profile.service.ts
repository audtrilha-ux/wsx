import { Injectable, signal, computed, inject } from '@angular/core';
import { ConfigurationService } from '../configuration/configuration.service';

export type OsProfileType = 'retail' | 'restaurant';

export interface OsProfileDefinition {
  id: OsProfileType;
  name: string;
  shortLabel: string;
  subtitle: string;
  description: string;
  icon: string;
  badge: string;
  preInstalledAppIds: string[];
  recommendedWallpapers: string[];
}

export const OS_PROFILES: Record<OsProfileType, OsProfileDefinition> = {
  retail: {
    id: 'retail',
    name: 'Modo Varejo & Comércio',
    shortLabel: 'Varejo',
    subtitle: 'Lojas, mercados, conveniências e comércio varejista',
    description: 'Ambiente otimizado para giro de estoque, frente de caixa PDV ágil com suporte a leitor de código de barras, balança comercial, gestão de relacionamento CRM e notificações operacionais via Telegram.',
    icon: 'storefront',
    badge: 'Comércio / Varejo',
    preInstalledAppIds: ['app_pos', 'app_inventory', 'app_crm', 'app_telegram'],
    recommendedWallpapers: ['desk-wood-counter', 'desk-leather-mat']
  },
  restaurant: {
    id: 'restaurant',
    name: 'Modo Restaurantes & Gastronomia',
    shortLabel: 'Restaurante',
    subtitle: 'Restaurantes, bares, cafeterias, pizzarias e lanchonetes',
    description: 'Ambiente focado no salão: mapa visual de mesas, comanda digital, KDS de cozinha em tempo real, fluxo de caixa e turnos financeiros, frente de caixa balcão e integrações com canais de entrega como iFood e WhatsApp.',
    icon: 'restaurant',
    badge: 'Alimentação / Gastronomia',
    preInstalledAppIds: ['app_tables', 'app_finance', 'app_pos', 'app_inventory'],
    recommendedWallpapers: ['desk-dark-oak', 'desk-wood-counter']
  }
};

@Injectable({
  providedIn: 'root'
})
export class OsProfileService {
  private readonly PROFILE_KEY = '3eatcru_os_profile';
  private configService = inject(ConfigurationService, { optional: true });
  
  readonly activeProfile = signal<OsProfileType>(this.loadStoredProfile());

  readonly currentProfileDef = computed<OsProfileDefinition>(() => {
    return OS_PROFILES[this.activeProfile()] || OS_PROFILES.retail;
  });

  setProfile(profile: OsProfileType): void {
    if (profile !== 'retail' && profile !== 'restaurant') return;
    
    this.activeProfile.set(profile);
    
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.PROFILE_KEY, profile);
      }
    } catch (e) {
      console.warn('Falha ao gravar perfil no localStorage:', e);
    }

    if (this.configService) {
      const segmentName = profile === 'restaurant' ? 'Alimentação / Restaurante' : 'Comércio / Varejo';
      this.configService.set('company_segment', segmentName, 'COMPANY');
    }
  }

  private loadStoredProfile(): OsProfileType {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(this.PROFILE_KEY);
        if (stored === 'retail' || stored === 'restaurant') {
          return stored;
        }
      }
    } catch (e) {
      console.warn('Falha ao ler perfil do localStorage:', e);
    }
    return 'retail';
  }
}
