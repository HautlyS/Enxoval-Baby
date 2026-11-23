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
import {INITIAL_ENXOVAL_ITEMS} from '../core/catalog-seed';
import {EnxovalStore} from '../core/enxoval-store';
import {EnxovalStage, PixKeyType} from '../core/models';
import {validatePixKey} from '../core/pix-brcode';
import {KawaiiRibbon} from './kawaii-ornaments';

interface WizardStageOption {
  id: EnxovalStage;
  title: string;
  subtitle: string;
  icon: string;
  itemCount: number;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-create-list-wizard',
  imports: [CurrencyPipe, ReactiveFormsModule, MatIconModule, KawaiiRibbon],
  template: `
    @if (open()) {
      <div
        (keydown.escape)="closeWizard()"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-rose-100/55 backdrop-blur-md"
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
          class="relative z-10 glass-panel-strong w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[93vh] flex flex-col"
        >
          <!-- Mobile Grab Handle -->
          <div class="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
            <span class="w-10 h-1.5 rounded-full bg-rose-300/80"></span>
          </div>

          <!-- Header & Animated Stepper -->
          <div class="px-5 sm:px-6 pt-3.5 pb-4 border-b border-rose-200/60 bg-white/70 texture-silk-grid shrink-0 space-y-3.5">
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-3 min-w-0">
                <app-kawaii-ribbon [size]="30" />
                <div class="min-w-0">
                  <p class="text-xs font-medium text-rose-700">
                    Passo {{ step() }} de 4 · Assistente de Enxoval
                  </p>
                  <h2 id="wizard-title" class="font-display text-lg font-semibold text-rose-950 truncate">
                    {{ stepTitles[step() - 1] }}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                (click)="closeWizard()"
                aria-label="Fechar assistente de criação"
                class="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-rose-800 hover:bg-rose-100/80 transition-colors cursor-pointer shrink-0"
              >
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <!-- Stepper Progress Track -->
            <div class="grid grid-cols-4 gap-2" aria-label="Progresso do assistente">
              @for (s of [1, 2, 3, 4]; track s) {
                <div class="space-y-1">
                  <div class="h-1.5 w-full rounded-full texture-woven-blush overflow-hidden">
                    <div
                      class="h-full rounded-full bg-rose-600 transition-all duration-300"
                      [style.width.%]="step() >= s ? 100 : 0"
                    ></div>
                  </div>
                  <div
                    class="text-[10px] font-semibold truncate"
                    [class.text-rose-950]="step() === s"
                    [class.text-rose-600]="step() !== s"
                  >
                    {{ stepShortLabels[s - 1] }}
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Animated Step Content Body -->
          <div #stepBody class="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 texture-cotton-dots">
            @if (step() === 1) {
              <!-- Step 1: Baby Identity & Share Slug -->
              <form [formGroup]="identityForm" class="space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label for="wiz-baby" class="block text-xs font-semibold text-rose-900 mb-1">
                      Nome ou Apelido do Bebê
                    </label>
                    <input
                      id="wiz-baby"
                      type="text"
                      formControlName="babyName"
                      placeholder="Ex.: Alice, Bento ou Nosso Bebê"
                      class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 placeholder:text-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                  </div>
                  <div>
                    <label for="wiz-title" class="block text-xs font-semibold text-rose-900 mb-1">
                      Título da Sua Lista
                    </label>
                    <input
                      id="wiz-title"
                      type="text"
                      formControlName="title"
                      placeholder="Ex.: Enxoval da Pequena Alice"
                      class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 placeholder:text-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label for="wiz-city" class="block text-xs font-semibold text-rose-900 mb-1">
                      Cidade da Família
                    </label>
                    <input
                      id="wiz-city"
                      type="text"
                      formControlName="creatorCity"
                      placeholder="Ex.: SAO PAULO"
                      class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                  </div>
                  <div>
                    <label for="wiz-due" class="block text-xs font-semibold text-rose-900 mb-1">
                      Data Prevista do Parto (opcional)
                    </label>
                    <input
                      id="wiz-due"
                      type="date"
                      formControlName="dueDate"
                      class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                  </div>
                </div>

                <div>
                  <label for="wiz-slug" class="block text-xs font-semibold text-rose-900 mb-1">
                    Endereço Curto de Compartilhamento
                  </label>
                  <div class="flex items-center rounded-xl bg-rose-50/80 border border-rose-200 overflow-hidden">
                    <span class="px-3 text-xs font-mono text-rose-700 bg-rose-100/70 min-h-[44px] flex items-center shrink-0">
                      ?list=
                    </span>
                    <input
                      id="wiz-slug"
                      type="text"
                      formControlName="customSlug"
                      placeholder="enxoval-da-alice"
                      class="w-full min-h-[44px] px-3 py-2 bg-white/90 text-sm font-mono text-rose-950 focus:outline-none"
                    />
                  </div>
                  @if (sanitizedSlugPreview()) {
                    <p class="mt-1 text-[11px] font-mono text-rose-700 truncate">
                      Link final: /?list={{ sanitizedSlugPreview() }}
                    </p>
                  }
                </div>

                <div>
                  <label for="wiz-note" class="block text-xs font-semibold text-rose-900 mb-1">
                    Mensagem de Boas-Vindas aos Convidados
                  </label>
                  <textarea
                    id="wiz-note"
                    rows="2"
                    formControlName="welcomeNote"
                    placeholder="Preparamos com carinho cada item que vamos precisar nesta nova jornada..."
                    class="w-full px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 placeholder:text-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
                  ></textarea>
                </div>
              </form>
            } @else if (step() === 2) {
              <!-- Step 2: Select Stages & Essentials Filter -->
              <div class="space-y-4">
                <p class="text-xs sm:text-sm text-rose-900 leading-relaxed">
                  Escolha quais etapas já devem entrar na sua lista com imagens e preços reais indexados das lojas:
                </p>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  @for (opt of stageOptions; track opt.id) {
                    @let active = isStageSelected(opt.id);
                    <button
                      type="button"
                      (click)="toggleStage(opt.id)"
                      class="p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 active:scale-[0.99]"
                      [class.bg-rose-50]="active"
                      [class.border-rose-500]="active"
                      [class.shadow-sm]="active"
                      [class.bg-white/80]="!active"
                      [class.border-rose-200]="!active"
                    >
                      <div
                        class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                        [class.bg-rose-600]="active"
                        [class.text-white]="active"
                        [class.bg-rose-100]="!active"
                        [class.text-rose-700]="!active"
                      >
                        <mat-icon>{{ active ? 'check' : opt.icon }}</mat-icon>
                      </div>
                      <div class="min-w-0 flex-1 space-y-0.5">
                        <div class="flex items-center justify-between gap-2">
                          <span class="font-display text-sm font-semibold text-rose-950">
                            {{ opt.title }}
                          </span>
                          <span class="font-mono text-[11px] font-semibold text-rose-700 shrink-0">
                            {{ opt.itemCount }} itens
                          </span>
                        </div>
                        <p class="text-xs text-rose-800 leading-relaxed">{{ opt.subtitle }}</p>
                      </div>
                    </button>
                  }
                </div>

                <!-- Essentials Toggle -->
                <button
                  type="button"
                  (click)="toggleEssentialsOnly()"
                  class="w-full min-h-[52px] p-4 rounded-2xl border text-left transition-colors cursor-pointer flex items-center justify-between gap-4"
                  [class.bg-rose-50]="essentialsOnly()"
                  [class.border-rose-400]="essentialsOnly()"
                  [class.bg-white/80]="!essentialsOnly()"
                  [class.border-rose-200]="!essentialsOnly()"
                >
                  <div class="space-y-0.5">
                    <div class="text-xs font-semibold text-rose-950">
                      Modo Lista Enxuta (apenas itens de prioridade Essencial)
                    </div>
                    <div class="text-[11px] text-rose-700">
                      Ideal para quem quer começar com os itens indispensáveis e ampliar depois.
                    </div>
                  </div>
                  <div
                    class="w-12 h-7 rounded-full p-1 transition-colors shrink-0 flex items-center"
                    [class.bg-rose-600]="essentialsOnly()"
                    [class.justify-end]="essentialsOnly()"
                    [class.bg-rose-200]="!essentialsOnly()"
                    [class.justify-start]="!essentialsOnly()"
                  >
                    <span class="w-5 h-5 rounded-full bg-white shadow-sm"></span>
                  </div>
                </button>

                <div class="rounded-2xl bg-white/80 border border-rose-200 p-4 flex items-center justify-between gap-4 text-xs">
                  <div class="text-rose-800">
                    Prévia da lista inicial:
                    <strong class="text-rose-950 tabular-nums">{{ previewSelection().count }} itens</strong>
                  </div>
                  <div class="font-mono font-bold text-rose-700 tabular-nums">
                    Estimativa: {{ previewSelection().totalValue | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}
                  </div>
                </div>
              </div>
            } @else if (step() === 3) {
              <!-- Step 3: Google Creator Auth + Optional Pix Key -->
              <div class="space-y-4">
                <div class="rounded-2xl bg-rose-50/90 border border-rose-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  @if (store.currentUser(); as user) {
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="w-10 h-10 rounded-full bg-rose-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                        {{ user.name.charAt(0).toUpperCase() }}
                      </div>
                      <div class="min-w-0">
                        <div class="text-xs font-semibold text-rose-950 truncate">
                          Criador conectado: {{ user.name }}
                        </div>
                        <div class="text-[11px] text-rose-700 truncate">{{ user.email }}</div>
                      </div>
                    </div>
                    <mat-icon class="text-rose-600 shrink-0">verified</mat-icon>
                  } @else {
                    <div class="space-y-0.5 text-xs text-rose-900">
                      <div class="font-semibold">Conecte sua conta Google para publicar</div>
                      <div class="text-rose-700">
                        Sua conta Google garante que somente você gerencie e receba nesta lista.
                      </div>
                    </div>
                    <button
                      type="button"
                      (click)="store.authModalOpen.set(true)"
                      class="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <mat-icon class="text-base!">login</mat-icon>
                      <span>Conectar Google</span>
                    </button>
                  }
                </div>

                <form [formGroup]="pixForm" class="space-y-3.5">
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label for="wiz-key-type" class="block text-xs font-semibold text-rose-900 mb-1">
                        Tipo da Chave Pix
                      </label>
                      <select
                        id="wiz-key-type"
                        formControlName="pixKeyType"
                        class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-400"
                      >
                        <option value="email">E-mail</option>
                        <option value="cpf">CPF</option>
                        <option value="telefone">Telefone</option>
                        <option value="aleatoria">Chave Aleatória</option>
                        <option value="cnpj">CNPJ</option>
                      </select>
                    </div>
                    <div class="sm:col-span-2">
                      <label for="wiz-pix-key" class="block text-xs font-semibold text-rose-900 mb-1">
                        Sua Chave Pix (para presentes em dinheiro)
                      </label>
                      <input
                        id="wiz-pix-key"
                        type="text"
                        formControlName="pixKey"
                        placeholder="Ex.: seuemail@gmail.com ou CPF (pode preencher depois)"
                        class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm font-mono text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="wiz-creator" class="block text-xs font-semibold text-rose-900 mb-1">
                      Nome do Titular Pix (até 25 caracteres)
                    </label>
                    <input
                      id="wiz-creator"
                      type="text"
                      formControlName="creatorName"
                      placeholder="Nome que aparecerá no aplicativo do banco"
                      class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                  </div>
                </form>

                @if (errorMsg()) {
                  <p class="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                    {{ errorMsg() }}
                  </p>
                }
              </div>
            } @else {
              <!-- Step 4: Animated Creation + Ready Share Link -->
              @if (publishing()) {
                <div class="py-10 text-center space-y-5">
                  <div class="w-16 h-16 mx-auto rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center animate-bounce">
                    <app-kawaii-ribbon [size]="36" />
                  </div>
                  <div class="space-y-1.5">
                    <h3 class="font-display text-xl font-semibold text-rose-950">
                      Montando seu Enxoval Compartilhável...
                    </h3>
                    <p class="text-xs sm:text-sm text-rose-800">
                      Vinculando ofertas verificadas, sincronização em tempo real e URL exclusiva.
                    </p>
                  </div>
                  <div class="max-w-xs mx-auto h-2 rounded-full bg-rose-100 overflow-hidden">
                    <div class="h-full w-3/4 rounded-full bg-rose-600 kawaii-shimmer"></div>
                  </div>
                </div>
              } @else if (publishedResult(); as res) {
                <div #publishedCard class="rounded-3xl bg-white/85 border border-rose-200 p-6 text-center space-y-5">
                  <div class="w-14 h-14 mx-auto rounded-full bg-rose-600 text-white flex items-center justify-center shadow-sm">
                    <mat-icon>celebration</mat-icon>
                  </div>
                  <div class="space-y-1">
                    <h3 class="font-display text-2xl font-semibold text-rose-950">
                      Sua Lista Está Pronta para Compartilhar
                    </h3>
                    <p class="text-xs sm:text-sm text-rose-800">
                      Envie este link para familiares e amigos escolherem presentes via Pix ou direto nas lojas.
                    </p>
                  </div>

                  <div class="rounded-2xl bg-rose-50/90 border border-rose-200 p-3.5 text-left space-y-2">
                    <div class="text-[11px] font-semibold text-rose-700">
                      Link Exclusivo de Compartilhamento
                    </div>
                    <div class="font-mono text-xs text-rose-950 break-all bg-white rounded-xl px-3 py-2.5 border border-rose-200/80">
                      {{ res.shareUrl }}
                    </div>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      (click)="copyShareUrl(res.shareUrl)"
                      class="min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold cursor-pointer transition-colors"
                    >
                      <mat-icon class="text-lg!">{{ copiedShare() ? 'check' : 'content_copy' }}</mat-icon>
                      <span>{{ copiedShare() ? 'Copiado!' : 'Copiar Link' }}</span>
                    </button>

                    <button
                      type="button"
                      (click)="nativeShare(res.shareUrl, res.title)"
                      class="min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-950 text-sm font-semibold cursor-pointer transition-colors"
                    >
                      <mat-icon class="text-lg!">ios_share</mat-icon>
                      <span>Enviar</span>
                    </button>

                    <a
                      [href]="whatsappShareUrl(res.shareUrl, res.title)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-950 text-sm font-semibold transition-colors"
                    >
                      <mat-icon class="text-lg!">share</mat-icon>
                      <span>WhatsApp</span>
                    </a>
                  </div>
                </div>
              }
            }
          </div>

          <!-- Sticky Footer Navigation -->
          <div class="px-5 sm:px-6 py-3.5 border-t border-rose-200/60 bg-white/85 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
            @if (step() < 4) {
              <button
                type="button"
                (click)="prevStep()"
                [disabled]="step() === 1"
                class="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-rose-50 disabled:opacity-40 border border-rose-200 text-xs font-semibold text-rose-900 cursor-pointer transition-colors"
              >
                <mat-icon class="text-base!">arrow_back</mat-icon>
                <span>Voltar</span>
              </button>

              @if (step() < 3) {
                <button
                  type="button"
                  (click)="nextStep()"
                  [disabled]="!canAdvance()"
                  class="min-h-[48px] inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer transition-colors"
                >
                  <span>Continuar</span>
                  <mat-icon class="text-base!">arrow_forward</mat-icon>
                </button>
              } @else {
                <button
                  type="button"
                  (click)="publishList()"
                  [disabled]="publishing()"
                  class="min-h-[48px] inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer transition-all apple-press"
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
                class="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer transition-all apple-press"
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

  readonly step = signal<1 | 2 | 3 | 4>(1);
  readonly selectedStages = signal<EnxovalStage[]>([
    'gestante',
    'bebe_rn',
    'quarto_passeio',
    'familia',
  ]);
  readonly essentialsOnly = signal(false);
  readonly publishing = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly copiedShare = signal(false);
  readonly publishedResult = signal<{shareUrl: string; title: string; slug: string} | null>(null);
  readonly sanitizedSlugPreview = signal('');

  private wasOpen = false;
  private lastAnimatedStep = 0;

  protected readonly stepTitles = [
    'Identidade do Bebê & Link da Lista',
    'Escolha as Etapas do Enxoval',
    'Conta Google & Chave Pix Própria',
    'Link Pronto para Compartilhar',
  ];

  protected readonly stepShortLabels = ['1. Bebê', '2. Etapas', '3. Google/Pix', '4. Compartilhar'];

  protected readonly stageOptions: WizardStageOption[] = [
    {
      id: 'gestante',
      title: 'Gestante & Maternidade',
      subtitle: 'Mala hospitalar, amamentação e conforto',
      icon: 'pregnant_woman',
      itemCount: INITIAL_ENXOVAL_ITEMS.filter((i) => i.stage === 'gestante').length,
    },
    {
      id: 'bebe_rn',
      title: 'Bebê Recém-Nascido',
      subtitle: 'Bodies, macacões, fraldas e farmácia RN',
      icon: 'child_care',
      itemCount: INITIAL_ENXOVAL_ITEMS.filter((i) => i.stage === 'bebe_rn').length,
    },
    {
      id: 'quarto_passeio',
      title: 'Quarto, Passeio & Banho',
      subtitle: 'Berço, carrinho, banheira e babá eletrônica',
      icon: 'crib',
      itemCount: INITIAL_ENXOVAL_ITEMS.filter((i) => i.stage === 'quarto_passeio').length,
    },
    {
      id: 'familia',
      title: 'Família & Rede de Apoio',
      subtitle: 'Canguru ergonômico, esterilizador e farmácia',
      icon: 'diversity_1',
      itemCount: INITIAL_ENXOVAL_ITEMS.filter((i) => i.stage === 'familia').length,
    },
  ];

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

  readonly previewSelection = computed(() => {
    const stages = this.selectedStages();
    const ess = this.essentialsOnly();
    const matched = INITIAL_ENXOVAL_ITEMS.filter((it) => stages.includes(it.stage)).filter((it) =>
      ess ? it.priority === 'Essencial' : true,
    );
    const totalValue = matched.reduce((acc, it) => acc + it.requiredQty * it.unitPriceBrl, 0);
    return {
      count: matched.length,
      totalValue: Number(totalValue.toFixed(2)),
    };
  });

  constructor() {
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

  protected isStageSelected(stage: EnxovalStage): boolean {
    return this.selectedStages().includes(stage);
  }

  protected toggleStage(stage: EnxovalStage): void {
    this.selectedStages.update((prev) => {
      if (prev.includes(stage)) {
        return prev.length > 1 ? prev.filter((s) => s !== stage) : prev;
      }
      return [...prev, stage];
    });
  }

  protected toggleEssentialsOnly(): void {
    this.essentialsOnly.update((v) => !v);
  }

  protected canAdvance(): boolean {
    if (this.step() === 1) {
      return this.identityForm.valid;
    }
    if (this.step() === 2) {
      return this.selectedStages().length > 0;
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
          selectedStages: this.selectedStages(),
          essentialsOnly: this.essentialsOnly(),
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
