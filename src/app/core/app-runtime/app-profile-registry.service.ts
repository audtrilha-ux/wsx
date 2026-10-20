import { Injectable } from '@angular/core';
import { AppManifest } from '../../contracts/apps/app-manifest.contract';
import { 
  posAppManifest, 
  inventoryAppManifest, 
  crmAppManifest, 
  financeAppManifest, 
  tablesAppManifest, 
  publicSpaceAppManifest, 
  whatsappAppManifest, 
  telegramAppManifest, 
  ifoodAppManifest 
} from '../../apps/index';

@Injectable({
  providedIn: 'root'
})
export class AppProfileRegistryService {
  /**
   * Suíte Pré-instalada Padrão para Modo Varejo:
   * - Frente de Caixa PDV (Código de Barras, Balança, Cupom)
   * - Gestão de Estoque (Inventário, Movimentações, Ficha)
   * - CRM & Fidelização (Clientes, Histórico, Pontuação)
   * - Bot Telegram (Notificações, Alertas Operacionais de Caixa)
   */
  private readonly retailApps: AppManifest[] = [
    posAppManifest,
    inventoryAppManifest,
    crmAppManifest,
    telegramAppManifest
  ];

  /**
   * Suíte Pré-instalada Padrão para Modo Restaurantes & Gastronomia:
   * - Salão de Mesas & KDS Cozinha (Mapa de mesas, comandas, KDS em tempo real)
   * - Financeiro & Sessões de Caixa (Fechamento de turnos, contas a pagar/receber)
   * - Frente de Caixa PDV (Pedidos balcão, take-away, faturamento rápido)
   * - Gestão de Estoque de Insumos (Controle de matéria-prima e fichas técnicas)
   */
  private readonly restaurantApps: AppManifest[] = [
    tablesAppManifest,
    financeAppManifest,
    posAppManifest,
    inventoryAppManifest
  ];

  /**
   * Aplicativos complementares disponíveis no ecossistema
   */
  private readonly complementaryApps: Record<'retail' | 'restaurant', AppManifest[]> = {
    retail: [
      financeAppManifest,
      publicSpaceAppManifest,
      whatsappAppManifest
    ],
    restaurant: [
      ifoodAppManifest,
      whatsappAppManifest,
      crmAppManifest,
      publicSpaceAppManifest,
      telegramAppManifest
    ]
  };

  getAppsForProfile(profile: 'retail' | 'restaurant'): AppManifest[] {
    return profile === 'restaurant' ? this.restaurantApps : this.retailApps;
  }

  getComplementaryAppsForProfile(profile: 'retail' | 'restaurant'): AppManifest[] {
    return this.complementaryApps[profile] || [];
  }

  getAllBusinessApps(): AppManifest[] {
    return [
      posAppManifest,
      inventoryAppManifest,
      tablesAppManifest,
      financeAppManifest,
      crmAppManifest,
      telegramAppManifest,
      ifoodAppManifest,
      whatsappAppManifest,
      publicSpaceAppManifest
    ];
  }
}
