import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {animate} from 'motion';
import {EnxovalStore} from '../core/enxoval-store';
import {KawaiiRibbon} from './kawaii-ornaments';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-google-auth-modal',
  imports: [ReactiveFormsModule, MatIconModule, KawaiiRibbon],
  template: `
    @if (store.authModalOpen()) {
      <div
        (keydown.escape)="close()"
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-rose-100/55 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="google-auth-title"
      >
        <button
          type="button"
          tabindex="-1"
          aria-label="Fechar janela de login"
          (click)="close()"
          class="absolute inset-0 w-full h-full cursor-default"
        ></button>
        <div
          #sheetContainer
          class="relative z-10 glass-panel-strong w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
        >
          <!-- Mobile Grab Handle -->
          <div class="sm:hidden pt-3 pb-1 flex justify-center">
            <span class="w-10 h-1.5 rounded-full bg-rose-300/80"></span>
          </div>

          <div class="flex items-center justify-between gap-4 px-6 py-4 border-b border-rose-200/60 bg-white/70 texture-silk-grid">
            <div class="flex items-center gap-3">
              <app-kawaii-ribbon [size]="28" />
              <div>
                <p class="text-xs font-medium text-rose-700">Acesso Exclusivo Google</p>
                <h2 id="google-auth-title" class="font-display text-lg font-semibold text-rose-950">
                  Conectar Conta Google
                </h2>
              </div>
            </div>
            <button
              type="button"
              (click)="close()"
              aria-label="Fechar janela de login"
              class="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-rose-800 hover:bg-rose-100/80 transition-colors cursor-pointer"
            >
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="p-6 space-y-5 texture-cotton-dots">
            <p class="text-sm text-rose-900 leading-relaxed">
              Entre exclusivamente com sua conta Google para editar itens do enxoval, configurar a chave Pix da lista e vincular sua assinatura nos presentes recebidos.
            </p>

            @if (!showPreviewForm()) {
              <button
                type="button"
                (click)="handleGoogleClick()"
                [disabled]="loading()"
                class="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-white hover:bg-rose-50 border border-rose-200 shadow-sm flex items-center justify-center gap-3 text-sm font-semibold text-rose-950 transition-all apple-press cursor-pointer"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z" />
                  <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z" />
                </svg>
                <span>{{ loading() ? 'Abrindo autenticação Google...' : 'Continuar com Google' }}</span>
              </button>
            } @else {
              <div class="rounded-2xl bg-rose-50/80 border border-rose-200 p-4 space-y-3">
                <div class="text-xs font-semibold text-rose-900">
                  Modo Preview Google (OAuth externo ainda não configurado)
                </div>
                <p class="text-xs text-rose-800 leading-relaxed">
                  Para testar a sessão Google imediatamente neste ambiente, confirme seu nome e e-mail Google. Em produção, basta definir <code class="font-mono">GOOGLE_CLIENT_ID</code> ou conectar o Supabase Auth.
                </p>
                <form [formGroup]="previewForm" (ngSubmit)="submitPreview()" class="space-y-3">
                  <div>
                    <label for="g-name" class="block text-xs font-semibold text-rose-900 mb-1">
                      Nome Completo
                    </label>
                    <input
                      id="g-name"
                      type="text"
                      formControlName="name"
                      placeholder="Ex.: Mariana Oliveira"
                      class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-rose-200 text-sm text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                  </div>
                  <div>
                    <label for="g-email" class="block text-xs font-semibold text-rose-900 mb-1">
                      E-mail Google
                    </label>
                    <input
                      id="g-email"
                      type="email"
                      formControlName="email"
                      placeholder="voce@gmail.com"
                      class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-rose-200 text-sm text-rose-950 focus:outline-none focus:ring-2 focus:ring-rose-400"
                    />
                  </div>
                  @if (errorMsg()) {
                    <p class="text-xs text-red-700 font-medium">{{ errorMsg() }}</p>
                  }
                  <button
                    type="submit"
                    [disabled]="loading() || previewForm.invalid"
                    class="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-semibold transition-all apple-press cursor-pointer"
                  >
                    {{ loading() ? 'Conectando...' : 'Confirmar Sessão Google' }}
                  </button>
                </form>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class GoogleAuthModal {
  protected readonly store = inject(EnxovalStore);
  private readonly sheetRef = viewChild<ElementRef<HTMLElement>>('sheetContainer');

  readonly loading = signal(false);
  readonly showPreviewForm = signal(false);
  readonly errorMsg = signal<string | null>(null);

  readonly previewForm = new FormGroup({
    name: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.minLength(2)]}),
    email: new FormControl('', {nonNullable: true, validators: [Validators.required, Validators.email]}),
  });

  private wasOpen = false;

  constructor() {
    effect(() => {
      const open = this.store.authModalOpen();
      const el = this.sheetRef()?.nativeElement;
      if (open && !this.wasOpen) {
        this.wasOpen = true;
        if (el && typeof window !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          animate(el, {opacity: [0, 1], y: [28, 0]}, {duration: 0.28, ease: [0.16, 1, 0.3, 1]});
        }
      } else if (!open) {
        this.wasOpen = false;
        this.showPreviewForm.set(false);
        this.errorMsg.set(null);
      }
    });
  }

  async handleGoogleClick(): Promise<void> {
    this.loading.set(true);
    this.errorMsg.set(null);
    try {
      const outcome = await this.store.startGoogleOAuthPopup();
      if (outcome === 'needs_preview') {
        this.showPreviewForm.set(true);
      }
    } catch {
      this.showPreviewForm.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async submitPreview(): Promise<void> {
    if (this.previewForm.invalid || this.loading()) return;
    this.loading.set(true);
    this.errorMsg.set(null);
    try {
      const {name, email} = this.previewForm.getRawValue();
      await this.store.signInPreviewGoogle(email.trim(), name.trim());
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : 'Erro ao conectar conta.');
    } finally {
      this.loading.set(false);
    }
  }

  close(): void {
    this.store.authModalOpen.set(false);
  }
}
