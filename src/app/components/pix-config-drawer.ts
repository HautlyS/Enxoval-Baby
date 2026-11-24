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
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-[#0F1115]/35 backdrop-blur-sm"
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
          class="relative z-10 bento-card-strong w-full sm:max-w-2xl rounded-t-[28px] sm:rounded-[28px] overflow-hidden max-h-[92vh] flex flex-col text-[#0F1115]"
        >
          <div class="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
            <span class="w-10 h-1.5 rounded-full bg-[#CBD2DD]"></span>
          </div>

          <div class="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 border-b border-[#E4E7EC] bg-[#F6F7F9] shrink-0">
            <div class="flex items-center gap-3">
              <app-kawaii-ribbon [size]="30" />
              <div>
                <p class="text-xs font-bold text-[#C2185B]">
                  {{ store.currentUser()?.name || 'Conta do Criador' }} · Recebimento Pix
                </p>
                <h2 id="pix-config-title" class="font-display text-lg font-bold text-[#0F1115]">
                  Configurar Lista e Chave Pix
                </h2>
              </div>
            </div>
            <button
              type="button"
              (click)="closed.emit()"
              aria-label="Fechar configurações"
              class="apple-press min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#4B5563] hover:text-[#0F1115] hover:bg-[#E4E7EC] cursor-pointer"
            >
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="p-5 sm:p-6 overflow-y-auto space-y-5 bg-white">
            @if (store.listConfig().isCommunityTemplate) {
              <div class="rounded-[20px] bg-[#FCE4EC]/55 border border-[#F48FB1] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="text-xs text-[#374151] leading-relaxed">
                  <strong class="text-[#0F1115]">Lista de Demonstração:</strong> você está navegando em uma lista pública de outro criador. Crie sua própria lista no assistente para configurar sua Chave Pix.
                </div>
                <button
                  type="button"
                  (click)="openCreatorWizard()"
                  class="apple-press min-h-[44px] px-5 py-2 rounded-full bg-[#FF80AB] hover:bg-[#F48FB1] text-[#111111] text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                >
                  Criar Minha Lista
                </button>
              </div>
            } @else if (!store.isAuthenticated()) {
              <div class="rounded-[20px] bg-[#F6F7F9] border border-[#E4E7EC] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="text-xs text-[#4B5563]">
                  <strong class="text-[#0F1115]">Identidade do Criador:</strong> conecte sua conta Google para assumir a lista e salvar sua chave Pix.
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

            <form [formGroup]="form" (ngSubmit)="saveConfig()" class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="cfg-title" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    Título do Enxoval
                  </label>
                  <input
                    id="cfg-title"
                    type="text"
                    formControlName="title"
                    placeholder="Ex.: Enxoval do Meu Bebê"
                    class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] focus:outline-none focus:border-[#C2185B]"
                  />
                </div>
                <div>
                  <label for="cfg-baby" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    Nome do Bebê
                  </label>
                  <input
                    id="cfg-baby"
                    type="text"
                    formControlName="babyName"
                    placeholder="Ex.: Sofia ou Nosso Bebê"
                    class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] focus:outline-none focus:border-[#C2185B]"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label for="cfg-key-type" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    Tipo da Chave Pix
                  </label>
                  <select
                    id="cfg-key-type"
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
                  <label for="cfg-pix-key" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    Sua Chave Pix Própria
                  </label>
                  <input
                    id="cfg-pix-key"
                    type="text"
                    formControlName="pixKey"
                    placeholder="Digite sua chave Pix real (e-mail, CPF, celular ou aleatória)"
                    class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] font-mono focus:outline-none focus:border-[#C2185B]"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div class="sm:col-span-2">
                  <label for="cfg-creator" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    Nome do Titular Pix (até 25 caracteres)
                  </label>
                  <input
                    id="cfg-creator"
                    type="text"
                    formControlName="creatorName"
                    placeholder="Seu nome completo"
                    class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] focus:outline-none focus:border-[#C2185B]"
                  />
                </div>
                <div>
                  <label for="cfg-city" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    Cidade
                  </label>
                  <input
                    id="cfg-city"
                    type="text"
                    formControlName="creatorCity"
                    placeholder="SAO PAULO"
                    class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] focus:outline-none focus:border-[#C2185B]"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="cfg-due" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    Data Prevista do Parto
                  </label>
                  <input
                    id="cfg-due"
                    type="date"
                    formControlName="dueDate"
                    class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] focus:outline-none focus:border-[#C2185B]"
                  />
                </div>
                <div>
                  <label for="cfg-note" class="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    Mensagem de Boas-Vindas
                  </label>
                  <input
                    id="cfg-note"
                    type="text"
                    formControlName="welcomeNote"
                    class="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#F6F7F9] border border-[#D8DCE3] text-sm text-[#0F1115] focus:outline-none focus:border-[#C2185B]"
                  />
                </div>
              </div>

              <!-- Expandable Pix Explanation -->
              <div class="rounded-[20px] bg-[#F6F7F9] border border-[#E4E7EC] p-3.5 space-y-2">
                <button
                  type="button"
                  (click)="togglePixEducation()"
                  class="w-full flex items-center justify-between text-xs font-bold text-[#0F1115] cursor-pointer"
                >
                  <span class="flex items-center gap-2">
                    <mat-icon class="text-base! text-[#C2185B]">help_outline</mat-icon>
                    <span>Entenda como o QR Code Pix é gerado com sua chave</span>
                  </span>
                  <mat-icon class="text-base! text-[#C2185B]">{{ showPixEducation() ? 'expand_less' : 'expand_more' }}</mat-icon>
                </button>
                @if (showPixEducation()) {
                  <div class="text-[11px] text-[#4B5563] space-y-1.5 pt-1 leading-relaxed">
                    <p>
                      O Enxoval Baby gera um <strong class="text-[#0F1115]">BR Code Estático padrão EMV QRCPS-MPM</strong> reconhecido pelo Banco Central e por todos os bancos brasileiros.
                    </p>
                    <p>
                      Não há intermediários nem taxas: sua chave DICT, o valor exato do item e o TXID são codificados com checksum <strong class="text-[#0F1115]">CRC-16/CCITT-FALSE</strong> diretamente para sua conta.
                    </p>
                  </div>
                }
              </div>

              @if (errorMsg()) {
                <p class="text-xs font-semibold text-[#9D174D] bg-[#FCE4EC] border border-[#F48FB1] rounded-xl px-3 py-2">
                  {{ errorMsg() }}
                </p>
              }

              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#E4E7EC]">
                <div class="text-[11px] text-[#4B5563]">
                  Backend:
                  <strong class="text-[#0F1115]">
                    {{ store.realtimeMode() === 'supabase' ? 'Supabase Realtime' : 'Preview Local' }}
                  </strong>
                </div>

                <button
                  type="submit"
                  [disabled]="saving() || form.invalid || store.listConfig().isCommunityTemplate"
                  class="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-[#FF80AB] hover:bg-[#F48FB1] disabled:opacity-45 text-[#111111] text-sm font-bold cursor-pointer apple-press whitespace-nowrap"
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
