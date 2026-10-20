import { AppManifest } from '../../contracts/apps/app-manifest.contract';


export const tablesAppManifest: AppManifest = {
  id: 'app_tables',
  name: 'Mesas, Comandas & KDS',
  description: 'Gestão de salão, comandas eletrônicas e fila de cozinha para food service',
  version: '1.0.0',
  category: 'RESTAURANT',
  icon: 'table_restaurant',
  developer: '3eatcru Food Platform',
  permissions: ['printer', 'storage', 'notifications'],
  defaultWindowSize: { width: 900, height: 650 },
  entryPoint: '/apps/tables',
  loadComponent: () => import('./ui/tables').then(m => m.TablesComponent)
};
