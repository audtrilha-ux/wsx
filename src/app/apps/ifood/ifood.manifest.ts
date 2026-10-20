import { AppManifest } from '../../contracts/apps/app-manifest.contract';


export const ifoodAppManifest: AppManifest = {
  id: 'app_ifood',
  name: 'iFood Delivery Hub',
  description: 'Recepção de pedidos externos do iFood com integração direta ao KDS de cozinha, impressão térmica automática e status de entrega.',
  version: '1.0.0',
  category: 'DELIVERY',
  icon: 'delivery_dining',
  developer: '3eatcru Community',
  permissions: ['network:webhooks', 'printer:tickets', 'storage:isolated'],
  capabilities: ['DELIVERY_ORDERS', 'KDS_SYNC', 'AUTO_PRINT'],
  defaultWindowSize: { width: 920, height: 680 },
  entryPoint: '/apps/ifood',
  loadComponent: () => import('./ifood').then(m => m.Ifood)};
