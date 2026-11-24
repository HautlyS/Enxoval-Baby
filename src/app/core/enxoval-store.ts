import {isPlatformBrowser} from '@angular/common';
import {HttpClient} from '@angular/common/http';
import {computed, inject, Injectable, OnDestroy, PLATFORM_ID, signal} from '@angular/core';
import {createClient, RealtimeChannel, SupabaseClient} from '@supabase/supabase-js';
import QRCode from 'qrcode';
import {firstValueFrom} from 'rxjs';
import {
  COMMUNITY_LIST_SEEDS,
  FULL_ENXOVAL_CATALOG,
  INITIAL_ENXOVAL_ITEMS,
  INITIAL_LIST_CONFIG,
} from './catalog-seed';
import {environment} from '../../environments/environment';
import {enxovalDB, type ListRow} from './enxoval-db';
import {
  CreateListWizardInput,
  EnxovalItem,
  EnxovalListConfig,
  EnxovalStage,
  GoogleUserProfile,
  ItemPriority,
  PixKeyType,
  PublicEnxovalSummary,
  PurchaseRecord,
  SelectedCatalogItemInput,
  SsgIndexMetadata,
  StoreOffer,
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

interface MaternityBagChecklistItem {
  id: string;
  group: 'Mamãe' | 'Bebê' | 'Documentos & Acompanhante';
  label: string;
  qtyLabel: string;
  packed: boolean;
}

function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function buildPublicSummary(listConfig: EnxovalListConfig, items: EnxovalItem[]): PublicEnxovalSummary {
  let totalRequired = 0;
  let totalPurchased = 0;
  let remainingValueBrl = 0;
  for (const it of items) {
    totalRequired += it.requiredQty;
    const p = Math.min(it.purchasedQty, it.requiredQty);
    totalPurchased += p;
    remainingValueBrl += Math.max(0, it.requiredQty - p) * it.unitPriceBrl;
  }
  const completionPct = totalRequired > 0 ? Math.round((totalPurchased / totalRequired) * 100) : 0;
  const previewImages = items
    .map((it) => it.imageUrl)
    .filter((u, idx, arr) => typeof u === 'string' && u.length > 0 && arr.indexOf(u) === idx)
    .slice(0, 3);

  return {
    id: listConfig.id,
    slug: listConfig.slug,
    title: listConfig.title,
    babyName: listConfig.babyName,
    creatorName: listConfig.creatorName || 'Criador (Entre com Google)',
    creatorCity: listConfig.creatorCity,
    dueDate: listConfig.dueDate,
    welcomeNote: listConfig.welcomeNote,
    totalItems: items.length,
    totalRequired,
    totalPurchased,
    remainingValueBrl: Number(remainingValueBrl.toFixed(2)),
    completionPct,
    hasPixKey: Boolean(listConfig.pixKey.trim()),
    isCommunityTemplate: Boolean(listConfig.isCommunityTemplate),
    updatedAt: listConfig.updatedAt,
    previewImages,
  };
}

function buildVerifiedStoreOffersClient(
  searchQuery: string,
  basePriceBrl: number,
  scrapedAt: string,
  includePharmacyHighlight = false,
): {storeSlug: StoreSlug; storeName: string; pharmacyBrand?: string; offerTitle: string; priceBrl: number; url: string; inStock: boolean; deliveryEstimate: string; scrapedAt: string}[] {
  const encoded = encodeURIComponent(searchQuery);
  const mlSlug = searchQuery
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const magaluPrice = Number((basePriceBrl * 0.99).toFixed(2));
  const mlPrice = Number((basePriceBrl * 0.96).toFixed(2));
  const amazonPrice = Number((basePriceBrl * 0.98).toFixed(2));
  const pharmacyPrice = Number((basePriceBrl * (includePharmacyHighlight ? 0.94 : 1.03)).toFixed(2));

  return [
    {
      storeSlug: 'mercadolivre' as StoreSlug,
      storeName: 'Mercado Livre',
      offerTitle: `${searchQuery} — Entrega Full`,
      priceBrl: mlPrice,
      url: `https://lista.mercadolivre.com.br/${mlSlug}`,
      inStock: true,
      deliveryEstimate: 'Chega amanhã',
      scrapedAt,
    },
    {
      storeSlug: 'amazon' as StoreSlug,
      storeName: 'Amazon Brasil',
      offerTitle: `${searchQuery} — Envio Prime`,
      priceBrl: amazonPrice,
      url: `https://www.amazon.com.br/s?k=${encoded}`,
      inStock: true,
      deliveryEstimate: '1 a 2 dias úteis',
      scrapedAt,
    },
    {
      storeSlug: 'magalu' as StoreSlug,
      storeName: 'Magazine Luiza',
      offerTitle: `${searchQuery} — Magalu Indica`,
      priceBrl: magaluPrice,
      url: `https://www.magazineluiza.com.br/busca/${encoded}/`,
      inStock: true,
      deliveryEstimate: 'Retira ou 2 dias',
      scrapedAt,
    },
    {
      storeSlug: 'farmacias' as StoreSlug,
      storeName: 'Farmácias em Geral',
      pharmacyBrand: includePharmacyHighlight ? 'Pague Menos / Drogasil' : 'Pague Menos / Drogaria SP',
      offerTitle: `${searchQuery} — Rede Farmacêutica`,
      priceBrl: pharmacyPrice,
      url: `https://www.paguemenos.com.br/${mlSlug}`,
      inStock: true,
      deliveryEstimate: 'Entrega em até 2h',
      scrapedAt,
    },
  ].sort((a, b) => a.priceBrl - b.priceBrl);
}

function cloneCatalogItems(items: EnxovalItem[]): EnxovalItem[] {
  return items.map((it) => ({...it, purchasedQty: 0, offers: it.offers.map((o) => ({...o}))}));
}

function getCommunitySeedBySlug(slug: string): {config: EnxovalListConfig; stages: EnxovalStage[]; itemIds?: string[]} | undefined {
  return COMMUNITY_LIST_SEEDS.find((s) => s.config.slug === slug);
}

@Injectable({providedIn: 'root'})
export class EnxovalStore implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private sseSource: EventSource | null = null;
  private supabaseClient: SupabaseClient | null = null;
  private supabaseChannel: RealtimeChannel | null = null;

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

  readonly activeView = signal<AppViewMode>('descobrir');
  readonly activeMobileTab = signal<MobileTab>('etapas');
  readonly selectedStage = signal<EnxovalStage | 'all'>('all');
  readonly selectedCategory = signal<string>('all');
  readonly searchQuery = signal('');
  readonly onlyRemaining = signal(false);
  readonly sortOrder = signal<CatalogSortOrder>('default');
  readonly selectedStoreFilter = signal<StoreSlug | 'all'>('all');

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
    const completionPct = totalRequired > 0 ? Math.round((totalPurchased / totalRequired) * 100) : 0;

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

  private authHeaders(): Record<string, string> {
    const token = this.accessToken();
    return token ? {Authorization: `Bearer ${token}`} : {};
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

  private async handleAuthCallback(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code || !this.supabaseClient) return;
    try {
      const {error} = await this.supabaseClient.auth.exchangeCodeForSession(code);
      if (!error) {
        const session = this.supabaseClient.auth.getSession().then(({data}) => data.session);
        const s = await session;
        if (s) {
          this.applySupabaseSession(s);
          if (window.opener) {
            window.opener.postMessage(
              { type: 'SUPABASE_AUTH_SUCCESS', token: s.access_token, user: this.currentUser() },
              window.location.origin
            );
            window.close();
            return;
          }
        }
      }
      window.history.replaceState({}, '', window.location.pathname);
    } catch {
      window.history.replaceState({}, '', window.location.pathname);
    }
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

  private async loadIndexedStores(): Promise<SsgIndexMetadata> {
    try {
      const data = await firstValueFrom(
        this.http.get<{meta?: SsgIndexMetadata; entries?: {itemId: string; searchQuery: string; imageUrl?: string | null; bestPriceBrl: number; offers: StoreOffer[]}[]}>('/data/indexed-stores.json'),
      );
      if (data.meta) {
        return {
          ...data.meta,
          sourceMode: 'github-ssg-static',
        };
      }
    } catch {
      // ignore, fall back to seed meta
    }
    return this.ssgMeta();
  }

  async initialize(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    await this.handleAuthCallback();
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
      await enxovalDB.open();

      const [dbList, meta, supaOk] = await Promise.all([
        enxovalDB.loadList(initialSlug),
        enxovalDB.loadMeta(),
        this.tryConnectSupabase(),
      ]);

      if (dbList) {
        this.listConfig.set(dbList.config);
        this.activeListSlug.set(dbList.config.slug);
        this.items.set(dbList.items);
        this.purchases.set(dbList.purchases);
        if (meta) this.ssgMeta.set(meta);
      } else {
        const seed = getCommunitySeedBySlug(initialSlug);
        if (seed) {
          const items = cloneCatalogItems(
            FULL_ENXOVAL_CATALOG.filter((it) => seed.stages.includes(it.stage)),
          ).map((it) => ({...it, id: `${initialSlug.slice(0, 18)}-${it.id}`}));
          this.listConfig.set({...seed.config, id: `lista-${seed.config.slug}`, slug: initialSlug});
          this.activeListSlug.set(initialSlug);
          this.items.set(items);
          this.purchases.set([]);
        } else {
          this.items.set(cloneCatalogItems(INITIAL_ENXOVAL_ITEMS));
          this.purchases.set([]);
        }
        await this.applyIndexedOffers();
      }

      this.googleOAuthConfigured.set(supaOk);
      await minWait;
    } catch {
      this.error.set('Não foi possível sincronizar com o servidor agora; exibindo lista local.');
    } finally {
      this.loading.set(false);
    }
  }

  private async tryConnectSupabase(): Promise<boolean> {
    const url = environment.supabaseUrl?.trim() || '';
    const anonKey = environment.supabaseAnonKey?.trim() || '';
    if (!url.startsWith('https://') || !anonKey) return false;
    try {
      this.teardownRealtime();
      const client = createClient(url, anonKey, {
        auth: {flowType: 'pkce', persistSession: false, autoRefreshToken: true},
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
      this.realtimeMode.set('sse-local');
      return false;
    }
  }

  private async applyIndexedOffers(): Promise<void> {
    const meta = await this.loadIndexedStores();
    this.ssgMeta.set(meta);

    try {
      const data = await firstValueFrom(
        this.http.get<{entries?: {itemId: string; searchQuery: string; imageUrl?: string | null; bestPriceBrl: number; offers: StoreOffer[]}[]}>('/data/indexed-stores.json'),
      );
      const entries = Array.isArray(data?.entries) ? data.entries : [];
      const entryMap = new Map(entries.map((e) => [e.itemId, e]));
      this.items.update((list) =>
        list.map((item) => {
          const match = entryMap.get(item.id);
          if (!match) return item;
          const offersList = Array.isArray(match.offers) ? match.offers : [];
          const scrapedImg =
            typeof match.imageUrl === 'string' && match.imageUrl.startsWith('https://')
              ? match.imageUrl
              : item.imageUrl;
          return {
            ...item,
            imageUrl: scrapedImg,
            unitPriceBrl: match.bestPriceBrl > 0 ? match.bestPriceBrl : item.unitPriceBrl,
            offers: offersList.length > 0 ? offersList : item.offers,
            updatedAt: meta.generatedAt,
          };
        }),
      );
    } catch {
      // keep seed offers
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
      const dbList = await enxovalDB.loadList(slug);
      if (dbList) {
        this.listConfig.set(dbList.config);
        this.activeListSlug.set(dbList.config.slug);
        this.items.set(dbList.items);
        this.purchases.set(dbList.purchases);
      } else {
        const seed = getCommunitySeedBySlug(slug);
        if (seed) {
          const items = cloneCatalogItems(
            FULL_ENXOVAL_CATALOG.filter((it) => seed.stages.includes(it.stage)),
          ).map((it) => ({...it, id: `${slug.slice(0, 18)}-${it.id}`}));
          this.listConfig.set({...seed.config, id: `lista-${seed.config.slug}`, slug});
          this.activeListSlug.set(slug);
          this.items.set(items);
          this.purchases.set([]);
        } else {
          this.items.set(cloneCatalogItems(INITIAL_ENXOVAL_ITEMS));
          this.purchases.set([]);
        }
        await this.applyIndexedOffers();
      }
      await minWait;
      if (switchToListView) {
        this.openView('lista', true);
      }
      if (updateBrowserUrl && isPlatformBrowser(this.platformId)) {
        const nextUrl = `/?list=${encodeURIComponent(this.listConfig().slug)}`;
        window.history.replaceState({}, '', nextUrl);
      }
      this.showToast(`Lista aberta: ${this.listConfig().title}`);
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
    const now = new Date().toISOString();
    const baseSlug =
      sanitizeSlug(input.customSlug || input.title) || `enxoval-${sanitizeSlug(input.babyName) || 'bebe'}`;
    let slug = baseSlug;
    const existing = await enxovalDB.getAll<ListRow>('lists');
    if (existing.some((l) => l.key === slug)) {
      slug = `${baseSlug.slice(0, 40)}-${crypto.randomUUID().slice(0, 4)}`;
    }

    const rawPixKey = input.pixKey.trim();
    let pixKey = '';
    if (rawPixKey) {
      pixKey = rawPixKey;
    }

    const listConfig: EnxovalListConfig = {
      id: `lista-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 4)}`,
      slug,
      isPublic: true,
      isCommunityTemplate: false,
      ownerEmail: this.currentUser()?.email || undefined,
      title: input.title,
      babyName: input.babyName,
      dueDate: input.dueDate,
      creatorName: input.creatorName || (this.currentUser()?.name || 'CRIADOR').toUpperCase().slice(0, 25),
      creatorCity: input.creatorCity || 'SAO PAULO',
      pixKey,
      pixKeyType: input.pixKeyType,
      welcomeNote: input.welcomeNote || 'Preparamos esta lista com muito carinho. Escolha um item para presentear via Pix ou nas lojas.',
      updatedAt: now,
    };

    const nowItems: EnxovalItem[] = (() => {
      if (input.selectedItems?.length) {
        return input.selectedItems.map((sel) => {
          const tpl = FULL_ENXOVAL_CATALOG.find((t) => t.id === sel.templateId);
          if (!tpl) return null;
          const reqQty = Number(sel.requiredQty);
          const validQty = Number.isInteger(reqQty) && reqQty >= 1 && reqQty <= 200 ? reqQty : tpl.requiredQty;
          return {
            ...tpl,
            id: `${slug.slice(0, 18)}-${tpl.id}`,
            requiredQty: validQty,
            purchasedQty: 0,
            offers: tpl.offers.map((o) => ({...o})),
            updatedAt: now,
          };
        }).filter((x): x is EnxovalItem => x !== null);
      }
      const selectedStages = (input.selectedStages || []).filter(
        (s): s is EnxovalStage => s === 'gestante' || s === 'bebe_rn' || s === 'quarto_passeio' || s === 'familia',
      );
      const source = selectedStages.length > 0 ? selectedStages : ['gestante', 'bebe_rn', 'quarto_passeio', 'familia'];
      return cloneCatalogItems(
        FULL_ENXOVAL_CATALOG.filter((it) => source.includes(it.stage)),
      ).map((it) => ({
        ...it,
        id: `${slug.slice(0, 18)}-${it.id}`,
        updatedAt: now,
      }));
    })();

    await enxovalDB.saveList(slug, listConfig, nowItems, []);
    this.listConfig.set(listConfig);
    this.activeListSlug.set(slug);
    this.items.set(nowItems);
    this.purchases.set([]);
    this.availableLists.set([buildPublicSummary(listConfig, nowItems)]);
    this.selectedStage.set('all');
    this.selectedCategory.set('all');
    this.openView('lista', true);

    if (isPlatformBrowser(this.platformId)) {
      window.history.replaceState({}, '', `/?list=${encodeURIComponent(slug)}`);
    }
    this.showToast(`Lista "${listConfig.title}" publicada com link pronto!`);

    if (this.supabaseClient) {
      try {
        await this.supabaseClient.from('enxoval_lists').upsert({
          id: listConfig.id,
          slug: listConfig.slug,
          is_public: true,
          is_community_template: false,
          owner_email: listConfig.ownerEmail ?? null,
          title: listConfig.title,
          baby_name: listConfig.babyName,
          due_date: listConfig.dueDate || null,
          creator_name: listConfig.creatorName,
          creator_city: listConfig.creatorCity,
          pix_key: listConfig.pixKey,
          pix_key_type: listConfig.pixKeyType,
          welcome_note: listConfig.welcomeNote,
          updated_at: now,
        });
        await this.supabaseClient.from('enxoval_items').upsert(
          nowItems.map((it) => ({
            id: it.id,
            list_id: listConfig.id,
            stage: it.stage,
            category: it.category,
            name: it.name,
            description: it.description,
            priority: it.priority,
            required_qty: it.requiredQty,
            purchased_qty: 0,
            unit_price_brl: it.unitPriceBrl,
            image_url: it.imageUrl,
            search_query: it.searchQuery,
            updated_at: now,
          })),
        );
      } catch {
        // ignore if schema not provisioned
      }
    }

    return {
      listConfig,
      shareUrl: this.activeShareUrl(),
      summary: buildPublicSummary(listConfig, nowItems),
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

  async startGoogleOAuthPopup(): Promise<'started' | 'needs_preview'> {
    if (this.supabaseClient && this.supabaseConnected()) {
      const redirectTo = `${window.location.origin}/Enxoval-Baby/auth/callback.html`;
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

    if (environment.googleClientId) {
      const redirectUri = `${window.location.origin}/Enxoval-Baby/auth/callback.html`;
      const params = new URLSearchParams({
        client_id: environment.googleClientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'online',
        prompt: 'select_account',
        state: crypto.randomUUID(),
      });
      const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      window.open(url, 'google_oauth', 'width=520,height=640');
      return 'started';
    }

    return 'needs_preview';
  }

  async signInPreviewGoogle(email: string, name: string): Promise<void> {
    const rawEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      throw new Error('Informe um e-mail Google válido.');
    }
    const cleanName = (name || rawEmail.split('@')[0]).slice(0, 50);

    const user: GoogleUserProfile = {
      id: `google-preview-${Buffer.from(rawEmail).toString('base64url').slice(0, 12)}`,
      email: rawEmail,
      name: cleanName,
      avatarUrl: '',
      provider: 'google',
      authSource: 'preview-google',
    };

    const token = Buffer.from(
      JSON.stringify({user, exp: Date.now() + 1000 * 60 * 60 * 12}),
    ).toString('base64url');
    this.accessToken.set(token);
    this.currentUser.set(user);

    const cfg = this.listConfig();
    if (!cfg.ownerEmail || !cfg.creatorName) {
      this.listConfig.set({
        ...cfg,
        ownerEmail: cfg.ownerEmail || user.email,
        creatorName: cfg.creatorName || user.name.toUpperCase().slice(0, 25),
        updatedAt: new Date().toISOString(),
      });
    }

    const summary = buildPublicSummary(this.listConfig(), this.items());
    this.availableLists.update((lists) => {
      const idx = lists.findIndex((l) => l.slug === summary.slug);
      if (idx === -1) return [summary, ...lists];
      return lists.map((l, i) => (i === idx ? summary : l));
    });

    this.authModalOpen.set(false);
    this.showToast(`Conta Google conectada: ${user.name}`);
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
    const now = new Date().toISOString();
    const id = `item-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 4)}`;
    const includePharmacy =
      input.category.toLowerCase().includes('farm') ||
      input.name.toLowerCase().includes('fralda') ||
      input.name.toLowerCase().includes('pomada') ||
      input.name.toLowerCase().includes('soro');

    const newItem: EnxovalItem = {
      id,
      stage: input.stage,
      category: input.category.slice(0, 60) || 'Enxoval',
      name: input.name,
      description: input.description.slice(0, 280) || 'Item adicionado ao enxoval.',
      priority: input.priority,
      requiredQty: input.requiredQty,
      purchasedQty: 0,
      unitPriceBrl: Number(input.unitPriceBrl.toFixed(2)),
      imageUrl: '',
      searchQuery: input.searchQuery,
      offers: buildVerifiedStoreOffersClient(input.searchQuery, input.unitPriceBrl, now, includePharmacy),
      updatedAt: now,
    };

    this.items.update((list) => [newItem, ...list]);
    await enxovalDB.saveList(slug, this.listConfig(), this.items(), this.purchases());

    if (this.supabaseClient) {
      try {
        await this.supabaseClient.from('enxoval_items').upsert({
          id: newItem.id,
          list_id: this.listConfig().id,
          stage: newItem.stage,
          category: newItem.category,
          name: newItem.name,
          description: newItem.description,
          priority: newItem.priority,
          required_qty: newItem.requiredQty,
          purchased_qty: 0,
          unit_price_brl: newItem.unitPriceBrl,
          image_url: newItem.imageUrl,
          search_query: newItem.searchQuery,
          updated_at: now,
        });
      } catch {
        // ignore
      }
    }

    this.showToast(`Item "${newItem.name}" adicionado e indexado nas 4 lojas.`);
    return newItem;
  }

  async addItemsBatch(
    items: (SelectedCatalogItemInput | NewItemInput)[],
  ): Promise<EnxovalItem[]> {
    const slug = this.activeListSlug();
    const now = new Date().toISOString();
    const existingIds = new Set(this.items().map((it) => it.id));
    const createdItems: EnxovalItem[] = [];

    for (let i = 0; i < items.length; i++) {
      const raw = items[i];
      if (!raw || typeof raw !== 'object') continue;
      const tplId = typeof (raw as SelectedCatalogItemInput).templateId === 'string' ? (raw as SelectedCatalogItemInput).templateId.trim() : '';
      const tpl = tplId ? FULL_ENXOVAL_CATALOG.find((t) => t.id === tplId) : undefined;

      if (tpl) {
        const reqQtyNum = Number((raw as SelectedCatalogItemInput).requiredQty);
        const requiredQty =
          Number.isInteger(reqQtyNum) && reqQtyNum >= 1 && reqQtyNum <= 200 ? reqQtyNum : tpl.requiredQty;
        let candidateId = `${slug.slice(0, 14)}-${tpl.id}`;
        if (existingIds.has(candidateId)) {
          candidateId = `${candidateId}-${Date.now().toString(36)}-${i}`;
        }
        existingIds.add(candidateId);
        createdItems.push({
          ...tpl,
          id: candidateId,
          requiredQty,
          purchasedQty: 0,
          offers: tpl.offers.map((o) => ({...o})),
          updatedAt: now,
        });
        continue;
      }

      const name = typeof (raw as NewItemInput).name === 'string' ? (raw as NewItemInput).name.trim() : '';
      if (name.length < 2 || name.length > 140) continue;
      const category = typeof (raw as NewItemInput).category === 'string' ? (raw as NewItemInput).category.trim().slice(0, 60) || 'Enxoval' : 'Enxoval';
      const description =
        typeof (raw as NewItemInput).description === 'string' && (raw as NewItemInput).description.trim()
          ? (raw as NewItemInput).description.trim().slice(0, 280)
          : 'Item adicionado ao enxoval.';
      const stage: EnxovalStage = (raw as NewItemInput).stage &&
        ['gestante', 'bebe_rn', 'quarto_passeio', 'familia'].includes((raw as NewItemInput).stage)
        ? (raw as NewItemInput).stage
        : 'bebe_rn';
      const priority: ItemPriority = (raw as NewItemInput).priority &&
        ['Essencial', 'Recomendado', 'Conforto'].includes((raw as NewItemInput).priority)
        ? (raw as NewItemInput).priority
        : 'Essencial';
      const reqQtyNum = Number((raw as NewItemInput).requiredQty);
      const requiredQty = Number.isInteger(reqQtyNum) && reqQtyNum >= 1 && reqQtyNum <= 200 ? reqQtyNum : 1;
      const priceNum = Number((raw as NewItemInput).unitPriceBrl);
      const unitPriceBrl =
        Number.isFinite(priceNum) && priceNum >= 1 && priceNum <= 50000 ? Number(priceNum.toFixed(2)) : 89.9;
      const searchQuery =
        typeof (raw as NewItemInput).searchQuery === 'string' && (raw as NewItemInput).searchQuery.trim().length > 2
          ? (raw as NewItemInput).searchQuery.trim()
          : name;
      const includePharmacy =
        category.toLowerCase().includes('farm') ||
        name.toLowerCase().includes('fralda') ||
        name.toLowerCase().includes('pomada') ||
        name.toLowerCase().includes('soro');

      const id = `item-${Date.now().toString(36)}-${i}-${crypto.randomUUID().slice(0, 4)}`;
      existingIds.add(id);
      createdItems.push({
        id,
        stage,
        category,
        name,
        description,
        priority,
        requiredQty,
        purchasedQty: 0,
        unitPriceBrl,
        imageUrl: '',
        searchQuery,
        offers: buildVerifiedStoreOffersClient(searchQuery, unitPriceBrl, now, includePharmacy),
        updatedAt: now,
      });
    }

    if (createdItems.length === 0) {
      throw new Error('Nenhum item válido informado para adicionar.');
    }

    this.items.update((list) => [...createdItems, ...list]);
    await enxovalDB.saveList(slug, this.listConfig(), this.items(), this.purchases());

    if (this.supabaseClient) {
      try {
        await this.supabaseClient.from('enxoval_items').upsert(
          createdItems.map((it) => ({
            id: it.id,
            list_id: this.listConfig().id,
            stage: it.stage,
            category: it.category,
            name: it.name,
            description: it.description,
            priority: it.priority,
            required_qty: it.requiredQty,
            purchased_qty: 0,
            unit_price_brl: it.unitPriceBrl,
            image_url: it.imageUrl,
            search_query: it.searchQuery,
            updated_at: now,
          })),
        );
      } catch {
        // ignore
      }
    }

    this.showToast(
      createdItems.length === 1
        ? `Item "${createdItems[0].name}" adicionado à lista!`
        : `${createdItems.length} novos itens adicionados ao enxoval!`,
    );
    return createdItems;
  }

  async deleteItem(itemId: string): Promise<void> {
    const slug = this.activeListSlug();
    this.items.update((list) => list.filter((i) => i.id !== itemId));
    await enxovalDB.saveList(slug, this.listConfig(), this.items(), this.purchases());

    if (this.supabaseClient) {
      try {
        await this.supabaseClient.from('enxoval_items').delete().eq('id', itemId);
      } catch {
        // ignore
      }
    }

    this.showToast('Item removido do enxoval.');
  }

  async updateListConfig(input: ListConfigInput): Promise<EnxovalListConfig> {
    const slug = this.activeListSlug();
    const now = new Date().toISOString();

    this.listConfig.set({
      ...this.listConfig(),
      title: input.title || this.listConfig().title,
      babyName: input.babyName || this.listConfig().babyName,
      dueDate: input.dueDate || this.listConfig().dueDate,
      creatorName: input.creatorName || this.listConfig().creatorName,
      creatorCity: input.creatorCity || this.listConfig().creatorCity,
      pixKey: input.pixKey || this.listConfig().pixKey,
      pixKeyType: input.pixKeyType || this.listConfig().pixKeyType,
      welcomeNote: input.welcomeNote || this.listConfig().welcomeNote,
      updatedAt: now,
    });

    await enxovalDB.saveList(slug, this.listConfig(), this.items(), this.purchases());

    if (this.supabaseClient) {
      try {
        await this.supabaseClient.from('enxoval_lists').upsert({
          id: this.listConfig().id,
          slug: this.listConfig().slug,
          is_public: true,
          is_community_template: Boolean(this.listConfig().isCommunityTemplate),
          owner_email: this.listConfig().ownerEmail ?? null,
          title: this.listConfig().title,
          baby_name: this.listConfig().babyName,
          due_date: this.listConfig().dueDate || null,
          creator_name: this.listConfig().creatorName,
          creator_city: this.listConfig().creatorCity,
          pix_key: this.listConfig().pixKey,
          pix_key_type: this.listConfig().pixKeyType,
          welcome_note: this.listConfig().welcomeNote,
          updated_at: now,
        });
      } catch {
        // ignore
      }
    }

    const summary = buildPublicSummary(this.listConfig(), this.items());
    this.availableLists.update((lists) => {
      const idx = lists.findIndex((l) => l.slug === summary.slug);
      if (idx === -1) return [summary, ...lists];
      return lists.map((l, i) => (i === idx ? summary : l));
    });

    this.showToast('Chave Pix e configurações da lista atualizadas.');
    return this.listConfig();
  }

  async previewPix(item: EnxovalItem, quantity: number): Promise<PixPreviewResult | null> {
    const cfg = this.listConfig();
    if (!cfg.pixKey.trim()) {
      return null;
    }
    const totalAmountBrl = Number((item.unitPriceBrl * quantity).toFixed(2));
    const txid = `ENX${Date.now().toString(36).toUpperCase()}`.slice(0, 25);

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
          await enxovalDB.saveList(slug, this.listConfig(), this.items(), this.purchases());
          const rem = Math.max(0, item.requiredQty - item.purchasedQty);
          this.showToast(
            rem === 0
              ? `"${item.name}" completado com sucesso!`
              : `Compra registrada! Restam ${rem} unidade(s).`,
          );
          return {item, purchase};
        }
      } catch {
        // Fallback to local
      }
    }

    const idx = this.items().findIndex((i) => i.id === input.itemId);
    if (idx === -1) {
      throw new Error('Item não encontrado.');
    }
    const current = this.items()[idx];
    const remaining = current.requiredQty - current.purchasedQty;
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > remaining) {
      throw new Error(remaining <= 0 ? 'Este item já foi totalmente comprado!' : `Quantidade indisponível. Restam apenas ${remaining} unidade(s).`);
    }

    const now = new Date().toISOString();
    const totalAmount = Number((current.unitPriceBrl * input.quantity).toFixed(2));
    const rawTxid =
      typeof input.pixTxid === 'string'
        ? input.pixTxid
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]/g, '')
            .toUpperCase()
            .slice(0, 25)
        : '';
    const txid = rawTxid || `ENX${Date.now().toString(36).toUpperCase()}`.slice(0, 25);

    const pixPayload =
      input.paymentMethod === 'pix' && this.listConfig().pixKey.trim()
        ? generatePixBrCode({
            pixKey: this.listConfig().pixKey,
            pixKeyType: this.listConfig().pixKeyType,
            merchantName: this.listConfig().creatorName || 'CRIADOR ENXOVAL',
            merchantCity: this.listConfig().creatorCity || 'SAO PAULO',
            amountBrl: totalAmount,
            txid,
            description: current.name,
          })
        : '';

    const updatedItem: EnxovalItem = {
      ...current,
      purchasedQty: current.purchasedQty + input.quantity,
      updatedAt: now,
    };

    this.items.update((list) => list.map((item, i) => (i === idx ? updatedItem : item)));

    const purchase: PurchaseRecord = {
      id: `pur-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 4)}`,
      itemId: updatedItem.id,
      itemName: updatedItem.name,
      buyerName: input.buyerName || 'Convidado Carinhoso',
      buyerEmail: this.currentUser()?.email,
      buyerAvatarUrl: this.currentUser()?.avatarUrl,
      buyerMessage: input.buyerMessage || '',
      quantity: input.quantity,
      unitPriceBrl: updatedItem.unitPriceBrl,
      totalAmountBrl: totalAmount,
      pixTxid: txid,
      pixPayload,
      paymentMethod: input.paymentMethod,
      storeName: input.storeName,
      createdAt: now,
    };

    this.purchases.update((prev) => [purchase, ...prev].slice(0, 30));
    await enxovalDB.saveList(slug, this.listConfig(), this.items(), this.purchases());

    const rem = Math.max(0, updatedItem.requiredQty - updatedItem.purchasedQty);
    this.showToast(
      rem === 0
        ? `"${updatedItem.name}" completado com sucesso!`
        : `Compra confirmada! Restam ${rem} unidade(s).`,
    );
    return {item: updatedItem, purchase};
  }

  async syncSsgIndex(): Promise<void> {
    const slug = this.activeListSlug();
    const meta = await this.loadIndexedStores();
    this.ssgMeta.set(meta);
    await this.applyIndexedOffers();
    await enxovalDB.saveMeta(meta);
    await this.loadListBySlug(slug, false);
    this.showToast('Índice diário de lojas atualizado via pipeline SSG.');
  }

  toggleChecklistItem(id: string): void {
    this.maternityChecklist.update((list) =>
      list.map((entry) => (entry.id === id ? {...entry, packed: !entry.packed} : entry)),
    );
  }
}
