import {isPlatformBrowser} from '@angular/common';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {computed, inject, Injectable, OnDestroy, PLATFORM_ID, signal} from '@angular/core';
import {createClient, RealtimeChannel, SupabaseClient} from '@supabase/supabase-js';
import QRCode from 'qrcode';
import {firstValueFrom} from 'rxjs';
import {INITIAL_ENXOVAL_ITEMS, INITIAL_LIST_CONFIG} from './catalog-seed';
import {
  CreateListWizardInput,
  EnxovalItem,
  EnxovalListConfig,
  EnxovalStage,
  EnxovalStateSnapshot,
  GoogleUserProfile,
  ItemPriority,
  MaternityBagChecklistItem,
  PixKeyType,
  PublicEnxovalSummary,
  PurchaseRecord,
  SelectedCatalogItemInput,
  SsgIndexMetadata,
  StoreSlug,
} from './models';
import {generatePixBrCode} from './pix-brcode';

export interface NewItemInput {
  stage: EnxovalStage;
  category: string;
  name: string;
  description: string;
  priority: ItemPriority;
  requiredQty: number;
  unitPriceBrl: number;
  searchQuery: string;
}

export interface ListConfigInput {
  title: string;
  babyName: string;
  dueDate: string;
  creatorName: string;
  creatorCity: string;
  pixKey: string;
  pixKeyType: PixKeyType;
  welcomeNote: string;
}

export interface PurchaseInput {
  itemId: string;
  quantity: number;
  buyerName: string;
  buyerMessage: string;
  paymentMethod: 'pix' | 'loja_externa';
  storeName?: string;
  pixTxid?: string;
}

export interface PixPreviewResult {
  pixPayload: string;
  pixTxid: string;
  totalAmountBrl: number;
  qrDataUrl: string;
  creatorName: string;
  pixKey: string;
}

export type MobileTab = 'catalogo' | 'etapas' | 'ferramentas' | 'conta';
export type CatalogSortOrder = 'default' | 'price_asc' | 'remaining_desc';
export type AppViewMode = 'lista' | 'descobrir' | 'ferramentas';

const INITIAL_MATERNITY_CHECKLIST: MaternityBagChecklistItem[] = [
  {id: 'bag-1', group: 'Mamãe', label: 'Camisolas com abertura frontal para amamentar', qtyLabel: '3 un.', packed: true},
  {id: 'bag-2', group: 'Mamãe', label: 'Sutiãs de amamentação + absorventes para seios', qtyLabel: '3 un.', packed: false},
  {id: 'bag-3', group: 'Mamãe', label: 'Calcinhas pós-parto confortáveis cintura alta', qtyLabel: '5 un.', packed: false},
  {id: 'bag-4', group: 'Mamãe', label: 'Roupão leve, chinelo lavável e nécessaire', qtyLabel: '1 kit', packed: false},
  {id: 'bag-5', group: 'Bebê', label: 'Trocas completas RN (body + mijão + macacão)', qtyLabel: '6 kits', packed: true},
  {id: 'bag-6', group: 'Bebê', label: 'Pacote de fraldas RN corte umbilical + lenços água pura', qtyLabel: '1 pct', packed: false},
  {id: 'bag-7', group: 'Bebê', label: 'Mantas macias, meias, luvinhas e paninhos de boca', qtyLabel: '3 un.', packed: false},
  {id: 'bag-8', group: 'Documentos & Acompanhante', label: 'RG, CPF, Cartão Pré-Natal, Exames e Plano de Parto', qtyLabel: '1 pasta', packed: true},
  {id: 'bag-9', group: 'Documentos & Acompanhante', label: 'Troca de roupa do acompanhante e carregador longo', qtyLabel: '1 kit', packed: false},
];

@Injectable({providedIn: 'root'})
export class EnxovalStore implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private sseSource: EventSource | null = null;
  private supabaseClient: SupabaseClient | null = null;
  private supabaseChannel: RealtimeChannel | null = null;

  // In-memory Google auth session token (never stored in localStorage/sessionStorage)
  private accessToken = signal<string | null>(null);
  readonly currentUser = signal<GoogleUserProfile | null>(null);
  readonly googleOAuthConfigured = signal(false);
  readonly authModalOpen = signal(false);

  readonly listConfig = signal<EnxovalListConfig>(INITIAL_LIST_CONFIG);
  readonly activeListSlug = signal<string>(INITIAL_LIST_CONFIG.slug);
  readonly availableLists = signal<PublicEnxovalSummary[]>([]);
  readonly items = signal<EnxovalItem[]>(INITIAL_ENXOVAL_ITEMS);
  readonly purchases = signal<PurchaseRecord[]>([]);
  readonly ssgMeta = signal<SsgIndexMetadata>({
    generatedAt: '2026-11-22T06:00:00.000Z',
    workflowName: 'daily-scrape-ssg-index',
    scheduleCron: '0 6 * * *',
    totalItemsIndexed: INITIAL_ENXOVAL_ITEMS.length,
    totalOffersIndexed: INITIAL_ENXOVAL_ITEMS.length * 4,
    storesCovered: ['Magazine Luiza', 'Mercado Livre', 'Amazon Brasil', 'Farmácias em Geral'],
    sourceMode: 'github-ssg-static',
  });
  readonly realtimeMode = signal<'supabase' | 'sse-local'>('sse-local');
  readonly supabaseConnected = signal(false);
  readonly loading = signal(true);
  readonly switchingList = signal(false);
  readonly wizardOpen = signal(false);
  readonly error = signal<string | null>(null);
  readonly toastMessage = signal<string | null>(null);

  // Navigation & Filters
  readonly activeView = signal<AppViewMode>('descobrir');
  readonly activeMobileTab = signal<MobileTab>('etapas');
  readonly selectedStage = signal<EnxovalStage | 'all'>('all');
  readonly selectedCategory = signal<string>('all');
  readonly searchQuery = signal('');
  readonly onlyRemaining = signal(false);
  readonly sortOrder = signal<CatalogSortOrder>('default');
  readonly selectedStoreFilter = signal<StoreSlug | 'all'>('all');

  // Baby Tools State
  readonly maternityChecklist = signal<MaternityBagChecklistItem[]>(INITIAL_MATERNITY_CHECKLIST);

  readonly availableCategories = computed(() => {
    const cats = new Set<string>();
    for (const item of this.items()) {
      if (item.category.trim()) cats.add(item.category.trim());
    }
    return Array.from(cats).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  });

  readonly isAuthenticated = computed(() => Boolean(this.currentUser() && this.accessToken()));
  readonly canManageActiveList = computed(() => {
    const user = this.currentUser();
    if (!user || !this.accessToken()) return false;
    const cfg = this.listConfig();
    if (cfg.isCommunityTemplate) return false;
    const ownerEmail = cfg.ownerEmail?.trim().toLowerCase();
    return !ownerEmail || ownerEmail === user.email.toLowerCase();
  });
  readonly activeShareUrl = computed(() => {
    const slug = this.activeListSlug();
    if (!isPlatformBrowser(this.platformId)) {
      return `/?list=${encodeURIComponent(slug)}`;
    }
    return `${window.location.origin}/?list=${encodeURIComponent(slug)}`;
  });

  readonly filteredItems = computed(() => {
    const stage = this.selectedStage();
    const category = this.selectedCategory();
    const query = this.searchQuery().trim().toLowerCase();
    const onlyRem = this.onlyRemaining();
    const order = this.sortOrder();

    const matched = this.items().filter((item) => {
      if (stage !== 'all' && item.stage !== stage) return false;
      if (category !== 'all' && item.category !== category) return false;
      if (onlyRem && item.requiredQty - item.purchasedQty <= 0) return false;
      if (query) {
        const haystack = `${item.name} ${item.category} ${item.description}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    if (order === 'price_asc') {
      return [...matched].sort((a, b) => a.unitPriceBrl - b.unitPriceBrl);
    }
    if (order === 'remaining_desc') {
      return [...matched].sort(
        (a, b) => Math.max(0, b.requiredQty - b.purchasedQty) - Math.max(0, a.requiredQty - a.purchasedQty),
      );
    }
    return matched;
  });

  readonly stats = computed(() => {
    const all = this.items();
    let totalRequired = 0;
    let totalPurchased = 0;
    let remainingValueBrl = 0;
    let totalOffers = 0;

    for (const item of all) {
      totalRequired += item.requiredQty;
      const purchased = Math.min(item.purchasedQty, item.requiredQty);
      totalPurchased += purchased;
      const remaining = Math.max(0, item.requiredQty - purchased);
      remainingValueBrl += remaining * item.unitPriceBrl;
      totalOffers += item.offers.length;
    }

    const totalRemaining = Math.max(0, totalRequired - totalPurchased);
    const completionPct =
      totalRequired > 0 ? Math.round((totalPurchased / totalRequired) * 100) : 0;

    return {
      totalCatalogItems: all.length,
      totalRequired,
      totalPurchased,
      totalRemaining,
      completionPct,
      remainingValueBrl,
      totalOffers,
    };
  });

  readonly stageStats = computed(() => {
    const all = this.items();
    const stages: EnxovalStage[] = ['gestante', 'bebe_rn', 'quarto_passeio', 'familia'];
    const map = new Map<EnxovalStage, {required: number; purchased: number; remaining: number}>();
    for (const s of stages) {
      map.set(s, {required: 0, purchased: 0, remaining: 0});
    }
    for (const item of all) {
      const entry = map.get(item.stage);
      if (!entry) continue;
      entry.required += item.requiredQty;
      entry.purchased += Math.min(item.purchasedQty, item.requiredQty);
      entry.remaining += Math.max(0, item.requiredQty - item.purchasedQty);
    }
    return map;
  });

  readonly checklistProgress = computed(() => {
    const all = this.maternityChecklist();
    const packed = all.filter((i) => i.packed).length;
    return {
      total: all.length,
      packed,
      pct: all.length > 0 ? Math.round((packed / all.length) * 100) : 0,
    };
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.listenOAuthPopupMessages();
      void this.initialize();
    }
  }

  ngOnDestroy(): void {
    this.teardownRealtime();
  }

  private authHeaders(): HttpHeaders {
    const token = this.accessToken();
    return token ? new HttpHeaders({Authorization: `Bearer ${token}`}) : new HttpHeaders();
  }

  openView(view: AppViewMode, scrollToTop = true): void {
    this.activeView.set(view);
    this.activeMobileTab.set(
      view === 'lista' ? 'catalogo' : view === 'descobrir' ? 'etapas' : 'ferramentas',
    );
    if (scrollToTop && isPlatformBrowser(this.platformId)) {
      window.scrollTo({top: 0, behavior: 'smooth'});
    }
  }

  showToast(message: string): void {
    this.toastMessage.set(message);
    setTimeout(() => {
      if (this.toastMessage() === message) {
        this.toastMessage.set(null);
      }
    }, 3600);
  }

  private listenOAuthPopupMessages(): void {
    window.addEventListener('message', async (event) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data?.type === 'GOOGLE_OAUTH_SUCCESS' && event.data?.token && event.data?.user) {
        const gUser = event.data.user as GoogleUserProfile;
        this.accessToken.set(String(event.data.token));
        this.currentUser.set(gUser);
        this.listConfig.update((cfg) => {
          if (cfg.isCommunityTemplate || cfg.ownerEmail) return cfg;
          return {
            ...cfg,
            ownerEmail: gUser.email,
            creatorName: cfg.creatorName || gUser.name.toUpperCase().slice(0, 25),
          };
        });
        this.authModalOpen.set(false);
        this.showToast(`Conectado com Google: ${gUser.name}`);
      }

      if (
        event.data?.type === 'SUPABASE_AUTH_CALLBACK' &&
        typeof event.data?.code === 'string' &&
        this.supabaseClient
      ) {
        const {data, error} = await this.supabaseClient.auth.exchangeCodeForSession(event.data.code);
        if (!error && data.session) {
          this.applySupabaseSession(data.session);
          const gUser = this.currentUser();
          if (gUser) {
            this.listConfig.update((cfg) => {
              if (cfg.isCommunityTemplate || cfg.ownerEmail) return cfg;
              return {
                ...cfg,
                ownerEmail: gUser.email,
                creatorName: cfg.creatorName || gUser.name.toUpperCase().slice(0, 25),
              };
            });
          }
          this.authModalOpen.set(false);
          this.showToast(`Conectado com Google via Supabase: ${this.currentUser()?.name}`);
        }
      }
    });
  }

  private applySupabaseSession(session: {
    access_token: string;
    user: {id: string; email?: string; user_metadata?: Record<string, unknown>};
  }): void {
    this.accessToken.set(session.access_token);
    this.currentUser.set({
      id: session.user.id,
      email: session.user.email ?? '',
      name: String(session.user.user_metadata?.['full_name'] || session.user.email || 'Conta Google'),
      avatarUrl: String(session.user.user_metadata?.['avatar_url'] ?? ''),
      provider: 'google',
      authSource: 'supabase-google',
    });
  }

  private resolveInitialSlugFromUrl(): {slug: string; isExplicitLink: boolean} {
    if (!isPlatformBrowser(this.platformId)) {
      return {slug: INITIAL_LIST_CONFIG.slug, isExplicitLink: false};
    }
    const params = new URLSearchParams(window.location.search);
    const paramSlug = params.get('list')?.trim();
    if (paramSlug) return {slug: paramSlug, isExplicitLink: true};

    const match = window.location.pathname.match(/^\/l\/([^/]+)/);
    if (match?.[1]) return {slug: decodeURIComponent(match[1]), isExplicitLink: true};

    return {slug: INITIAL_LIST_CONFIG.slug, isExplicitLink: false};
  }

  async initialize(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const {slug: initialSlug, isExplicitLink} = this.resolveInitialSlugFromUrl();
    if (isExplicitLink) {
      this.activeView.set('lista');
      this.activeMobileTab.set('catalogo');
    } else {
      this.activeView.set('descobrir');
      this.activeMobileTab.set('etapas');
    }
    const minWait = new Promise((r) => setTimeout(r, 450));
    try {
      const [snapshot, supaCfg] = await Promise.all([
        firstValueFrom(
          this.http.get<EnxovalStateSnapshot>(
            `/api/enxoval/state?list=${encodeURIComponent(initialSlug)}`,
          ),
        ),
        firstValueFrom(
          this.http.get<{configured: boolean; url: string; anonKey: string}>('/api/config/supabase'),
        ),
        minWait,
      ]);

      this.applySnapshot(snapshot);
      if (supaCfg.configured && supaCfg.url && supaCfg.anonKey) {
        await this.connectSupabaseRuntime(supaCfg.url, supaCfg.anonKey);
      } else {
        this.connectSseRealtime();
      }
    } catch {
      this.error.set('Não foi possível sincronizar com o servidor agora; exibindo lista local.');
    } finally {
      this.loading.set(false);
    }
  }

  private applySnapshot(snapshot: EnxovalStateSnapshot): void {
    this.listConfig.set(snapshot.listConfig);
    this.activeListSlug.set(snapshot.listConfig.slug);
    this.items.set(snapshot.items);
    this.purchases.set(snapshot.purchases);
    this.ssgMeta.set(snapshot.ssgMeta);
    this.realtimeMode.set(snapshot.realtimeMode);
    this.googleOAuthConfigured.set(snapshot.googleOAuthConfigured);
    if (Array.isArray(snapshot.availableLists)) {
      this.availableLists.set(snapshot.availableLists);
    }
  }

  async loadListBySlug(
    slug: string,
    updateBrowserUrl = true,
    switchToListView = true,
  ): Promise<void> {
    if (this.switchingList()) return;
    this.switchingList.set(true);
    this.selectedStage.set('all');
    this.selectedCategory.set('all');
    const minWait = new Promise((r) => setTimeout(r, 420));
    try {
      const [snapshot] = await Promise.all([
        firstValueFrom(
          this.http.get<EnxovalStateSnapshot>(`/api/enxoval/state?list=${encodeURIComponent(slug)}`),
        ),
        minWait,
      ]);
      this.applySnapshot(snapshot);
      if (switchToListView) {
        this.openView('lista', true);
      }
      if (updateBrowserUrl && isPlatformBrowser(this.platformId)) {
        const nextUrl = `/?list=${encodeURIComponent(snapshot.listConfig.slug)}`;
        window.history.replaceState({}, '', nextUrl);
      }
      this.showToast(`Lista aberta: ${snapshot.listConfig.title}`);
    } catch {
      this.showToast('Não foi possível carregar essa lista agora.');
    } finally {
      this.switchingList.set(false);
    }
  }

  async createNewEnxovalList(input: CreateListWizardInput): Promise<{
    listConfig: EnxovalListConfig;
    shareUrl: string;
    summary: PublicEnxovalSummary;
  }> {
    const res = await firstValueFrom(
      this.http.post<{
        listConfig: EnxovalListConfig;
        items: EnxovalItem[];
        summary: PublicEnxovalSummary;
        availableLists: PublicEnxovalSummary[];
        shareUrl: string;
      }>('/api/enxoval/lists', input, {
        headers: this.authHeaders(),
      }),
    );

    this.listConfig.set(res.listConfig);
    this.activeListSlug.set(res.listConfig.slug);
    this.items.set(res.items);
    this.purchases.set([]);
    this.availableLists.set(res.availableLists);
    this.selectedStage.set('all');
    this.selectedCategory.set('all');
    this.openView('lista', true);

    if (isPlatformBrowser(this.platformId)) {
      window.history.replaceState({}, '', `/?list=${encodeURIComponent(res.listConfig.slug)}`);
    }
    this.showToast(`Lista "${res.listConfig.title}" publicada com link pronto!`);
    return {
      listConfig: res.listConfig,
      shareUrl: this.activeShareUrl(),
      summary: res.summary,
    };
  }

  private teardownRealtime(): void {
    if (this.sseSource) {
      this.sseSource.close();
      this.sseSource = null;
    }
    if (this.supabaseClient && this.supabaseChannel) {
      void this.supabaseClient.removeChannel(this.supabaseChannel);
      this.supabaseChannel = null;
    }
  }

  private connectSseRealtime(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.teardownRealtime();

    const source = new EventSource('/api/realtime/stream');
    this.sseSource = source;
    this.realtimeMode.set('sse-local');

    source.addEventListener('list_created', (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as {
          availableLists?: PublicEnxovalSummary[];
        };
        if (Array.isArray(data.availableLists)) {
          this.availableLists.set(data.availableLists);
        }
      } catch {
        // ignore
      }
    });

    source.addEventListener('item_added', (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as {
          listSlug?: string;
          item: EnxovalItem;
          ssgMeta?: SsgIndexMetadata;
          summary?: PublicEnxovalSummary;
        };
        if (data.summary) this.upsertListSummary(data.summary);
        if (data.listSlug && data.listSlug !== this.activeListSlug()) return;
        this.items.update((list) => {
          if (list.some((i) => i.id === data.item.id)) return list;
          return [data.item, ...list];
        });
        if (data.ssgMeta) this.ssgMeta.set(data.ssgMeta);
      } catch {
        // ignore
      }
    });

    source.addEventListener('items_batch_added', (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as {
          listSlug?: string;
          items: EnxovalItem[];
          ssgMeta?: SsgIndexMetadata;
          summary?: PublicEnxovalSummary;
        };
        if (data.summary) this.upsertListSummary(data.summary);
        if (data.listSlug && data.listSlug !== this.activeListSlug()) return;
        this.items.update((list) => {
          const existing = new Set(list.map((i) => i.id));
          const incoming = (data.items ?? []).filter((it) => !existing.has(it.id));
          return incoming.length > 0 ? [...incoming, ...list] : list;
        });
        if (data.ssgMeta) this.ssgMeta.set(data.ssgMeta);
      } catch {
        // ignore
      }
    });

    source.addEventListener('item_deleted', (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as {
          listSlug?: string;
          itemId: string;
          ssgMeta?: SsgIndexMetadata;
          summary?: PublicEnxovalSummary;
        };
        if (data.summary) this.upsertListSummary(data.summary);
        if (data.listSlug && data.listSlug !== this.activeListSlug()) return;
        this.items.update((list) => list.filter((i) => i.id !== data.itemId));
        if (data.ssgMeta) this.ssgMeta.set(data.ssgMeta);
      } catch {
        // ignore
      }
    });

    source.addEventListener('list_config_updated', (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as {
          listSlug?: string;
          listConfig: EnxovalListConfig;
          summary?: PublicEnxovalSummary;
        };
        if (data.summary) this.upsertListSummary(data.summary);
        if (data.listSlug && data.listSlug !== this.activeListSlug()) return;
        this.listConfig.set(data.listConfig);
      } catch {
        // ignore
      }
    });

    source.addEventListener('purchase_completed', (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as {
          listSlug?: string;
          item: EnxovalItem;
          purchase: PurchaseRecord;
          summary?: PublicEnxovalSummary;
        };
        if (data.summary) {
          this.availableLists.update((lists) =>
            lists.map((l) => (l.slug === data.summary!.slug ? data.summary! : l)),
          );
        }
        if (data.listSlug && data.listSlug !== this.activeListSlug()) return;
        this.items.update((list) => list.map((i) => (i.id === data.item.id ? data.item : i)));
        this.purchases.update((prev) => {
          if (prev.some((p) => p.id === data.purchase.id)) return prev;
          return [data.purchase, ...prev].slice(0, 30);
        });
      } catch {
        // ignore
      }
    });

    source.addEventListener('ssg_synced', (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as {
          listSlug?: string;
          ssgMeta: SsgIndexMetadata;
          items: EnxovalItem[];
        };
        if (data.listSlug && data.listSlug !== this.activeListSlug()) return;
        this.ssgMeta.set(data.ssgMeta);
        this.items.set(data.items);
      } catch {
        // ignore
      }
    });
  }

  async connectSupabaseRuntime(url: string, anonKey: string): Promise<boolean> {
    if (!url.startsWith('https://') || !anonKey) return false;
    try {
      this.teardownRealtime();
      const client = createClient(url, anonKey, {
        auth: {
          flowType: 'pkce',
          persistSession: false,
          autoRefreshToken: true,
        },
      });
      this.supabaseClient = client;

      const {data: sessionData} = await client.auth.getSession();
      if (sessionData.session) {
        this.applySupabaseSession(sessionData.session);
      }

      client.auth.onAuthStateChange((_event, session) => {
        if (session) {
          this.applySupabaseSession(session);
        }
      });

      const channel = client
        .channel('enxoval-realtime-sync')
        .on(
          'postgres_changes',
          {event: '*', schema: 'public', table: 'enxoval_items'},
          (payload) => {
            const row = payload.new as Record<string, unknown> | undefined;
            if (!row || typeof row['id'] !== 'string') return;
            const id = row['id'];
            this.items.update((list) =>
              list.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      purchasedQty: Number(row['purchased_qty'] ?? item.purchasedQty),
                      requiredQty: Number(row['required_qty'] ?? item.requiredQty),
                      unitPriceBrl: Number(row['unit_price_brl'] ?? item.unitPriceBrl),
                      updatedAt: String(row['updated_at'] ?? item.updatedAt),
                    }
                  : item,
              ),
            );
          },
        )
        .on(
          'postgres_changes',
          {event: 'INSERT', schema: 'public', table: 'enxoval_purchases'},
          (payload) => {
            const row = payload.new as Record<string, unknown> | undefined;
            if (!row || typeof row['id'] !== 'string') return;
            const itemId = String(row['item_id'] ?? '');
            if (!this.items().some((it) => it.id === itemId)) return;
            const rec: PurchaseRecord = {
              id: String(row['id']),
              itemId,
              itemName: String(row['item_name']),
              buyerName: String(row['buyer_name']),
              buyerEmail: row['buyer_email'] ? String(row['buyer_email']) : undefined,
              buyerAvatarUrl: row['buyer_avatar_url'] ? String(row['buyer_avatar_url']) : undefined,
              buyerMessage: String(row['buyer_message'] ?? ''),
              quantity: Number(row['quantity'] ?? 1),
              unitPriceBrl: Number(row['unit_price_brl'] ?? 0),
              totalAmountBrl: Number(row['total_amount_brl'] ?? 0),
              pixTxid: String(row['pix_txid'] ?? ''),
              pixPayload: String(row['pix_payload'] ?? ''),
              paymentMethod: row['payment_method'] === 'loja_externa' ? 'loja_externa' : 'pix',
              storeName: row['store_name'] ? String(row['store_name']) : undefined,
              createdAt: String(row['created_at'] ?? new Date().toISOString()),
            };
            this.purchases.update((prev) =>
              prev.some((p) => p.id === rec.id) ? prev : [rec, ...prev].slice(0, 30),
            );
          },
        )
        .subscribe((status) => {
          this.supabaseConnected.set(status === 'SUBSCRIBED');
          if (status === 'SUBSCRIBED') {
            this.realtimeMode.set('supabase');
          }
        });

      this.supabaseChannel = channel;
      this.realtimeMode.set('supabase');
      this.showToast('Supabase Realtime & Google Auth conectados.');
      return true;
    } catch {
      this.connectSseRealtime();
      return false;
    }
  }

  /**
   * Google Sign-In Only flow:
   * 1. Uses Supabase Auth Google OAuth PKCE popup if Supabase is connected
   * 2. Uses direct Google OAuth 2.0 popup if GOOGLE_CLIENT_ID is configured
   * 3. Otherwise opens the Google Sign-In modal for verified preview Google connection
   */
  async startGoogleOAuthPopup(): Promise<'started' | 'needs_preview'> {
    if (this.supabaseClient && this.supabaseConnected()) {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const {data, error} = await this.supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {prompt: 'select_account'},
        },
      });
      if (!error && data?.url) {
        window.open(data.url, 'google_oauth', 'width=520,height=640');
        return 'started';
      }
    }

    const res = await firstValueFrom(
      this.http.get<{configured: boolean; url: string | null}>('/api/auth/google/url'),
    );
    if (res.configured && res.url) {
      window.open(res.url, 'google_oauth', 'width=520,height=640');
      return 'started';
    }

    return 'needs_preview';
  }

  private upsertListSummary(summary: PublicEnxovalSummary): void {
    this.availableLists.update((lists) => {
      const idx = lists.findIndex((l) => l.slug === summary.slug);
      if (idx === -1) return [summary, ...lists];
      return lists.map((l, i) => (i === idx ? summary : l));
    });
  }

  async signInPreviewGoogle(email: string, name: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<{
        user: GoogleUserProfile;
        token: string;
        listConfig: EnxovalListConfig;
        summary?: PublicEnxovalSummary;
      }>('/api/auth/google/preview', {email, name}),
    );
    this.accessToken.set(res.token);
    this.currentUser.set(res.user);
    if (this.activeListSlug() === res.listConfig.slug) {
      this.listConfig.set(res.listConfig);
    }
    if (res.summary) {
      this.upsertListSummary(res.summary);
    }
    this.authModalOpen.set(false);
    this.showToast(`Conta Google conectada: ${res.user.name}`);
  }

  async signOut(): Promise<void> {
    if (this.supabaseClient) {
      await this.supabaseClient.auth.signOut();
    }
    this.accessToken.set(null);
    this.currentUser.set(null);
    this.showToast('Sessão Google encerrada.');
  }

  async addItem(input: NewItemInput): Promise<EnxovalItem> {
    const slug = this.activeListSlug();
    const res = await firstValueFrom(
      this.http.post<{item: EnxovalItem; summary?: PublicEnxovalSummary}>(
        `/api/enxoval/items?list=${encodeURIComponent(slug)}`,
        {...input, listSlug: slug},
        {headers: this.authHeaders()},
      ),
    );
    this.items.update((list) =>
      list.some((i) => i.id === res.item.id) ? list : [res.item, ...list],
    );
    if (res.summary) this.upsertListSummary(res.summary);
    this.showToast(`Item "${res.item.name}" adicionado e indexado nas 4 lojas.`);
    return res.item;
  }

  async addItemsBatch(
    items: (SelectedCatalogItemInput | NewItemInput)[],
  ): Promise<EnxovalItem[]> {
    const slug = this.activeListSlug();
    const res = await firstValueFrom(
      this.http.post<{items: EnxovalItem[]; summary?: PublicEnxovalSummary}>(
        `/api/enxoval/items/batch?list=${encodeURIComponent(slug)}`,
        {items, listSlug: slug},
        {headers: this.authHeaders()},
      ),
    );
    this.items.update((list) => {
      const existing = new Set(list.map((i) => i.id));
      const incoming = res.items.filter((it) => !existing.has(it.id));
      return incoming.length > 0 ? [...incoming, ...list] : list;
    });
    if (res.summary) this.upsertListSummary(res.summary);
    this.showToast(
      res.items.length === 1
        ? `Item "${res.items[0].name}" adicionado à lista!`
        : `${res.items.length} novos itens adicionados ao enxoval!`,
    );
    return res.items;
  }

  async deleteItem(itemId: string): Promise<void> {
    const slug = this.activeListSlug();
    const res = await firstValueFrom(
      this.http.delete<{ok: boolean; summary?: PublicEnxovalSummary}>(
        `/api/enxoval/items/${encodeURIComponent(itemId)}?list=${encodeURIComponent(slug)}`,
        {headers: this.authHeaders()},
      ),
    );
    this.items.update((list) => list.filter((i) => i.id !== itemId));
    if (res.summary) this.upsertListSummary(res.summary);
    this.showToast('Item removido do enxoval.');
  }

  async updateListConfig(input: ListConfigInput): Promise<EnxovalListConfig> {
    const slug = this.activeListSlug();
    const res = await firstValueFrom(
      this.http.put<{listConfig: EnxovalListConfig; summary?: PublicEnxovalSummary}>(
        `/api/enxoval/list-config?list=${encodeURIComponent(slug)}`,
        {...input, listSlug: slug},
        {headers: this.authHeaders()},
      ),
    );
    this.listConfig.set(res.listConfig);
    if (res.summary) this.upsertListSummary(res.summary);
    this.showToast('Chave Pix e configurações da lista atualizadas.');
    return res.listConfig;
  }

  async previewPix(item: EnxovalItem, quantity: number): Promise<PixPreviewResult | null> {
    const cfg = this.listConfig();
    if (!cfg.pixKey.trim()) {
      return null;
    }
    const slug = this.activeListSlug();
    const totalAmountBrl = Number((item.unitPriceBrl * quantity).toFixed(2));
    const txid = `ENX${Date.now().toString(36).toUpperCase()}`.slice(0, 25);

    try {
      return await firstValueFrom(
        this.http.post<PixPreviewResult>('/api/functions/pix-preview', {
          listSlug: slug,
          itemId: item.id,
          quantity,
        }),
      );
    } catch {
      const pixPayload = generatePixBrCode({
        pixKey: cfg.pixKey,
        pixKeyType: cfg.pixKeyType,
        merchantName: cfg.creatorName || 'CRIADOR ENXOVAL',
        merchantCity: cfg.creatorCity || 'SAO PAULO',
        amountBrl: totalAmountBrl,
        txid,
        description: item.name,
      });
      const qrDataUrl = await QRCode.toDataURL(pixPayload, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 280,
        color: {dark: '#421728', light: '#FFFFFF'},
      });
      return {
        pixPayload,
        pixTxid: txid,
        totalAmountBrl,
        qrDataUrl,
        creatorName: cfg.creatorName || 'CRIADOR ENXOVAL',
        pixKey: cfg.pixKey,
      };
    }
  }

  async confirmPurchase(input: PurchaseInput): Promise<{item: EnxovalItem; purchase: PurchaseRecord}> {
    const slug = this.activeListSlug();
    if (this.supabaseClient && this.supabaseConnected()) {
      try {
        const {data, error} = await this.supabaseClient.functions.invoke('purchase-item', {
          body: {...input, listSlug: slug},
        });
        if (!error && data?.item && data?.purchase) {
          const item = data.item as EnxovalItem;
          const purchase = data.purchase as PurchaseRecord;
          this.items.update((list) => list.map((i) => (i.id === item.id ? item : i)));
          this.purchases.update((prev) =>
            prev.some((p) => p.id === purchase.id) ? prev : [purchase, ...prev].slice(0, 30),
          );
          if (data.summary) {
            this.upsertListSummary(data.summary as PublicEnxovalSummary);
          }
          const rem = Math.max(0, item.requiredQty - item.purchasedQty);
          this.showToast(
            rem === 0
              ? `"${item.name}" completado com sucesso!`
              : `Compra registrada! Restam ${rem} unidade(s).`,
          );
          return {item, purchase};
        }
      } catch {
        // Fallback to Express Edge Function mirror
      }
    }

    const res = await firstValueFrom(
      this.http.post<{
        ok: boolean;
        item: EnxovalItem;
        purchase: PurchaseRecord;
        summary?: PublicEnxovalSummary;
      }>(
        `/api/functions/purchase-item?list=${encodeURIComponent(slug)}`,
        {...input, listSlug: slug},
        {headers: this.authHeaders()},
      ),
    );

    this.items.update((list) => list.map((i) => (i.id === res.item.id ? res.item : i)));
    this.purchases.update((prev) =>
      prev.some((p) => p.id === res.purchase.id) ? prev : [res.purchase, ...prev].slice(0, 30),
    );
    if (res.summary) {
      this.upsertListSummary(res.summary);
    }
    const remaining = Math.max(0, res.item.requiredQty - res.item.purchasedQty);
    this.showToast(
      remaining === 0
        ? `"${res.item.name}" completado com sucesso!`
        : `Compra confirmada! Restam ${remaining} unidade(s).`,
    );
    return {item: res.item, purchase: res.purchase};
  }

  async syncSsgIndex(): Promise<void> {
    const slug = this.activeListSlug();
    const res = await firstValueFrom(
      this.http.post<{ok: boolean; ssgMeta: SsgIndexMetadata}>('/api/functions/sync-ssg-index', {
        listSlug: slug,
      }),
    );
    this.ssgMeta.set(res.ssgMeta);
    await this.loadListBySlug(slug, false);
    this.showToast('Índice diário de lojas atualizado via pipeline SSG.');
  }

  toggleChecklistItem(id: string): void {
    this.maternityChecklist.update((list) =>
      list.map((entry) => (entry.id === id ? {...entry, packed: !entry.packed} : entry)),
    );
  }
}
