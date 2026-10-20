import { AppManifest } from '../contracts/apps/app-manifest.contract';
export { posAppManifest } from './pos/pos.manifest';
export { inventoryAppManifest } from './inventory/inventory.manifest';
export { crmAppManifest } from './crm/crm.manifest';
export { financeAppManifest } from './finance/finance.manifest';
export { tablesAppManifest } from './tables/tables.manifest';
export { publicSpaceAppManifest } from './public-space/public-space.manifest';
export { whatsappAppManifest } from './whatsapp/whatsapp.manifest';
export { telegramAppManifest } from './telegram/telegram.manifest';
export { ifoodAppManifest } from './ifood/ifood.manifest';

import { posAppManifest } from './pos/pos.manifest';
import { inventoryAppManifest } from './inventory/inventory.manifest';
import { crmAppManifest } from './crm/crm.manifest';
import { financeAppManifest } from './finance/finance.manifest';
import { tablesAppManifest } from './tables/tables.manifest';
import { publicSpaceAppManifest } from './public-space/public-space.manifest';
import { whatsappAppManifest } from './whatsapp/whatsapp.manifest';
import { telegramAppManifest } from './telegram/telegram.manifest';
import { ifoodAppManifest } from './ifood/ifood.manifest';

export const BUSINESS_APP_MANIFESTS: AppManifest[] = [
  posAppManifest,
  inventoryAppManifest,
  tablesAppManifest,
  financeAppManifest,
  publicSpaceAppManifest,
  crmAppManifest,
  whatsappAppManifest,
  telegramAppManifest,
  ifoodAppManifest
];
