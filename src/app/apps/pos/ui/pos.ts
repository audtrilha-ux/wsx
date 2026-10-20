import { Component, ChangeDetectionStrategy, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { GetProductsUseCase, RegisterSaleUseCase, GetSalesUseCase, CancelSaleUseCase } from '../application/pos.usecases';
import { GetCustomersUseCase, AddCustomerPointsUseCase } from '../../crm/application/crm.usecases';
import { Product, SaleItem, Sale } from '../domain/pos.entity';
import { OsSdkService } from '../../../sdk/os-sdk.service';
import { OsContext } from '../../../contracts/os/os-context.contract';
import { IEventSubscription } from '../../../contracts/events/events.contract';
import { PosProductGridComponent } from './components/pos-product-grid.component';
import { PosCartComponent, PosCustomerOption, DiscountDetails } from './components/pos-cart.component';

export interface RemoteOrderNotification {
  orderId: string;
  customerName: string;
  total: number;
  items: { product: { name: string; price: number }; quantity: number }[];
  channel: string;
}

@Component({
  selector: 'app-pos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, 
    MatIconModule, 
    PosProductGridComponent, 
    PosCartComponent
  ],
  host: {
    '(window:keydown)': 'handleGlobalKeydown($event)'
  },
  templateUrl: './pos.component.html'
})
export class PosComponent implements OnInit, OnDestroy {
  private getProductsUseCase = inject(GetProductsUseCase);
  private registerSaleUseCase = inject(RegisterSaleUseCase);
  private getSalesUseCase = inject(GetSalesUseCase);
  private cancelSaleUseCase = inject(CancelSaleUseCase);
  private getCustomersUseCase = inject(GetCustomersUseCase);
  private addCustomerPointsUseCase = inject(AddCustomerPointsUseCase);
  private osSdk = inject(OsSdkService);

  // Contexto soberano fornecido pelo OS SDK
  app: OsContext = this.osSdk.bind('app_pos');

  products = signal<Product[]>([]);
  customers = signal<PosCustomerOption[]>([]);
  selectedCustomerId = signal<string>('');
  selectedPaymentMethod = signal<string>('PIX');
  cart = signal<{ product: Product; quantity: number }[]>([]);
  isProcessing = signal(false);
  saleSuccessMessage = signal<string>('');
  saleErrorMessage = signal<string>('');
  incomingOrders = signal<RemoteOrderNotification[]>([]);

  // Vendas recentes e cancelamento
  showSalesHistory = signal(false);
  salesHistory = signal<Sale[]>([]);
  confirmCancelId = signal<string>('');

  // Barcode Keyboard Wedge Emulator State
  private barcodeBuffer = '';
  private lastKeystrokeTime = 0;

  private orderSubscription: IEventSubscription | null = null;

  async ngOnInit() {
    await this.loadProducts();
    await this.loadCustomers();
    await this.loadSalesHistory();

    // Inscrever no barramento de eventos do Kernel para receber pedidos remotos em tempo real
    this.orderSubscription = this.app.events.subscribe<RemoteOrderNotification>('marketplace.order_created', (evt) => {
      const order = evt.payload;
      this.incomingOrders.update(current => [order, ...current]);

      // Emite notificação nativa do sistema operacional
      this.app.notify(
        'Novo Pedido Online',
        `Pedido #${order.orderId.slice(-6)} de ${order.customerName} (R$ ${order.total.toFixed(2)})`,
        'info'
      );
    });
  }

  ngOnDestroy() {
    if (this.orderSubscription) {
      this.orderSubscription.unsubscribe();
    }
  }

  // Captura global de teclado para leitor de código de barras físico (wedge mode)
  handleGlobalKeydown(event: KeyboardEvent) {
    const currentTime = Date.now();
    
    // Ignora eventos de teclado se estiver focado em campos de formulário para não interferir nas buscas
    const activeEl = document.activeElement;
    if (activeEl && (
      activeEl.tagName === 'INPUT' || 
      activeEl.tagName === 'SELECT' || 
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.getAttribute('contenteditable') === 'true'
    )) {
      return;
    }

    if (event.key === 'Enter') {
      if (this.barcodeBuffer.length >= 3) {
        this.scanBarcode(this.barcodeBuffer);
        event.preventDefault();
      }
      this.barcodeBuffer = '';
    } else if (event.key.length === 1) { // Apenas teclas de caracteres normais
      if (currentTime - this.lastKeystrokeTime > 50) {
        this.barcodeBuffer = event.key;
      } else {
        this.barcodeBuffer += event.key;
      }
      this.lastKeystrokeTime = currentTime;
    }
  }

  scanBarcode(barcode: string) {
    const trimmed = barcode.trim();
    if (!trimmed) return;

    const prod = this.products().find(p => p.barcode === trimmed);
    if (prod) {
      this.addToCart(prod);
      this.app.notify('Scanner (BIP!)', `${prod.name} adicionado ao carrinho.`, 'success');
      
      // Envia dados do produto ao visor físico/virtual do cliente
      this.app.hardware.sendCustomerDisplay(
        `${prod.name.substring(0, 16).toUpperCase()}`,
        `R$ ${prod.price.toFixed(2)}`
      ).catch((err: unknown) => {
        this.app.logger.warn('Erro ao atualizar visor do cliente', { error: String(err) });
      });
    } else {
      this.app.notify('Código de Barras', `Código ${trimmed} não localizado no catálogo do PDV.`, 'warning');
    }
  }

  acceptIncomingOrder(order: RemoteOrderNotification) {
    // Carregar itens do pedido online diretamente no carrinho do PDV
    for (const item of order.items) {
      const existingProduct = this.products().find(p => p.name.toLowerCase() === item.product.name.toLowerCase());
      if (existingProduct) {
        this.cart.update(curr => {
          const found = curr.find(c => c.product.id === existingProduct.id);
          if (found) {
            return curr.map(c => c.product.id === existingProduct.id ? { ...c, quantity: c.quantity + item.quantity } : c);
          }
          return [...curr, { product: existingProduct, quantity: item.quantity }];
        });
      } else {
        // Cria produto virtual para o item não cadastrado formalmente
        const virtualProd: Product = {
          id: `prod_virtual_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          companyId: this.app.companyId,
          name: item.product.name,
          price: item.product.price,
          stock: 999,
          category: 'Online'
        };
        this.cart.update(curr => [...curr, { product: virtualProd, quantity: item.quantity }]);
      }
    }

    this.dismissIncomingOrder(order.orderId);
    this.app.notify('Pedido Carregado', `Itens do pedido de ${order.customerName} prontos para conferência e fechamento no PDV.`, 'success');
  }

  dismissIncomingOrder(orderId: string) {
    this.incomingOrders.update(curr => curr.filter(o => o.orderId !== orderId));
  }

  async loadProducts() {
    const loaded = await this.getProductsUseCase.execute(this.app.companyId);
    this.products.set(loaded);
  }

  async loadCustomers() {
    try {
      // Carrega clientes diretamente da fonte de verdade única do CRM!
      const raw = await this.getCustomersUseCase.execute(this.app.companyId);
      const mapped: PosCustomerOption[] = raw.map(c => ({
        id: c.id,
        name: c.name,
        points: c.points,
        tier: c.tier.toUpperCase()
      }));
      this.customers.set(mapped);
    } catch (e: unknown) {
      this.app.logger.warn('Erro ao carregar clientes do clube fidelidade do CRM', { error: String(e) });
    }
  }

  async loadSalesHistory() {
    try {
      const sales = await this.getSalesUseCase.execute(this.app.companyId);
      // Ordena por data mais recente
      sales.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      this.salesHistory.set(sales);
    } catch (err: unknown) {
      this.app.logger.error('Erro ao buscar histórico de vendas', { error: String(err) });
    }
  }

  async openSalesHistory() {
    await this.loadSalesHistory();
    this.showSalesHistory.set(true);
  }

  async executeCancelSale(id: string) {
    try {
      this.isProcessing.set(true);
      await this.cancelSaleUseCase.execute(id, this.app.companyId);
      
      this.app.notify('Venda Estornada', `Venda #${id.substring(5, 12).toUpperCase()} cancelada. Estoque recomposto.`, 'success');
      this.saleSuccessMessage.set(`Venda estornada com sucesso e estoque devolvido ao catálogo.`);
      
      // Limpa seletores e atualiza listagens
      this.confirmCancelId.set('');
      await this.loadProducts();
      await this.loadSalesHistory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.saleErrorMessage.set(`Falha ao estornar venda: ${msg}`);
      this.app.notify('Erro ao Estornar', msg, 'error');
    } finally {
      this.isProcessing.set(false);
    }
  }

  addToCart(product: Product) {
    this.cart.update(current => {
      const existing = current.find(item => item.product.id === product.id);
      if (existing) {
        return current.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  }

  handleQuantityChange(event: { productId: string; delta: number }) {
    this.cart.update(current => {
      return current
        .map(item => {
          if (item.product.id === event.productId) {
            const newQty = item.quantity + event.delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter((item): item is { product: Product; quantity: number } => item !== null);
    });
  }

  cartTotal = computed(() => {
    return this.cart().reduce((total, item) => total + (item.product.price * item.quantity), 0);
  });

  async handleOpenDrawer() {
    try {
      const ok = await this.app.hardware.triggerCashDrawer();
      if (ok) {
        this.app.notify('Gaveta de Dinheiro', 'Pulso elétrico RJ12 enviado. Gaveta aberta.', 'info');
      }
    } catch (err: unknown) {
      this.app.notify('Erro de Hardware', `Falha ao acionar gaveta: ${String(err)}`, 'warning');
    }
  }

  async handleReadScale() {
    try {
      const reading = await this.app.hardware.readScale();
      this.app.notify(
        'Balança Comercial',
        `Peso registrado: ${reading.weightKg.toFixed(3)} kg (Estabilizado: ${reading.isStable ? 'Sim' : 'Não'})`,
        'info'
      );
    } catch (err: unknown) {
      this.app.notify('Balança', `Falha na leitura: ${String(err)}`, 'warning');
    }
  }

  async finishSale(discountDetails: DiscountDetails) {
    if (this.cart().length === 0) return;
    
    this.isProcessing.set(true);
    this.saleSuccessMessage.set('');
    this.saleErrorMessage.set('');

    const cartSnapshot = [...this.cart()];
    const originalTotal = this.cartTotal();
    const discountAmount = discountDetails.discountAmount;
    const finalTotal = Math.max(0, originalTotal - discountAmount);
    
    const customerId = this.selectedCustomerId();
    const paymentMethod = this.selectedPaymentMethod();

    try {
      const items: SaleItem[] = cartSnapshot.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity,
        total: item.product.price * item.quantity
      }));
      
      const createdSale = await this.registerSaleUseCase.execute({
        companyId: this.app.companyId,
        items,
        total: finalTotal,
        paymentMethod,
        status: 'COMPLETED',
        discount: discountAmount,
        discountType: discountDetails.discountType,
        discountValue: discountDetails.discountValue,
        originalTotal: originalTotal
      }, this.app.companyId);

      // Se pagamento em dinheiro, abre a gaveta automaticamente
      if (paymentMethod === 'DINHEIRO') {
        await this.app.hardware.triggerCashDrawer();
      }

      // Atualiza display de cliente no hardware
      await this.app.hardware.sendCustomerDisplay(
        `TOTAL: R$ ${finalTotal.toFixed(2)}`,
        'OBRIGADO! VOLTE SEMPRE'
      );

      // Atualização de pontos no clube fidelidade diretamente no CRM (Fonte Única de Verdade)
      let earnedPoints = 0;
      let selectedCustName = '';
      if (customerId) {
        earnedPoints = Math.floor(finalTotal / 10);
        try {
          const result = await this.addCustomerPointsUseCase.execute(customerId, earnedPoints);
          if (result.success && result.customer) {
            selectedCustName = result.customer.name;
            // Publish event to the OS EventBus so CRM and other components sync in real-time
            this.app.events.publish('crm.customer_updated', { customerId, earnedPoints, action: 'Compra no PDV' }, 'app_pos');
          }
        } catch (ptsErr) {
          this.app.logger.warn('Erro ao atualizar pontos de fidelidade no CRM', { error: String(ptsErr) });
        }
        // Recarrega lista de clientes atualizada do CRM
        await this.loadCustomers();
      }

      // Publish sale.completed event to the OS EventBus so Finance, Inventory, and WhatsApp apps sync in real-time
      this.app.events.publish('sale.completed', {
        saleId: createdSale.id,
        total: finalTotal,
        paymentMethod,
        customerId,
        customerName: selectedCustName || 'Cliente Consumidor',
        earnedPoints,
        discount: discountAmount
      }, 'app_pos');
      
      // Auto-Print cupom de venda não fiscal na impressora do OS
      const itemsList = cartSnapshot.map(item => 
        `${item.product.name.padEnd(20)} ${item.quantity}x ${item.product.price.toFixed(2).padStart(8)}`
      ).join('\n');

      const discountText = discountAmount > 0 ? `
DESCONTO OPERACIONAL:       -R$ ${discountAmount.toFixed(2)}` : '';

      const loyaltyText = earnedPoints > 0 ? `
----------------------------------------
CLIENTE: ${selectedCustName.toUpperCase()}
PONTOS GANHOS: +${earnedPoints} pts` : '';

      const receiptContent = `
========================================
       ${this.app.companyName.toUpperCase()}
========================================
DATA: ${new Date().toLocaleString('pt-BR')}
RECIBO: #${createdSale.id.substring(5, 17).toUpperCase()}
PAGAMENTO: ${paymentMethod}
----------------------------------------
ITENS:
${itemsList}
----------------------------------------
SUBTOTAL:                   R$ ${originalTotal.toFixed(2)}${discountText}
TOTAL PAGO:                 R$ ${finalTotal.toFixed(2)}${loyaltyText}
========================================
    Agradecemos a sua preferência!
========================================
`;

      try {
        await this.app.print(`Recibo Venda - R$ ${finalTotal.toFixed(2)}`, receiptContent);
        this.app.notify('Venda Realizada', `Comprovante de venda emitido com sucesso (${paymentMethod}).`, 'success');
        this.saleSuccessMessage.set(`Venda concluída com sucesso! Recibo de venda enviado para a impressora.`);
      } catch (printErr: unknown) {
        const msg = printErr instanceof Error ? printErr.message : 'offline';
        this.saleSuccessMessage.set(`Venda registrada! (Aviso de impressão: ${msg})`);
      }

      // Reset cart and reload listings
      this.cart.set([]);
      this.selectedCustomerId.set('');
      await this.loadProducts();
      await this.loadSalesHistory();
      
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.saleErrorMessage.set(`Falha ao registrar venda: ${msg}`);
      this.app.notify('Erro ao Finalizar', msg, 'error');
    } finally {
      this.isProcessing.set(false);
    }
  }
}
