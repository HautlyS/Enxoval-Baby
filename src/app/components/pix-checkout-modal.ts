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
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-[#0F1115]/35 backdrop-blur-sm"
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
          class="relative z-10 bento-card-strong w-full sm:max-w-2xl rounded-t-[28px] sm:rounded-[28px] overflow-hidden max-h-[92vh] flex flex-col text-[#0F1115]"
        >
          <!-- Mobile Grab Handle -->
          <div class="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
            <span class="w-10 h-1.5 rounded-full bg-[#CBD2DD]"></span>
          </div>

          <!-- Header -->
          <div class="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 border-b border-[#E4E7EC] bg-[#F6F7F9] shrink-0">
            <div class="flex items-center gap-3 min-w-0">
              <app-kawaii-ribbon [size]="30" />
              <div class="min-w-0">
                <p class="text-xs font-bold text-[#C2185B] truncate">
                  Presentear Enxoval · {{ currentItem.category }}
                </p>
                <h2 id="pix-modal-title" class="font-display text-base sm:text-lg font-bold text-[#0F1115] truncate">
                  {{ currentItem.name }}
                </h2>
              </div>
            </div>
            <button
              type="button"
              (click)="handleClose()"
              aria-label="Fechar checkout"
              class="apple-press min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#4B5563] hover:text-[#0F1115] hover:bg-[#E4E7EC] cursor-pointer shrink-0"
            >
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <!-- Scrollable Body -->
          <div class="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-white">
            @if (confirmedPurchase(); as receipt) {
              <!-- Confirmation Receipt -->
              <div #receiptCard class="rounded-[24px] bg-[#F6F7F9] border border-[#E4E7EC] p-6 text-center space-y-4">
                <div class="w-14 h-14 mx-auto rounded-full bg-[#FF80AB] text-[#111111] flex items-center justify-center shadow-sm">
                  <mat-icon>check_circle</mat-icon>
                </div>
                <div class="space-y-1">
                  <h3 class="font-display text-2xl font-bold text-[#0F1115]">
                    Presente Confirmado com Carinho
                  </h3>
                  <p class="text-sm text-[#4B5563]">
                    A lista foi atualizada em tempo real. Restam
                    <strong class="text-[#0F1115] tabular-nums">{{ remainingAfterPurchase() }}</strong>
                    unidade(s) deste item.
                  </p>
                </div>

                <div class="rounded-[20px] bg-white border border-[#E4E7EC] p-4 text-left text-sm space-y-2">
                  <div class="flex justify-between gap-4">
                    <span class="text-[#4B5563]">Presenteado por</span>
                    <span class="font-bold text-[#0F1115]">{{ receipt.buyerName }}</span>
                  </div>
                  <div class="flex justify-between gap-4">
                    <span class="text-[#4B5563]">Forma escolhida</span>
                    <span class="font-bold text-[#0F1115]">
                      {{ receipt.paymentMethod === 'loja_externa' ? (receipt.storeName || 'Loja Parceira') : 'Pix Direto ao Criador' }}
                    </span>
                  </div>
                  <div class="flex justify-between gap-4">
                    <span class="text-[#4B5563]">Quantidade deduzida</span>
                    <span class="font-bold text-[#0F1115] tabular-nums">{{ receipt.quantity }} un.</span>
                  </div>
                  <div class="flex justify-between gap-4">
                    <span class="text-[#4B5563]">Valor estimado</span>
                    <span class="font-bold text-[#C2185B] tabular-nums">
                      {{ receipt.totalAmountBrl | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}
                    </span>
                  </div>
                  <div class="flex justify-between gap-4">
                    <span class="text-[#4B5563]">Identificador TXID</span>
                    <span class="font-mono text-xs font-semibold text-[#0F1115]">{{ receipt.pixTxid }}</span>
                  </div>
                </div>

                <button
                  type="button"
                  (click)="handleClose()"
                  class="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#FF80AB] hover:bg-[#F48FB1] text-[#111111] text-sm font-bold apple-press cursor-pointer whitespace-nowrap"
                >
                  <mat-icon>done</mat-icon>
                  <span>Voltar ao Enxoval</span>
                </button>
              </div>
            } @else {
              <!-- Payment Mode Segmented Pill Selector -->
              <div class="grid grid-cols-2 gap-1.5 p-1 rounded-full bg-[#F1F3F6] border border-[#E4E7EC]">
                <button
                  type="button"
                  (click)="setPaymentMethod('pix')"
                  class="apple-press min-h-[42px] px-3 py-2 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  [class.bg-[#FF80AB]]="paymentMethod() === 'pix'"
                  [class.text-[#111111]]="paymentMethod() === 'pix'"
                  [class.font-bold]="paymentMethod() === 'pix'"
                  [class.text-[#4B5563]]="paymentMethod() !== 'pix'"
                >
                  <mat-icon class="text-base!">qr_code_2</mat-icon>
                  <span>Pagar com Pix</span>
                </button>
                <button
                  type="button"
                  (click)="setPaymentMethod('loja_externa')"
                  class="apple-press min-h-[42px] px-3 py-2 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  [class.bg-[#FF80AB]]="paymentMethod() === 'loja_externa'"
                  [class.text-[#111111]]="paymentMethod() === 'loja_externa'"
                  [class.font-bold]="paymentMethod() === 'loja_externa'"
                  [class.text-[#4B5563]]="paymentMethod() !== 'loja_externa'"
                >
                  <mat-icon class="text-base!">storefront</mat-icon>
                  <span>Comprei na Loja</span>
                </button>
              </div>

              <!-- Active Purchase Form & Live Pix QR -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <!-- Left Column: Quantity & Buyer Details -->
                <div class="space-y-4">
                  <div class="rounded-[22px] bg-[#F6F7F9] border border-[#E4E7EC] p-4 space-y-3">
                    <div class="flex items-baseline justify-between gap-2">
                      <span class="text-xs font-semibold text-[#4B5563]">Preço unitário</span>
                      <span class="text-lg font-bold text-[#0F1115] tabular-nums">
                        {{ currentItem.unitPriceBrl | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}
                      </span>
                    </div>

                    <div class="flex items-center justify-between gap-3 pt-2.5 border-t border-[#E4E7EC]">
                      <div class="text-xs text-[#0F1115]">
                        <div class="font-semibold">Quantidade</div>
                        <div class="text-[#4B5563] tabular-nums">
                          Disponível: {{ maxQty() }} de {{ currentItem.requiredQty }}
                        </div>
                      </div>

                      <div class="flex items-center gap-1.5 bg-white border border-[#D8DCE3] rounded-full p-1">
                        <button
                          type="button"
                          (click)="decrementQty()"
                          [disabled]="selectedQty() <= 1"
                          aria-label="Diminuir quantidade"
                          class="apple-press min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-[#0F1115] hover:bg-[#F1F3F6] disabled:opacity-35 cursor-pointer"
                        >
                          <mat-icon>remove</mat-icon>
                        </button>
                        <span class="w-8 text-center font-bold text-[#0F1115] tabular-nums">
                          {{ selectedQty() }}
                        </span>
                        <button
                          type="button"
                          (click)="incrementQty()"
                          [disabled]="selectedQty() >= maxQty()"
                          aria-label="Aumentar quantidade"
                          class="apple-press min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-[#0F1115] hover:bg-[#F1F3F6] disabled:opacity-35 cursor-pointer"
                        >
                          <mat-icon>add</mat-icon>
                        </button>
                      </div>
                    </div>

                    <div class="flex items-baseline justify-between gap-2 pt-2.5 border-t border-[#E4E7EC]">
                      <span class="text-sm font-bold text-[#0F1115]">Total do Pedido</span>
                      <span #totalPriceEl class="font-display text-2xl font-bold text-[#C2185B] tabular-nums">
                        {{ totalPrice() | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}
                      </span>
                    </div>
                  </div>

                  <!-- Google account identity link -->
                  <div class="rounded-[20px] bg-[#F6F7F9] border border-[#E4E7EC] px-3.5 py-2.5 flex items-center justify-between gap-3">
                    @if (store.currentUser(); as user) {
                      <div class="flex items-center gap-2.5 min-w-0">
                        <div class="w-8 h-8 rounded-full bg-[#FF80AB] text-[#111111] text-xs font-bold flex items-center justify-center shrink-0">
                          {{ user.name.charAt(0).toUpperCase() }}
                        </div>
                        <div class="min-w-0">
                          <div class="text-xs font-bold text-[#0F1115] truncate">{{ user.name }}</div>
                          <div class="text-[11px] text-[#4B5563] truncate">Conta Google conectada</div>
                        </div>
                      </div>
                      <mat-icon class="text-[#C2185B] text-lg! shrink-0">verified</mat-icon>
                    } @else {
                      <div class="text-xs font-medium text-[#4B5563]">Vincular à conta Google</div>
                      <button
                        type="button"
                        (click)="store.authModalOpen.set(true)"
                        class="apple-press min-h-[38px] px-3.5 py-1.5 rounded-full bg-white hover:bg-[#EBEEF3] border border-[#D8DCE3] text-xs font-bold text-[#0F1115] cursor-pointer shrink-0 whitespace-nowrap"
                      >
                        Entrar Google
                      </button>
                    }
                  </div>

                  <form [formGroup]="buyerForm" class="space-y-3">
                    <div>
                      <label for="buyer-name" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                        Seu Nome (aparece na dedicatória)
                      </label>
                      <input
                        id="buyer-name"
                        type="text"
                        formControlName="buyerName"
                        placeholder="Ex.: Tia Juliana"
                        class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] placeholder:text-[#6B7280] focus:outline-none focus:border-[#C2185B]"
                      />
                    </div>
                    <div>
                      <label for="buyer-msg" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                        Recadinho para a família (opcional)
                      </label>
                      <input
                        id="buyer-msg"
                        type="text"
                        formControlName="buyerMessage"
                        placeholder="Muitas bênçãos para a chegada do bebê"
                        class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] placeholder:text-[#6B7280] focus:outline-none focus:border-[#C2185B]"
                      />
                    </div>
                  </form>
                </div>

                <!-- Right Column: Scannable Bacen Pix QR Code OR Verified Store Purchase -->
                @if (paymentMethod() === 'pix') {
                  <div #paymentPanel class="rounded-[22px] bg-[#F6F7F9] bento-dot-matrix border border-[#E4E7EC] p-4 sm:p-5 space-y-3.5">
                    <div class="flex items-center justify-between gap-2">
                      <div class="min-w-0">
                        <p class="text-xs font-bold text-[#C2185B]">Pix Direto para o Criador</p>
                        <p class="text-xs text-[#0F1115] font-semibold truncate">
                          Titular: {{ store.listConfig().creatorName || 'Criador da Lista' }}
                        </p>
                      </div>
                      <mat-icon class="text-[#C2185B] shrink-0">qr_code_2</mat-icon>
                    </div>

                    @if (pixLoading()) {
                      <div class="h-52 rounded-2xl bg-white border border-[#E4E7EC] flex items-center justify-center text-xs text-[#4B5563]">
                        Gerando QR Code BR Code oficial...
                      </div>
                    } @else if (pixPreview(); as preview) {
                      <div class="flex flex-col items-center gap-3">
                        <div class="p-3 rounded-2xl bg-white border border-[#E4E7EC] shadow-sm">
                          <img
                            [src]="preview.qrDataUrl"
                            alt="QR Code Pix para pagamento do enxoval"
                            width="200"
                            height="200"
                            referrerpolicy="no-referrer"
                            class="w-44 h-44 object-contain"
                          />
                        </div>

                        <div class="w-full text-center text-xs text-[#4B5563] space-y-0.5">
                          <div class="truncate">Chave Pix: <strong class="text-[#0F1115]">{{ preview.pixKey }}</strong></div>
                          <div class="font-mono text-[11px] font-bold text-[#C2185B]">
                            TXID: {{ preview.pixTxid }}
                          </div>
                        </div>

                        <div class="w-full space-y-2">
                          <div class="p-2.5 rounded-2xl bg-white border border-[#E4E7EC] font-mono text-[11px] text-[#374151] break-all max-h-16 overflow-y-auto">
                            {{ preview.pixPayload }}
                          </div>
                          <button
                            type="button"
                            (click)="copyPixCode(preview.pixPayload)"
                            class="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-white hover:bg-[#EBEEF3] border border-[#D8DCE3] text-[#0F1115] text-xs font-bold apple-press cursor-pointer whitespace-nowrap"
                          >
                            <mat-icon class="text-base! text-[#C2185B]">{{ copied() ? 'check' : 'content_copy' }}</mat-icon>
                            <span>{{ copied() ? 'Código Pix copiado' : 'Copiar Pix Copia e Cola' }}</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          (click)="togglePixGuide()"
                          class="w-full min-h-[40px] px-3.5 py-1.5 rounded-full bg-white hover:bg-[#EBEEF3] border border-[#E4E7EC] flex items-center justify-between text-[11px] font-semibold text-[#4B5563] hover:text-[#0F1115] cursor-pointer transition-colors"
                        >
                          <span>Como funciona o Pix Oficial (EMV)</span>
                          <mat-icon class="text-base! text-[#C2185B]">{{ showPixGuide() ? 'expand_less' : 'expand_more' }}</mat-icon>
                        </button>

                        @if (showPixGuide()) {
                          <div class="w-full rounded-2xl bg-white border border-[#E4E7EC] p-3 text-[11px] text-[#4B5563] space-y-1.5 leading-relaxed">
                            <div><strong class="text-[#0F1115]">00/01 (EMV Estático):</strong> Padrão Banco Central sem taxas de intermediário — cai direto para o criador.</div>
                            <div><strong class="text-[#0F1115]">26 (DICT):</strong> GUI <code class="font-mono font-bold text-[#C2185B]">br.gov.bcb.pix</code> + chave do criador.</div>
                            <div><strong class="text-[#0F1115]">53/54 (Valor):</strong> Moeda <code class="font-mono font-bold text-[#C2185B]">986</code> (BRL) e valor exato.</div>
                            <div><strong class="text-[#0F1115]">62/63 (TXID + CRC-16):</strong> Rastreio único validado pelo app do banco.</div>
                          </div>
                        }
                      </div>
                    } @else {
                      <div class="rounded-2xl bg-white border border-[#E4E7EC] p-4 text-center space-y-3">
                        <mat-icon class="text-[#C2185B] text-3xl!">vpn_key</mat-icon>
                        <div class="text-xs text-[#4B5563] leading-relaxed">
                          A Chave Pix desta lista ainda não foi informada. Compre em uma loja verificada ou configure a Chave Pix.
                        </div>
                        <div class="flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            (click)="setPaymentMethod('loja_externa')"
                            class="apple-press min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-[#FF80AB] hover:bg-[#F48FB1] text-[#111111] text-xs font-bold cursor-pointer"
                          >
                            <mat-icon class="text-base!">storefront</mat-icon>
                            <span>Comprar em Loja</span>
                          </button>
                          @if (store.canManageActiveList()) {
                            <button
                              type="button"
                              (click)="requestConfigurePix.emit()"
                              class="apple-press min-h-[42px] inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-[#F6F7F9] hover:bg-[#EBEEF3] border border-[#D8DCE3] text-xs font-bold text-[#0F1115] cursor-pointer"
                            >
                              <mat-icon class="text-base! text-[#C2185B]">tune</mat-icon>
                              <span>Configurar Pix</span>
                            </button>
                          }
                        </div>
                      </div>
                    }

                    @if (submitError()) {
                      <p class="text-xs font-semibold text-[#9D174D] bg-[#FCE4EC] border border-[#F48FB1] rounded-xl px-3 py-2">
                        {{ submitError() }}
                      </p>
                    }
                  </div>
                } @else {
                  <!-- Verified Partner Store Purchase Selector -->
                  <div #paymentPanel class="rounded-[22px] bg-[#F6F7F9] border border-[#E4E7EC] p-4 sm:p-5 space-y-3.5">
                    <div class="space-y-1">
                      <div class="text-xs font-bold text-[#C2185B] flex items-center gap-1.5">
                        <mat-icon class="text-base!">verified_user</mat-icon>
                        <span>Compra Direta em Site Verificado</span>
                      </div>
                      <p class="text-xs text-[#4B5563] leading-relaxed">
                        1. Abra a loja abaixo para finalizar a compra. 2. Selecione onde comprou para dar baixa na lista.
                      </p>
                    </div>

                    <div class="space-y-2">
                      @for (offer of currentItem.offers; track offer.storeSlug) {
                        @let isChosen = selectedStoreName() === offer.storeName;
                        @let isCheapest = isLowestOffer(currentItem, offer.priceBrl);
                        <div
                          class="rounded-2xl border p-2.5 flex items-center justify-between gap-2 transition-colors"
                          [class.bg-[#FCE4EC]]="isChosen"
                          [class.border-[#C2185B]]="isChosen"
                          [class.bg-white]="!isChosen"
                          [class.border-[#E4E7EC]]="!isChosen"
                        >
                          <button
                            type="button"
                            (click)="selectedStoreName.set(offer.storeName)"
                            class="flex-1 min-h-[40px] text-left flex items-center gap-2 cursor-pointer min-w-0"
                          >
                            <mat-icon class="text-base! shrink-0" [class.text-[#C2185B]]="isChosen" [class.text-[#6B7280]]="!isChosen">
                              {{ isChosen ? 'radio_button_checked' : 'radio_button_unchecked' }}
                            </mat-icon>
                            <div class="min-w-0">
                              <div class="text-xs font-bold text-[#0F1115] truncate">
                                {{ offer.storeName }}
                                @if (isCheapest) {
                                  <span class="text-[10px] font-bold text-[#C2185B]">· Menor preço</span>
                                }
                              </div>
                              <div class="font-mono text-[11px] font-semibold text-[#4B5563] tabular-nums">
                                {{ offer.priceBrl | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}
                              </div>
                            </div>
                          </button>
                          <a
                            [href]="offer.url"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="apple-press min-h-[38px] inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#F6F7F9] hover:bg-[#EBEEF3] border border-[#D8DCE3] text-[#0F1115] text-[11px] font-bold shrink-0 whitespace-nowrap"
                          >
                            <span>Abrir</span>
                            <mat-icon class="text-sm! text-[#C2185B]">open_in_new</mat-icon>
                          </a>
                        </div>
                      }
                    </div>

                    @if (submitError()) {
                      <p class="text-xs font-semibold text-[#9D174D] bg-[#FCE4EC] border border-[#F48FB1] rounded-xl px-3 py-2">
                        {{ submitError() }}
                      </p>
                    }
                  </div>
                }
              </div>
            }
          </div>

          <!-- Sticky Bottom CTA Bar -->
          @if (!confirmedPurchase()) {
            <div class="px-5 sm:px-6 py-4 border-t border-[#E4E7EC] bg-[#F6F7F9] shrink-0 space-y-2">
              @if (maxQty() <= 0) {
                <p class="text-xs font-semibold text-[#9D174D] bg-[#FCE4EC] border border-[#F48FB1] rounded-full px-3 py-2 text-center">
                  Todas as unidades deste item acabaram de ser garantidas na lista!
                </p>
              }
              <button
                type="button"
                (click)="submitPurchase()"
                [disabled]="submitting() || maxQty() <= 0 || (paymentMethod() === 'pix' && !pixPreview())"
                class="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#FF80AB] hover:bg-[#F48FB1] disabled:opacity-45 text-[#111111] text-sm font-bold shadow-xs apple-press cursor-pointer whitespace-nowrap"
              >
                <mat-icon>shopping_bag</mat-icon>
                <span>
                  {{
                    submitting()
                      ? 'Atualizando em tempo real...'
                      : paymentMethod() === 'loja_externa'
                        ? 'Confirmar Compra na Loja e Deduzir'
                        : 'Confirmar Pagamento Pix e Deduzir'
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
