import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DeviceService } from '../../../../core/device/device.service';
import { HardwareService, Peripheral } from '../../../../core/hardware/hardware.service';
import { PrinterService } from '../../../../core/printing/printer.service';
import { ConfigurationService } from '../../../../core/configuration/configuration.service';
import { DiagnosticsService } from '../../../../core/diagnostics/diagnostics.service';
import { UpdateService } from '../../../../core/update/update.service';
import { StorageService } from '../../../../core/storage/storage.service';
import { SyncService } from '../../../../core/sync/sync.service';
import { AppRuntimeService } from '../../../../core/app-runtime/app-runtime.service';
import { IdentityService } from '../../../../core/identity/identity.service';

import { OsProfileService, OsProfileType, OS_PROFILES } from '../../../../core/os-profile/os-profile.service';
import { LinuxThemeService } from '../../../../core/theme/linux-theme.service';

type SettingsTab = 'profile' | 'billing' | 'device' | 'hardware' | 'printing' | 'configuration' | 'diagnostics' | 'update' | 'sync';

export interface InvoiceItem {
  description: string;
  amount: number;
  type: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  companyId: string;
  companyName: string;
  billingPeriod: string;
  issueDate: string;
  dueDate: string;
  paidAt?: string;
  status: string;
  subtotal: number;
  discount: number;
  totalAmount: number;
  items: InvoiceItem[];
}

export interface PaymentOrder {
  id: string;
  invoiceId: string;
  companyId: string;
  paymentMethod: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  gatewayReference?: string;
  qrCode?: string;
  qrCodeCopyPaste?: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';
  amount: number;
  createdAt: string;
  confirmedAt?: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './settings.component.html'
})
export class SettingsComponent {
  http = inject(HttpClient);
  deviceService = inject(DeviceService);
  hardwareService = inject(HardwareService);
  printerService = inject(PrinterService);
  configService = inject(ConfigurationService);
  diagnosticsService = inject(DiagnosticsService);
  updateService = inject(UpdateService);
  storageService = inject(StorageService);
  syncService = inject(SyncService);
  appRuntimeService = inject(AppRuntimeService);
  identityService = inject(IdentityService);
  osProfileService = inject(OsProfileService);
  themeService = inject(LinuxThemeService);

  activeTab = signal<SettingsTab>('profile');
  
  // OS Operational Profiles (Retail vs Restaurant)
  activeProfile = this.osProfileService.activeProfile;
  profileDef = this.osProfileService.currentProfileDef;
  availableProfiles = Object.values(OS_PROFILES);

  selectOperationalProfile(profile: OsProfileType) {
    this.osProfileService.setProfile(profile);
    const label = profile === 'retail' ? 'Varejo & Comércio' : 'Restaurantes & Gastronomia';
    this.notify('Modo Operacional Atualizado', `Sistema configurado para ${label}. Os aplicativos pré-instalados foram atualizados.`, 'success');
  }

  // SaaS Billing properties
  invoices = signal<Invoice[]>([]);
  paymentOrders = signal<PaymentOrder[]>([]);
  activePaymentOrder = signal<PaymentOrder | null>(null);
  isLoadingBilling = signal<boolean>(false);
  isConfirmingPayment = signal<boolean>(false);

  // Profile computed getters for active company details
  profileName = computed(() => {
    return this.identityService.currentTenant()?.tenantName || '3eatcru OS Workspace';
  });
  profileCnpj = computed(() => String(this.configService.get('company_cnpj', 'COMPANY') || '12.345.678/0001-99'));
  profileSegment = computed(() => String(this.configService.get('company_segment', 'COMPANY') || (this.activeProfile() === 'restaurant' ? 'Alimentação / Restaurante' : 'Comércio / Varejo')));
  profileEmail = computed(() => String(this.configService.get('company_email', 'COMPANY') || 'contato@3eatcru.com'));
  profilePhone = computed(() => String(this.configService.get('company_phone', 'COMPANY') || '(11) 98765-4321'));
  profileAddress = computed(() => String(this.configService.get('company_address', 'COMPANY') || 'Av. Paulista, 1000 - São Paulo, SP'));
  profileHours = computed(() => String(this.configService.get('company_hours', 'COMPANY') || 'Seg - Sab: 09:00 às 22:00'));
  whatsappSandboxNum = computed(() => String(this.configService.get('whatsapp_sandbox_num', 'COMPANY') || '+55 (11) 98765-4321'));
  ifoodSandboxId = computed(() => String(this.configService.get('ifood_sandbox_id', 'COMPANY') || 'IF-982834'));

  updateProfileValue(key: string, val: string) {
    this.configService.set(key, val, 'COMPANY');
    this.notify('Perfil Atualizado', `Campo de perfil atualizado: ${key}`, 'success');
  }

  // Diagnostic states
  isRunningDiag = this.diagnosticsService.isRunningCheck;
  diagReport = this.diagnosticsService.report;

  // Update states
  updateState = this.updateService.state;

  // Sync states
  syncStatus = this.syncService.syncStatus;
  lastSyncedAt = this.syncService.lastSyncedAt;
  outbox = this.syncService.outbox;
  isOnline = this.syncService.isOnline;

  notify(title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    if (this.appRuntimeService.onNotification) {
      this.appRuntimeService.onNotification(title, message, type);
    } else {
      console.log(`[Settings notification] ${title}: ${message} (${type})`);
    }
  }

  selectTab(tab: SettingsTab) {
    this.activeTab.set(tab);
    if (tab === 'billing') {
      this.loadBillingInfo();
    }
  }

  loadBillingInfo() {
    const companyId = this.identityService.currentTenant()?.tenantId;
    if (!companyId) return;

    this.isLoadingBilling.set(true);
    
    Promise.all([
      firstValueFrom(this.http.get<Invoice[]>(`/api/v1/companies/${companyId}/invoices`)),
      firstValueFrom(this.http.get<PaymentOrder[]>(`/api/v1/companies/${companyId}/payment-orders`))
    ]).then(([invs, orders]) => {
      this.invoices.set(invs);
      this.paymentOrders.set(orders);
      this.isLoadingBilling.set(false);
    }).catch(err => {
      this.notify('Faturamento', `Erro ao carregar dados financeiros: ${err.message}`, 'error');
      this.isLoadingBilling.set(false);
    });
  }

  payInvoice(invoiceId: string) {
    const companyId = this.identityService.currentTenant()?.tenantId;
    if (!companyId) return;

    this.isLoadingBilling.set(true);
    firstValueFrom(this.http.post<{ success: boolean; paymentOrder?: PaymentOrder }>(`/api/v1/companies/${companyId}/invoices/${invoiceId}/pay`, { paymentMethod: 'PIX' }))
      .then(res => {
        if (res.success && res.paymentOrder) {
          this.activePaymentOrder.set(res.paymentOrder);
          this.notify('Pix Gerado', 'QR Code Pix copia-e-cola gerado com sucesso!', 'success');
          this.loadBillingInfo();
        } else {
          this.notify('Faturamento', 'Falha ao criar ordem de pagamento.', 'error');
        }
        this.isLoadingBilling.set(false);
      })
      .catch(err => {
        this.notify('Faturamento', `Erro: ${err.message}`, 'error');
        this.isLoadingBilling.set(false);
      });
  }

  confirmPayment(orderId: string) {
    const companyId = this.identityService.currentTenant()?.tenantId;
    if (!companyId) return;

    this.isConfirmingPayment.set(true);
    firstValueFrom(this.http.post<{ success: boolean }>(`/api/v1/companies/${companyId}/payment-orders/${orderId}/confirm`, {}))
      .then(res => {
        if (res.success) {
          this.notify('Pagamento Confirmado', 'O gateway processou o Pix e reativou o seu Workspace!', 'success');
          this.activePaymentOrder.set(null);
          this.loadBillingInfo();
          
          this.identityService.verifySession();
        } else {
          this.notify('Faturamento', 'Não foi possível confirmar o pagamento.', 'error');
        }
        this.isConfirmingPayment.set(false);
      })
      .catch(err => {
        this.notify('Faturamento', `Erro ao confirmar pagamento: ${err.message}`, 'error');
        this.isConfirmingPayment.set(false);
      });
  }

  // Device actions
  pair(name: string) {
    if (name.trim()) this.deviceService.pairDevice(name);
  }

  unpair() {
    this.deviceService.unpairDevice();
  }

  // Hardware actions
  togglePeripheralStatus(p: Peripheral) {
    const nextStatus = p.status === 'online' ? 'offline' : p.status === 'offline' ? 'no_paper' : 'online';
    this.hardwareService.updateStatus(p.id, nextStatus);
  }

  // Printing actions
  testPrint() {
    this.printerService.print('Teste de Impressão OS', 'Este é um teste do subsistema de impressão modular 3EATCRU.')
      .then(() => this.notify('Spooler de Impressão', 'Documento enviado para fila de impressão com sucesso!', 'success'))
      .catch(err => this.notify('Falha na Impressão', err.message, 'error'));
  }

  // Diagnostics actions
  runDiagnostics() {
    this.diagnosticsService.runDiagnostic();
  }

  // Update actions
  checkUpdates() {
    this.updateService.checkForUpdates().then(() => {
      this.notify('Atualização', 'Verificação de atualizações concluída!', 'info');
    });
  }

  installUpdate() {
    this.updateService.installUpdate().then(() => {
      this.notify('Sistema Atualizado', 'Sistema atualizado com sucesso para ' + this.updateState().currentVersion, 'success');
    });
  }

  // Sync actions
  toggleOnline() {
    this.syncService.toggleOnlineStatus();
  }

  triggerSync() {
    this.syncService.sync().then(() => {
      this.notify('Sincronização', 'Sincronização concluída com sucesso!', 'success');
    }).catch(err => {
      this.notify('Sincronização', `Erro de Sincronização: ${err.message}`, 'error');
    });
  }

  queueTestOp() {
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
    const companyId = this.identityService.currentTenant()?.tenantId || this.deviceService.deviceState().companyId;
    if (!companyId) {
      this.notify('Sincronização', 'Nenhum contexto de empresa ativo.', 'error');
      return;
    }
    this.syncService.queueOperation(
      'sale.create',
      {
        id: `sale_${uuid}`,
        companyId,
        total: 150.00,
        paymentMethod: 'PIX',
        items: [{ productId: 'prod_1', name: 'Item Teste de Sincronismo', price: 150.00, quantity: 1 }],
        createdAt: new Date().toISOString()
      }
    );
  }

  // Peripheral simulation states
  scaleWeight = signal<number>(0.000);
  scaleStable = signal<boolean>(false);
  customerDisplayLine1 = signal<string>('BEM VINDO AO OS');
  customerDisplayLine2 = signal<string>('3EATCRU PLATFORM');
  scannedBarcode = signal<string>('7891000315504');

  simulateScaleRead() {
    this.hardwareService.readScaleWeight().then(reading => {
      this.scaleWeight.set(reading.weightKg);
      this.scaleStable.set(reading.isStable);
      this.notify('Leitura da Balança', `Peso lido: ${reading.weightKg.toFixed(3)} Kg (Estável)`, 'success');
    }).catch(err => {
      this.notify('Falha na Balança', err.message, 'error');
    });
  }

  simulateBarcodeScan(code: string) {
    if (!code) return;
    this.scannedBarcode.set(code);
    this.notify('Barcode Capturado', `Leitor decodificou: ${code}`, 'success');
  }

  simulateCustomerDisplay(line1: string, line2: string) {
    this.hardwareService.sendCustomerDisplay(line1, line2).then(success => {
      if (success) {
        this.customerDisplayLine1.set(line1);
        this.customerDisplayLine2.set(line2);
        this.notify('Display do Cliente', 'Mensagem atualizada no display VFD.', 'success');
      } else {
        this.notify('Display do Cliente', 'Falha ao enviar mensagem (Display offline).', 'warning');
      }
    });
  }
}
