import {CurrencyPipe} from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {animate, stagger} from 'motion';
import {DECORATION_IMAGES} from '../core/catalog-seed';
import {EnxovalStore} from '../core/enxoval-store';
import {EnxovalStage} from '../core/models';
import {KawaiiFloralCorner, KawaiiProgressRing} from './kawaii-ornaments';

export interface HeroStageMeta {
  id: EnxovalStage;
  shortLabel: string;
  title: string;
  subtitle: string;
  imageUrl: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-hero',
  imports: [CurrencyPipe, MatIconModule, KawaiiFloralCorner, KawaiiProgressRing],
  template: `
    <section #heroRoot class="space-y-5" aria-label="Resumo principal do enxoval">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-stretch">
        <!-- Left Editorial Glass Card -->
        <div
          class="hero-animate relative overflow-hidden lg:col-span-7 glass-panel-strong texture-silk-grid rounded-3xl p-6 sm:p-8 lg:p-9 flex flex-col justify-between gap-6"
        >
          <img
            [src]="decorImages.blushSilkPattern"
            alt=""
            aria-hidden="true"
            referrerpolicy="no-referrer"
            class="pointer-events-none select-none hero-silk-wash absolute inset-0 w-full h-full object-cover opacity-[0.09]"
          />
          <div class="pointer-events-none absolute top-0 right-0 opacity-75">
            <app-kawaii-floral-corner />
          </div>

          <div class="flex items-start justify-between gap-4 relative">
            <div class="space-y-3 min-w-0">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-rose-700">
                <span>{{ store.listConfig().babyName || 'Meu Bebê' }}</span>
                <span aria-hidden="true">·</span>
                <span>Criador: {{ store.listConfig().creatorName || store.currentUser()?.name || 'Entre com Google' }}</span>
                @if (dueDateLabel(); as dueLabel) {
                  <span aria-hidden="true">·</span>
                  <span>{{ dueLabel }}</span>
                }
                <span aria-hidden="true">·</span>
                <span>{{ store.realtimeMode() === 'supabase' ? 'Supabase Realtime' : 'Preview Tempo Real' }}</span>
              </div>

              <h1 class="font-display text-3xl sm:text-5xl font-semibold text-rose-950 leading-[1.08] tracking-tight text-balance">
                {{ store.listConfig().title }}
              </h1>

              <p class="text-sm sm:text-base text-rose-900/90 leading-relaxed max-w-2xl">
                {{ store.listConfig().welcomeNote }}
              </p>
            </div>

            <div class="hidden sm:block shrink-0 w-20 h-20 rounded-2xl overflow-hidden border border-rose-200/80 bg-white/90 p-1 shadow-xs ambient-float">
              <img
                [src]="decorImages.peonyRibbon"
                alt="Ilustração floral de peônias e laço de seda rosa"
                referrerpolicy="no-referrer"
                class="w-full h-full object-cover rounded-xl"
              />
            </div>
          </div>

          <!-- Progress Ring, Shareable Link Dock & Primary Actions -->
          <div class="space-y-3.5 relative">
            <div class="rounded-2xl bg-white/88 texture-gingham-blush border border-rose-200/80 p-4 flex items-center gap-4 shadow-xs">
              <app-kawaii-progress-ring [pct]="store.stats().completionPct" [size]="58" />
              <div class="flex-1 min-w-0 space-y-1.5">
                <div class="flex items-baseline justify-between gap-2 text-xs sm:text-sm">
                  <span class="font-semibold text-rose-950 truncate">Progresso Geral do Enxoval</span>
                  <span class="font-mono font-semibold text-rose-700 tabular-nums shrink-0">
                    {{ store.stats().totalPurchased }}/{{ store.stats().totalRequired }}
                  </span>
                </div>
                <div class="h-2.5 w-full rounded-full texture-woven-blush border border-rose-200/60 overflow-hidden">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-rose-400 via-rose-500 to-rose-600 transition-all duration-300"
                    [style.width.%]="store.stats().completionPct"
                  ></div>
                </div>
                <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-800 tabular-nums">
                  <span>
                    Restante estimado:
                    <strong class="text-rose-950">
                      {{ store.stats().remainingValueBrl | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}
                    </strong>
                  </span>
                  @if (store.listConfig().pixKey) {
                    <span class="font-mono text-[11px] text-rose-700">
                      Pix Direto Ativo
                    </span>
                  } @else if (store.canManageActiveList()) {
                    <button
                      type="button"
                      (click)="openPixConfigClicked.emit()"
                      class="text-[11px] font-semibold text-rose-700 underline underline-offset-2 hover:text-rose-950 cursor-pointer"
                    >
                      Configurar Chave Pix
                    </button>
                  }
                </div>
              </div>
            </div>

            <!-- Quick Shareable URL Dock -->
            <div class="rounded-2xl bg-white/80 border border-rose-200/75 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200/75 flex items-center justify-center text-rose-600 shrink-0">
                  <mat-icon class="text-base!">link</mat-icon>
                </span>
                <span class="font-mono text-xs text-rose-950 truncate select-all">
                  {{ store.activeShareUrl() }}
                </span>
              </div>
              <div class="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  (click)="copyActiveShareUrl()"
                  class="apple-press min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-950 cursor-pointer whitespace-nowrap"
                >
                  <mat-icon class="text-base!">{{ copiedActiveUrl() ? 'check' : 'content_copy' }}</mat-icon>
                  <span>{{ copiedActiveUrl() ? 'Copiado!' : 'Copiar Link' }}</span>
                </button>
                <button
                  type="button"
                  (click)="nativeShareList()"
                  class="apple-press min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-950 cursor-pointer whitespace-nowrap"
                >
                  <mat-icon class="text-base!">ios_share</mat-icon>
                  <span>Enviar</span>
                </button>
                <a
                  [href]="whatsappShareHref()"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="apple-press min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold whitespace-nowrap"
                >
                  <mat-icon class="text-base!">share</mat-icon>
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>

            <!-- Hero Primary CTAs -->
            <div class="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-3 pt-0.5">
              <a
                href="#catalogo"
                class="apple-press min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white text-sm font-semibold shadow-sm whitespace-nowrap"
              >
                <mat-icon class="text-lg!">shopping_bag</mat-icon>
                <span>Escolher Presente &amp; Pagar com Pix</span>
              </a>
              @if (store.canManageActiveList()) {
                <button
                  type="button"
                  (click)="addItemClicked.emit()"
                  class="apple-press min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/90 hover:bg-white border border-rose-200 text-rose-950 text-sm font-semibold cursor-pointer whitespace-nowrap"
                >
                  <mat-icon class="text-lg!">add_circle_outline</mat-icon>
                  <span>Adicionar Item</span>
                </button>
              } @else {
                <button
                  type="button"
                  (click)="createListClicked.emit()"
                  class="apple-press min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/90 hover:bg-white border border-rose-200 text-rose-950 text-sm font-semibold cursor-pointer whitespace-nowrap"
                >
                  <mat-icon class="text-lg!">auto_awesome</mat-icon>
                  <span>Criar Minha Lista</span>
                </button>
              }
            </div>
          </div>
        </div>

        <!-- Right Interactive Visual Bento Showcase -->
        <div
          class="hero-animate lg:col-span-5 glass-panel-strong rounded-3xl overflow-hidden relative min-h-[380px] sm:min-h-[440px] lg:min-h-[480px] flex flex-col justify-between group"
        >
          <img
            #showcaseImage
            [src]="activeShowcaseImage()"
            [alt]="activeShowcaseAlt()"
            referrerpolicy="no-referrer"
            class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />

          <!-- Luminous Soft Pastel Rim Glow (Zero dark/black scrims) -->
          <div
            class="absolute inset-0 bg-gradient-to-b from-white/15 via-transparent to-rose-50/45 pointer-events-none"
          ></div>

          <!-- Top Frosted Status Inset -->
          <div class="relative z-10 p-4 sm:p-5 flex items-start justify-between gap-3">
            <div class="rounded-2xl bg-white/88 backdrop-blur-xl border border-white/90 px-3.5 py-2.5 shadow-sm max-w-[90%] space-y-0.5">
              @if (latestPurchase(); as latest) {
                <div class="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700">
                  <mat-icon class="text-sm!">favorite</mat-icon>
                  <span>Último carinho recebido</span>
                </div>
                <div class="text-xs font-semibold text-rose-950 truncate">
                  {{ latest.buyerName }} · {{ latest.quantity }}x {{ latest.itemName }}
                </div>
              } @else {
                <div class="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700">
                  <mat-icon class="text-sm!">verified</mat-icon>
                  <span>{{ store.listConfig().creatorCity || 'Brasil' }}</span>
                </div>
                <div class="text-xs font-semibold text-rose-950 truncate">
                  {{ store.listConfig().pixKey ? 'Pix Direto Verificado · Sem Taxas' : 'Lojas Oficiais Verificadas' }}
                </div>
              }
            </div>
          </div>

          <!-- Bottom Apple Frosted Milk-Rose Glass Stage Dock -->
          <div class="relative z-10 m-3 sm:m-4 rounded-2xl bg-white/84 backdrop-blur-xl border border-white/90 p-3.5 sm:p-4 shadow-sm space-y-3">
            <div #showcaseCaption class="flex items-end justify-between gap-3">
              <div class="space-y-0.5 min-w-0">
                <div class="text-[11px] font-semibold text-rose-700">
                  @if (previewStage(); as st) {
                    {{ st.title }}
                  } @else {
                    Panorama Completo do Enxoval
                  }
                </div>
                <div class="font-display text-base sm:text-lg font-semibold text-rose-950 leading-snug line-clamp-2">
                  @if (previewStage(); as st) {
                    {{ st.subtitle }}
                  } @else {
                    Toque em uma etapa abaixo para visualizar e filtrar
                  }
                </div>
              </div>

              @if (previewStage(); as st) {
                <button
                  type="button"
                  (click)="stageSelected.emit(st.id)"
                  class="apple-press min-h-[40px] px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Filtrar</span>
                  <mat-icon class="text-sm!">arrow_downward</mat-icon>
                </button>
              }
            </div>

            <div class="grid grid-cols-4 gap-2">
              @for (st of stages(); track st.id) {
                @let isSelected = previewStageId() === st.id;
                @let remCount = stageRemaining(st.id);
                <button
                  type="button"
                  (click)="selectPreviewStage(st.id)"
                  [attr.aria-pressed]="isSelected"
                  class="apple-press rounded-xl p-1.5 border text-left cursor-pointer flex flex-col gap-1 group/thumb transition-colors"
                  [class.bg-white]="isSelected"
                  [class.border-rose-400]="isSelected"
                  [class.ring-2]="isSelected"
                  [class.ring-rose-300/60]="isSelected"
                  [class.text-rose-950]="isSelected"
                  [class.shadow-xs]="isSelected"
                  [class.bg-rose-50/75]="!isSelected"
                  [class.hover:bg-white/95]="!isSelected"
                  [class.border-rose-200/75]="!isSelected"
                  [class.text-rose-900]="!isSelected"
                >
                  <div class="aspect-4/3 w-full rounded-lg overflow-hidden">
                    <img
                      [src]="st.imageUrl"
                      [alt]="st.shortLabel"
                      referrerpolicy="no-referrer"
                      class="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
                    />
                  </div>
                  <div class="px-0.5">
                    <div class="text-[10px] font-semibold truncate">{{ st.shortLabel }}</div>
                    <div class="font-mono text-[10px] text-rose-700 tabular-nums">
                      {{ remCount }} faltam
                    </div>
                  </div>
                </button>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Full-Width 4-Column Tactile KPI Strip -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div class="hero-animate interactive-card glass-panel texture-gingham-blush rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3">
          <div class="space-y-1">
            <div class="text-xs font-medium text-rose-700">Itens no Catálogo</div>
            <div class="font-display text-2xl sm:text-3xl font-semibold text-rose-950 tabular-nums">
              {{ store.stats().totalCatalogItems }}
            </div>
            <div class="text-[11px] sm:text-xs text-rose-800">4 etapas completas</div>
          </div>
          <span class="w-9 h-9 rounded-xl bg-rose-100/85 border border-rose-200/70 text-rose-700 flex items-center justify-center shrink-0">
            <mat-icon class="text-lg!">inventory_2</mat-icon>
          </span>
        </div>

        <div class="hero-animate interactive-card glass-panel texture-cotton-dots rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3">
          <div class="space-y-1">
            <div class="text-xs font-medium text-rose-700">Unidades Garantidas</div>
            <div #kpiPurchased class="font-display text-2xl sm:text-3xl font-semibold text-rose-950 tabular-nums">
              {{ store.stats().totalPurchased }}
            </div>
            <div class="text-[11px] sm:text-xs text-rose-800">Deduzidas em tempo real</div>
          </div>
          <span class="w-9 h-9 rounded-xl bg-rose-100/85 border border-rose-200/70 text-rose-700 flex items-center justify-center shrink-0">
            <mat-icon class="text-lg!">card_giftcard</mat-icon>
          </span>
        </div>

        <div class="hero-animate interactive-card glass-panel texture-gingham-blush rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3">
          <div class="space-y-1">
            <div class="text-xs font-medium text-rose-700">Faltam Comprar</div>
            <div class="font-display text-2xl sm:text-3xl font-semibold text-rose-700 tabular-nums">
              {{ store.stats().totalRemaining }}
            </div>
            <div class="text-[11px] sm:text-xs text-rose-800">Disponíveis para Pix</div>
          </div>
          <span class="w-9 h-9 rounded-xl bg-rose-100/85 border border-rose-200/70 text-rose-700 flex items-center justify-center shrink-0">
            <mat-icon class="text-lg!">shopping_bag</mat-icon>
          </span>
        </div>

        <div class="hero-animate interactive-card glass-panel texture-cotton-dots rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3">
          <div class="space-y-1">
            <div class="text-xs font-medium text-rose-700">Ofertas Indexadas</div>
            <div class="font-display text-2xl sm:text-3xl font-semibold text-rose-950 tabular-nums">
              {{ store.stats().totalOffers }}
            </div>
            <div class="text-[11px] sm:text-xs text-rose-800">Magalu, ML, Amazon e Farmácias</div>
          </div>
          <span class="w-9 h-9 rounded-xl bg-rose-100/85 border border-rose-200/70 text-rose-700 flex items-center justify-center shrink-0">
            <mat-icon class="text-lg!">storefront</mat-icon>
          </span>
        </div>
      </div>
    </section>
  `,
})
export class AppHero {
  protected readonly store = inject(EnxovalStore);
  protected readonly decorImages = DECORATION_IMAGES;
  private readonly heroRoot = viewChild<ElementRef<HTMLElement>>('heroRoot');
  private readonly showcaseImageRef = viewChild<ElementRef<HTMLElement>>('showcaseImage');
  private readonly showcaseCaptionRef = viewChild<ElementRef<HTMLElement>>('showcaseCaption');
  private readonly kpiPurchasedRef = viewChild<ElementRef<HTMLElement>>('kpiPurchased');

  readonly stages = input.required<HeroStageMeta[]>();
  readonly heroImage = input.required<string>();

  readonly createListClicked = output<void>();
  readonly addItemClicked = output<void>();
  readonly openPixConfigClicked = output<void>();
  readonly stageSelected = output<EnxovalStage>();

  protected readonly copiedActiveUrl = signal(false);
  protected readonly previewStageId = signal<EnxovalStage | null>(null);
  private lastShowcaseKey: string | null = null;
  private lastPurchasedCount: number | null = null;

  protected readonly previewStage = computed(() => {
    const id = this.previewStageId();
    if (!id) return null;
    return this.stages().find((s) => s.id === id) ?? null;
  });

  protected readonly activeShowcaseImage = computed(() => {
    const st = this.previewStage();
    return st ? st.imageUrl : this.heroImage();
  });

  protected readonly activeShowcaseAlt = computed(() => {
    const st = this.previewStage();
    return st
      ? `${st.title} — ${st.subtitle}`
      : 'Quarto de bebê em tons de rosa pastel e madeira clara com berço e coelho de pelúcia';
  });

  protected readonly latestPurchase = computed(() => this.store.purchases()[0] ?? null);

  protected readonly dueDateLabel = computed(() => {
    const raw = this.store.listConfig().dueDate?.trim();
    if (!raw) return null;
    const parsed = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    const diffDays = Math.ceil((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0 && diffDays <= 365) {
      return `Chegada em ${diffDays} dias`;
    }
    return `Previsão: ${parsed.toLocaleDateString('pt-BR', {month: 'short', year: 'numeric'})}`;
  });

  constructor() {
    effect(() => {
      this.store.activeListSlug();
      this.previewStageId.set(null);
    });

    effect(() => {
      const stageId = this.previewStageId() ?? 'hero';
      if (this.lastShowcaseKey === null) {
        this.lastShowcaseKey = stageId;
        return;
      }
      if (this.lastShowcaseKey === stageId) return;
      this.lastShowcaseKey = stageId;
      if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      const img = untracked(() => this.showcaseImageRef()?.nativeElement);
      const caption = untracked(() => this.showcaseCaptionRef()?.nativeElement);
      if (img) {
        animate(img, {opacity: [0.55, 1], scale: [1.04, 1]}, {duration: 0.36, ease: [0.16, 1, 0.3, 1]});
      }
      if (caption) {
        animate(caption, {opacity: [0.35, 1], y: [8, 0]}, {duration: 0.24, ease: [0.16, 1, 0.3, 1]});
      }
    });

    effect(() => {
      const purchased = this.store.stats().totalPurchased;
      if (this.lastPurchasedCount === null) {
        this.lastPurchasedCount = purchased;
        return;
      }
      if (this.lastPurchasedCount === purchased) return;
      this.lastPurchasedCount = purchased;
      if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      const el = untracked(() => this.kpiPurchasedRef()?.nativeElement);
      if (el) {
        animate(el, {scale: [1, 1.14, 1]}, {duration: 0.32, ease: [0.16, 1, 0.3, 1]});
      }
    });

    afterNextRender(() => {
      if (typeof window === 'undefined') return;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      const root = this.heroRoot()?.nativeElement;
      if (!root) return;
      const items = root.querySelectorAll('.hero-animate');
      if (items.length > 0) {
        animate(
          items,
          {opacity: [0, 1], y: [16, 0]},
          {delay: stagger(0.055), duration: 0.44, ease: [0.16, 1, 0.3, 1]},
        );
      }
    });
  }

  protected selectPreviewStage(stageId: EnxovalStage): void {
    this.previewStageId.update((prev) => (prev === stageId ? null : stageId));
  }

  protected stageRemaining(stageId: EnxovalStage): number {
    return this.store.stageStats().get(stageId)?.remaining ?? 0;
  }

  protected async copyActiveShareUrl(): Promise<void> {
    const url = this.store.activeShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      this.copiedActiveUrl.set(true);
      this.store.showToast('Link da lista copiado! Envie para amigos e familiares.');
      setTimeout(() => this.copiedActiveUrl.set(false), 2600);
    } catch {
      this.store.showToast('Copie o link exibido na barra de compartilhamento.');
    }
  }

  protected async nativeShareList(): Promise<void> {
    const url = this.store.activeShareUrl();
    const cfg = this.store.listConfig();
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: cfg.title,
          text: `Veja os itens do ${cfg.title} e presenteie via Pix ou nas lojas verificadas:`,
          url,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    await this.copyActiveShareUrl();
  }

  protected whatsappShareHref(): string {
    const cfg = this.store.listConfig();
    const url = this.store.activeShareUrl();
    const msg = `Veja nossa lista "${cfg.title}" no Enxoval Baby: ${url}`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  }
}
