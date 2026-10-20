import { AppManifest } from '../../contracts/apps/app-manifest.contract';


export const inventoryAppManifest: AppManifest = {
  id: 'app_inventory',
  name: 'Controle de Estoque',
  description: 'Catálogo de itens, movimentações, precificação e níveis de estoque',
  version: '1.0.0',
  category: 'INVENTORY',
  icon: 'inventory_2',
  developer: '3eatcru Core Logistics',
  permissions: ['storage', 'notifications'],
  defaultWindowSize: { width: 900, height: 600 },
  entryPoint: '/apps/inventory',
  loadComponent: () => import('./ui/inventory').then(m => m.InventoryComponent)
};
