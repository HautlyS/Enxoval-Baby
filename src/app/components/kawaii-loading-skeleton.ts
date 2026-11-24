import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  viewChild,
} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {animate, stagger} from 'motion';
import {KawaiiRibbon} from './kawaii-ornaments';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-kawaii-loading-skeleton',
  imports: [MatIconModule, KawaiiRibbon],
  template: `
    <div #loadingRoot class="space-y-6 py-4" role="status" aria-live="polite">
      <!-- Animated White Bento Crest Banner -->
      <div class="bento-card bento-dot-matrix rounded-[28px] p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 overflow-hidden relative">
        <div class="flex items-center gap-4">
          <div
            #floatingCrest
            class="w-14 h-14 rounded-2xl bg-[#F6F7F9] border border-[#E4E7EC] flex items-center justify-center shrink-0"
          >
            <app-kawaii-ribbon [size]="34" />
          </div>
          <div class="space-y-1.5">
            <div class="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C2185B]">
              <mat-icon class="text-base! animate-spin">autorenew</mat-icon>
              <span>{{ statusLabel() }}</span>
            </div>
            <h2 class="font-display text-xl sm:text-2xl font-semibold text-[#0F1115]">
              {{ headline() }}
            </h2>
            <p class="text-xs sm:text-sm text-[#4B5563]">
              Sincronizando necessidades reais, imagens de fornecedores e conexão em tempo real...
            </p>
          </div>
        </div>

        <div class="w-full sm:w-56 space-y-2 shrink-0">
          <div class="h-2 w-full rounded-full bg-[#F1F3F6] overflow-hidden border border-[#E4E7EC]">
            <div #progressWave class="h-full w-2/3 rounded-full bg-[#C2185B]"></div>
          </div>
          <div class="flex justify-between text-[11px] font-medium text-[#4B5563]">
            <span>Lojas Verificadas</span>
            <span>Pix &amp; Realtime</span>
          </div>
        </div>
      </div>

      <!-- Community Discovery Skeleton Row -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        @for (card of [1, 2, 3]; track card) {
          <div class="skeleton-card bento-card rounded-[26px] p-5 space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl kawaii-shimmer shrink-0"></div>
              <div class="flex-1 space-y-2">
                <div class="h-4 w-3/4 rounded-lg kawaii-shimmer"></div>
                <div class="h-3 w-1/2 rounded-lg kawaii-shimmer"></div>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div class="h-14 rounded-xl kawaii-shimmer"></div>
              <div class="h-14 rounded-xl kawaii-shimmer"></div>
              <div class="h-14 rounded-xl kawaii-shimmer"></div>
            </div>
            <div class="h-10 w-full rounded-full kawaii-shimmer"></div>
          </div>
        }
      </div>

      <!-- Product Catalog Skeleton Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        @for (item of [1, 2, 3, 4, 5, 6]; track item) {
          <div class="skeleton-card bento-card rounded-[26px] overflow-hidden flex flex-col">
            <div class="aspect-4/3 w-full kawaii-shimmer"></div>
            <div class="p-5 space-y-3">
              <div class="h-3 w-1/3 rounded-md kawaii-shimmer"></div>
              <div class="h-5 w-4/5 rounded-lg kawaii-shimmer"></div>
              <div class="h-3 w-full rounded-md kawaii-shimmer"></div>
              <div class="grid grid-cols-2 gap-2 pt-2">
                <div class="h-9 rounded-full kawaii-shimmer"></div>
                <div class="h-9 rounded-full kawaii-shimmer"></div>
              </div>
              <div class="h-12 w-full rounded-full kawaii-shimmer"></div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class KawaiiLoadingSkeleton {
  readonly headline = input('Preparando listas de enxoval...');
  readonly statusLabel = input('Carregando catálogo e ofertas');

  private readonly rootRef = viewChild<ElementRef<HTMLElement>>('loadingRoot');
  private readonly crestRef = viewChild<ElementRef<HTMLElement>>('floatingCrest');
  private readonly waveRef = viewChild<ElementRef<HTMLElement>>('progressWave');

  constructor() {
    effect(() => {
      const root = this.rootRef()?.nativeElement;
      const crest = this.crestRef()?.nativeElement;
      const wave = this.waveRef()?.nativeElement;
      if (!root || typeof window === 'undefined') return;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

      const cards = root.querySelectorAll('.skeleton-card');
      if (cards.length > 0) {
        animate(
          cards,
          {opacity: [0, 1], y: [14, 0]},
          {delay: stagger(0.05), duration: 0.35, ease: 'easeOut'},
        );
      }

      if (crest) {
        animate(
          crest,
          {y: [-4, 4, -4], scale: [1, 1.04, 1]},
          {duration: 1.8, repeat: Infinity, ease: 'easeInOut'},
        );
      }

      if (wave) {
        animate(
          wave,
          {x: ['-45%', '85%', '-45%']},
          {duration: 1.4, repeat: Infinity, ease: 'easeInOut'},
        );
      }
    });
  }
}
