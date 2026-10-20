export interface PermissionDefinition {
  id: string;
  name: string;
  category: 'HARDWARE' | 'STORAGE' | 'NETWORK' | 'SYSTEM' | 'SALES' | 'NOTIFICATIONS';
  description: string;
}

export const PLATFORM_PERMISSIONS: Record<string, PermissionDefinition> = {
  // Storage
  'storage': { id: 'storage', name: 'Armazenamento Local', category: 'STORAGE', description: 'Acesso completo ao armazenamento local do aplicativo' },
  'storage.read': { id: 'storage.read', name: 'Leitura de Armazenamento', category: 'STORAGE', description: 'Permite leitura de dados persistidos no terminal' },
  'storage.write': { id: 'storage.write', name: 'Gravação de Armazenamento', category: 'STORAGE', description: 'Permite salvar e modificar dados locais' },
  'storage.isolated': { id: 'storage.isolated', name: 'Armazenamento Isolado', category: 'STORAGE', description: 'Armazenamento particionado exclusivamente para este app' },

  // Printer & Hardware
  'printer': { id: 'printer', name: 'Impressão Térmica', category: 'HARDWARE', description: 'Acesso completo às impressoras térmicas e bobinas' },
  'printer.tickets': { id: 'printer.tickets', name: 'Impressão de Comprovantes', category: 'HARDWARE', description: 'Emissão de tíquetes de venda e KDS de cozinha' },
  'printer.fiscal': { id: 'printer.fiscal', name: 'Impressão Fiscal', category: 'HARDWARE', description: 'Emissão de cupons fiscais e NFC-e' },
  'hardware': { id: 'hardware', name: 'Hardware & Periféricos', category: 'HARDWARE', description: 'Comunicação com balanças, leitores e gavetas de dinheiro' },
  'hardware.printer': { id: 'hardware.printer', name: 'Hardware de Impressão', category: 'HARDWARE', description: 'Acesso a periféricos de impressão' },

  // Network & Integrations
  'network': { id: 'network', name: 'Rede & Internet', category: 'NETWORK', description: 'Comunicação de rede com serviços externos' },
  'network.outbound': { id: 'network.outbound', name: 'Conexões de Saída', category: 'NETWORK', description: 'Disparo de requisições HTTPS para endpoints externos' },
  'network.webhooks': { id: 'network.webhooks', name: 'Recepção de Webhooks', category: 'NETWORK', description: 'Recepção de eventos em tempo real' },
  'network.sync': { id: 'network.sync', name: 'Sincronismo com Nuvem', category: 'NETWORK', description: 'Sincronização de transações offline com o servidor Central' },

  // Notifications & Messaging
  'notifications': { id: 'notifications', name: 'Notificações do Sistema', category: 'NOTIFICATIONS', description: 'Exibição de toasts e alertas ao operador' },
  'notifications.send': { id: 'notifications.send', name: 'Envio de Notificações', category: 'NOTIFICATIONS', description: 'Envio de alertas ao operador' },
  'messaging.send': { id: 'messaging.send', name: 'Disparo de Mensagens', category: 'NOTIFICATIONS', description: 'Envio de mensagens a clientes' },
  'messaging.receive': { id: 'messaging.receive', name: 'Recepção de Mensagens', category: 'NOTIFICATIONS', description: 'Recebimento de mensagens' },

  // System & Diagnostics
  'system.read': { id: 'system.read', name: 'Leitura de Diagnósticos', category: 'SYSTEM', description: 'Acesso a métricas de CPU, memória e status da aplicação' },
  'system.write': { id: 'system.write', name: 'Configurações do Sistema', category: 'SYSTEM', description: 'Ajuste de preferências globais e perfil de rede' },
  'diagnostics.read': { id: 'diagnostics.read', name: 'Diagnósticos de Conectividade', category: 'SYSTEM', description: 'Monitoramento da saúde dos periféricos e outbox' },

  // Domain Business
  'sales.read': { id: 'sales.read', name: 'Consulta de Vendas', category: 'SALES', description: 'Visualização de pedidos e fluxo de balcão' },
  'sales.write': { id: 'sales.write', name: 'Abertura e Baixa de Vendas', category: 'SALES', description: 'Registro de vendas e fechamento de pedidos' },
  'products.read': { id: 'products.read', name: 'Consulta de Produtos', category: 'SALES', description: 'Consulta ao catálogo e preços' },
  'products.write': { id: 'products.write', name: 'Gestão de Produtos', category: 'SALES', description: 'Cadastro e alteração de itens de estoque' },
  'customers.read': { id: 'customers.read', name: 'Consulta de Clientes', category: 'SALES', description: 'Acesso a dados cadastrais de clientes' },
  'customers.write': { id: 'customers.write', name: 'Cadastro de Clientes', category: 'SALES', description: 'Edição de fichas cadastrais' },
  'finance.read': { id: 'finance.read', name: 'Leitura Financeira', category: 'SALES', description: 'Consulta a saldos e extratos' },
  'finance.write': { id: 'finance.write', name: 'Movimentações de Caixa', category: 'SALES', description: 'Lançamento de sangrias e suprimentos' },
  'orders.read': { id: 'orders.read', name: 'Consulta de Pedidos', category: 'SALES', description: 'Leitura de comandas e pedidos' },
  'orders.write': { id: 'orders.write', name: 'Gestão de Pedidos', category: 'SALES', description: 'Criação e despacho de pedidos' },
  'tables.read': { id: 'tables.read', name: 'Consulta de Mesas', category: 'SALES', description: 'Status das mesas do salão' },
  'tables.write': { id: 'tables.write', name: 'Gestão de Mesas', category: 'SALES', description: 'Abertura e fechamento de mesas' }
};

export const CANONICAL_PERMISSION_IDS = Object.keys(PLATFORM_PERMISSIONS);
