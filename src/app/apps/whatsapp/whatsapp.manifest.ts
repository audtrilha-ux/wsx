import { AppManifest } from '../../contracts/apps/app-manifest.contract';


export const whatsappAppManifest: AppManifest = {
  id: 'app_whatsapp',
  name: 'WhatsApp Business Hub',
  description: 'Automação de notificações, envio de recibos digitais, alertas de status de pedidos e integração via Webhooks.',
  version: '1.0.0',
  category: 'MESSAGING',
  icon: 'chat',
  developer: 'Meta / 3eatcru Ecosystem',
  permissions: ['network:webhooks', 'notifications:send', 'storage:isolated'],
  capabilities: ['MESSAGING', 'AUTOMATION', 'RECEIPTS'],
  defaultWindowSize: { width: 880, height: 640 },
  entryPoint: '/apps/whatsapp',
  loadComponent: () => import('./whatsapp').then(m => m.Whatsapp)};
