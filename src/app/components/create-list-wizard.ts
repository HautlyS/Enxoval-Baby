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
import {FULL_ENXOVAL_CATALOG, INITIAL_ENXOVAL_ITEMS, STAGE_IMAGES} from '../core/catalog-seed';
import {EnxovalStore} from '../core/enxoval-store';
import {EnxovalItem, EnxovalStage, ItemPriority, PixKeyType} from '../core/models';
import {validatePixKey} from '../core/pix-brcode';
import {KawaiiRibbon} from './kawaii-ornaments';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-create-list-wizard',
  imports: [CurrencyPipe, ReactiveFormsModule, MatIconModule, KawaiiRibbon],
  template: `
    @if (open()) {
      <div
        (keydown.escape)="closeWizard()"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-[#0F1115]/35 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
      >
        <button
          type="button"
          tabindex="-1"
          aria-label="Fechar assistente"
          (click)="closeWizard()"
          class="absolute inset-0 w-full h-full cursor-default"
        ></button>
        <div
          #sheetContainer
          class="relative z-10 bento-card-strong w-full sm:max-w-2xl rounded-t-[28px] sm:rounded-[28px] overflow-hidden max-h-[93vh] flex flex-col text-[#0F1115]"
        >
          <!-- Mobile Grab Handle -->
          <div class="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
            <span class="w-10 h-1.5 rounded-full bg-[#CBD2DD]"></span>
          </div>

          <!-- Header & Animated Stepper -->
          <div class="px-5 sm:px-6 pt-3.5 pb-4 border-b border-[#E4E7EC] bg-[#F6F7F9] shrink-0 space-y-3.5">
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-3 min-w-0">
                <app-kawaii-ribbon [size]="30" />
                <div class="min-w-0">
                  <p class="text-xs font-bold text-[#C2185B]">
                    Passo {{ step() }} de 4 · Assistente de Enxoval
                  </p>
                  <h2 id="wizard-title" class="font-display text-lg font-bold text-[#0F1115] truncate">
                    {{ stepTitles[step() - 1] }}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                (click)="closeWizard()"
                aria-label="Fechar assistente de criação"
                class="apple-press min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#4B5563] hover:text-[#0F1115] hover:bg-[#E4E7EC] cursor-pointer shrink-0"
              >
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <!-- Stepper Progress Track -->
            <div class="grid grid-cols-4 gap-2" aria-label="Progresso do assistente">
              @for (s of [1, 2, 3, 4]; track s) {
                <div class="space-y-1">
                  <div class="h-1.5 w-full rounded-full bg-[#E4E7EC] overflow-hidden">
                    <div
                      class="h-full rounded-full bg-[#C2185B] transition-all duration-300"
                      [style.width.%]="step() >= s ? 100 : 0"
                    ></div>
                  </div>
                  <div
                    class="text-[10px] font-bold truncate"
                    [class.text-[#0F1115]]="step() === s"
                    [class.text-[#4B5563]]="step() !== s"
                  >
                    {{ stepShortLabels[s - 1] }}
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Animated Step Content Body -->
          <div #stepBody class="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 bg-white">
            @if (step() === 1) {
              <!-- Step 1: Baby Identity & Share Slug -->
              <form [formGroup]="identityForm" class="space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label for="wiz-baby" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                      Nome ou Apelido do Bebê
                    </label>
                    <input
                      id="wiz-baby"
                      type="text"
                      formControlName="babyName"
                      placeholder="Ex.: Alice, Bento ou Nosso Bebê"
                      class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] placeholder:text-[#6B7280] focus:outline-none focus:border-[#C2185B]"
                    />
                  </div>
                  <div>
                    <label for="wiz-title" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                      Título da Sua Lista
                    </label>
                    <input
                      id="wiz-title"
                      type="text"
                      formControlName="title"
                      placeholder="Ex.: Enxoval da Pequena Alice"
                      class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] placeholder:text-[#6B7280] focus:outline-none focus:border-[#C2185B]"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label for="wiz-city" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                      Cidade da Família
                    </label>
                    <input
                      id="wiz-city"
                      type="text"
                      formControlName="creatorCity"
                      placeholder="Ex.: SAO PAULO"
                      class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] focus:outline-none focus:border-[#C2185B]"
                    />
                  </div>
                  <div>
                    <label for="wiz-due" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                      Data Prevista do Parto (opcional)
                    </label>
                    <input
                      id="wiz-due"
                      type="date"
                      formControlName="dueDate"
                      class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] focus:outline-none focus:border-[#C2185B]"
                    />
                  </div>
                </div>

                <div>
                  <label for="wiz-slug" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    Endereço Curto de Compartilhamento
                  </label>
                  <div class="flex items-center rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] overflow-hidden focus-within:border-[#C2185B]">
                    <span class="px-3.5 text-xs font-mono font-bold text-[#C2185B] bg-[#EBEEF3] min-h-[44px] flex items-center shrink-0">
                      ?list=
                    </span>
                    <input
                      id="wiz-slug"
                      type="text"
                      formControlName="customSlug"
                      placeholder="enxoval-da-alice"
                      class="w-full min-h-[44px] px-3 py-2 bg-transparent text-sm font-mono text-[#0F1115] focus:outline-none"
                    />
                  </div>
                  @if (sanitizedSlugPreview()) {
                    <p class="mt-1.5 text-[11px] font-mono font-semibold text-[#C2185B] truncate">
                      Link final: /?list={{ sanitizedSlugPreview() }}
                    </p>
                  }
                </div>

                <div>
                  <label for="wiz-note" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    Mensagem de Boas-Vindas aos Convidados
                  </label>
                  <textarea
                    id="wiz-note"
                    rows="2"
                    formControlName="welcomeNote"
                    placeholder="Preparamos com carinho cada item que vamos precisar nesta nova jornada..."
                    class="w-full px-4 py-2.5 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] placeholder:text-[#6B7280] focus:outline-none focus:border-[#C2185B] resize-none"
                  ></textarea>
                </div>
              </form>
            } @else if (step() === 2) {
              <!-- Step 2: Full Search & Multi-Select Enxoval Catalog (68 Items) -->
              <div class="space-y-3.5">
                <!-- Quick Presets Row -->
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      (click)="applySelectionPreset('starter')"
                      class="apple-press min-h-[34px] px-3 py-1 rounded-full text-[11px] font-bold border cursor-pointer transition-colors"
                      [class.bg-[#FF80AB]]="activePreset() === 'starter'"
                      [class.border-[#FF80AB]]="activePreset() === 'starter'"
                      [class.text-[#111111]]="activePreset() === 'starter'"
                      [class.bg-[#F6F7F9]]="activePreset() !== 'starter'"
                      [class.border-[#D8DCE3]]="activePreset() !== 'starter'"
                      [class.text-[#0F1115]]="activePreset() !== 'starter'"
                    >
                      Base Recomendada ({{ starterItems.length }})
                    </button>
                    <button
                      type="button"
                      (click)="applySelectionPreset('essentials')"
                      class="apple-press min-h-[34px] px-3 py-1 rounded-full text-[11px] font-bold border cursor-pointer transition-colors"
                      [class.bg-[#FF80AB]]="activePreset() === 'essentials'"
                      [class.border-[#FF80AB]]="activePreset() === 'essentials'"
                      [class.text-[#111111]]="activePreset() === 'essentials'"
                      [class.bg-[#F6F7F9]]="activePreset() !== 'essentials'"
                      [class.border-[#D8DCE3]]="activePreset() !== 'essentials'"
                      [class.text-[#0F1115]]="activePreset() !== 'essentials'"
                    >
                      Lista Enxuta ({{ essentialCatalogCount }})
                    </button>
                    <button
                      type="button"
                      (click)="applySelectionPreset('all')"
                      class="apple-press min-h-[34px] px-3 py-1 rounded-full text-[11px] font-bold border cursor-pointer transition-colors"
                      [class.bg-[#FF80AB]]="activePreset() === 'all'"
                      [class.border-[#FF80AB]]="activePreset() === 'all'"
                      [class.text-[#111111]]="activePreset() === 'all'"
                      [class.bg-[#F6F7F9]]="activePreset() !== 'all'"
                      [class.border-[#D8DCE3]]="activePreset() !== 'all'"
                      [class.text-[#0F1115]]="activePreset() !== 'all'"
                    >
                      Tudo ({{ fullCatalog.length }})
                    </button>
                  </div>

                  <button
                    type="button"
                    (click)="clearAllSelections()"
                    class="text-[11px] font-bold text-[#C2185B] hover:text-[#9D174D] cursor-pointer"
                  >
                    Desmarcar tudo
                  </button>
                </div>

                <!-- Search & Category Select -->
                <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div class="relative sm:col-span-7">
                    <mat-icon class="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4B5563] text-lg!">
                      search
                    </mat-icon>
                    <input
                      type="search"
                      [formControl]="wizardSearchControl"
                      placeholder="Buscar fraldas, berço, cadeirão, mala..."
                      aria-label="Buscar itens no assistente"
                      class="w-full min-h-[42px] pl-10 pr-4 py-1.5 rounded-full bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] placeholder:text-[#6B7280] focus:outline-none focus:border-[#C2185B]"
                    />
                  </div>
                  <select
                    [formControl]="wizardCategoryControl"
                    aria-label="Filtrar categoria no assistente"
                    class="sm:col-span-5 min-h-[42px] px-4 py-1.5 rounded-full bg-[#F6F7F9] border border-[#D8DCE3] text-xs font-semibold text-[#0F1115] focus:outline-none focus:border-[#C2185B] cursor-pointer"
                  >
                    <option value="all">Todas categorias ({{ catalogCategories.length }})</option>
                    @for (cat of catalogCategories; track cat) {
                      <option [value]="cat">{{ cat }}</option>
                    }
                  </select>
                </div>

                <!-- Stage & Priority Filter Pills -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div class="mask-fade-x flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    @for (st of wizardStageTabs; track st.id) {
                      <button
                        type="button"
                        (click)="wizardStageFilter.set(st.id)"
                        class="apple-press min-h-[34px] px-3 py-1 rounded-full text-[11px] font-semibold border cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                        [class.bg-[#FF80AB]]="wizardStageFilter() === st.id"
                        [class.border-[#FF80AB]]="wizardStageFilter() === st.id"
                        [class.text-[#111111]]="wizardStageFilter() === st.id"
                        [class.font-bold]="wizardStageFilter() === st.id"
                        [class.bg-[#F6F7F9]]="wizardStageFilter() !== st.id"
                        [class.border-[#E4E7EC]]="wizardStageFilter() !== st.id"
                        [class.text-[#4B5563]]="wizardStageFilter() !== st.id"
                      >
                        {{ st.label }}
                      </button>
                    }
                  </div>

                  <div class="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
                    @for (pr of wizardPriorityTabs; track pr) {
                      <button
                        type="button"
                        (click)="wizardPriorityFilter.set(pr)"
                        class="apple-press min-h-[32px] px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                        [class.bg-[#111111]]="wizardPriorityFilter() === pr"
                        [class.border-[#111111]]="wizardPriorityFilter() === pr"
                        [class.text-white]="wizardPriorityFilter() === pr"
                        [class.bg-white]="wizardPriorityFilter() !== pr"
                        [class.border-[#D8DCE3]]="wizardPriorityFilter() !== pr"
                        [class.text-[#4B5563]]="wizardPriorityFilter() !== pr"
                      >
                        {{ pr === 'all' ? 'Todas' : pr }}
                      </button>
                    }
                  </div>
                </div>

                <!-- Filtered Count + Select Visible -->
                <div class="flex items-center justify-between gap-2 text-[11px] text-[#4B5563]">
                  <span class="tabular-nums">
                    Mostrando <strong class="text-[#0F1115]">{{ filteredWizardCatalog().length }}</strong> de {{ fullCatalog.length }} itens
                  </span>
                  @if (filteredWizardCatalog().length > 0) {
                    <button
                      type="button"
                      (click)="selectAllVisibleWizard()"
                      class="font-bold text-[#C2185B] hover:text-[#9D174D] cursor-pointer"
                    >
                      Marcar visíveis ({{ filteredWizardCatalog().length }})
                    </button>
                  }
                </div>

                <!-- Multi-Select Scrollable List -->
                <div class="max-h-[290px] sm:max-h-[320px] overflow-y-auto rounded-[22px] bg-[#F6F7F9] border border-[#E4E7EC] p-2.5 space-y-2">
                  @if (filteredWizardCatalog().length === 0) {
                    <div class="py-8 text-center space-y-2">
                      <div class="text-xs font-bold text-[#0F1115]">Nenhum item encontrado neste filtro</div>
                      <button
                        type="button"
                        (click)="resetWizardCatalogFilters()"
                        class="apple-press min-h-[36px] px-4 py-1 rounded-full bg-[#FF80AB] text-[#111111] text-xs font-bold cursor-pointer"
                      >
                        Limpar filtros
                      </button>
                    </div>
                  } @else {
                    @for (item of filteredWizardCatalog(); track item.id) {
                      @let chosenQty = selectedItemQuantities().get(item.id);
                      @let isChosen = chosenQty !== undefined;
                      <div
                        class="rounded-[18px] border p-2.5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                        [class.bg-[#FCE4EC]/55]="isChosen"
                        [class.border-[#C2185B]]="isChosen"
                        [class.bg-white]="!isChosen"
                        [class.border-[#E4E7EC]]="!isChosen"
                      >
                        <button
                          type="button"
                          (click)="toggleWizardItem(item)"
                          class="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
                        >
                          <span
                            class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-colors"
                            [class.bg-[#FF80AB]]="isChosen"
                            [class.border-[#C2185B]]="isChosen"
                            [class.text-[#111111]]="isChosen"
                            [class.bg-[#F6F7F9]]="!isChosen"
                            [class.border-[#CBD2DD]]="!isChosen"
                            [class.text-transparent]="!isChosen"
                          >
                            <mat-icon class="text-[13px]!">check</mat-icon>
                          </span>

                          <div class="w-10 h-10 rounded-xl bg-white border border-[#E4E7EC] overflow-hidden p-0.5 shrink-0">
                            <img
                              [src]="item.imageUrl"
                              [alt]="item.name"
                              loading="lazy"
                              (error)="onWizardThumbError($event, item.stage)"
                              referrerpolicy="no-referrer"
                              class="w-full h-full object-contain"
                            />
                          </div>

                          <div class="min-w-0 flex-1">
                            <div class="text-[10px] font-semibold text-[#4B5563] truncate">
                              <span class="text-[#C2185B]">{{ stageShortLabels[item.stage] }}</span> · {{ item.category }} · {{ item.priority }}
                            </div>
                            <div class="text-xs font-bold text-[#0F1115] truncate">{{ item.name }}</div>
                          </div>
                        </button>

                        <div class="flex items-center justify-between sm:justify-end gap-2.5 pl-7 sm:pl-0 shrink-0">
                          <span class="font-mono text-xs font-bold text-[#0F1115] tabular-nums">
                            {{ item.unitPriceBrl | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}
                          </span>

                          @if (isChosen && chosenQty !== undefined) {
                            <div class="inline-flex items-center gap-0.5 rounded-full bg-white border border-[#C2185B]/45 p-0.5">
                              <button
                                type="button"
                                (click)="adjustWizardItemQty(item.id, -1)"
                                aria-label="Diminuir quantidade"
                                class="apple-press w-7 h-7 rounded-full hover:bg-[#F6F7F9] flex items-center justify-center text-[#0F1115] cursor-pointer"
                              >
                                <mat-icon class="text-sm!">remove</mat-icon>
                              </button>
                              <span class="w-6 text-center font-mono text-xs font-bold text-[#0F1115] tabular-nums">
                                {{ chosenQty }}
                              </span>
                              <button
                                type="button"
                                (click)="adjustWizardItemQty(item.id, 1)"
                                aria-label="Aumentar quantidade"
                                class="apple-press w-7 h-7 rounded-full hover:bg-[#F6F7F9] flex items-center justify-center text-[#0F1115] cursor-pointer"
                              >
                                <mat-icon class="text-sm!">add</mat-icon>
                              </button>
                            </div>
                          }
                        </div>
                      </div>
                    }
                  }
                </div>

                <!-- Live Preview Summary Bar -->
                <div class="rounded-[18px] bg-[#F6F7F9] border border-[#E4E7EC] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div class="text-[#4B5563]">
                    Selecionados:
                    <strong class="text-[#0F1115] tabular-nums">{{ previewSelection().count }} itens</strong>
                    <span class="text-[#4B5563] tabular-nums"> ({{ previewSelection().units }} un.)</span>
                  </div>
                  <div class="font-mono font-bold text-[#C2185B] tabular-nums">
                    Estimativa: {{ previewSelection().totalValue | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}
                  </div>
                </div>
              </div>
            } @else if (step() === 3) {
              <!-- Step 3: Google Creator Auth + Optional Pix Key -->
              <div class="space-y-4">
                <div class="rounded-[20px] bg-[#F6F7F9] border border-[#E4E7EC] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  @if (store.currentUser(); as user) {
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="w-10 h-10 rounded-full bg-[#FF80AB] text-[#111111] text-sm font-bold flex items-center justify-center shrink-0">
                        {{ user.name.charAt(0).toUpperCase() }}
                      </div>
                      <div class="min-w-0">
                        <div class="text-xs font-bold text-[#0F1115] truncate">
                          Criador conectado: {{ user.name }}
                        </div>
                        <div class="text-[11px] text-[#4B5563] truncate">{{ user.email }}</div>
                      </div>
                    </div>
                    <mat-icon class="text-[#C2185B] shrink-0">verified</mat-icon>
                  } @else {
                    <div class="space-y-0.5 text-xs">
                      <div class="font-bold text-[#0F1115]">Conecte sua conta Google para publicar</div>
                      <div class="text-[#4B5563]">
                        Sua conta Google garante que somente você gerencie e receba nesta lista.
                      </div>
                    </div>
                    <button
                      type="button"
                      (click)="store.authModalOpen.set(true)"
                      class="apple-press min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full bg-[#FF80AB] hover:bg-[#F48FB1] text-[#111111] text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <mat-icon class="text-base!">login</mat-icon>
                      <span>Conectar Google</span>
                    </button>
                  }
                </div>

                <form [formGroup]="pixForm" class="space-y-3.5">
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label for="wiz-key-type" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                        Tipo da Chave Pix
                      </label>
                      <select
                        id="wiz-key-type"
                        formControlName="pixKeyType"
                        class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] focus:outline-none focus:border-[#C2185B]"
                      >
                        <option value="email">E-mail</option>
                        <option value="cpf">CPF</option>
                        <option value="telefone">Telefone</option>
                        <option value="aleatoria">Chave Aleatória</option>
                        <option value="cnpj">CNPJ</option>
                      </select>
                    </div>
                    <div class="sm:col-span-2">
                      <label for="wiz-pix-key" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                        Sua Chave Pix (para presentes em dinheiro)
                      </label>
                      <input
                        id="wiz-pix-key"
                        type="text"
                        formControlName="pixKey"
                        placeholder="Ex.: seuemail@gmail.com ou CPF (pode preencher depois)"
                        class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm font-mono text-[#0F1115] focus:outline-none focus:border-[#C2185B]"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="wiz-creator" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                      Nome do Titular Pix (até 25 caracteres)
                    </label>
                    <input
                      id="wiz-creator"
                      type="text"
                      formControlName="creatorName"
                      placeholder="Nome que aparecerá no aplicativo do banco"
                      class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] focus:outline-none focus:border-[#C2185B]"
                    />
                  </div>
                </form>

                @if (errorMsg()) {
                  <p class="text-xs font-semibold text-[#9D174D] bg-[#FCE4EC] border border-[#F48FB1] rounded-xl px-3.5 py-2.5">
                    {{ errorMsg() }}
                  </p>
                }
              </div>
            } @else {
              <!-- Step 4: Animated Creation + Ready Share Link -->
              @if (publishing()) {
                <div class="py-10 text-center space-y-5">
                  <div class="w-16 h-16 mx-auto rounded-full bg-[#F6F7F9] border border-[#E4E7EC] flex items-center justify-center animate-bounce">
                    <app-kawaii-ribbon [size]="36" />
                  </div>
                  <div class="space-y-1.5">
                    <h3 class="font-display text-xl font-bold text-[#0F1115]">
                      Montando seu Enxoval Compartilhável...
                    </h3>
                    <p class="text-xs sm:text-sm text-[#4B5563]">
                      Vinculando ofertas verificadas, sincronização em tempo real e URL exclusiva.
                    </p>
                  </div>
                  <div class="max-w-xs mx-auto h-2 rounded-full bg-[#F1F3F6] overflow-hidden">
                    <div class="h-full w-3/4 rounded-full bg-[#C2185B] kawaii-shimmer"></div>
                  </div>
                </div>
              } @else if (publishedResult(); as res) {
                <div #publishedCard class="rounded-[24px] bg-[#F6F7F9] border border-[#E4E7EC] p-6 text-center space-y-5">
                  <div class="w-14 h-14 mx-auto rounded-full bg-[#FF80AB] text-[#111111] flex items-center justify-center shadow-sm">
                    <mat-icon>celebration</mat-icon>
                  </div>
                  <div class="space-y-1">
                    <h3 class="font-display text-2xl font-bold text-[#0F1115]">
                      Sua Lista Está Pronta para Compartilhar
                    </h3>
                    <p class="text-xs sm:text-sm text-[#4B5563]">
                      Envie este link para familiares e amigos escolherem presentes via Pix ou direto nas lojas.
                    </p>
                  </div>

                  <div class="rounded-2xl bg-white border border-[#E4E7EC] p-3.5 text-left space-y-2">
                    <div class="text-[11px] font-bold text-[#C2185B]">
                      Link Exclusivo de Compartilhamento
                    </div>
                    <div class="font-mono text-xs font-semibold text-[#0F1115] break-all bg-[#F6F7F9] rounded-xl px-3 py-2.5 border border-[#E4E7EC] select-all">
                      {{ res.shareUrl }}
                    </div>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      (click)="copyShareUrl(res.shareUrl)"
                      class="apple-press min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#FF80AB] hover:bg-[#F48FB1] text-[#111111] text-sm font-bold cursor-pointer"
                    >
                      <mat-icon class="text-lg!">{{ copiedShare() ? 'check' : 'content_copy' }}</mat-icon>
                      <span>{{ copiedShare() ? 'Copiado!' : 'Copiar Link' }}</span>
                    </button>

                    <button
                      type="button"
                      (click)="nativeShare(res.shareUrl, res.title)"
                      class="apple-press min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-white hover:bg-[#EBEEF3] border border-[#D8DCE3] text-[#0F1115] text-sm font-bold cursor-pointer"
                    >
                      <mat-icon class="text-lg! text-[#C2185B]">ios_share</mat-icon>
                      <span>Enviar</span>
                    </button>

                    <a
                      [href]="whatsappShareUrl(res.shareUrl, res.title)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="apple-press min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-white hover:bg-[#EBEEF3] border border-[#D8DCE3] text-[#0F1115] text-sm font-bold"
                    >
                      <mat-icon class="text-lg! text-[#C2185B]">share</mat-icon>
                      <span>WhatsApp</span>
                    </a>
                  </div>
                </div>
              }
            }
          </div>

          <!-- Sticky Footer Navigation -->
          <div class="px-5 sm:px-6 py-4 border-t border-[#E4E7EC] bg-[#F6F7F9] flex items-center justify-between gap-3 shrink-0">
            @if (step() < 4) {
              <button
                type="button"
                (click)="prevStep()"
                [disabled]="step() === 1"
                class="apple-press min-h-[44px] inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-white hover:bg-[#EBEEF3] disabled:opacity-40 border border-[#D8DCE3] text-xs font-bold text-[#0F1115] cursor-pointer"
              >
                <mat-icon class="text-base!">arrow_back</mat-icon>
                <span>Voltar</span>
              </button>

              @if (step() < 3) {
                <button
                  type="button"
                  (click)="nextStep()"
                  [disabled]="!canAdvance()"
                  class="apple-press min-h-[46px] inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#FF80AB] hover:bg-[#F48FB1] disabled:opacity-45 text-[#111111] text-sm font-bold cursor-pointer"
                >
                  <span>Continuar</span>
                  <mat-icon class="text-base!">arrow_forward</mat-icon>
                </button>
              } @else {
                <button
                  type="button"
                  (click)="publishList()"
                  [disabled]="publishing()"
                  class="apple-press min-h-[46px] inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#FF80AB] hover:bg-[#F48FB1] disabled:opacity-45 text-[#111111] text-sm font-bold cursor-pointer"
                >
                  <mat-icon class="text-base!">rocket_launch</mat-icon>
                  <span>Publicar Lista &amp; Gerar Link</span>
                </button>
              }
            } @else {
              <button
                type="button"
                (click)="finishAndView()"
                [disabled]="publishing()"
                class="apple-press w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#FF80AB] hover:bg-[#F48FB1] disabled:opacity-45 text-[#111111] text-sm font-bold cursor-pointer"
              >
                <mat-icon class="text-lg!">done_all</mat-icon>
                <span>Abrir Minha Lista Agora</span>
              </button>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class CreateListWizard {
  protected readonly store = inject(EnxovalStore);
  private readonly sheetRef = viewChild<ElementRef<HTMLElement>>('sheetContainer');
  private readonly stepBodyRef = viewChild<ElementRef<HTMLElement>>('stepBody');
  private readonly publishedCardRef = viewChild<ElementRef<HTMLElement>>('publishedCard');

  readonly open = input(false);
  readonly closed = output<void>();

  protected readonly fullCatalog = FULL_ENXOVAL_CATALOG;
  protected readonly starterItems = INITIAL_ENXOVAL_ITEMS;
  protected readonly essentialCatalogCount = FULL_ENXOVAL_CATALOG.filter(
    (i) => i.priority === 'Essencial',
  ).length;
  protected readonly catalogCategories = Array.from(
    new Set(FULL_ENXOVAL_CATALOG.map((it) => it.category)),
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  readonly step = signal<1 | 2 | 3 | 4>(1);
  readonly activePreset = signal<'starter' | 'essentials' | 'all' | 'custom'>('starter');
  readonly selectedItemQuantities = signal<Map<string, number>>(
    new Map(INITIAL_ENXOVAL_ITEMS.map((it) => [it.id, it.requiredQty])),
  );
  readonly wizardStageFilter = signal<EnxovalStage | 'all'>('all');
  readonly wizardPriorityFilter = signal<ItemPriority | 'all'>('all');
  readonly wizardSearchText = signal('');
  readonly wizardCategoryText = signal('all');

  readonly wizardSearchControl = new FormControl('', {nonNullable: true});
  readonly wizardCategoryControl = new FormControl('all', {nonNullable: true});

  readonly publishing = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly copiedShare = signal(false);
  readonly publishedResult = signal<{shareUrl: string; title: string; slug: string} | null>(null);
  readonly sanitizedSlugPreview = signal('');

  private wasOpen = false;
  private lastAnimatedStep = 0;

  protected readonly stepTitles = [
    'Identidade do Bebê & Link da Lista',
    'Escolha Cada Item do Seu Enxoval',
    'Conta Google & Chave Pix Própria',
    'Link Pronto para Compartilhar',
  ];

  protected readonly stepShortLabels = ['1. Bebê', '2. Itens', '3. Google/Pix', '4. Compartilhar'];

  protected readonly wizardStageTabs: {id: EnxovalStage | 'all'; label: string}[] = [
    {id: 'all', label: 'Tudo'},
    {id: 'gestante', label: 'Gestante'},
    {id: 'bebe_rn', label: 'Bebê RN'},
    {id: 'quarto_passeio', label: 'Quarto & Passeio'},
    {id: 'familia', label: 'Família'},
  ];

  protected readonly wizardPriorityTabs: (ItemPriority | 'all')[] = [
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

  readonly identityForm = new FormGroup({
    babyName: new FormControl('', {nonNullable: true, validators: [Validators.required]}),
    title: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.minLength(3)]}),
    creatorCity: new FormControl('SAO PAULO', {nonNullable: true}),
    dueDate: new FormControl('', {nonNullable: true}),
    customSlug: new FormControl('', {nonNullable: true}),
    welcomeNote: new FormControl(
      'Preparamos com carinho cada item que vamos precisar. Escolha um presente via Pix ou nas lojas verificadas.',
      {nonNullable: true},
    ),
  });

  readonly pixForm = new FormGroup({
    pixKeyType: new FormControl<PixKeyType>('email', {nonNullable: true}),
    pixKey: new FormControl('', {nonNullable: true}),
    creatorName: new FormControl('', {nonNullable: true}),
  });

  readonly filteredWizardCatalog = computed(() => {
    const stage = this.wizardStageFilter();
    const pri = this.wizardPriorityFilter();
    const cat = this.wizardCategoryText();
    const q = this.wizardSearchText().trim().toLowerCase();

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

  readonly previewSelection = computed(() => {
    const map = this.selectedItemQuantities();
    let count = 0;
    let units = 0;
    let totalValue = 0;
    for (const it of this.fullCatalog) {
      const qty = map.get(it.id);
      if (qty !== undefined) {
        count++;
        units += qty;
        totalValue += qty * it.unitPriceBrl;
      }
    }
    return {
      count,
      units,
      totalValue: Number(totalValue.toFixed(2)),
    };
  });

  constructor() {
    this.wizardSearchControl.valueChanges.subscribe((v) => this.wizardSearchText.set(v));
    this.wizardCategoryControl.valueChanges.subscribe((v) => this.wizardCategoryText.set(v));

    this.identityForm.controls.customSlug.valueChanges.subscribe((raw) => {
      const clean = raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
      this.sanitizedSlugPreview.set(clean);
    });

    this.identityForm.controls.babyName.valueChanges.subscribe((baby) => {
      const clean = baby.trim();
      if (!clean) return;
      if (!this.identityForm.controls.title.dirty) {
        this.identityForm.controls.title.setValue(`Enxoval de ${clean}`);
      }
      if (!this.identityForm.controls.customSlug.dirty) {
        const slug = `enxoval-${clean
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')}`;
        this.identityForm.controls.customSlug.setValue(slug);
      }
    });

    effect(() => {
      const isOpen = this.open();
      const sheet = this.sheetRef()?.nativeElement;
      if (isOpen && !this.wasOpen) {
        this.wasOpen = true;
        if (sheet && typeof window !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          animate(sheet, {opacity: [0, 1], y: [30, 0]}, {duration: 0.3, ease: [0.16, 1, 0.3, 1]});
        }
      } else if (!isOpen) {
        this.wasOpen = false;
        this.lastAnimatedStep = 0;
      }
    });

    effect(() => {
      const user = this.store.currentUser();
      const isOpen = this.open();
      if (!isOpen || !user) return;
      untracked(() => {
        if (!this.pixForm.controls.creatorName.dirty && !this.pixForm.controls.creatorName.value) {
          this.pixForm.controls.creatorName.setValue(user.name.toUpperCase().slice(0, 25));
        }
        if (!this.pixForm.controls.pixKey.dirty && !this.pixForm.controls.pixKey.value) {
          this.pixForm.controls.pixKey.setValue(user.email);
        }
      });
    });

    effect(() => {
      const isOpen = this.open();
      const currentStep = this.step();
      const body = this.stepBodyRef()?.nativeElement;
      if (isOpen && currentStep !== this.lastAnimatedStep && body) {
        this.lastAnimatedStep = currentStep;
        if (typeof window !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          animate(body, {opacity: [0.25, 1], x: [14, 0]}, {duration: 0.24, ease: 'easeOut'});
        }
      }
    });

    effect(() => {
      const res = this.publishedResult();
      const card = this.publishedCardRef()?.nativeElement;
      if (res && card && typeof window !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        animate(card, {opacity: [0, 1], scale: [0.92, 1], y: [10, 0]}, {duration: 0.34, ease: [0.16, 1, 0.3, 1]});
      }
    });
  }

  protected toggleWizardItem(item: EnxovalItem): void {
    this.activePreset.set('custom');
    this.selectedItemQuantities.update((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.set(item.id, item.requiredQty);
      }
      return next;
    });
  }

  protected adjustWizardItemQty(itemId: string, delta: number): void {
    this.activePreset.set('custom');
    this.selectedItemQuantities.update((prev) => {
      const next = new Map(prev);
      const cur = next.get(itemId);
      if (cur === undefined) return prev;
      next.set(itemId, Math.max(1, Math.min(200, cur + delta)));
      return next;
    });
  }

  protected applySelectionPreset(preset: 'starter' | 'essentials' | 'all'): void {
    this.activePreset.set(preset);
    if (preset === 'starter') {
      this.selectedItemQuantities.set(new Map(INITIAL_ENXOVAL_ITEMS.map((it) => [it.id, it.requiredQty])));
      return;
    }
    if (preset === 'essentials') {
      this.selectedItemQuantities.set(
        new Map(
          FULL_ENXOVAL_CATALOG.filter((it) => it.priority === 'Essencial').map((it) => [
            it.id,
            it.requiredQty,
          ]),
        ),
      );
      return;
    }
    this.selectedItemQuantities.set(new Map(FULL_ENXOVAL_CATALOG.map((it) => [it.id, it.requiredQty])));
  }

  protected selectAllVisibleWizard(): void {
    this.activePreset.set('custom');
    const visible = this.filteredWizardCatalog();
    this.selectedItemQuantities.update((prev) => {
      const next = new Map(prev);
      for (const it of visible) {
        if (!next.has(it.id)) {
          next.set(it.id, it.requiredQty);
        }
      }
      return next;
    });
  }

  protected clearAllSelections(): void {
    this.activePreset.set('custom');
    this.selectedItemQuantities.set(new Map());
  }

  protected resetWizardCatalogFilters(): void {
    this.wizardStageFilter.set('all');
    this.wizardPriorityFilter.set('all');
    this.wizardSearchControl.setValue('');
    this.wizardCategoryControl.setValue('all');
  }

  protected onWizardThumbError(event: Event, stage: EnxovalStage): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;
    const fallback = STAGE_IMAGES[stage];
    if (!img.src.endsWith(fallback)) {
      img.src = fallback;
    }
  }

  protected canAdvance(): boolean {
    if (this.step() === 1) {
      return this.identityForm.valid;
    }
    if (this.step() === 2) {
      return this.previewSelection().count > 0;
    }
    return true;
  }

  protected nextStep(): void {
    if (!this.canAdvance()) return;
    this.errorMsg.set(null);
    const cur = this.step();
    if (cur < 4) {
      this.step.set((cur + 1) as 1 | 2 | 3 | 4);
    }
  }

  protected prevStep(): void {
    this.errorMsg.set(null);
    const cur = this.step();
    if (cur > 1) {
      this.step.set((cur - 1) as 1 | 2 | 3 | 4);
    }
  }

  async publishList(): Promise<void> {
    if (!this.store.isAuthenticated()) {
      this.store.authModalOpen.set(true);
      this.errorMsg.set('Conecte sua conta Google para publicar e gerar o link compartilhável.');
      return;
    }
    if (this.publishing()) return;

    const pixVal = this.pixForm.getRawValue();
    const trimmedKey = pixVal.pixKey.trim();
    let finalPixKey = '';
    if (trimmedKey) {
      const check = validatePixKey(trimmedKey, pixVal.pixKeyType);
      if (!check.valid) {
        this.errorMsg.set(check.error ?? 'Chave Pix inválida para o tipo escolhido.');
        return;
      }
      finalPixKey = check.normalized;
    }

    const selectedEntries = Array.from(this.selectedItemQuantities().entries()).map(
      ([templateId, requiredQty]) => ({templateId, requiredQty}),
    );
    const derivedStageSet = new Set<EnxovalStage>();
    for (const it of this.fullCatalog) {
      if (this.selectedItemQuantities().has(it.id)) {
        derivedStageSet.add(it.stage);
      }
    }
    const derivedStages: EnxovalStage[] =
      derivedStageSet.size > 0
        ? Array.from(derivedStageSet)
        : ['gestante', 'bebe_rn', 'quarto_passeio', 'familia'];

    this.step.set(4);
    this.publishing.set(true);
    this.errorMsg.set(null);

    const minAnim = new Promise((r) => setTimeout(r, 950));
    try {
      const idVal = this.identityForm.getRawValue();
      const [created] = await Promise.all([
        this.store.createNewEnxovalList({
          title: idVal.title.trim(),
          babyName: idVal.babyName.trim(),
          dueDate: idVal.dueDate,
          creatorCity: idVal.creatorCity.trim() || 'SAO PAULO',
          customSlug: idVal.customSlug.trim(),
          welcomeNote: idVal.welcomeNote.trim(),
          selectedStages: derivedStages,
          selectedItems: selectedEntries,
          pixKey: finalPixKey,
          pixKeyType: pixVal.pixKeyType,
          creatorName:
            pixVal.creatorName.trim() ||
            this.store.currentUser()?.name.toUpperCase().slice(0, 25) ||
            'CRIADOR',
        }),
        minAnim,
      ]);

      this.publishedResult.set({
        shareUrl: created.shareUrl,
        title: created.listConfig.title,
        slug: created.listConfig.slug,
      });
    } catch (err) {
      this.step.set(3);
      this.errorMsg.set(err instanceof Error ? err.message : 'Erro ao criar lista compartilhável.');
    } finally {
      this.publishing.set(false);
    }
  }

  async copyShareUrl(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      this.copiedShare.set(true);
      this.store.showToast('Link da sua lista copiado para compartilhar!');
      setTimeout(() => this.copiedShare.set(false), 2600);
    } catch {
      this.copiedShare.set(false);
    }
  }

  async nativeShare(url: string, title: string): Promise<void> {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title,
          text: `Veja os itens de "${title}" no Enxoval Baby:`,
          url,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    await this.copyShareUrl(url);
  }

  protected whatsappShareUrl(url: string, title: string): string {
    const msg = `Conheça nossa lista de necessidades "${title}" no Enxoval Baby: ${url}`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  }

  protected finishAndView(): void {
    this.closeWizard();
    this.store.openView('lista', true);
  }

  protected closeWizard(): void {
    this.step.set(1);
    this.publishedResult.set(null);
    this.errorMsg.set(null);
    this.activePreset.set('starter');
    this.selectedItemQuantities.set(
      new Map(INITIAL_ENXOVAL_ITEMS.map((it) => [it.id, it.requiredQty])),
    );
    this.resetWizardCatalogFilters();
    this.identityForm.reset({
      babyName: '',
      title: '',
      creatorCity: 'SAO PAULO',
      dueDate: '',
      customSlug: '',
      welcomeNote:
        'Preparamos com carinho cada item que vamos precisar. Escolha um presente via Pix ou nas lojas verificadas.',
    });
    this.pixForm.reset({pixKeyType: 'email', pixKey: '', creatorName: ''});
    this.closed.emit();
  }
}
