import {CurrencyPipe, DatePipe} from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {animate, stagger} from 'motion';
import {AddItemModal} from './components/add-item-modal';
import {AppHero, HeroStageMeta} from './components/app-hero';
import {BabyToolsPanel} from './components/baby-tools-panel';
import {CreateListWizard} from './components/create-list-wizard';
import {GoogleAuthModal} from './components/google-auth-modal';
import {KawaiiLoadingSkeleton} from './components/kawaii-loading-skeleton';
import {KawaiiFloralCorner, KawaiiRibbon} from './components/kawaii-ornaments';
import {PixCheckoutModal} from './components/pix-checkout-modal';
import {PixConfigDrawer} from './components/pix-config-drawer';
import {DECORATION_IMAGES, FULL_ENXOVAL_CATALOG, STAGE_IMAGES} from './core/catalog-seed';
import {AppViewMode, CatalogSortOrder, EnxovalStore, MobileTab} from './core/enxoval-store';
import {EnxovalItem, EnxovalStage, StoreSlug} from './core/models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    MatIconModule,
    KawaiiRibbon,
    KawaiiFloralCorner,
    AppHero,
    KawaiiLoadingSkeleton,
    CreateListWizard,
    PixCheckoutModal,
    AddItemModal,
    PixConfigDrawer,
    GoogleAuthModal,
    BabyToolsPanel,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly store = inject(EnxovalStore);
  private readonly rootContainer = viewChild<ElementRef<HTMLElement>>('rootContainer');
  private readonly accountMenuRef = viewChild<ElementRef<HTMLElement>>('accountMenuEl');
  private readonly toastRef = viewChild<ElementRef<HTMLElement>>('toastEl');
  private readonly catalogGridRef = viewChild<ElementRef<HTMLElement>>('catalogGrid');

  protected readonly heroImage = STAGE_IMAGES.hero;
  protected readonly decorImages = DECORATION_IMAGES;
  protected readonly fullCatalogCount = FULL_ENXOVAL_CATALOG.length;

  protected readonly stages: HeroStageMeta[] = [
    {
      id: 'gestante',
      shortLabel: 'Gestante',
      title: 'Gestante & Maternidade',
      subtitle: 'Mala do hospital, amamentação e cuidados pós-parto',
      imageUrl: STAGE_IMAGES.gestante,
    },
    {
      id: 'bebe_rn',
      shortLabel: 'Bebê RN',
      title: 'Bebê Recém-Nascido',
      subtitle: 'Roupinhas em algodão pima, fraldas, higiene e cueiros',
      imageUrl: STAGE_IMAGES.bebe_rn,
    },
    {
      id: 'quarto_passeio',
      shortLabel: 'Quarto',
      title: 'Quarto, Passeio & Banho',
      subtitle: 'Berço certificado, carrinho travel system, banheira e babá',
      imageUrl: STAGE_IMAGES.quarto_passeio,
    },
    {
      id: 'familia',
      shortLabel: 'Família',
      title: 'Família & Rede de Apoio',
      subtitle: 'Ergonomia dos pais, esterilizador, primeiros socorros e ordem',
      imageUrl: STAGE_IMAGES.familia,
    },
  ];

  protected readonly stageLabels: Record<EnxovalStage, string> = {
    gestante: 'Gestante',
    bebe_rn: 'Bebê RN',
    quarto_passeio: 'Quarto & Passeio',
    familia: 'Família',
  };

  protected readonly searchControl = new FormControl('', {nonNullable: true});
  protected readonly categoryControl = new FormControl('all', {nonNullable: true});
  protected readonly sortControl = new FormControl<CatalogSortOrder>('default', {nonNullable: true});
  protected readonly activeCheckoutItem = signal<EnxovalItem | null>(null);
  protected readonly addItemOpen = signal(false);
  protected readonly pixConfigOpen = signal(false);
  protected readonly syncingIndex = signal(false);
  protected readonly accountMenuOpen = signal(false);

  protected readonly hasActiveCatalogFilters = computed(
    () =>
      this.store.selectedStage() !== 'all' ||
      this.store.selectedCategory() !== 'all' ||
      this.store.onlyRemaining() ||
      this.store.searchQuery().trim().length > 0 ||
      this.store.sortOrder() !== 'default',
  );

  protected readonly storeFilterTabs: {slug: StoreSlug | 'all'; label: string}[] = [
    {slug: 'all', label: 'Todas as Lojas'},
    {slug: 'magalu', label: 'Magazine Luiza'},
    {slug: 'mercadolivre', label: 'Mercado Livre'},
    {slug: 'amazon', label: 'Amazon Brasil'},
    {slug: 'farmacias', label: 'Farmácias em Geral'},
  ];

  protected readonly indexedRows = computed(() => {
    const storeFilter = this.store.selectedStoreFilter();
    const list = this.store.items();
    return list.map((item) => {
      const matchingOffers =
        storeFilter === 'all'
          ? item.offers
          : item.offers.filter((o) => o.storeSlug === storeFilter);
      const pool = matchingOffers.length > 0 ? matchingOffers : item.offers;
      const bestOffer = pool.reduce(
        (cheapest, current) => (current.priceBrl < cheapest.priceBrl ? current : cheapest),
        pool[0],
      );
      return {
        item,
        bestOffer,
        offers: matchingOffers,
      };
    });
  });

  private lastActiveSlug = this.store.activeListSlug();
  private lastCatalogKey: string | null = null;

  constructor() {
    this.searchControl.valueChanges.subscribe((value) => {
      this.store.searchQuery.set(value);
    });

    this.categoryControl.valueChanges.subscribe((category) => {
      this.store.selectedCategory.set(category);
    });

    this.sortControl.valueChanges.subscribe((order) => {
      this.store.sortOrder.set(order);
    });

    afterNextRender(() => {
      this.runRevealAnimations();
    });

    effect(() => {
      const slug = this.store.activeListSlug();
      if (slug !== this.lastActiveSlug) {
        this.lastActiveSlug = slug;
        this.resetCatalogFilters();
      }
    });

    effect(() => {
      const loading = this.store.loading();
      const switching = this.store.switchingList();
      const currentView = this.store.activeView();
      if (currentView && !loading && !switching && typeof window !== 'undefined') {
        setTimeout(() => this.runRevealAnimations(), 40);
      }
    });

    effect(() => {
      const menuOpen = this.accountMenuOpen();
      const el = this.accountMenuRef()?.nativeElement;
      if (menuOpen && el && typeof window !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        animate(el, {opacity: [0, 1], y: [-8, 0], scale: [0.96, 1]}, {duration: 0.2, ease: [0.16, 1, 0.3, 1]});
      }
    });

    effect(() => {
      const toast = this.store.toastMessage();
      const el = this.toastRef()?.nativeElement;
      if (toast && el && typeof window !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        animate(el, {opacity: [0, 1], y: [16, 0], scale: [0.96, 1]}, {duration: 0.24, ease: [0.16, 1, 0.3, 1]});
      }
    });

    effect(() => {
      const filterKey = [
        this.store.selectedStage(),
        this.store.selectedCategory(),
        this.store.onlyRemaining(),
        this.store.sortOrder(),
        this.store.searchQuery(),
      ].join('|');
      if (this.lastCatalogKey === null) {
        this.lastCatalogKey = filterKey;
        return;
      }
      if (this.lastCatalogKey === filterKey) return;
      this.lastCatalogKey = filterKey;
      if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      setTimeout(() => {
        const grid = untracked(() => this.catalogGridRef()?.nativeElement);
        const cards = grid?.querySelectorAll('.catalog-card');
        if (cards && cards.length > 0) {
          animate(
            cards,
            {opacity: [0.25, 1], y: [10, 0], scale: [0.985, 1]},
            {delay: stagger(0.025), duration: 0.28, ease: [0.16, 1, 0.3, 1]},
          );
        }
      }, 24);
    });
  }

  private runRevealAnimations(): void {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const root = this.rootContainer()?.nativeElement;
    if (!root) return;
    const targets = root.querySelectorAll('.animate-reveal');
    if (targets.length > 0) {
      animate(
        targets,
        {opacity: [0, 1], y: [14, 0]},
        {delay: stagger(0.045), duration: 0.4, ease: [0.16, 1, 0.3, 1]},
      );
    }
  }

  protected switchView(view: AppViewMode): void {
    this.accountMenuOpen.set(false);
    this.store.openView(view, true);
  }

  protected toggleAccountMenu(): void {
    this.accountMenuOpen.update((v) => !v);
  }

  protected closeAccountMenu(): void {
    this.accountMenuOpen.set(false);
  }

  protected openPixFromMenu(): void {
    this.accountMenuOpen.set(false);
    this.pixConfigOpen.set(true);
  }

  protected openWizardFromMenu(): void {
    this.accountMenuOpen.set(false);
    this.openWizard();
  }

  protected async signOutFromMenu(): Promise<void> {
    this.accountMenuOpen.set(false);
    await this.store.signOut();
  }

  protected dismissToast(): void {
    this.store.toastMessage.set(null);
  }

  protected isBestOffer(item: EnxovalItem, priceBrl: number): boolean {
    let min = Infinity;
    for (const o of item.offers) {
      if (o.priceBrl < min) min = o.priceBrl;
    }
    return priceBrl <= min;
  }

  protected openWizard(): void {
    this.store.wizardOpen.set(true);
  }

  protected async selectCommunityList(slug: string): Promise<void> {
    if (slug === this.store.activeListSlug()) {
      this.store.openView('lista', true);
      return;
    }
    await this.store.loadListBySlug(slug, true, true);
  }

  protected selectStage(stage: EnxovalStage | 'all'): void {
    this.store.selectedStage.set(stage);
  }

  protected selectStageAndScroll(stage: EnxovalStage): void {
    this.store.selectedStage.set(stage);
    this.store.openView('lista', false);
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        const el = document.getElementById('catalogo');
        el?.scrollIntoView({behavior: 'smooth', block: 'start'});
      }, 60);
    }
  }

  protected navigateMobileTab(tab: MobileTab): void {
    this.store.activeMobileTab.set(tab);
    if (tab === 'conta') {
      this.pixConfigOpen.set(true);
      return;
    }
    const targetView: AppViewMode =
      tab === 'catalogo' ? 'lista' : tab === 'etapas' ? 'descobrir' : 'ferramentas';
    this.store.openView(targetView, true);
  }

  protected toggleOnlyRemaining(): void {
    this.store.onlyRemaining.update((v) => !v);
  }

  protected resetCatalogFilters(): void {
    this.store.selectedStage.set('all');
    this.store.selectedCategory.set('all');
    this.store.onlyRemaining.set(false);
    this.searchControl.setValue('');
    this.categoryControl.setValue('all');
    this.sortControl.setValue('default');
  }

  protected setStoreFilter(slug: StoreSlug | 'all'): void {
    this.store.selectedStoreFilter.set(slug);
  }

  protected remainingQty(item: EnxovalItem): number {
    return Math.max(0, item.requiredQty - item.purchasedQty);
  }

  protected itemProgressPct(item: EnxovalItem): number {
    if (item.requiredQty <= 0) return 0;
    return Math.min(100, Math.round((item.purchasedQty / item.requiredQty) * 100));
  }

  protected stageProgress(stage: EnxovalStage): {
    required: number;
    purchased: number;
    remaining: number;
    pct: number;
  } {
    const stat = this.store.stageStats().get(stage) ?? {required: 0, purchased: 0, remaining: 0};
    const pct = stat.required > 0 ? Math.round((stat.purchased / stat.required) * 100) : 0;
    return {...stat, pct};
  }

  protected openCheckout(item: EnxovalItem): void {
    if (this.remainingQty(item) <= 0) return;
    this.activeCheckoutItem.set(item);
  }

  protected closeCheckout(): void {
    this.activeCheckoutItem.set(null);
  }

  protected openPixFromCheckout(): void {
    this.activeCheckoutItem.set(null);
    this.pixConfigOpen.set(true);
  }

  protected onProductImageError(event: Event, stage: EnxovalStage): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;
    const fallback = STAGE_IMAGES[stage];
    if (!img.src.endsWith(fallback)) {
      img.src = fallback;
      img.classList.remove('object-contain', 'p-2', 'p-1', 'p-3');
      img.classList.add('object-cover');
    }
  }

  protected openCatalogBrowser(): void {
    this.addItemOpen.set(true);
  }

  protected openAddItem(): void {
    if (!this.store.isAuthenticated()) {
      this.store.authModalOpen.set(true);
      this.store.showToast('Conecte sua conta Google para adicionar itens.');
      return;
    }
    if (!this.store.canManageActiveList()) {
      this.store.showToast('Esta lista pertence a outro criador. Crie a sua no assistente!');
      this.openWizard();
      return;
    }
    this.addItemOpen.set(true);
  }

  protected async removeItem(item: EnxovalItem): Promise<void> {
    if (!this.store.isAuthenticated()) {
      this.store.authModalOpen.set(true);
      return;
    }
    if (!this.store.canManageActiveList()) {
      this.store.showToast('Somente o criador desta lista pode remover itens.');
      return;
    }
    await this.store.deleteItem(item.id);
  }

  protected async triggerSyncSsg(): Promise<void> {
    if (this.syncingIndex()) return;
    this.syncingIndex.set(true);
    try {
      await this.store.syncSsgIndex();
    } finally {
      this.syncingIndex.set(false);
    }
  }
}
