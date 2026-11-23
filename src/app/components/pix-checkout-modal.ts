import {CurrencyPipe} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {animate} from 'motion';
import {EnxovalStore, PixPreviewResult} from '../core/enxoval-store';
import {EnxovalItem, PurchaseRecord} from '../core/models';
import {KawaiiRibbon} from './kawaii-ornaments';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-pix-checkout-modal',
  imports: [CurrencyPipe, ReactiveFormsModule, MatIconModule, KawaiiRibbon],
  template: `
    @if (liveItem(); as currentItem) {
      <div
        (keydown.escape)="handleClose()"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-rose-100/55 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pix-modal-title"
      >
        <button
          type="button"
          tabindex="-1"
          aria-label="Fechar checkout"
          (click)="handleClose()"
          class="absolute inset-0 w-full h-full cursor-default"
        ></button>
        <div
          #sheetContainer
          class="relative z-10 glass-panel-strong w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] flex flex-col"
        >
          <!-- Mobile Grab Handle -->
          <div class="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
            <span class="w-10 h-1.5 rounded-full bg-rose-300/80"></span>
          </div>

          <!-- Header -->
          <div class="flex items-center justify-between gap-4 px-5 sm:px-6 py-3.5 sm:py-4 border-b border-rose-200/60 bg-white/70 texture-silk-grid shrink-0">
            <div class="flex items-center gap-3 min-w-0">
              <app-kawaii-ribbon [size]="30" />
              <div class="min-w-0">
                <p class="text-xs font-medium text-rose-700 truncate">
                  Presentear Enxoval · {{ currentItem.category }}
                </p>
                <h2 id="pix-modal-title" class="font-display text-base sm:text-lg font-semibold text-rose-950 truncate">
                  {{ currentItem.name }}
                </h2>
              </div>
            </div>
            <button
              type="button"
              (click)="handleClose()"
              aria-label="Fechar checkout"
              class="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-rose-800 hover:bg-rose-100/80 transition-colors cursor-pointer shrink-0"
            >
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <!-- Scrollable Body -->
          <div class="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 texture-cotton-dots">
            @if (confirmedPurchase(); as receipt) {
              <!-- Confirmation Receipt -->
              <div #receiptCard class="rounded-2xl bg-white/85 border border-rose-200 p-6 text-center space-y-4">
                <div class="w-14 h-14 mx-auto rounded-full bg-rose-600 text-white flex items-center justify-center shadow-sm">
                  <mat-icon>check_circle</mat-icon>
                </div>
                <div class="space-y-1">
                  <h3 class="font-display text-2xl font-semibold text-rose-950">
                    Presente Confirmado com Carinho
                  </h3>
                  <p class="text-sm text-rose-800">
                    A lista foi atualizada em tempo real. Restam
                    <strong class="tabular-nums">{{ remainingAfterPurchase() }}</strong>
                    unidade(s) deste item.
                  </p>
                </div>

                <div class="rounded-2xl bg-rose-50/80 border border-rose-200/70 p-4 text-left text-sm space-y-2">
                  <div class="flex justify-between gap-4">
                    <span class="text-rose-700">Presenteado por</span>
                    <span class="font-semibold text-rose-950">{{ receipt.buyerName }}</span>
                  </div>
                  <div class="flex justify-between gap-4">
                    <span class="text-rose-700">Forma escolhida</span>
                    <span class="font-semibold text-rose-950">
                      {{ receipt.paymentMethod === 'loja_externa' ? (receipt.storeName || 'Loja Parceira') : 'Pix Direto ao Criador' }}
                    </span>
                  </div>
                  <div class="flex justify-between gap-4">
                    <span class="text-rose-700">Quantidade deduzida</span>
                    <span class="font-semibold text-rose-950 tabular-nums">{{ receipt.quantity }} un.</span>
                  </div>
                  <div class="flex justify-between gap-4">
                    <span class="text-rose-700">Valor estimado</span>
                    <span class="font-semibold text-rose-950 tabular-nums">
                      {{ receipt.totalAmountBrl | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}
                    </span>
                  </div>
                  <div class="flex justify-between gap-4">
                    <span class="text-rose-700">Identificador TXID</span>
                    <span class="font-mono text-xs text-rose-900">{{ receipt.pixTxid }}</span>
                  </div>
                </div>

                <button
                  type="button"
                  (click)="handleClose()"
                  class="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-all apple-press cursor-pointer whitespace-nowrap"
                >
                  <mat-icon>done</mat-icon>
                  <span>Voltar ao Enxoval</span>
                </button>
              </div>
            } @else {
              <!-- Payment Mode Segmented Selector -->
              <div class="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-rose-100/80">
                <button
                  type="button"
                  (click)="setPaymentMethod('pix')"
                  class="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  [class.bg-white]="paymentMethod() === 'pix'"
                  [class.text-rose-950]="paymentMethod() === 'pix'"
                  [class.shadow-sm]="paymentMethod() === 'pix'"
                  [class.text-rose-800]="paymentMethod() !== 'pix'"
                >
                  <mat-icon class="text-base!">qr_code_2</mat-icon>
                  <span>Pagar com Pix</span>
                </button>
                <button
                  type="button"
                  (click)="setPaymentMethod('loja_externa')"
                  class="min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  [class.bg-white]="paymentMethod() === 'loja_externa'"
                  [class.text-rose-950]="paymentMethod() === 'loja_externa'"
                  [class.shadow-sm]="paymentMethod() === 'loja_externa'"
                  [class.text-rose-800]="paymentMethod() !== 'loja_externa'"
                >
                  <mat-icon class="text-base!">storefront</mat-icon>
                  <span>Comprei na Loja</span>
                </button>
              </div>

              <!-- Active Purchase Form & Live Pix QR -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                <!-- Left Column: Quantity & Buyer Details -->
                <div class="space-y-4">
                  <div class="rounded-2xl bg-white/80 border border-rose-200/70 p-4 space-y-3">
                    <div class="flex items-baseline justify-between gap-2">
                      <span class="text-xs font-medium text-rose-700">Preço atual unitário</span>
                      <span class="text-lg font-bold text-rose-950 tabular-nums">
                        {{ currentItem.unitPriceBrl | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}
                      </span>
                    </div>

                    <div class="flex items-center justify-between gap-3 pt-2 border-t border-rose-100">
                      <div class="text-xs text-rose-800">
                        <div>Quantidade</div>
                        <div class="text-rose-600 tabular-nums">
                          Disponível: {{ maxQty() }} de {{ currentItem.requiredQty }}
                        </div>
                      </div>

                      <div class="flex items-center gap-1.5 bg-rose-50/90 border border-rose-200 rounded-xl p-1">
                        <button
                          type="button"
                          (click)="decrementQty()"
                          [disabled]="selectedQty() <= 1"
                          aria-label="Diminuir quantidade"
                          class="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-rose-900 hover:bg-white disabled:opacity-40 cursor-pointer transition-colors"
                        >
                          <mat-icon>remove</mat-icon>
                        </button>
                        <span class="w-8 text-center font-semibold text-rose-950 tabular-nums">
                          {{ selectedQty() }}
                        </span>
                        <button
                          type="button"
                          (click)="incrementQty()"
                          [disabled]="selectedQty() >= maxQty()"
                          aria-label="Aumentar quantidade"
                          class="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-rose-900 hover:bg-white disabled:opacity-40 cursor-pointer transition-colors"
                        >
                          <mat-icon>add</mat-icon>
                        </button>
                      </div>
                    </div>

                    <div class="flex items-baseline justify-between gap-2 pt-2 border-t border-rose-100">
                      <span class="text-sm font-semibold text-rose-900">Total do Pedido</span>
                      <span #totalPriceEl class="font-display text-2xl font-bold text-rose-700 tabular-nums">
                        {{ totalPrice() | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}
                      </span>
                    </div>
                  </div>

                  <!-- Google account identity link -->
                  <div class="rounded-2xl bg-rose-50/80 border border-rose-200/70 px-3.5 py-2.5 flex items-center justify-between gap-3">
                    @if (store.currentUser(); as user) {
                      <div class="flex items-center gap-2.5 min-w-0">
                        <div class="w-8 h-8 rounded-full bg-rose-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {{ user.name.charAt(0).toUpperCase() }}
                        </div>
                        <div class="min-w-0">
                          <div class="text-xs font-semibold text-rose-950 truncate">{{ user.name }}</div>
                          <div class="text-[11px] text-rose-700 truncate">Conta Google conectada</div>
                        </div>
                      </div>
                      <mat-icon class="text-rose-600 text-lg! shrink-0">verified</mat-icon>
                    } @else {
                      <div class="text-xs text-rose-800">Vincular presente à sua conta Google</div>
                      <button
                        type="button"
                        (click)="store.authModalOpen.set(true)"
                        class="min-h-[40px] px-3 py-1.5 rounded-xl bg-white hover:bg-rose-100 border border-rose-200 text-xs font-semibold text-rose-950 cursor-pointer shrink-0 whitespace-nowrap"
                      >
                        Entrar Google
                      </button>
                    }
                  </div>

                  <form [formGroup]="buyerForm" class="space-y-2.5">
                    <div>
                      <label for="buyer-name" class="block text-xs font-semibold text-rose-900 mb-1">
                        Seu Nome (aparece na dedicatória)
                      </label>
                      <input
                        id="buyer-name"
                        type="text"
                        formControlName="buyerName"
                        placeholder="Ex.: Tia Juliana"
                        class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 placeholder:text-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400"
                      />
                    </div>
                    <div>
                      <label for="buyer-msg" class="block text-xs font-semibold text-rose-900 mb-1">
                        Recadinho para a família (opcional)
                      </label>
                      <input
                        id="buyer-msg"
                        type="text"
                        formControlName="buyerMessage"
                        placeholder="Muitas bênçãos para a chegada do bebê"
                        class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 placeholder:text-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400"
                      />
                    </div>
                  </form>
                </div>

                <!-- Right Column: Scannable Bacen Pix QR Code OR Verified Store Purchase -->
                @if (paymentMethod() === 'pix') {
                  <div #paymentPanel class="rounded-2xl bg-white/90 texture-silk-grid border border-rose-200 p-4 sm:p-5 space-y-3.5">
                    <div class="flex items-center justify-between gap-2">
                      <div class="min-w-0">
                        <p class="text-xs font-semibold text-rose-700">Pix Direto para o Criador</p>
                        <p class="text-xs text-rose-900 font-medium truncate">
                          Titular: {{ store.listConfig().creatorName || 'Criador da Lista' }}
                        </p>
                      </div>
                      <mat-icon class="text-rose-600 shrink-0">qr_code_2</mat-icon>
                    </div>

                    @if (pixLoading()) {
                      <div class="h-52 rounded-2xl bg-rose-50/70 flex items-center justify-center text-xs text-rose-700">
                        Gerando QR Code BR Code oficial...
                      </div>
                    } @else if (pixPreview(); as preview) {
                      <div class="flex flex-col items-center gap-3">
                        <div class="p-2.5 rounded-2xl bg-white border border-rose-200 shadow-sm">
                          <img
                            [src]="preview.qrDataUrl"
                            alt="QR Code Pix para pagamento do enxoval"
                            width="200"
                            height="200"
                            referrerpolicy="no-referrer"
                            class="w-44 h-44 object-contain"
                          />
                        </div>

                        <div class="w-full text-center text-xs text-rose-800 space-y-0.5">
                          <div class="truncate">Chave Pix: <strong>{{ preview.pixKey }}</strong></div>
                          <div class="font-mono text-[11px] text-rose-600">
                            TXID: {{ preview.pixTxid }}
                          </div>
                        </div>

                        <div class="w-full space-y-2">
                          <div class="p-2.5 rounded-xl bg-rose-50/80 border border-rose-200 font-mono text-[11px] text-rose-900 break-all max-h-16 overflow-y-auto">
                            {{ preview.pixPayload }}
                          </div>
                          <button
                            type="button"
                            (click)="copyPixCode(preview.pixPayload)"
                            class="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-100 hover:bg-rose-200/80 text-rose-950 text-xs font-semibold transition-all apple-press cursor-pointer whitespace-nowrap"
                          >
                            <mat-icon class="text-base!">{{ copied() ? 'check' : 'content_copy' }}</mat-icon>
                            <span>{{ copied() ? 'Código Pix Copia e Cola copiado' : 'Copiar Código Pix Copia e Cola' }}</span>
                          </button>
                        </div>

                        <!-- Interactive Bacen BR Code Explainer -->
                        <button
                          type="button"
                          (click)="togglePixGuide()"
                          class="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-rose-50/70 hover:bg-rose-100/70 border border-rose-200/60 flex items-center justify-between text-[11px] font-semibold text-rose-800 cursor-pointer transition-colors"
                        >
                          <span>Como funciona o Pix Oficial (EMV BR Code)</span>
                          <mat-icon class="text-base!">{{ showPixGuide() ? 'expand_less' : 'expand_more' }}</mat-icon>
                        </button>

                        @if (showPixGuide()) {
                          <div class="w-full rounded-xl bg-rose-50/60 border border-rose-200/70 p-3 text-[11px] text-rose-900 space-y-1.5 leading-relaxed">
                            <div><strong>00/01 (EMV Estático):</strong> Padrão oficial Banco Central sem taxa de intermediário — o valor cai direto na conta do criador.</div>
                            <div><strong>26 (DICT):</strong> GUI <code class="font-mono">br.gov.bcb.pix</code> + chave sanitizada do criador.</div>
                            <div><strong>53/54 (Valor):</strong> Moeda <code class="font-mono">986</code> (BRL) e valor exato do presente.</div>
                            <div><strong>62/63 (TXID + CRC-16):</strong> Rastreio único e assinatura CRC-16/CCITT-FALSE validada pelo aplicativo do seu banco.</div>
                          </div>
                        }
                      </div>
                    } @else {
                      <div class="rounded-2xl bg-rose-50/85 border border-rose-200 p-4 text-center space-y-3">
                        <mat-icon class="text-rose-500 text-3xl!">vpn_key</mat-icon>
                        <div class="text-xs text-rose-900 leading-relaxed">
                          A Chave Pix do criador desta lista ainda não foi informada. Você pode comprar em uma loja verificada ou configurar a Chave Pix.
                        </div>
                        <div class="flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            (click)="setPaymentMethod('loja_externa')"
                            class="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                          >
                            <mat-icon class="text-base!">storefront</mat-icon>
                            <span>Comprar em Loja Parceira</span>
                          </button>
                          @if (store.canManageActiveList()) {
                            <button
                              type="button"
                              (click)="requestConfigurePix.emit()"
                              class="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-rose-100 border border-rose-200 text-xs font-semibold text-rose-950 cursor-pointer"
                            >
                              <mat-icon class="text-base!">tune</mat-icon>
                              <span>Configurar Chave Pix</span>
                            </button>
                          }
                        </div>
                      </div>
                    }

                    @if (submitError()) {
                      <p class="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                        {{ submitError() }}
                      </p>
                    }
                  </div>
                } @else {
                  <!-- Verified Partner Store Purchase Selector -->
                  <div #paymentPanel class="rounded-2xl bg-white/85 border border-rose-200 p-4 sm:p-5 space-y-3.5">
                    <div class="space-y-1">
                      <div class="text-xs font-semibold text-rose-700 flex items-center gap-1.5">
                        <mat-icon class="text-base!">verified_user</mat-icon>
                        <span>Compra Direta em Site Verificado</span>
                      </div>
                      <p class="text-xs text-rose-800 leading-relaxed">
                        1. Abra a loja abaixo para finalizar a compra no site oficial. 2. Selecione onde comprou para dar baixa na lista.
                      </p>
                    </div>

                    <div class="space-y-2">
                      @for (offer of currentItem.offers; track offer.storeSlug) {
                        @let isChosen = selectedStoreName() === offer.storeName;
                        @let isCheapest = isLowestOffer(currentItem, offer.priceBrl);
                        <div
                          class="rounded-xl border p-2.5 flex items-center justify-between gap-2 transition-colors"
                          [class.bg-rose-50]="isChosen"
                          [class.border-rose-500]="isChosen"
                          [class.bg-white]="!isChosen"
                          [class.border-rose-200]="!isChosen"
                        >
                          <button
                            type="button"
                            (click)="selectedStoreName.set(offer.storeName)"
                            class="flex-1 min-h-[40px] text-left flex items-center gap-2 cursor-pointer min-w-0"
                          >
                            <mat-icon class="text-base! shrink-0" [class.text-rose-600]="isChosen" [class.text-rose-300]="!isChosen">
                              {{ isChosen ? 'radio_button_checked' : 'radio_button_unchecked' }}
                            </mat-icon>
                            <div class="min-w-0">
                              <div class="text-xs font-semibold text-rose-950 truncate">
                                {{ offer.storeName }}
                                @if (isCheapest) {
                                  <span class="text-[10px] font-bold text-rose-600">· Menor preço</span>
                                }
                              </div>
                              <div class="font-mono text-[11px] text-rose-700 tabular-nums">
                                {{ offer.priceBrl | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}
                              </div>
                            </div>
                          </button>
                          <a
                            [href]="offer.url"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="min-h-[40px] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-950 text-[11px] font-semibold shrink-0 whitespace-nowrap"
                          >
                            <span>Abrir</span>
                            <mat-icon class="text-sm!">open_in_new</mat-icon>
                          </a>
                        </div>
                      }
                    </div>

                    @if (submitError()) {
                      <p class="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                        {{ submitError() }}
                      </p>
                    }
                  </div>
                }
              </div>
            }
          </div>

          <!-- Sticky Bottom CTA Bar (Mobile Thumb Zone & Desktop Confirmation) -->
          @if (!confirmedPurchase()) {
            <div class="px-5 sm:px-6 py-3.5 border-t border-rose-200/60 bg-white/85 backdrop-blur-md shrink-0 space-y-2">
              @if (maxQty() <= 0) {
                <p class="text-xs font-medium text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-center">
                  Todas as unidades deste item acabaram de ser garantidas na lista!
                </p>
              }
              <button
                type="button"
                (click)="submitPurchase()"
                [disabled]="submitting() || maxQty() <= 0 || (paymentMethod() === 'pix' && !pixPreview())"
                class="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-semibold shadow-sm apple-press transition-all cursor-pointer whitespace-nowrap"
              >
                <mat-icon>shopping_bag</mat-icon>
                <span>
                  {{
                    submitting()
                      ? 'Atualizando em tempo real...'
                      : paymentMethod() === 'loja_externa'
                        ? 'Confirmar Compra na Loja e Deduzir'
                        : 'Confirmar Pagamento Pix e Deduzir da Lista'
                  }}
                </span>
              </button>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class PixCheckoutModal {
  protected readonly store = inject(EnxovalStore);
  private readonly sheetRef = viewChild<ElementRef<HTMLElement>>('sheetContainer');
  private readonly paymentPanelRef = viewChild<ElementRef<HTMLElement>>('paymentPanel');
  private readonly totalPriceRef = viewChild<ElementRef<HTMLElement>>('totalPriceEl');
  private readonly receiptCardRef = viewChild<ElementRef<HTMLElement>>('receiptCard');

  readonly item = input<EnxovalItem | null>(null);
  readonly closed = output<void>();
  readonly requestConfigurePix = output<void>();

  readonly selectedQty = signal(1);
  readonly paymentMethod = signal<'pix' | 'loja_externa'>('pix');
  readonly selectedStoreName = signal('Mercado Livre');
  readonly showPixGuide = signal(false);
  readonly pixLoading = signal(false);
  readonly pixPreview = signal<PixPreviewResult | null>(null);
  readonly copied = signal(false);
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly confirmedPurchase = signal<PurchaseRecord | null>(null);

  readonly buyerForm = new FormGroup({
    buyerName: new FormControl('', {nonNullable: true, validators: [Validators.maxLength(60)]}),
    buyerMessage: new FormControl('', {nonNullable: true, validators: [Validators.maxLength(200)]}),
  });

  private lastOpenedItemId: string | null = null;

  readonly liveItem = computed(() => {
    const it = this.item();
    if (!it) return null;
    return this.store.items().find((x) => x.id === it.id) ?? it;
  });

  readonly maxQty = computed(() => {
    const it = this.liveItem();
    if (!it) return 0;
    return Math.max(0, it.requiredQty - it.purchasedQty);
  });

  readonly totalPrice = computed(() => {
    const it = this.liveItem();
    if (!it) return 0;
    return Number((it.unitPriceBrl * this.selectedQty()).toFixed(2));
  });

  readonly remainingAfterPurchase = computed(() => {
    const it = this.liveItem();
    if (!it) return 0;
    return Math.max(0, it.requiredQty - it.purchasedQty);
  });

  constructor() {
    effect(() => {
      const current = this.item();
      const currentId = current?.id ?? null;
      const el = this.sheetRef()?.nativeElement;

      if (!current || !currentId) {
        this.lastOpenedItemId = null;
        this.pixPreview.set(null);
        this.confirmedPurchase.set(null);
        this.submitError.set(null);
        this.selectedQty.set(1);
        this.paymentMethod.set('pix');
        this.showPixGuide.set(false);
        return;
      }

      if (this.lastOpenedItemId !== currentId) {
        this.lastOpenedItemId = currentId;
        if (el && typeof window !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          animate(el, {opacity: [0, 1], y: [28, 0]}, {duration: 0.28, ease: [0.16, 1, 0.3, 1]});
        }
        if (current.offers.length > 0) {
          const cheapest = current.offers.reduce(
            (min, cur) => (cur.priceBrl < min.priceBrl ? cur : min),
            current.offers[0],
          );
          this.selectedStoreName.set(cheapest.storeName);
        }
        const qty = untracked(() => {
          const googleUser = this.store.currentUser();
          if (googleUser && !this.buyerForm.controls.buyerName.value) {
            this.buyerForm.controls.buyerName.setValue(googleUser.name);
          }
          const avail = Math.max(1, current.requiredQty - current.purchasedQty);
          const clamped = Math.min(this.selectedQty(), avail);
          this.selectedQty.set(clamped);
          return clamped;
        });
        void this.refreshPixPreview(current, qty);
      }
    });

    effect(() => {
      const avail = this.maxQty();
      const qty = untracked(() => this.selectedQty());
      if (avail > 0 && qty > avail) {
        this.selectedQty.set(avail);
        const current = untracked(() => this.liveItem());
        if (current) {
          void this.refreshPixPreview(current, avail);
        }
      }
    });

    effect(() => {
      this.paymentMethod();
      const panel = this.paymentPanelRef()?.nativeElement;
      if (!panel || typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      animate(panel, {opacity: [0.35, 1], y: [8, 0]}, {duration: 0.22, ease: [0.16, 1, 0.3, 1]});
    });

    effect(() => {
      this.selectedQty();
      const priceEl = this.totalPriceRef()?.nativeElement;
      if (!priceEl || typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      animate(priceEl, {scale: [1, 1.09, 1]}, {duration: 0.22, ease: [0.16, 1, 0.3, 1]});
    });

    effect(() => {
      const rec = this.confirmedPurchase();
      const card = this.receiptCardRef()?.nativeElement;
      if (rec && card && typeof window !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        animate(card, {opacity: [0, 1], scale: [0.92, 1], y: [10, 0]}, {duration: 0.32, ease: [0.16, 1, 0.3, 1]});
      }
    });
  }

  private async refreshPixPreview(item: EnxovalItem, qty: number): Promise<void> {
    this.pixLoading.set(true);
    try {
      const preview = await this.store.previewPix(item, qty);
      this.pixPreview.set(preview);
    } catch (err) {
      this.submitError.set(err instanceof Error ? err.message : 'Erro ao gerar QR Code Pix.');
    } finally {
      this.pixLoading.set(false);
    }
  }

  setPaymentMethod(method: 'pix' | 'loja_externa'): void {
    this.submitError.set(null);
    this.paymentMethod.set(method);
  }

  togglePixGuide(): void {
    this.showPixGuide.update((v) => !v);
  }

  incrementQty(): void {
    const current = this.liveItem();
    if (!current) return;
    const next = Math.min(this.maxQty(), this.selectedQty() + 1);
    if (next === this.selectedQty()) return;
    this.selectedQty.set(next);
    void this.refreshPixPreview(current, next);
  }

  decrementQty(): void {
    const current = this.liveItem();
    if (!current) return;
    const next = Math.max(1, this.selectedQty() - 1);
    if (next === this.selectedQty()) return;
    this.selectedQty.set(next);
    void this.refreshPixPreview(current, next);
  }

  isLowestOffer(item: EnxovalItem, priceBrl: number): boolean {
    let min = Infinity;
    for (const o of item.offers) {
      if (o.priceBrl < min) min = o.priceBrl;
    }
    return priceBrl <= min;
  }

  async copyPixCode(payload: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(payload);
      this.copied.set(true);
      this.store.showToast('Código Pix Copia e Cola copiado!');
      setTimeout(() => this.copied.set(false), 2500);
    } catch {
      this.copied.set(false);
    }
  }

  async submitPurchase(): Promise<void> {
    const current = this.liveItem();
    if (!current || this.submitting()) return;

    this.submitting.set(true);
    this.submitError.set(null);

    try {
      const {buyerName, buyerMessage} = this.buyerForm.getRawValue();
      const method = this.paymentMethod();
      const result = await this.store.confirmPurchase({
        itemId: current.id,
        quantity: this.selectedQty(),
        buyerName: buyerName.trim() || this.store.currentUser()?.name || 'Convidado Carinhoso',
        buyerMessage: buyerMessage.trim(),
        paymentMethod: method,
        storeName: method === 'loja_externa' ? this.selectedStoreName() : undefined,
        pixTxid: method === 'pix' ? this.pixPreview()?.pixTxid : undefined,
      });
      this.confirmedPurchase.set(result.purchase);
    } catch (err) {
      this.submitError.set(
        err instanceof Error ? err.message : 'Não foi possível concluir a dedução do item.',
      );
    } finally {
      this.submitting.set(false);
    }
  }

  handleClose(): void {
    this.confirmedPurchase.set(null);
    this.buyerForm.reset({buyerName: '', buyerMessage: ''});
    this.closed.emit();
  }
}
