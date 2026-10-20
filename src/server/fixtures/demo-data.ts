import crypto from 'node:crypto';
import { 
  CompanyData, 
  TenantUserData, 
  HqAdminData, 
  CompanyLedgerEntry, 
  CustomerData, 
  ProductData, 
  PublicSpaceData, 
  TableData,
  PlanDefinition
} from '../state.js';
import { hashPassword } from '../config.js';

const devMfaSecret: string = process.env['HQ_ADMIN_MFA_SECRET'] || crypto.randomBytes(20).toString('hex').toUpperCase();

/**
 * 3EATCRU OS - Development & Demo Fixtures
 * Este arquivo isola os dados de demonstração (seed) do runtime corporativo de produção.
 */

export function getDemoPlans(): PlanDefinition[] {
  return [
    {
      id: 'starter',
      name: 'Plano Starter',
      monthlyPrice: 99.00,
      maxTerminals: 2,
      maxBranches: 1,
      description: 'Ideal para pequenos comércios e operações de balcão único.',
      includedApps: ['app_settings', 'app_pos', 'app_public_space'],
      features: ['Até 2 terminais ativos', '1 Filial / Matriz única', 'Suporte a cupom térmico', 'Website público com cardápio', 'Atualizações estáveis do Core OS']
    },
    {
      id: 'pro',
      name: 'Plano Profissional',
      monthlyPrice: 249.00,
      maxTerminals: 5,
      maxBranches: 3,
      description: 'Perfeito para restaurantes, lojas e operações com estoque e CRM.',
      includedApps: ['app_settings', 'app_pos', 'app_inventory', 'app_crm', 'app_finance', 'app_tables', 'app_public_space'],
      features: ['Até 5 terminais simultâneos', 'Até 3 filiais sincronizadas', 'Gestão avançada de estoque e fichas', 'Clube de fidelidade e CRM', 'Fluxo de caixa e fechamento cego', 'Mesas e tela de cozinha (KDS)']
    },
    {
      id: 'enterprise',
      name: 'Plano Enterprise',
      monthlyPrice: 499.00,
      maxTerminals: 99,
      maxBranches: 20,
      description: 'Infraestrutura corporativa com terminais ilimitados e acesso antecipado.',
      includedApps: ['app_settings', 'app_pos', 'app_inventory', 'app_crm', 'app_finance', 'app_tables', 'app_public_space', 'app_hr', 'app_analytics'],
      features: ['Terminais ilimitados', 'Até 20 filiais em rede', 'Acesso a canais Beta/Canary do OS', 'SLA prioritário 24/7', 'Módulos customizados e webhooks corporativos']
    }
  ];
}

export function getDemoHqAdmins(): HqAdminData[] {
  const adminEmail = process.env['HQ_ADMIN_EMAIL'] || 'admin@3eatcru.com';
  const adminPassword = process.env['HQ_ADMIN_PASSWORD'] || process.env['HQ_ADMIN_SECRET'] || '3eatcru_HQ_SecurePass_2026!';
  const mfaSecret = devMfaSecret;

  return [
    {
      id: 'hq_admin_1',
      name: 'Administrador 3eatcru HQ',
      email: adminEmail,
      password: hashPassword(adminPassword),
      role: 'hq_admin',
      mfaEnabled: true,
      mfaSecret: mfaSecret
    }
  ];
}

export function getDemoCompanies(): [string, CompanyData][] {
  return [
    ['comp_burger', { 
      id: 'comp_burger', 
      name: 'Burger & Co Gourmet', 
      isDemo: true,
      balance: 1751, 
      installedApps: ['app_settings', 'app_pos', 'app_inventory', 'app_tables', 'app_crm', 'app_finance', 'app_public_space'], 
      status: 'active',
      plan: 'pro',
      maxTerminals: 5,
      activeTerminals: 2,
      channel: 'stable',
      osTargetVersion: '1.1.0-lts',
      licenseExpiresAt: '2026-12-31',
      allowNegativeStock: false,
      branches: [
        { id: 'br_burger_1', companyId: 'comp_burger', name: 'Matriz Jardins', address: 'Rua Augusta, 1500 - Consolação, São Paulo, SP', phone: '(11) 98888-1111', isActive: true, isMain: true },
        { id: 'br_burger_2', companyId: 'comp_burger', name: 'Unidade Vila Madalena', address: 'Rua Fradique Coutinho, 450 - Pinheiros, São Paulo, SP', phone: '(11) 98888-2222', isActive: true }
      ]
    }],
    ['comp_fashion', { 
      id: 'comp_fashion', 
      name: 'Fashion Varejo', 
      isDemo: true,
      balance: 800, 
      installedApps: ['app_settings', 'app_pos', 'app_inventory', 'app_public_space', 'app_crm', 'app_finance'], 
      status: 'active',
      plan: 'pro',
      maxTerminals: 5,
      activeTerminals: 1,
      channel: 'stable',
      osTargetVersion: '1.1.0-lts',
      licenseExpiresAt: '2026-12-31',
      allowNegativeStock: true,
      branches: [
        { id: 'br_fashion_1', companyId: 'comp_fashion', name: 'Unidade Oscar Freire', address: 'Rua Oscar Freire, 800 - Jardins, São Paulo, SP', phone: '(11) 97777-6666', isActive: true, isMain: true }
      ]
    }],
    ['comp_pet', { 
      id: 'comp_pet', 
      name: 'Pet Care Clinica', 
      isDemo: true,
      balance: 1500, 
      installedApps: ['app_settings', 'app_public_space'], 
      status: 'active',
      plan: 'starter',
      maxTerminals: 2,
      activeTerminals: 1,
      channel: 'stable',
      osTargetVersion: '1.1.0-lts',
      licenseExpiresAt: '2026-12-31',
      allowNegativeStock: false,
      branches: [
        { id: 'br_pet_1', companyId: 'comp_pet', name: 'Unidade Jardins', address: 'Al. Lorena, 1200 - Jardins, São Paulo, SP', phone: '(11) 96666-5555', isActive: true, isMain: true }
      ]
    }]
  ];
}

export function getDemoCompanyUsers(): [string, TenantUserData[]][] {
  return [
    ['comp_burger', [
      { id: 'usr_b1', companyId: 'comp_burger', name: 'Marcelo Oliveira (Gerente)', email: 'marcelo@burger3e.com', pin: hashPassword('1234'), password: hashPassword('Adim1234'), role: 'admin', status: 'active', createdAt: '2026-08-10' },
      { id: 'usr_b2', companyId: 'comp_burger', name: 'Lucas Souza (Operador Caixa)', email: 'lucas@burger3e.com', pin: hashPassword('1234'), role: 'operator', status: 'active', createdAt: '2026-08-12' },
      { id: 'usr_b3', companyId: 'comp_burger', name: 'Fernanda Lima (Cozinha KDS)', email: 'fernanda@burger3e.com', pin: hashPassword('1234'), role: 'operator', status: 'active', createdAt: '2026-08-15' },
      { id: 'usr_b_demo', companyId: 'comp_burger', name: 'Gerente Geral', email: 'gerente@3eatcru.com', pin: hashPassword('1234'), password: hashPassword('Adim1234'), role: 'admin', status: 'active', createdAt: '2026-08-01' }
    ]],
    ['comp_fashion', [
      { id: 'usr_f1', companyId: 'comp_fashion', name: 'Camila Rocha (Administradora)', email: 'camila@fashionvarejo.com', pin: hashPassword('1234'), password: hashPassword('Adim1234'), role: 'admin', status: 'active', createdAt: '2026-08-05' },
      { id: 'usr_f2', companyId: 'comp_fashion', name: 'Pedro Henrique (Vendedor/Caixa)', email: 'pedro@fashionvarejo.com', pin: hashPassword('1234'), role: 'operator', status: 'active', createdAt: '2026-08-20' },
      { id: 'usr_f_demo', companyId: 'comp_fashion', name: 'Gerente Geral', email: 'gerente@3eatcru.com', pin: hashPassword('1234'), password: hashPassword('Adim1234'), role: 'admin', status: 'active', createdAt: '2026-08-01' }
    ]],
    ['comp_pet', [
      { id: 'usr_p1', companyId: 'comp_pet', name: 'Dra. Vanessa Martins', email: 'vanessa@petcare.com', pin: hashPassword('1234'), password: hashPassword('Adim1234'), role: 'admin', status: 'active', createdAt: '2026-08-25' },
      { id: 'usr_p_demo', companyId: 'comp_pet', name: 'Gerente Geral', email: 'gerente@3eatcru.com', pin: hashPassword('1234'), password: hashPassword('Adim1234'), role: 'admin', status: 'active', createdAt: '2026-08-01' }
    ]]
  ];
}

export function getDemoLedger(): [string, CompanyLedgerEntry[]][] {
  return [
    ['comp_burger', [
      { id: 'ldg_b1', companyId: 'comp_burger', type: 'CREDIT_ADDED', amount: 1500.00, previousBalance: 0, newBalance: 1500.00, description: 'Aporte inicial de créditos corporativos', timestamp: '2026-08-01T10:00:00Z' },
      { id: 'ldg_b2', companyId: 'comp_burger', type: 'PLAN_CHARGE', amount: -249.00, previousBalance: 1500.00, newBalance: 1251.00, description: 'Mensalidade Plano Pro (Ciclo Agosto)', timestamp: '2026-08-01T10:05:00Z' },
      { id: 'ldg_b3', companyId: 'comp_burger', type: 'CREDIT_ADDED', amount: 500.00, previousBalance: 1251.00, newBalance: 1751.00, description: 'Recarga via PIX Corporativo', timestamp: '2026-09-01T09:00:00Z' }
    ]],
    ['comp_fashion', [
      { id: 'ldg_f1', companyId: 'comp_fashion', type: 'CREDIT_ADDED', amount: 1000.00, previousBalance: 0, newBalance: 1000.00, description: 'Ativação de conta SaaS', timestamp: '2026-08-05T14:00:00Z' },
      { id: 'ldg_f2', companyId: 'comp_fashion', type: 'PLAN_CHARGE', amount: -249.00, previousBalance: 1000.00, newBalance: 751.00, description: 'Mensalidade Plano Pro', timestamp: '2026-08-05T14:05:00Z' }
    ]]
  ];
}

export function getDemoCustomers(): [string, CustomerData][] {
  return [
    ['cust_1', {
      id: 'cust_1',
      companyId: 'comp_burger',
      name: 'Carlos Eduardo Silva',
      phone: '(11) 98765-4321',
      email: 'carlos.silva@email.com',
      points: 145,
      totalSpent: 420.50,
      tier: 'Silver',
      createdAt: '2026-08-10'
    }],
    ['cust_2', {
      id: 'cust_2',
      companyId: 'comp_burger',
      name: 'Mariana Costa Guimarães',
      phone: '(11) 97777-8888',
      email: 'mariana.costa@email.com',
      points: 380,
      totalSpent: 1290.00,
      tier: 'Gold',
      createdAt: '2026-08-12'
    }]
  ];
}

export function getDemoProducts(): [string, ProductData][] {
  return [
    // Burger & Co products
    ['prod_1', { id: 'prod_1', companyId: 'comp_burger', name: 'Cheeseburger Clássico 180g', price: 34.90, stock: 45 }],
    ['prod_2', { id: 'prod_2', companyId: 'comp_burger', name: 'Burger Duplo Cheddar & Bacon', price: 42.50, stock: 32 }],
    ['prod_3', { id: 'prod_3', companyId: 'comp_burger', name: 'Smash Trufado com Maionese Verde', price: 38.00, stock: 28 }],
    ['prod_4', { id: 'prod_4', companyId: 'comp_burger', name: 'Batata Rústica com Alecrim e Páprica', price: 22.00, stock: 60 }],
    ['prod_5', { id: 'prod_5', companyId: 'comp_burger', name: 'Refrigerante Orgânico Lata 350ml', price: 9.00, stock: 80 }],
    // Fashion Varejo products
    ['prod_f1', { id: 'prod_f1', companyId: 'comp_fashion', name: 'Camiseta Algodão Egípcio Premium', price: 119.90, stock: 25 }],
    ['prod_f2', { id: 'prod_f2', companyId: 'comp_fashion', name: 'Calça Jeans Slim Denim Black', price: 249.00, stock: 18 }],
    ['prod_f3', { id: 'prod_f3', companyId: 'comp_fashion', name: 'Jaqueta Corta-Vento Minimalist', price: 320.00, stock: 12 }],
    // Pet Care products & services
    ['prod_p1', { id: 'prod_p1', companyId: 'comp_pet', name: 'Consulta Veterinária Geral & Check-up', price: 180.00, stock: 99 }],
    ['prod_p2', { id: 'prod_p2', companyId: 'comp_pet', name: 'Banho & Tosa Higiênica Completa', price: 95.00, stock: 99 }],
    ['prod_p3', { id: 'prod_p3', companyId: 'comp_pet', name: 'Ração Super Premium Cães 15kg', price: 289.90, stock: 15 }]
  ];
}

export function getDemoTables(): [string, TableData][] {
  return [
    ['tbl_1', { id: 'tbl_1', companyId: 'comp_burger', number: 1, name: 'Mesa 01 (Janela)', capacity: 4, status: 'AVAILABLE' }],
    ['tbl_2', { id: 'tbl_2', companyId: 'comp_burger', number: 2, name: 'Mesa 02 (Salão Central)', capacity: 2, status: 'AVAILABLE' }],
    ['tbl_3', { id: 'tbl_3', companyId: 'comp_burger', number: 3, name: 'Mesa 03 (Lounge)', capacity: 6, status: 'AVAILABLE' }],
    ['tbl_4', { id: 'tbl_4', companyId: 'comp_burger', number: 4, name: 'Mesa 04 (Varanda)', capacity: 4, status: 'AVAILABLE' }],
    ['tbl_5', { id: 'tbl_5', companyId: 'comp_burger', number: 5, name: 'Mesa 05 (Bistrô)', capacity: 2, status: 'AVAILABLE' }]
  ];
}

export function getDemoPublicSpaces(): [string, PublicSpaceData][] {
  return [
    ['comp_burger', {
      companyId: 'comp_burger',
      companySlug: 'burger-co-gourmet',
      title: 'Burger & Co Gourmet',
      description: 'Hambúrgueres artesanais defumados na brasa com ingredientes selecionados e pão de fermentação natural.',
      logo: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=200&h=200&fit=crop&crop=faces',
      templateId: 'restaurant',
      themeColor: '#f97316',
      status: 'published',
      publishedAt: '2026-08-01',
      phone: '(11) 98888-1111',
      email: 'contato@burger3e.com',
      address: 'Rua Augusta, 1500 - Consolação, São Paulo - SP',
      hours: 'Seg a Dom: 11h30 às 23h30',
      products: [
        { name: 'Cheeseburger Clássico 180g', price: 34.90, desc: 'Blend bovino Angus, queijo prato artesanal derretido e picles no pão brioche' },
        { name: 'Burger Duplo Cheddar & Bacon', price: 42.50, desc: 'Dois smashs de 100g, cheddar inglês cremoso e fatias de bacon crocante' },
        { name: 'Batata Rústica com Alecrim e Páprica', price: 22.00, desc: 'Batatas selecionadas crocantes com tempero especial da casa e maionese verde' }
      ]
    }],
    ['comp_fashion', {
      companyId: 'comp_fashion',
      companySlug: 'fashion-varejo',
      title: 'Fashion Varejo Concept',
      description: 'Moda urbana contemporânea, tecidos sustentáveis e coleções exclusivas de alta durabilidade.',
      logo: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&h=200&fit=crop&crop=faces',
      templateId: 'retail',
      themeColor: '#0ea5e9',
      status: 'published',
      publishedAt: '2026-08-05',
      phone: '(11) 97777-6666',
      email: 'contato@fashionvarejo.com',
      address: 'Rua Oscar Freire, 800 - Jardins, São Paulo - SP',
      hours: 'Seg a Sáb: 10h00 às 20h00',
      products: [
        { name: 'Camiseta Algodão Egípcio Premium', price: 119.90, desc: 'Toque macio de alta densidade, modelagem oversized moderna' },
        { name: 'Calça Jeans Slim Denim Black', price: 249.00, desc: 'Denim com elastano premium para máximo conforto e estilo urbano' },
        { name: 'Jaqueta Corta-Vento Minimalist', price: 320.00, desc: 'Impermeável, leve e respirável com acabamento térmico premium' }
      ]
    }],
    ['comp_pet', {
      companyId: 'comp_pet',
      companySlug: 'pet-care-clinica',
      title: 'Pet Care Clínica & Estética Animal',
      description: 'Cuidado veterinário especializado, exames preventivos, estética canina e felina com amor e carinho.',
      logo: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=200&h=200&fit=crop&crop=faces',
      templateId: 'business',
      themeColor: '#10b981',
      status: 'published',
      publishedAt: '2026-08-25',
      phone: '(11) 96666-5555',
      email: 'vanessa@petcare.com',
      address: 'Al. Lorena, 1200 - Jardins, São Paulo - SP',
      hours: 'Seg a Sex: 08h00 às 18h00',
      products: [
        { name: 'Consulta Veterinária Geral & Check-up', price: 180.00, desc: 'Avaliação clínica completa, anamnese detalhada e orientações de saúde' },
        { name: 'Banho & Tosa Higiênica Completa', price: 95.00, desc: 'Shampoo hipoalergênico, hidratação profunda, corte de unhas e limpeza auricular' },
        { name: 'Ração Super Premium Cães 15kg', price: 289.90, desc: 'Fórmula completa rica em proteínas nobres, ômega 3 e minerais orgânicos' }
      ]
    }]
  ];
}
