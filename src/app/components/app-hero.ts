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
    <section #heroRoot class="space-y-4" aria-label="Resumo principal do enxoval">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <!-- Left Vibrant Pink Hero Feature Card -->
        <div
          class="hero-animate relative overflow-hidden lg:col-span-7 bento-hero-pink bento-dot-matrix-dark rounded-[28px] p-6 sm:p-8 flex flex-col justify-between gap-6"
        >
          <div class="pointer-events-none absolute top-5 right-6 text-[#111111]">
            <app-kawaii-floral-corner />
          </div>

          <div class="relative space-y-3 min-w-0">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[#111111]/85">
              <span>{{ store.listConfig().babyName || 'Meu Bebê' }}</span>
              <span aria-hidden="true">·</span>
              <span>{{ store.listConfig().creatorName || store.currentUser()?.name || 'Entre com Google' }}</span>
              @if (dueDateLabel(); as dueLabel) {
                <span aria-hidden="true">·</span>
                <span>{{ dueLabel }}</span>
              }
              <span aria-hidden="true">·</span>
              <span>{{ store.realtimeMode() === 'supabase' ? 'Tempo Real' : 'Preview Live' }}</span>
            </div>

            <h1 class="font-display text-3xl sm:text-5xl font-bold text-[#111111] leading-[1.06] tracking-tight text-balance max-w-2xl">
              {{ store.listConfig().title }}
            </h1>

            <p class="text-sm sm:text-base text-[#111111]/85 leading-relaxed max-w-xl font-medium">
              {{ store.listConfig().welcomeNote }}
            </p>
          </div>

          <!-- Minimal Progress Visualization, Share Dock & Full-Pill CTAs -->
          <div class="relative space-y-3.5">
            <div class="rounded-[22px] bg-white/80 backdrop-blur-md border border-[#111111]/10 p-4 flex items-center gap-4 shadow-xs">
              <app-kawaii-progress-ring [pct]="store.stats().completionPct" [size]="58" [onPink]="true" />
              <div class="flex-1 min-w-0 space-y-2">
                <div class="flex items-baseline justify-between gap-2 text-xs sm:text-sm">
                  <span class="font-bold text-[#111111] truncate">Progresso do Enxoval</span>
                  <span class="font-mono font-bold text-[#111111] tabular-nums shrink-0">
                    {{ store.stats().totalPurchased }}/{{ store.stats().totalRequired }}
                  </span>
                </div>
                <div class="h-2 w-full rounded-full bg-[#111111]/12 overflow-hidden">
                  <div
                    class="h-full rounded-full bg-[#111111] transition-all duration-300"
                    [style.width.%]="store.stats().completionPct"
                  ></div>
                </div>
                <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-[#111111]/80 tabular-nums">
                  <span>
                    Restante:
                    <strong class="text-[#111111]">
                      {{ store.stats().remainingValueBrl | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}
                    </strong>
                  </span>
                  @if (store.listConfig().pixKey) {
                    <span class="font-mono text-[11px] font-bold text-[#111111]">
                      Pix Direto Ativo
                    </span>
                  } @else if (store.canManageActiveList()) {
                    <button
                      type="button"
                      (click)="openPixConfigClicked.emit()"
                      class="text-[11px] font-bold text-[#111111] underline underline-offset-2 cursor-pointer"
                    >
                      Configurar Chave Pix
                    </button>
                  }
                </div>
              </div>
            </div>

            <!-- Compact Pill Share Bar -->
            <div class="rounded-[22px] sm:rounded-full bg-white/85 backdrop-blur-md border border-[#111111]/10 p-2 sm:pl-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
              <div class="flex items-center gap-2 min-w-0 px-2 sm:px-0">
                <mat-icon class="text-base! text-[#C2185B] shrink-0">link</mat-icon>
                <span class="font-mono text-xs font-semibold text-[#0F1115] truncate select-all">
                  {{ store.activeShareUrl() }}
                </span>
              </div>
              <div class="flex flex-wrap items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  (click)="copyActiveShareUrl()"
                  class="apple-press min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F6F7F9] hover:bg-white border border-[#E4E7EC] text-xs font-semibold text-[#0F1115] cursor-pointer whitespace-nowrap"
                >
                  <mat-icon class="text-base! text-[#C2185B]">{{ copiedActiveUrl() ? 'check' : 'content_copy' }}</mat-icon>
                  <span>{{ copiedActiveUrl() ? 'Copiado' : 'Copiar' }}</span>
                </button>
                <button
                  type="button"
                  (click)="nativeShareList()"
                  class="apple-press min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#F6F7F9] hover:bg-white border border-[#E4E7EC] text-xs font-semibold text-[#0F1115] cursor-pointer whitespace-nowrap"
                >
                  <mat-icon class="text-base! text-[#C2185B]">ios_share</mat-icon>
                  <span>Enviar</span>
                </button>
                <a
                  [href]="whatsappShareHref()"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="apple-press min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#111111] hover:bg-[#23262B] text-white text-xs font-semibold whitespace-nowrap"
                >
                  <mat-icon class="text-base!">share</mat-icon>
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>

            <!-- Hero Full-Pill CTAs -->
            <div class="flex flex-wrap items-center gap-3 pt-0.5">
              <a
                href="#catalogo"
                class="apple-press flex-1 sm:flex-initial min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#111111] hover:bg-[#23262B] text-white text-sm font-semibold shadow-md whitespace-nowrap"
              >
                <mat-icon class="text-lg! text-[#FF80AB]">shopping_bag</mat-icon>
                <span>Escolher Presente &amp; Pix</span>
              </a>
              @if (store.canManageActiveList()) {
                <button
                  type="button"
                  (click)="addItemClicked.emit()"
                  class="apple-press flex-1 sm:flex-initial min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white hover:bg-[#F6F7F9] text-[#0F1115] text-sm font-bold shadow-xs cursor-pointer whitespace-nowrap"
                >
                  <mat-icon class="text-lg! text-[#C2185B]">add_circle</mat-icon>
                  <span>Adicionar Item</span>
                </button>
              } @else {
                <button
                  type="button"
                  (click)="createListClicked.emit()"
                  class="apple-press flex-1 sm:flex-initial min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white hover:bg-[#F6F7F9] text-[#0F1115] text-sm font-bold shadow-xs cursor-pointer whitespace-nowrap"
                >
                  <mat-icon class="text-lg! text-[#C2185B]">auto_awesome</mat-icon>
                  <span>Criar Minha Lista</span>
                </button>
              }
            </div>
          </div>
        </div>

        <!-- Right Interactive Visual Bento Showcase -->
        <div
          class="hero-animate lg:col-span-5 bento-card rounded-[28px] overflow-hidden relative min-h-[380px] sm:min-h-[430px] lg:min-h-[460px] flex flex-col justify-between group"
        >
          <img
            #showcaseImage
            [src]="activeShowcaseImage()"
            [alt]="activeShowcaseAlt()"
            referrerpolicy="no-referrer"
            class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />

          <!-- Top Floating Crisp White Status Pill Card -->
          <div class="relative z-10 p-4 flex items-start justify-between gap-3">
            <div class="rounded-full bg-white/94 backdrop-blur-xl border border-black/[0.08] px-4 py-2 shadow-md max-w-[92%] flex items-center gap-2.5">
              @if (latestPurchase(); as latest) {
                <mat-icon class="text-base! text-[#C2185B] shrink-0">favorite</mat-icon>
                <span class="text-xs font-semibold text-[#0F1115] truncate">
                  {{ latest.buyerName }} · {{ latest.quantity }}x {{ latest.itemName }}
                </span>
              } @else {
                <mat-icon class="text-base! text-[#C2185B] shrink-0">verified</mat-icon>
                <span class="text-xs font-semibold text-[#0F1115] truncate">
                  {{ store.listConfig().pixKey ? 'Pix Direto Sem Taxas' : 'Lojas Verificadas' }} · {{ store.listConfig().creatorCity || 'Brasil' }}
                </span>
              }
            </div>
          </div>

          <!-- Bottom White Bento Dock Switcher -->
          <div class="relative z-10 m-3.5 rounded-[22px] bg-white/95 backdrop-blur-xl border border-black/[0.08] p-3.5 shadow-xl space-y-3">
            <div #showcaseCaption class="flex items-end justify-between gap-3">
              <div class="space-y-0.5 min-w-0">
                <div class="text-[11px] font-bold text-[#C2185B]">
                  @if (previewStage(); as st) {
                    {{ st.title }}
                  } @else {
                    Panorama do Enxoval
                  }
                </div>
                <div class="font-display text-sm sm:text-base font-semibold text-[#0F1115] leading-snug line-clamp-1">
                  @if (previewStage(); as st) {
                    {{ st.subtitle }}
                  } @else {
                    Toque em uma etapa para filtrar
                  }
                </div>
              </div>

              @if (previewStage(); as st) {
                <button
                  type="button"
                  (click)="stageSelected.emit(st.id)"
                  class="apple-press min-h-[40px] px-4 py-1.5 rounded-full bg-[#111111] hover:bg-[#23262B] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Filtrar</span>
                  <mat-icon class="text-sm! text-[#FF80AB]">arrow_downward</mat-icon>
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
                  class="apple-press rounded-2xl p-1.5 border text-left cursor-pointer flex flex-col gap-1 group/thumb transition-colors"
                  [class.bg-[#FCE4EC]]="isSelected"
                  [class.border-[#C2185B]]="isSelected"
                  [class.bg-[#F6F7F9]]="!isSelected"
                  [class.hover:bg-white]="!isSelected"
                  [class.border-[#E4E7EC]]="!isSelected"
                >
                  <div class="aspect-4/3 w-full rounded-xl overflow-hidden bg-white">
                    <img
                      [src]="st.imageUrl"
                      [alt]="st.shortLabel"
                      referrerpolicy="no-referrer"
                      class="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
                    />
                  </div>
                  <div class="px-0.5">
                    <div class="text-[10px] font-bold text-[#0F1115] truncate">{{ st.shortLabel }}</div>
                    <div class="font-mono text-[10px] font-semibold text-[#C2185B] tabular-nums">
                      {{ remCount }} faltam
                    </div>
                  </div>
                </button>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Full-Width 4-Column White Bento Metric Strip -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="hero-animate interactive-card bento-card bento-dot-matrix rounded-[24px] p-5 flex items-start justify-between gap-3">
          <div class="space-y-1.5">
            <div class="text-xs font-semibold text-[#4B5563]">Itens na Lista</div>
            <div class="font-display text-3xl font-bold text-[#0F1115] tabular-nums">
              {{ store.stats().totalCatalogItems }}
            </div>
            <div class="text-[11px] font-medium text-[#4B5563]">4 etapas organizadas</div>
          </div>
          <span class="w-10 h-10 rounded-full bg-[#FCE4EC] border border-[#F48FB1] text-[#C2185B] flex items-center justify-center shrink-0">
            <mat-icon class="text-lg!">inventory_2</mat-icon>
          </span>
        </div>

        <div class="hero-animate interactive-card bento-card rounded-[24px] p-5 flex items-start justify-between gap-3">
          <div class="space-y-1.5">
            <div class="text-xs font-semibold text-[#4B5563]">Garantidos</div>
            <div #kpiPurchased class="font-display text-3xl font-bold text-[#0F1115] tabular-nums">
              {{ store.stats().totalPurchased }}
            </div>
            <div class="text-[11px] font-medium text-[#4B5563]">Deduzidos ao vivo</div>
          </div>
          <span class="w-10 h-10 rounded-full bg-[#FCE4EC] border border-[#F48FB1] text-[#C2185B] flex items-center justify-center shrink-0">
            <mat-icon class="text-lg!">card_giftcard</mat-icon>
          </span>
        </div>

        <div class="hero-animate interactive-card bento-card bento-dot-matrix rounded-[24px] p-5 flex items-start justify-between gap-3">
          <div class="space-y-1.5">
            <div class="text-xs font-semibold text-[#4B5563]">Faltam Comprar</div>
            <div class="font-display text-3xl font-bold text-[#C2185B] tabular-nums">
              {{ store.stats().totalRemaining }}
            </div>
            <div class="text-[11px] font-medium text-[#4B5563]">Prontos para Pix</div>
          </div>
          <span class="w-10 h-10 rounded-full bg-[#FF80AB] text-[#111111] flex items-center justify-center shrink-0">
            <mat-icon class="text-lg!">shopping_bag</mat-icon>
          </span>
        </div>

        <div class="hero-animate interactive-card bento-card rounded-[24px] p-5 flex items-start justify-between gap-3">
          <div class="space-y-1.5">
            <div class="text-xs font-semibold text-[#4B5563]">Ofertas Indexadas</div>
            <div class="font-display text-3xl font-bold text-[#0F1115] tabular-nums">
              {{ store.stats().totalOffers }}
            </div>
            <div class="text-[11px] font-medium text-[#4B5563]">4 redes verificadas</div>
          </div>
          <span class="w-10 h-10 rounded-full bg-[#FCE4EC] border border-[#F48FB1] text-[#C2185B] flex items-center justify-center shrink-0">
            <mat-icon class="text-lg!">storefront</mat-icon>
          </span>
        </div>
      </div>
    </section>
  `,
})
export class AppHero {
  protected readonly store = inject(EnxovalStore);
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
      : 'Quarto de bebê moderno com berço e decoração acolhedora';
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
          {opacity: [0, 1], y: [14, 0]},
          {delay: stagger(0.05), duration: 0.4, ease: [0.16, 1, 0.3, 1]},
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
