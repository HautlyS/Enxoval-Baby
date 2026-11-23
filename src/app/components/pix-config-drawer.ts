import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
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
import {EnxovalStore} from '../core/enxoval-store';
import {PixKeyType} from '../core/models';
import {validatePixKey} from '../core/pix-brcode';
import {KawaiiRibbon} from './kawaii-ornaments';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-pix-config-drawer',
  imports: [ReactiveFormsModule, MatIconModule, KawaiiRibbon],
  template: `
    @if (open()) {
      <div
        (keydown.escape)="closed.emit()"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-rose-100/55 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pix-config-title"
      >
        <button
          type="button"
          tabindex="-1"
          aria-label="Fechar configurações"
          (click)="closed.emit()"
          class="absolute inset-0 w-full h-full cursor-default"
        ></button>
        <div
          #sheetContainer
          class="relative z-10 glass-panel-strong w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] flex flex-col"
        >
          <div class="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
            <span class="w-10 h-1.5 rounded-full bg-rose-300/80"></span>
          </div>

          <div class="flex items-center justify-between gap-4 px-5 sm:px-6 py-3.5 sm:py-4 border-b border-rose-200/60 bg-white/70 texture-silk-grid shrink-0">
            <div class="flex items-center gap-3">
              <app-kawaii-ribbon [size]="30" />
              <div>
                <p class="text-xs font-medium text-rose-700">
                  {{ store.currentUser()?.name || 'Conta do Criador' }} · Recebimento Pix
                </p>
                <h2 id="pix-config-title" class="font-display text-lg font-semibold text-rose-950">
                  Configurar Lista e Chave Pix
                </h2>
              </div>
            </div>
            <button
              type="button"
              (click)="closed.emit()"
              aria-label="Fechar configurações"
              class="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-rose-800 hover:bg-rose-100/80 transition-colors cursor-pointer"
            >
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="p-5 sm:p-6 overflow-y-auto space-y-5 texture-cotton-dots">
            @if (store.listConfig().isCommunityTemplate) {
              <div class="rounded-2xl bg-rose-50/90 border border-rose-300 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="text-xs text-rose-900 leading-relaxed">
                  <strong>Lista de Demonstração da Comunidade:</strong> você está navegando em uma lista pública de outro criador. Crie sua própria lista no assistente para configurar sua Chave Pix.
                </div>
                <button
                  type="button"
                  (click)="openCreatorWizard()"
                  class="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                >
                  Criar Minha Lista
                </button>
              </div>
            } @else if (!store.isAuthenticated()) {
              <div class="rounded-2xl bg-rose-50/90 border border-rose-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="text-xs text-rose-900">
                  <strong>Identidade do Criador:</strong> conecte sua conta Google para assumir a lista e salvar sua chave Pix.
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

            <form [formGroup]="form" (ngSubmit)="saveConfig()" class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="cfg-title" class="block text-xs font-semibold text-rose-900 mb-1">
                    Título do Enxoval
                  </label>
                  <input
                    id="cfg-title"
                    type="text"
                    formControlName="title"
                    placeholder="Ex.: Enxoval do Meu Bebê"
                    class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                </div>
                <div>
                  <label for="cfg-baby" class="block text-xs font-semibold text-rose-900 mb-1">
                    Nome do Bebê
                  </label>
                  <input
                    id="cfg-baby"
                    type="text"
                    formControlName="babyName"
                    placeholder="Ex.: Sofia ou Nosso Bebê"
                    class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label for="cfg-key-type" class="block text-xs font-semibold text-rose-900 mb-1">
                    Tipo da Chave Pix
                  </label>
                  <select
                    id="cfg-key-type"
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
                  <label for="cfg-pix-key" class="block text-xs font-semibold text-rose-900 mb-1">
                    Sua Chave Pix Própria
                  </label>
                  <input
                    id="cfg-pix-key"
                    type="text"
                    formControlName="pixKey"
                    placeholder="Digite sua chave Pix real (e-mail, CPF, celular ou aleatória)"
                    class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 font-mono focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div class="sm:col-span-2">
                  <label for="cfg-creator" class="block text-xs font-semibold text-rose-900 mb-1">
                    Nome do Titular Pix (até 25 caracteres)
                  </label>
                  <input
                    id="cfg-creator"
                    type="text"
                    formControlName="creatorName"
                    placeholder="Seu nome completo"
                    class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                </div>
                <div>
                  <label for="cfg-city" class="block text-xs font-semibold text-rose-900 mb-1">
                    Cidade
                  </label>
                  <input
                    id="cfg-city"
                    type="text"
                    formControlName="creatorCity"
                    placeholder="SAO PAULO"
                    class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="cfg-due" class="block text-xs font-semibold text-rose-900 mb-1">
                    Data Prevista do Parto
                  </label>
                  <input
                    id="cfg-due"
                    type="date"
                    formControlName="dueDate"
                    class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                </div>
                <div>
                  <label for="cfg-note" class="block text-xs font-semibold text-rose-900 mb-1">
                    Mensagem de Boas-Vindas
                  </label>
                  <input
                    id="cfg-note"
                    type="text"
                    formControlName="welcomeNote"
                    class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white/90 border border-rose-200 text-sm text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                </div>
              </div>

              <!-- Expandable Pix Explanation -->
              <div class="rounded-2xl bg-rose-50/75 border border-rose-200/70 p-3.5 space-y-2">
                <button
                  type="button"
                  (click)="togglePixEducation()"
                  class="w-full flex items-center justify-between text-xs font-semibold text-rose-900 cursor-pointer"
                >
                  <span class="flex items-center gap-1.5">
                    <mat-icon class="text-base! text-rose-600">help_outline</mat-icon>
                    <span>Entenda como o QR Code Pix é gerado com sua chave</span>
                  </span>
                  <mat-icon class="text-base!">{{ showPixEducation() ? 'expand_less' : 'expand_more' }}</mat-icon>
                </button>
                @if (showPixEducation()) {
                  <div class="text-[11px] text-rose-800 space-y-1.5 pt-1 leading-relaxed">
                    <p>
                      O Enxoval Baby gera um <strong>BR Code Estático padrão EMV QRCPS-MPM</strong> reconhecido pelo Banco Central e por todos os bancos brasileiros (Nubank, Itaú, Inter, BB, Caixa, Bradesco).
                    </p>
                    <p>
                      Não há intermediários nem taxas: a chave DICT (E-mail, CPF, CNPJ, Telefone +55 ou Chave Aleatória), o valor exato do item e o TXID são codificados com checksum <strong>CRC-16/CCITT-FALSE</strong> diretamente para sua conta.
                    </p>
                  </div>
                }
              </div>

              @if (errorMsg()) {
                <p class="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {{ errorMsg() }}
                </p>
              }

              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-rose-200/60">
                <div class="text-[11px] text-rose-700">
                  Backend:
                  <strong>
                    {{ store.realtimeMode() === 'supabase' ? 'Supabase (via GitHub Secrets)' : 'Modo Mock Preview (Secrets ausentes)' }}
                  </strong>
                </div>

                <button
                  type="submit"
                  [disabled]="saving() || form.invalid || store.listConfig().isCommunityTemplate"
                  class="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer transition-all apple-press whitespace-nowrap"
                >
                  <mat-icon class="text-base!">save</mat-icon>
                  <span>{{ saving() ? 'Salvando...' : 'Salvar Chave Pix da Lista' }}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }
  `,
})
export class PixConfigDrawer {
  protected readonly store = inject(EnxovalStore);
  private readonly sheetRef = viewChild<ElementRef<HTMLElement>>('sheetContainer');

  readonly open = input(false);
  readonly closed = output<void>();
  readonly saving = signal(false);
  readonly errorMsg = signal<string | null>(null);
  readonly showPixEducation = signal(false);

  readonly form = new FormGroup({
    title: new FormControl('', {nonNullable: true, validators: [Validators.required]}),
    babyName: new FormControl('', {nonNullable: true, validators: [Validators.required]}),
    dueDate: new FormControl('', {nonNullable: true}),
    creatorName: new FormControl('', {nonNullable: true, validators: [Validators.required]}),
    creatorCity: new FormControl('', {nonNullable: true, validators: [Validators.required]}),
    pixKey: new FormControl('', {nonNullable: true, validators: [Validators.required]}),
    pixKeyType: new FormControl<PixKeyType>('email', {nonNullable: true}),
    welcomeNote: new FormControl('', {nonNullable: true}),
  });

  private wasOpen = false;

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const el = this.sheetRef()?.nativeElement;

      if (isOpen && !this.wasOpen) {
        this.wasOpen = true;
        if (el && typeof window !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          animate(el, {opacity: [0, 1], y: [28, 0]}, {duration: 0.28, ease: [0.16, 1, 0.3, 1]});
        }
        untracked(() => {
          this.errorMsg.set(null);
          const cfg = this.store.listConfig();
          const user = this.store.currentUser();
          this.form.reset({
            title: cfg.title,
            babyName: cfg.babyName,
            dueDate: cfg.dueDate,
            creatorName: cfg.creatorName || user?.name.toUpperCase().slice(0, 25) || '',
            creatorCity: cfg.creatorCity,
            pixKey: cfg.pixKey || user?.email || '',
            pixKeyType: cfg.pixKeyType,
            welcomeNote: cfg.welcomeNote,
          });
        });
      } else if (!isOpen) {
        this.wasOpen = false;
      }
    });

    // If user signs in via Google while drawer is already open, prefill empty untouched Pix fields
    effect(() => {
      const user = this.store.currentUser();
      const isOpen = untracked(() => this.open());
      if (!isOpen || !user) return;
      untracked(() => {
        if (!this.form.controls.creatorName.dirty && !this.form.controls.creatorName.value) {
          this.form.controls.creatorName.setValue(user.name.toUpperCase().slice(0, 25));
        }
        if (!this.form.controls.pixKey.dirty && !this.form.controls.pixKey.value) {
          this.form.controls.pixKey.setValue(user.email);
        }
      });
    });
  }

  openCreatorWizard(): void {
    this.closed.emit();
    this.store.wizardOpen.set(true);
  }

  togglePixEducation(): void {
    this.showPixEducation.update((v) => !v);
  }

  async saveConfig(): Promise<void> {
    if (this.store.listConfig().isCommunityTemplate) {
      this.errorMsg.set('Crie sua própria lista no assistente para editar sua Chave Pix.');
      return;
    }
    if (!this.store.isAuthenticated()) {
      this.store.authModalOpen.set(true);
      return;
    }
    if (this.form.invalid || this.saving()) return;

    const raw = this.form.getRawValue();
    const pixCheck = validatePixKey(raw.pixKey, raw.pixKeyType);
    if (!pixCheck.valid) {
      this.errorMsg.set(pixCheck.error ?? 'Chave Pix inválida para o tipo selecionado.');
      return;
    }

    this.saving.set(true);
    this.errorMsg.set(null);
    try {
      await this.store.updateListConfig({...raw, pixKey: pixCheck.normalized});
      this.closed.emit();
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Erro ao salvar configuração.');
    } finally {
      this.saving.set(false);
    }
  }
}
