import { AppManifest } from '../../contracts/apps/app-manifest.contract';


export const crmAppManifest: AppManifest = {
  id: 'app_crm',
  name: 'CRM & Fidelidade',
  description: 'Gestão de relacionamento com clientes, carteira de pontos e clube de fidelidade',
  version: '1.0.0',
  category: 'CRM',
  icon: 'loyalty',
  developer: '3eatcru CRM',
  permissions: ['printer', 'storage', 'notifications'],
  defaultWindowSize: { width: 900, height: 650 },
  entryPoint: '/apps/crm',
  loadComponent: () => import('./ui/crm').then(m => m.CrmComponent)};
