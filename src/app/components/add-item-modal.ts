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
  viewChild,
} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {animate} from 'motion';
import {FULL_ENXOVAL_CATALOG, STAGE_IMAGES} from '../core/catalog-seed';
import {EnxovalStore} from '../core/enxoval-store';
import {EnxovalItem, EnxovalStage, ItemPriority} from '../core/models';
import {KawaiiRibbon} from './kawaii-ornaments';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-add-item-modal',
  imports: [CurrencyPipe, ReactiveFormsModule, MatIconModule, KawaiiRibbon],
  template: `
    @if (open()) {
      <div
        (keydown.escape)="closed.emit()"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-[#0F1115]/35 backdrop-blur-sm"
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
          class="relative z-10 bento-card-strong w-full sm:max-w-3xl rounded-t-[28px] sm:rounded-[28px] overflow-hidden max-h-[93vh] flex flex-col text-[#0F1115]"
        >
          <div class="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
            <span class="w-10 h-1.5 rounded-full bg-[#CBD2DD]"></span>
          </div>

          <!-- Header + Mode Switcher -->
          <div class="px-5 sm:px-6 pt-3.5 pb-4 border-b border-[#E4E7EC] bg-[#F6F7F9] shrink-0 space-y-3.5">
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-3 min-w-0">
                <app-kawaii-ribbon [size]="30" />
                <div class="min-w-0">
                  <p class="text-xs font-bold text-[#C2185B]">
                    Catálogo Curado ({{ fullCatalog.length }} itens) &amp; Item Personalizado
                  </p>
                  <h2 id="add-item-title" class="font-display text-lg font-bold text-[#0F1115] truncate">
                    Escolher Itens para o Enxoval
                  </h2>
                </div>
              </div>
              <button
                type="button"
                (click)="closed.emit()"
                aria-label="Fechar modal"
                class="apple-press min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#4B5563] hover:text-[#0F1115] hover:bg-[#E4E7EC] cursor-pointer shrink-0"
              >
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <!-- Two-Tab Segmented Control -->
            <div class="inline-flex items-center gap-1 p-1 rounded-full bg-white border border-[#E4E7EC] shadow-xs">
              <button
                type="button"
                (click)="activeTab.set('catalogo')"
                class="apple-press min-h-[38px] inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs cursor-pointer whitespace-nowrap"
                [class.bg-[#FF80AB]]="activeTab() === 'catalogo'"
                [class.text-[#111111]]="activeTab() === 'catalogo'"
                [class.font-bold]="activeTab() === 'catalogo'"
                [class.text-[#4B5563]]="activeTab() !== 'catalogo'"
                [class.font-semibold]="activeTab() !== 'catalogo'"
              >
                <mat-icon class="text-base!">inventory_2</mat-icon>
                <span>Catálogo Completo ({{ fullCatalog.length }})</span>
              </button>
              <button
                type="button"
                (click)="activeTab.set('custom')"
                class="apple-press min-h-[38px] inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs cursor-pointer whitespace-nowrap"
                [class.bg-[#FF80AB]]="activeTab() === 'custom'"
                [class.text-[#111111]]="activeTab() === 'custom'"
                [class.font-bold]="activeTab() === 'custom'"
                [class.text-[#4B5563]]="activeTab() !== 'custom'"
                [class.font-semibold]="activeTab() !== 'custom'"
              >
                <mat-icon class="text-base!">edit_note</mat-icon>
                <span>Item Personalizado</span>
              </button>
            </div>
          </div>

          @if (activeTab() === 'catalogo') {
            <!-- TAB 1: FULL SEARCH & MULTI-SELECT CATALOG -->
            <div class="p-4 sm:px-6 sm:pt-4 sm:pb-3 border-b border-[#E4E7EC] bg-white shrink-0 space-y-3">
              @if (!store.isAuthenticated()) {
                <div class="rounded-[18px] bg-[#F6F7F9] border border-[#E4E7EC] px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div class="text-xs text-[#4B5563]">
                    <strong class="text-[#0F1115]">Conta Google necessária:</strong> explore os {{ fullCatalog.length }} itens abaixo e entre com Google para salvar na sua lista.
                  </div>
                  <button
                    type="button"
                    (click)="store.authModalOpen.set(true)"
                    class="apple-press min-h-[38px] px-4 py-1.5 rounded-full bg-[#FF80AB] hover:bg-[#F48FB1] text-[#111111] text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Entrar Google
                  </button>
                </div>
              } @else if (!store.canManageActiveList()) {
                <div class="rounded-[18px] bg-[#FCE4EC]/55 border border-[#F48FB1] px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div class="text-xs text-[#4B5563]">
                    <strong class="text-[#0F1115]">Lista modelo da comunidade:</strong> crie sua própria lista no assistente para escolher e gerenciar os itens.
                  </div>
                  <button
                    type="button"
                    (click)="openCreateWizard()"
                    class="apple-press min-h-[38px] px-4 py-1.5 rounded-full bg-[#111111] text-white text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Criar Minha Lista
                  </button>
                </div>
              }

              <!-- Search + Category Dropdown -->
              <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div class="relative sm:col-span-7">
                  <mat-icon class="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4B5563] text-lg!">
                    search
                  </mat-icon>
                  <input
                    type="search"
                    [formControl]="searchControl"
                    placeholder="Buscar fraldas, carrinho, termômetro, amamentação..."
                    aria-label="Buscar no catálogo completo"
                    class="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-full bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] placeholder:text-[#6B7280] focus:outline-none focus:border-[#C2185B]"
                  />
                </div>

                <select
                  [formControl]="categoryControl"
                  aria-label="Filtrar por categoria"
                  class="sm:col-span-5 min-h-[44px] px-4 py-2 rounded-full bg-[#F6F7F9] border border-[#D8DCE3] text-xs font-semibold text-[#0F1115] focus:outline-none focus:border-[#C2185B] cursor-pointer"
                >
                  <option value="all">Todas as categorias ({{ catalogCategories.length }})</option>
                  @for (cat of catalogCategories; track cat) {
                    <option [value]="cat">{{ cat }}</option>
                  }
                </select>
              </div>

              <!-- Stage & Priority Quick Filters -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div class="mask-fade-x flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  @for (st of stageFilters; track st.id) {
                    <button
                      type="button"
                      (click)="stageFilter.set(st.id)"
                      class="apple-press min-h-[34px] px-3 py-1 rounded-full text-[11px] font-semibold border cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                      [class.bg-[#FF80AB]]="stageFilter() === st.id"
                      [class.border-[#FF80AB]]="stageFilter() === st.id"
                      [class.text-[#111111]]="stageFilter() === st.id"
                      [class.font-bold]="stageFilter() === st.id"
                      [class.bg-[#F6F7F9]]="stageFilter() !== st.id"
                      [class.border-[#E4E7EC]]="stageFilter() !== st.id"
                      [class.text-[#4B5563]]="stageFilter() !== st.id"
                    >
                      {{ st.label }}
                    </button>
                  }
                </div>

                <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                  @for (pr of priorityFilters; track pr) {
                    <button
                      type="button"
                      (click)="priorityFilter.set(pr)"
                      class="apple-press min-h-[34px] px-3 py-1 rounded-full text-[11px] font-semibold border cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                      [class.bg-[#111111]]="priorityFilter() === pr"
                      [class.border-[#111111]]="priorityFilter() === pr"
                      [class.text-white]="priorityFilter() === pr"
                      [class.bg-white]="priorityFilter() !== pr"
                      [class.border-[#D8DCE3]]="priorityFilter() !== pr"
                      [class.text-[#4B5563]]="priorityFilter() !== pr"
                    >
                      {{ pr === 'all' ? 'Todas' : pr }}
                    </button>
                  }
                </div>
              </div>

              <!-- Helper Row: Visible Count + Batch Actions -->
              <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#4B5563]">
                <span class="tabular-nums font-medium">
                  Exibindo <strong class="text-[#0F1115]">{{ filteredCatalog().length }}</strong> de {{ fullCatalog.length }} itens
                </span>
                <div class="flex items-center gap-3">
                  @if (filteredCatalog().length > 0) {
                    <button
                      type="button"
                      (click)="selectAllVisibleNotAdded()"
                      class="font-bold text-[#C2185B] hover:text-[#9D174D] cursor-pointer"
                    >
                      Selecionar faltantes visíveis
                    </button>
                  }
                  @if (selectedSummary().count > 0) {
                    <button
                      type="button"
                      (click)="clearCatalogSelection()"
                      class="font-semibold text-[#4B5563] hover:text-[#0F1115] cursor-pointer"
                    >
                      Limpar ({{ selectedSummary().count }})
                    </button>
                  }
                </div>
              </div>
            </div>

            <!-- Scrollable Multi-Select Item List -->
            <div class="flex-1 overflow-y-auto p-4 sm:px-6 space-y-2.5 bg-[#F6F7F9]">
              @if (filteredCatalog().length === 0) {
                <div class="rounded-[22px] bg-white border border-[#E4E7EC] p-8 text-center space-y-3">
                  <mat-icon class="text-[#C2185B] text-3xl!">search_off</mat-icon>
                  <div class="text-sm font-bold text-[#0F1115]">Nenhum item encontrado para essa busca</div>
                  <button
                    type="button"
                    (click)="resetCatalogPickerFilters()"
                    class="apple-press min-h-[40px] px-4 py-1.5 rounded-full bg-[#FF80AB] text-[#111111] text-xs font-bold cursor-pointer"
                  >
                    Mostrar todos os {{ fullCatalog.length }} itens
                  </button>
                </div>
              } @else {
                @for (item of filteredCatalog(); track item.id) {
                  @let selectedQty = selectedMap().get(item.id);
                  @let isSelected = selectedQty !== undefined;
                  @let alreadyInList = existingItemKeySet().has(item.id) || existingNameSet().has(normalizeName(item.name));
                  <div
                    class="rounded-[20px] border p-3 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    [class.bg-[#FCE4EC]/55]="isSelected"
                    [class.border-[#C2185B]]="isSelected"
                    [class.bg-white]="!isSelected"
                    [class.border-[#E4E7EC]]="!isSelected"
                  >
                    <button
                      type="button"
                      (click)="toggleCatalogItem(item)"
                      class="flex items-start sm:items-center gap-3 text-left flex-1 min-w-0 cursor-pointer"
                    >
                      <span
                        class="w-6 h-6 mt-0.5 sm:mt-0 rounded-full flex items-center justify-center shrink-0 transition-colors border"
                        [class.bg-[#FF80AB]]="isSelected"
                        [class.border-[#C2185B]]="isSelected"
                        [class.text-[#111111]]="isSelected"
                        [class.bg-[#F6F7F9]]="!isSelected"
                        [class.border-[#CBD2DD]]="!isSelected"
                        [class.text-transparent]="!isSelected"
                      >
                        <mat-icon class="text-sm!">check</mat-icon>
                      </span>

                      <div class="w-12 h-12 rounded-xl bg-white border border-[#E4E7EC] overflow-hidden p-1 shrink-0">
                        <img
                          [src]="item.imageUrl"
                          [alt]="item.name"
                          loading="lazy"
                          (error)="onThumbError($event, item.stage)"
                          referrerpolicy="no-referrer"
                          class="w-full h-full object-contain"
                        />
                      </div>

                      <div class="min-w-0 flex-1 space-y-0.5">
                        <div class="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-[#4B5563]">
                          <span class="text-[#C2185B]">{{ stageShortLabels[item.stage] }}</span>
                          <span aria-hidden="true">·</span>
                          <span class="truncate">{{ item.category }}</span>
                          <span aria-hidden="true">·</span>
                          <span>{{ item.priority }}</span>
                          @if (alreadyInList) {
                            <span class="text-[#0F1115] font-bold">· Já na lista</span>
                          }
                        </div>
                        <div class="text-sm font-bold text-[#0F1115] leading-snug">{{ item.name }}</div>
                        <p class="text-xs text-[#4B5563] line-clamp-1">{{ item.description }}</p>
                      </div>
                    </button>

                    <!-- Price + Quantity Stepper -->
                    <div class="flex items-center justify-between sm:justify-end gap-3 pl-9 sm:pl-0 shrink-0">
                      <div class="text-left sm:text-right">
                        <div class="font-mono text-xs font-bold text-[#0F1115] tabular-nums">
                          {{ item.unitPriceBrl | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}
                        </div>
                        <div class="text-[10px] text-[#4B5563] tabular-nums">
                          Sugerido: {{ item.requiredQty }} un.
                        </div>
                      </div>

                      @if (isSelected && selectedQty !== undefined) {
                        <div class="inline-flex items-center gap-1 rounded-full bg-white border border-[#C2185B]/45 p-0.5 shadow-xs">
                          <button
                            type="button"
                            (click)="adjustItemQty(item.id, -1)"
                            aria-label="Diminuir quantidade"
                            class="apple-press w-8 h-8 rounded-full hover:bg-[#F6F7F9] flex items-center justify-center text-[#0F1115] cursor-pointer"
                          >
                            <mat-icon class="text-base!">remove</mat-icon>
                          </button>
                          <span class="w-7 text-center font-mono text-xs font-bold text-[#0F1115] tabular-nums">
                            {{ selectedQty }}
                          </span>
                          <button
                            type="button"
                            (click)="adjustItemQty(item.id, 1)"
                            aria-label="Aumentar quantidade"
                            class="apple-press w-8 h-8 rounded-full hover:bg-[#F6F7F9] flex items-center justify-center text-[#0F1115] cursor-pointer"
                          >
                            <mat-icon class="text-base!">add</mat-icon>
                          </button>
                        </div>
                      } @else {
                        <button
                          type="button"
                          (click)="toggleCatalogItem(item)"
                          class="apple-press min-h-[36px] px-3.5 py-1 rounded-full bg-[#F6F7F9] hover:bg-[#EBEEF3] border border-[#D8DCE3] text-xs font-bold text-[#0F1115] cursor-pointer whitespace-nowrap"
                        >
                          Selecionar
                        </button>
                      }
                    </div>
                  </div>
                }
              }
            </div>

            <!-- Catalog Sticky Footer -->
            <div class="px-5 sm:px-6 py-4 border-t border-[#E4E7EC] bg-white shrink-0 space-y-2.5">
              @if (errorMsg()) {
                <p class="text-xs font-semibold text-[#9D174D] bg-[#FCE4EC] border border-[#F48FB1] rounded-xl px-3 py-2">
                  {{ errorMsg() }}
                </p>
              }
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="text-xs text-[#4B5563]">
                  @if (selectedSummary().count === 0) {
                    <span>Selecione um ou mais itens acima para incluir de uma só vez.</span>
                  } @else {
                    <span class="tabular-nums">
                      <strong class="text-[#0F1115]">{{ selectedSummary().count }}</strong> item(ns) · {{ selectedSummary().units }} un. · Estimativa
                      <strong class="text-[#C2185B]">{{ selectedSummary().totalValue | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</strong>
                    </span>
                  }
                </div>

                <div class="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    (click)="closed.emit()"
                    class="min-h-[44px] px-4 py-2 rounded-full bg-[#F6F7F9] hover:bg-[#EBEEF3] border border-[#D8DCE3] text-xs font-bold text-[#0F1115] cursor-pointer apple-press whitespace-nowrap"
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    (click)="submitSelectedCatalog()"
                    [disabled]="saving() || selectedSummary().count === 0"
                    class="min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#FF80AB] hover:bg-[#F48FB1] disabled:opacity-45 text-[#111111] text-xs sm:text-sm font-bold cursor-pointer apple-press whitespace-nowrap"
                  >
                    <mat-icon class="text-base!">playlist_add_check</mat-icon>
                    <span>
                      {{ saving() ? 'Adicionando...' : 'Adicionar ' + (selectedSummary().count || '') + ' à Lista' }}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          } @else {
            <!-- TAB 2: CUSTOM ITEM REACTIVE FORM -->
            <form [formGroup]="form" (ngSubmit)="onSubmitCustom()" class="p-5 sm:p-6 overflow-y-auto space-y-4 bg-white">
              @if (!store.isAuthenticated()) {
                <div class="rounded-[20px] bg-[#F6F7F9] border border-[#E4E7EC] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div class="text-xs text-[#4B5563]">
                    <strong class="text-[#0F1115]">Conta Google necessária:</strong> conecte-se com Google para adicionar novos itens com segurança.
                  </div>
                  <button
                    type="button"
                    (click)="store.authModalOpen.set(true)"
                    class="apple-press min-h-[44px] px-5 py-2 rounded-full bg-[#FF80AB] hover:bg-[#F48FB1] text-[#111111] text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Entrar com Google
                  </button>
                </div>
              }

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="new-stage" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    Etapa do Processo
                  </label>
                  <select
                    id="new-stage"
                    formControlName="stage"
                    class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] focus:outline-none focus:border-[#C2185B]"
                  >
                    <option value="gestante">Gestante &amp; Maternidade</option>
                    <option value="bebe_rn">Bebê Recém-Nascido</option>
                    <option value="quarto_passeio">Quarto, Passeio &amp; Banho</option>
                    <option value="familia">Família &amp; Casa</option>
                  </select>
                </div>

                <div>
                  <label for="new-priority" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    Prioridade
                  </label>
                  <select
                    id="new-priority"
                    formControlName="priority"
                    class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] focus:outline-none focus:border-[#C2185B]"
                  >
                    <option value="Essencial">Essencial</option>
                    <option value="Recomendado">Recomendado</option>
                    <option value="Conforto">Conforto</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="new-name" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    Nome do Item
                  </label>
                  <input
                    id="new-name"
                    type="text"
                    formControlName="name"
                    placeholder="Ex.: Termômetro de Banho Digital"
                    class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] placeholder:text-[#6B7280] focus:outline-none focus:border-[#C2185B]"
                  />
                </div>

                <div>
                  <label for="new-category" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    Categoria
                  </label>
                  <input
                    id="new-category"
                    type="text"
                    formControlName="category"
                    placeholder="Ex.: Banho &amp; Higiene"
                    class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] placeholder:text-[#6B7280] focus:outline-none focus:border-[#C2185B]"
                  />
                </div>
              </div>

              <div>
                <label for="new-desc" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                  Detalhes ou Especificações
                </label>
                <textarea
                  id="new-desc"
                  rows="2"
                  formControlName="description"
                  placeholder="Ex.: Material livre de BPA, cor rosa ou neutro"
                  class="w-full px-4 py-2.5 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] placeholder:text-[#6B7280] focus:outline-none focus:border-[#C2185B] resize-none"
                ></textarea>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label for="new-qty" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    Quantidade
                  </label>
                  <input
                    id="new-qty"
                    type="number"
                    min="1"
                    max="200"
                    formControlName="requiredQty"
                    class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] tabular-nums focus:outline-none focus:border-[#C2185B]"
                  />
                </div>

                <div>
                  <label for="new-price" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    Preço Unitário (R$)
                  </label>
                  <input
                    id="new-price"
                    type="number"
                    step="0.01"
                    min="1"
                    formControlName="unitPriceBrl"
                    class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] tabular-nums focus:outline-none focus:border-[#C2185B]"
                  />
                </div>
              </div>

              <div>
                <label for="new-query" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                  Termo para Indexação Direta (Magalu, Mercado Livre, Amazon, Farmácias)
                </label>
                <input
                  id="new-query"
                  type="text"
                  formControlName="searchQuery"
                  placeholder="Opcional — usa o nome do item se vazio"
                  class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] placeholder:text-[#6B7280] focus:outline-none focus:border-[#C2185B]"
                />
              </div>

              @if (errorMsg()) {
                <p class="text-xs font-semibold text-[#9D174D] bg-[#FCE4EC] border border-[#F48FB1] rounded-xl px-3 py-2">
                  {{ errorMsg() }}
                </p>
              }

              <div class="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
                <button
                  type="button"
                  (click)="closed.emit()"
                  class="min-h-[44px] px-5 py-2.5 rounded-full bg-[#F6F7F9] hover:bg-[#EBEEF3] border border-[#D8DCE3] text-sm font-semibold text-[#0F1115] cursor-pointer apple-press whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  [disabled]="saving() || form.invalid"
                  class="min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-[#FF80AB] hover:bg-[#F48FB1] disabled:opacity-45 text-[#111111] text-sm font-bold cursor-pointer apple-press whitespace-nowrap"
                >
                  <mat-icon class="text-base!">add_circle</mat-icon>
                  <span>{{ saving() ? 'Indexando lojas...' : 'Salvar e Indexar Item' }}</span>
                </button>
              </div>
            </form>
          }
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

  protected readonly fullCatalog = FULL_ENXOVAL_CATALOG;
  protected readonly catalogCategories = Array.from(
    new Set(FULL_ENXOVAL_CATALOG.map((it) => it.category)),
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  protected readonly stageFilters: {id: EnxovalStage | 'all'; label: string}[] = [
    {id: 'all', label: 'Tudo'},
    {id: 'gestante', label: 'Gestante'},
    {id: 'bebe_rn', label: 'Bebê RN'},
    {id: 'quarto_passeio', label: 'Quarto & Passeio'},
    {id: 'familia', label: 'Família'},
  ];

  protected readonly priorityFilters: (ItemPriority | 'all')[] = [
    'all',
    'Essencial',
    'Recomendado',
    'Conforto',
  ];

  protected readonly stageShortLabels: Record<EnxovalStage, string> = {
    gestante: 'Gestante',
    bebe_rn: 'Bebê RN',
    quarto_passeio: 'Quarto & Passeio',
    familia: 'Família',
  };

  readonly activeTab = signal<'catalogo' | 'custom'>('catalogo');
  readonly stageFilter = signal<EnxovalStage | 'all'>('all');
  readonly priorityFilter = signal<ItemPriority | 'all'>('all');
  readonly searchText = signal('');
  readonly categoryText = signal('all');
  readonly selectedMap = signal<Map<string, number>>(new Map());
  readonly saving = signal(false);
  readonly errorMsg = signal<string | null>(null);

  readonly searchControl = new FormControl('', {nonNullable: true});
  readonly categoryControl = new FormControl('all', {nonNullable: true});

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

  readonly existingItemKeySet = computed(() => {
    const keys = new Set<string>();
    for (const active of this.store.items()) {
      for (const tpl of FULL_ENXOVAL_CATALOG) {
        if (active.id === tpl.id || active.id.endsWith(`-${tpl.id}`)) {
          keys.add(tpl.id);
        }
      }
    }
    return keys;
  });

  readonly existingNameSet = computed(() => {
    const names = new Set<string>();
    for (const active of this.store.items()) {
      names.add(this.normalizeName(active.name));
    }
    return names;
  });

  readonly filteredCatalog = computed(() => {
    const stage = this.stageFilter();
    const pri = this.priorityFilter();
    const cat = this.categoryText();
    const q = this.searchText().trim().toLowerCase();

    return this.fullCatalog.filter((item) => {
      if (stage !== 'all' && item.stage !== stage) return false;
      if (pri !== 'all' && item.priority !== pri) return false;
      if (cat !== 'all' && item.category !== cat) return false;
      if (q) {
        const hay = `${item.name} ${item.category} ${item.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });

  readonly selectedSummary = computed(() => {
    const map = this.selectedMap();
    let count = 0;
    let units = 0;
    let totalValue = 0;
    for (const tpl of this.fullCatalog) {
      const qty = map.get(tpl.id);
      if (qty !== undefined) {
        count++;
        units += qty;
        totalValue += qty * tpl.unitPriceBrl;
      }
    }
    return {count, units, totalValue: Number(totalValue.toFixed(2))};
  });

  private wasOpen = false;

  constructor() {
    this.searchControl.valueChanges.subscribe((v) => this.searchText.set(v));
    this.categoryControl.valueChanges.subscribe((v) => this.categoryText.set(v));

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

  protected normalizeName(name: string): string {
    return name.trim().toLowerCase();
  }

  protected toggleCatalogItem(item: EnxovalItem): void {
    this.selectedMap.update((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.set(item.id, item.requiredQty);
      }
      return next;
    });
  }

  protected adjustItemQty(itemId: string, delta: number): void {
    this.selectedMap.update((prev) => {
      const next = new Map(prev);
      const current = next.get(itemId);
      if (current === undefined) return prev;
      const updated = Math.max(1, Math.min(200, current + delta));
      next.set(itemId, updated);
      return next;
    });
  }

  protected selectAllVisibleNotAdded(): void {
    const existingIds = this.existingItemKeySet();
    const existingNames = this.existingNameSet();
    const visible = this.filteredCatalog();
    this.selectedMap.update((prev) => {
      const next = new Map(prev);
      for (const item of visible) {
        const inList = existingIds.has(item.id) || existingNames.has(this.normalizeName(item.name));
        if (!inList && !next.has(item.id)) {
          next.set(item.id, item.requiredQty);
        }
      }
      return next;
    });
  }

  protected clearCatalogSelection(): void {
    this.selectedMap.set(new Map());
  }

  protected resetCatalogPickerFilters(): void {
    this.stageFilter.set('all');
    this.priorityFilter.set('all');
    this.searchControl.setValue('');
    this.categoryControl.setValue('all');
  }

  protected openCreateWizard(): void {
    this.closed.emit();
    this.store.wizardOpen.set(true);
  }

  protected onThumbError(event: Event, stage: EnxovalStage): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;
    const fallback = STAGE_IMAGES[stage];
    if (!img.src.endsWith(fallback)) {
      img.src = fallback;
    }
  }

  async submitSelectedCatalog(): Promise<void> {
    if (!this.store.isAuthenticated()) {
      this.store.authModalOpen.set(true);
      this.errorMsg.set('Conecte sua conta Google para salvar os itens selecionados.');
      return;
    }
    if (!this.store.canManageActiveList()) {
      this.openCreateWizard();
      this.store.showToast('Crie sua própria lista para personalizar e salvar esses itens!');
      return;
    }
    const entries = Array.from(this.selectedMap().entries()).map(([templateId, requiredQty]) => ({
      templateId,
      requiredQty,
    }));
    if (entries.length === 0 || this.saving()) return;

    this.saving.set(true);
    this.errorMsg.set(null);
    try {
      await this.store.addItemsBatch(entries);
      this.selectedMap.set(new Map());
      this.closed.emit();
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Erro ao adicionar itens.');
    } finally {
      this.saving.set(false);
    }
  }

  async onSubmitCustom(): Promise<void> {
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
