import {ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, signal, untracked, viewChild} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {animate, stagger} from 'motion';
import {EnxovalStore} from '../core/enxoval-store';
import {KawaiiProgressRing} from './kawaii-ornaments';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-baby-tools-panel',
  imports: [MatIconModule, KawaiiProgressRing],
  template: `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Tool 1: Calculadora de Fraldas -->
      <div class="lg:col-span-6 glass-panel-strong texture-silk-grid rounded-3xl p-5 sm:p-6 space-y-5">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <div class="text-xs font-medium text-rose-700">Planejamento Inteligente</div>
            <h3 class="font-display text-xl font-semibold text-rose-950">
              Calculadora de Fraldas por Idade
            </h3>
            <p class="text-xs text-rose-800">
              Ajuste o tempo de planejamento e adicione os pacotes exatos direto no enxoval.
            </p>
          </div>
          <div class="w-11 h-11 rounded-2xl bg-rose-100/85 border border-rose-200/70 flex items-center justify-center text-rose-700 shrink-0">
            <mat-icon>calculate</mat-icon>
          </div>
        </div>

        <div class="space-y-4 rounded-2xl bg-white/80 texture-cotton-dots border border-rose-200/70 p-4">
          <div class="flex items-center justify-between gap-4">
            <div>
              <div class="text-xs font-semibold text-rose-950">Horizonte de Estoque</div>
              <div class="text-[11px] text-rose-700">Meses iniciais do bebê</div>
            </div>
            <div class="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl p-1">
              <button
                type="button"
                (click)="changeMonths(-1)"
                [disabled]="months() <= 1"
                aria-label="Reduzir meses"
                class="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-rose-900 hover:bg-white disabled:opacity-40 cursor-pointer"
              >
                <mat-icon>remove</mat-icon>
              </button>
              <span class="w-14 text-center text-sm font-bold text-rose-950 tabular-nums">
                {{ months() }}m
              </span>
              <button
                type="button"
                (click)="changeMonths(1)"
                [disabled]="months() >= 12"
                aria-label="Aumentar meses"
                class="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-rose-900 hover:bg-white disabled:opacity-40 cursor-pointer"
              >
                <mat-icon>add</mat-icon>
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between gap-4 pt-2 border-t border-rose-100">
            <div>
              <div class="text-xs font-semibold text-rose-950">Trocas Médias Diárias</div>
              <div class="text-[11px] text-rose-700">Recomendado RN: 8 a 10 trocas/dia</div>
            </div>
            <div class="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl p-1">
              <button
                type="button"
                (click)="changePerDay(-1)"
                [disabled]="changesPerDay() <= 5"
                aria-label="Reduzir trocas diárias"
                class="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-rose-900 hover:bg-white disabled:opacity-40 cursor-pointer"
              >
                <mat-icon>remove</mat-icon>
              </button>
              <span class="w-14 text-center text-sm font-bold text-rose-950 tabular-nums">
                {{ changesPerDay() }}/dia
              </span>
              <button
                type="button"
                (click)="changePerDay(1)"
                [disabled]="changesPerDay() >= 12"
                aria-label="Aumentar trocas diárias"
                class="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-rose-900 hover:bg-white disabled:opacity-40 cursor-pointer"
              >
                <mat-icon>add</mat-icon>
              </button>
            </div>
          </div>
        </div>

        <div #diaperTiers class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
          @for (tier of diaperBreakdown(); track tier.size) {
            <div class="tier-box rounded-2xl bg-white/85 texture-cotton-dots border border-rose-200/70 p-3 space-y-0.5 transition-colors hover:border-rose-300">
              <div class="text-[11px] font-semibold text-rose-700">{{ tier.size }}</div>
              <div class="font-display text-xl font-bold text-rose-950 tabular-nums">
                {{ tier.packs }}
              </div>
              <div class="text-[10px] text-rose-700 tabular-nums">{{ tier.units }} fraldas</div>
            </div>
          }
        </div>

        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div class="text-xs text-rose-900">
            Total estimado: <strong class="tabular-nums">{{ totalPacks() }} pacotes</strong>
            ({{ totalDiapers() }} fraldas)
          </div>
          <button
            type="button"
            (click)="addCalculatedDiapers()"
            [disabled]="addingDiapers()"
            class="apple-press min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <mat-icon class="text-base!">add_shopping_cart</mat-icon>
            <span>{{ addingDiapers() ? 'Adicionando...' : 'Adicionar Estoque ao Enxoval' }}</span>
          </button>
        </div>
      </div>

      <!-- Tool 2: Checklist Interativo da Mala da Maternidade + Export CSV -->
      <div class="lg:col-span-6 glass-panel-strong texture-gingham-blush rounded-3xl p-5 sm:p-6 space-y-4">
        <div class="flex items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="text-xs font-medium text-rose-700">Organização Pré-Parto</div>
            <h3 class="font-display text-xl font-semibold text-rose-950">
              Checklist da Mala da Maternidade
            </h3>
            <p class="text-xs text-rose-800">
              Toque em cada item para marcar o que já está separado na mala.
            </p>
          </div>
          <app-kawaii-progress-ring [pct]="store.checklistProgress().pct" [size]="54" />
        </div>

        <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
          @for (entry of store.maternityChecklist(); track entry.id) {
            <button
              type="button"
              (click)="store.toggleChecklistItem(entry.id)"
              class="apple-press w-full min-h-[48px] px-3.5 py-2.5 rounded-2xl bg-white/85 hover:bg-white texture-cotton-dots border border-rose-200/70 flex items-center justify-between gap-3 text-left cursor-pointer"
            >
              <div class="flex items-center gap-3 min-w-0">
                <mat-icon
                  class="transition-transform duration-200"
                  [class.scale-110]="entry.packed"
                  [class.text-rose-600]="entry.packed"
                  [class.text-rose-300]="!entry.packed"
                >
                  {{ entry.packed ? 'check_circle' : 'radio_button_unchecked' }}
                </mat-icon>
                <div class="min-w-0">
                  <div
                    class="text-xs font-semibold truncate transition-colors"
                    [class.line-through]="entry.packed"
                    [class.text-rose-600]="entry.packed"
                    [class.text-rose-950]="!entry.packed"
                  >
                    {{ entry.label }}
                  </div>
                  <div class="text-[11px] text-rose-700">{{ entry.group }}</div>
                </div>
              </div>
              <span class="font-mono text-[11px] font-semibold text-rose-800 shrink-0 tabular-nums">
                {{ entry.qtyLabel }}
              </span>
            </button>
          }
        </div>

        <div class="pt-2 border-t border-rose-200/60 flex flex-wrap items-center justify-between gap-3">
          <span class="inline-flex items-center gap-1.5 text-xs font-medium text-rose-800 tabular-nums">
            @if (store.checklistProgress().pct === 100) {
              <mat-icon class="text-base! text-rose-600">celebration</mat-icon>
              <span class="font-semibold text-rose-700">Mala 100% pronta para a maternidade!</span>
            } @else {
              <span>{{ store.checklistProgress().packed }} de {{ store.checklistProgress().total }} itens prontos</span>
            }
          </span>
          <a
            [href]="'/api/enxoval/export.csv?list=' + store.activeListSlug()"
            [attr.download]="'enxoval-' + store.activeListSlug() + '.csv'"
            class="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/90 hover:bg-rose-50 border border-rose-200 text-rose-950 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <mat-icon class="text-base!">download</mat-icon>
            <span>Baixar Lista Completa (CSV)</span>
          </a>
        </div>
      </div>
    </div>
  `,
})
export class BabyToolsPanel {
  protected readonly store = inject(EnxovalStore);
  private readonly diaperTiersRef = viewChild<ElementRef<HTMLElement>>('diaperTiers');

  readonly months = signal(4);
  readonly changesPerDay = signal(8);
  readonly addingDiapers = signal(false);
  private initializedTiers = false;

  constructor() {
    effect(() => {
      this.months();
      this.changesPerDay();
      if (!this.initializedTiers) {
        this.initializedTiers = true;
        return;
      }
      if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      const container = untracked(() => this.diaperTiersRef()?.nativeElement);
      const boxes = container?.querySelectorAll('.tier-box');
      if (boxes && boxes.length > 0) {
        animate(
          boxes,
          {scale: [0.95, 1.03, 1], opacity: [0.75, 1]},
          {delay: stagger(0.03), duration: 0.28, ease: [0.16, 1, 0.3, 1]},
        );
      }
    });
  }

  readonly totalDiapers = computed(() => this.months() * 30 * this.changesPerDay());

  readonly diaperBreakdown = computed(() => {
    const m = this.months();
    const daily = this.changesPerDay();
    const rnUnits = Math.min(m, 1) * 20 * daily;
    const pUnits = m >= 2 ? 40 * daily : Math.max(0, m * 30 - 20) * daily;
    const mUnits = m >= 3 ? Math.min(m - 2, 4) * 30 * daily : 0;
    const gUnits = m >= 7 ? (m - 6) * 30 * daily : 0;

    return [
      {size: 'Tamanho RN', units: rnUnits, packs: Math.max(1, Math.ceil(rnUnits / 36))},
      {size: 'Tamanho P', units: pUnits, packs: Math.ceil(pUnits / 40)},
      {size: 'Tamanho M', units: mUnits, packs: Math.ceil(mUnits / 44)},
      {size: 'Tamanho G', units: gUnits, packs: Math.ceil(gUnits / 40)},
    ];
  });

  readonly totalPacks = computed(() =>
    this.diaperBreakdown().reduce((acc, tier) => acc + tier.packs, 0),
  );

  changeMonths(delta: number): void {
    this.months.update((m) => Math.max(1, Math.min(12, m + delta)));
  }

  changePerDay(delta: number): void {
    this.changesPerDay.update((d) => Math.max(5, Math.min(12, d + delta)));
  }

  async addCalculatedDiapers(): Promise<void> {
    if (!this.store.isAuthenticated()) {
      this.store.authModalOpen.set(true);
      this.store.showToast('Entre com sua conta Google para adicionar pacotes ao enxoval.');
      return;
    }
    if (!this.store.canManageActiveList()) {
      this.store.showToast('Crie sua própria lista no assistente para adicionar estoque personalizado.');
      this.store.wizardOpen.set(true);
      return;
    }
    this.addingDiapers.set(true);
    try {
      const packs = this.totalPacks();
      await this.store.addItem({
        stage: 'bebe_rn',
        category: 'Troca & Farmácia',
        name: `Estoque Calculado de Fraldas (${this.months()} meses)`,
        description: `Planejamento automático para ${this.changesPerDay()} trocas diárias: RN, P, M e G.`,
        priority: 'Essencial',
        requiredQty: packs,
        unitPriceBrl: 54.9,
        searchQuery: 'fralda pampers premium care mega',
      });
    } finally {
      this.addingDiapers.set(false);
    }
  }
}
