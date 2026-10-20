import { AppManifest } from '../../contracts/apps/app-manifest.contract';


export const posAppManifest: AppManifest = {
  id: 'app_pos',
  name: 'Ponto de Venda (PDV)',
  description: 'Frente de caixa, registro de vendas, leitor de código de barras e emissão térmica',
  version: '1.0.0',
  category: 'SALES',
  icon: 'point_of_sale',
  developer: '3eatcru Commercial',
  permissions: ['printer', 'hardware', 'storage', 'notifications'],
  defaultWindowSize: { width: 950, height: 680 },
  entryPoint: '/apps/pos',
  loadComponent: () => import('./ui/pos').then(m => m.PosComponent)
};
