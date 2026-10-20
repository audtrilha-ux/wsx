import { AppManifest } from '../../contracts/apps/app-manifest.contract';


export const telegramAppManifest: AppManifest = {
  id: 'app_telegram',
  name: 'Telegram Manager Bot',
  description: 'Robô de alertas executivos e operacionais em tempo real: sangrias de caixa, relatórios de turno e estoque crítico.',
  version: '1.0.0',
  category: 'INTEGRATION',
  icon: 'send',
  developer: 'Telegram / 3eatcru Ecosystem',
  permissions: ['network:webhooks', 'notifications:send', 'storage:isolated'],
  capabilities: ['BOT_ALERTS', 'MANAGEMENT', 'NOTIFICATIONS'],
  defaultWindowSize: { width: 850, height: 600 },
  entryPoint: '/apps/telegram',
  loadComponent: () => import('./telegram').then(m => m.Telegram)};
