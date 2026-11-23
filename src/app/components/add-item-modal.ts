import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {animate} from 'motion';
import {EnxovalStore} from '../core/enxoval-store';
import {EnxovalStage, ItemPriority} from '../core/models';
import {KawaiiRibbon} from './kawaii-ornaments';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-add-item-modal',
  imports: [ReactiveFormsModule, MatIconModule, KawaiiRibbon],
  template: `
    @if (open()) {
      <div
        (keydown.escape)="closed.emit()"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-rose-100/55 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-item-title"
      >
        <button
          type="button"
          tabindex="-1"
          aria-label="Fechar modal"
          (click)="closed.emit()"
          class="absolute inset-0 w-full h-full cursor-default"
        ></button>
        <div
          #sheetContainer
          class="relative z-10 glass-panel-strong w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] flex flex-col"
        >
          <div class="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
            <span class="w-10 h-1.5 rounded-full bg-rose-300/80"></span>
          </div>

          <div class="flex items-center justify-between gap-4 px-5 sm:px-6 py-3.5 sm:py-4 border-b border-rose-200/60 bg-white/70 texture-silk-grid shrink-0">
            <div class="flex items-center gap-3">
              <app-kawaii-ribbon [size]="30" />
              <div>
                <p class="text-xs font-medium text-rose-700">Novo Item &amp; Indexação nas 4 Lojas</p>
                <h2 id="add-item-title" class="font-display text-lg font-semibold text-rose-950">
                  Adicionar ao Enxoval
                </h2>
              </div>
            </div>
            <button
              type="button"
              (click)="closed.emit()"
              aria-label="Fechar modal"
              class="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-rose-800 hover:bg-rose-100/80 transition-colors cursor-pointer"
            >
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="p-5 sm:p-6 overflow-y-auto space-y-4 texture-cotton-dots">
            @if (!store.isAuthenticated()) {
              <div class="rounded-2xl bg-rose-50/90 border border-rose-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="text-xs text-rose-900">
                  <strong>Conta Google necessária:</strong> conecte-se com Google para adicionar novos itens com segurança.
                </div>
                <button
                  type="button"
                  (click)="store.authModalOpen.set(true)"
                  class="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                >
                  Entrar com Google
                </button>
              </div>
            }

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="new-stage" class="block text-xs font-semibold text-rose-900 mb-1">
                  Etapa do Processo
                </label>
                <select
                  id="new-stage"
                  formControlName="stage"
                  class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-400"
                >
                  <option value="gestante">Gestante &amp; Maternidade</option>
                  <option value="bebe_rn">Bebê Recém-Nascido</option>
                  <option value="quarto_passeio">Quarto, Passeio &amp; Banho</option>
                  <option value="familia">Família &amp; Casa</option>
                </select>
              </div>

              <div>
                <label for="new-priority" class="block text-xs font-semibold text-rose-900 mb-1">
                  Prioridade
                </label>
                <select
                  id="new-priority"
                  formControlName="priority"
                  class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-400"
                >
                  <option value="Essencial">Essencial</option>
                  <option value="Recomendado">Recomendado</option>
                  <option value="Conforto">Conforto</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="new-name" class="block text-xs font-semibold text-rose-900 mb-1">
                  Nome do Item
                </label>
                <input
                  id="new-name"
                  type="text"
                  formControlName="name"
                  placeholder="Ex.: Termômetro de Banho Digital"
                  class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
              </div>

              <div>
                <label for="new-category" class="block text-xs font-semibold text-rose-900 mb-1">
                  Categoria
                </label>
                <input
                  id="new-category"
                  type="text"
                  formControlName="category"
                  placeholder="Ex.: Banho &amp; Higiene"
                  class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
              </div>
            </div>

            <div>
              <label for="new-desc" class="block text-xs font-semibold text-rose-900 mb-1">
                Detalhes ou Especificações
              </label>
              <textarea
                id="new-desc"
                rows="2"
                formControlName="description"
                placeholder="Ex.: Material livre de BPA, cor rosa chá ou neutro"
                class="w-full px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
              ></textarea>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="new-qty" class="block text-xs font-semibold text-rose-900 mb-1">
                  Quantidade
                </label>
                <input
                  id="new-qty"
                  type="number"
                  min="1"
                  max="200"
                  formControlName="requiredQty"
                  class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 tabular-nums focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
              </div>

              <div>
                <label for="new-price" class="block text-xs font-semibold text-rose-900 mb-1">
                  Preço Unitário (R$)
                </label>
                <input
                  id="new-price"
                  type="number"
                  step="0.01"
                  min="1"
                  formControlName="unitPriceBrl"
                  class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 tabular-nums focus:outline-none focus:ring-2 focus:ring-rose-400"
                />
              </div>
            </div>

            <div>
              <label for="new-query" class="block text-xs font-semibold text-rose-900 mb-1">
                Termo para Indexação Direta (Magalu, Mercado Livre, Amazon, Farmácias)
              </label>
              <input
                id="new-query"
                type="text"
                formControlName="searchQuery"
                placeholder="Opcional — usa o nome do item se vazio"
                class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>

            @if (errorMsg()) {
              <p class="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {{ errorMsg() }}
              </p>
            }

            <div class="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
              <button
                type="button"
                (click)="closed.emit()"
                class="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/80 hover:bg-rose-50 border border-rose-200 text-sm font-medium text-rose-900 cursor-pointer transition-all apple-press whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                type="submit"
                [disabled]="saving() || form.invalid"
                class="min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer transition-all apple-press whitespace-nowrap"
              >
                <mat-icon class="text-base!">add_circle</mat-icon>
                <span>{{ saving() ? 'Indexando lojas...' : 'Salvar e Indexar Item' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class AddItemModal {
  protected readonly store = inject(EnxovalStore);
  private readonly sheetRef = viewChild<ElementRef<HTMLElement>>('sheetContainer');

  readonly open = input(false);
  readonly closed = output<void>();

  readonly saving = signal(false);
  readonly errorMsg = signal<string | null>(null);

  readonly form = new FormGroup({
    stage: new FormControl<EnxovalStage>('bebe_rn', {nonNullable: true}),
    priority: new FormControl<ItemPriority>('Essencial', {nonNullable: true}),
    name: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.minLength(2)]}),
    category: new FormControl('Cuidados do Bebê', {nonNullable: true, validators: [Validators.required]}),
    description: new FormControl('', {nonNullable: true}),
    requiredQty: new FormControl(1, {nonNullable: true, validators: [Validators.required, Validators.min(1)]}),
    unitPriceBrl: new FormControl(89.9, {nonNullable: true, validators: [Validators.required, Validators.min(1)]}),
    searchQuery: new FormControl('', {nonNullable: true}),
  });

  private wasOpen = false;

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const el = this.sheetRef()?.nativeElement;
      if (isOpen && !this.wasOpen) {
        this.wasOpen = true;
        this.errorMsg.set(null);
        if (el && typeof window !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          animate(el, {opacity: [0, 1], y: [28, 0]}, {duration: 0.28, ease: [0.16, 1, 0.3, 1]});
        }
      } else if (!isOpen) {
        this.wasOpen = false;
      }
    });
  }

  async onSubmit(): Promise<void> {
    if (!this.store.isAuthenticated()) {
      this.store.authModalOpen.set(true);
      return;
    }
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.errorMsg.set(null);
    try {
      const val = this.form.getRawValue();
      await this.store.addItem({
        stage: val.stage,
        priority: val.priority,
        name: val.name.trim(),
        category: val.category.trim(),
        description: val.description.trim(),
        requiredQty: Number(val.requiredQty),
        unitPriceBrl: Number(val.unitPriceBrl),
        searchQuery: val.searchQuery.trim() || val.name.trim(),
      });
      this.form.reset({
        stage: 'bebe_rn',
        priority: 'Essencial',
        name: '',
        category: 'Cuidados do Bebê',
        description: '',
        requiredQty: 1,
        unitPriceBrl: 89.9,
        searchQuery: '',
      });
      this.closed.emit();
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Erro ao adicionar item.');
    } finally {
      this.saving.set(false);
    }
  }
}
