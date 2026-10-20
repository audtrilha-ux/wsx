import { AppManifest } from '../../contracts/apps/app-manifest.contract';


export const financeAppManifest: AppManifest = {
  id: 'app_finance',
  name: 'Fluxo de Caixa & Finanças',
  description: 'Controle de liquidez, sangrias, suprimentos e fechamento de caixa térmico',
  version: '1.0.0',
  category: 'FINANCE',
  icon: 'account_balance_wallet',
  developer: '3eatcru Finance',
  permissions: ['printer', 'storage', 'notifications'],
  defaultWindowSize: { width: 900, height: 650 },
  entryPoint: '/apps/finance',
  loadComponent: () => import('./ui/finance').then(m => m.FinanceComponent)};
