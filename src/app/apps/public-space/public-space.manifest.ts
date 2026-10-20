import { AppManifest } from '../../contracts/apps/app-manifest.contract';


export const publicSpaceAppManifest: AppManifest = {
  id: 'app_public_space',
  name: 'Presença Digital & Site',
  description: 'Gerenciador do site público, cardápio online, vitrine e canais de contato',
  version: '1.0.0',
  category: 'PUBLIC_SPACE',
  icon: 'language',
  developer: '3eatcru Web Services',
  permissions: ['storage', 'notifications'],
  defaultWindowSize: { width: 950, height: 680 },
  entryPoint: '/apps/publicspacemanager',
  loadComponent: () => import('./ui/public-space-manager').then(m => m.PublicSpaceManager)
};
