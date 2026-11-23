import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import {createClient, SupabaseClient} from '@supabase/supabase-js';
import express, {NextFunction, Request, Response} from 'express';
import {createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import QRCode from 'qrcode';
import {
  buildVerifiedStoreOffers,
  COMMUNITY_LIST_SEEDS,
  INITIAL_ENXOVAL_ITEMS,
  INITIAL_LIST_CONFIG,
  STAGE_IMAGES,
} from './app/core/catalog-seed';
import {
  EnxovalItem,
  EnxovalListConfig,
  EnxovalStage,
  GoogleUserProfile,
  ItemPriority,
  PixKeyType,
  PublicEnxovalSummary,
  PurchaseRecord,
  SsgIndexMetadata,
  StoreOffer,
} from './app/core/models';
import {generatePixBrCode, validatePixKey} from './app/core/pix-brcode';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
app.use(express.json({limit: '1mb'}));

const angularApp = new AngularNodeAppEngine();

// Ephemeral cryptographically random fallback key if SESSION_SECRET is unset
const SESSION_SIGNING_SECRET = process.env['SESSION_SECRET']?.trim() || randomBytes(32).toString('hex');

function getSupabaseServerClient(): SupabaseClient | null {
  const url = process.env['SUPABASE_URL']?.trim() || '';
  const serviceRole = process.env['SUPABASE_SERVICE_ROLE_KEY']?.trim() || '';
  const anonKey = process.env['SUPABASE_ANON_KEY']?.trim() || '';
  const key = serviceRole || anonKey;
  if (!url.startsWith('https://') || !key) return null;
  return createClient(url, key, {auth: {persistSession: false}});
}

function getSupabaseAdminClient(): SupabaseClient | null {
  const url = process.env['SUPABASE_URL']?.trim() || '';
  const serviceRole = process.env['SUPABASE_SERVICE_ROLE_KEY']?.trim() || '';
  if (!url.startsWith('https://') || !serviceRole) return null;
  return createClient(url, serviceRole, {auth: {persistSession: false}});
}

const ALLOWED_STORE_HOSTS = new Set([
  'www.magazineluiza.com.br',
  'magazineluiza.com.br',
  'lista.mercadolivre.com.br',
  'produto.mercadolivre.com.br',
  'www.mercadolivre.com.br',
  'www.amazon.com.br',
  'amazon.com.br',
  'www.drogasil.com.br',
  'www.drogaraia.com.br',
  'www.paguemenos.com.br',
  'www.panvel.com',
  'www.drogariasaopaulo.com.br',
  'www.alobebe.com.br',
  'www.rihappy.com.br',
]);

function isSafeHttpsUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' && ALLOWED_STORE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function getAppBaseUrl(req: Request): string {
  const configured = process.env['APP_URL']?.trim();
  if (configured && configured.startsWith('http') && !configured.includes('MY_APP_URL')) {
    return configured.replace(/\/$/, '');
  }
  const rawProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http');
  const proto = rawProto.split(',')[0].trim() || 'http';
  const rawHost = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000');
  const host = rawHost.split(',')[0].trim() || 'localhost:3000';
  return `${proto}://${host}`;
}

interface SignedSessionPayload {
  user: GoogleUserProfile;
  exp: number;
}

function signSessionToken(user: GoogleUserProfile): string {
  const payload: SignedSessionPayload = {
    user,
    exp: Date.now() + 1000 * 60 * 60 * 12,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', SESSION_SIGNING_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token: string): GoogleUserProfile | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = createHmac('sha256', SESSION_SIGNING_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SignedSessionPayload;
    if (!decoded.exp || decoded.exp < Date.now()) return null;
    if (!decoded.user || decoded.user.provider !== 'google') return null;
    return decoded.user;
  } catch {
    return null;
  }
}

async function extractBearerUser(req: Request): Promise<GoogleUserProfile | null> {
  const auth = req.headers.authorization ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;

  const localUser = verifySessionToken(token);
  if (localUser) return localUser;

  const supa = getSupabaseServerClient();
  if (supa) {
    try {
      const {data, error} = await supa.auth.getUser(token);
      if (!error && data?.user) {
        const provider = data.user.app_metadata?.['provider'];
        if (!provider || provider === 'google') {
          return {
            id: data.user.id,
            email: data.user.email ?? '',
            name: String(data.user.user_metadata?.['full_name'] || data.user.email || 'Conta Google'),
            avatarUrl: String(data.user.user_metadata?.['avatar_url'] ?? ''),
            provider: 'google',
            authSource: 'supabase-google',
          };
        }
      }
    } catch {
      // Invalid Supabase JWT
    }
  }
  return null;
}

interface AuthedRequest extends Request {
  googleUser?: GoogleUserProfile;
}

async function requireGoogleAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const user = await extractBearerUser(req);
  if (!user) {
    res.status(401).json({error: 'Entre com sua conta Google para gerenciar o enxoval.'});
    return;
  }
  req.googleUser = user;
  next();
}

// Track temporary OAuth CSRF state tokens (10-minute TTL)
const oauthStates = new Map<string, number>();

interface SsgIndexFile {
  meta?: SsgIndexMetadata;
  entries?: {
    itemId: string;
    searchQuery: string;
    imageUrl?: string | null;
    bestPriceBrl: number;
    offers: StoreOffer[];
  }[];
}

interface ServerEnxovalList {
  config: EnxovalListConfig;
  items: EnxovalItem[];
  purchases: PurchaseRecord[];
  isCommunityTemplate: boolean;
}

const DEFAULT_LIST_SLUG = INITIAL_LIST_CONFIG.slug;

let catalogTemplateItems: EnxovalItem[] = INITIAL_ENXOVAL_ITEMS.map((item) => ({
  ...item,
  offers: [...item.offers],
}));

let ssgMeta: SsgIndexMetadata = {
  generatedAt: '2026-11-22T06:00:00.000Z',
  workflowName: 'daily-scrape-ssg-index',
  scheduleCron: '0 6 * * *',
  totalItemsIndexed: catalogTemplateItems.length,
  totalOffersIndexed: catalogTemplateItems.length * 4,
  storesCovered: ['Magazine Luiza', 'Mercado Livre', 'Amazon Brasil', 'Farmácias em Geral'],
  sourceMode: 'live-server',
};

const listsRegistry = new Map<string, ServerEnxovalList>();

function cloneCatalogItems(stages?: EnxovalStage[], essentialsOnly = false): EnxovalItem[] {
  return catalogTemplateItems
    .filter((it) => (!stages || stages.length === 0 ? true : stages.includes(it.stage)))
    .filter((it) => (essentialsOnly ? it.priority === 'Essencial' : true))
    .map((it) => ({
      ...it,
      purchasedQty: 0,
      offers: it.offers.map((o) => ({...o})),
    }));
}

function initListsRegistry(): void {
  listsRegistry.clear();
  listsRegistry.set(DEFAULT_LIST_SLUG, {
    config: {...INITIAL_LIST_CONFIG},
    items: cloneCatalogItems(),
    purchases: [],
    isCommunityTemplate: false,
  });

  for (const seed of COMMUNITY_LIST_SEEDS) {
    listsRegistry.set(seed.config.slug, {
      config: {...seed.config, isCommunityTemplate: true},
      items: cloneCatalogItems(seed.stages),
      purchases: [],
      isCommunityTemplate: true,
    });
  }
}

function loadStaticSsgIndex(): void {
  const candidates = [
    resolve(process.cwd(), 'public/data/indexed-stores.json'),
    join(browserDistFolder, 'data/indexed-stores.json'),
  ];
  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    try {
      const raw = readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as SsgIndexFile;
      if (parsed.meta) {
        ssgMeta = {
          ...parsed.meta,
          sourceMode: 'github-ssg-static',
        };
      }
      if (Array.isArray(parsed.entries)) {
        const entryMap = new Map(parsed.entries.map((e) => [e.itemId, e]));
        catalogTemplateItems = catalogTemplateItems.map((item) => {
          const match = entryMap.get(item.id);
          if (!match) return item;
          const offersList = Array.isArray(match.offers) ? match.offers : [];
          const safeOffers = offersList.filter((o) => isSafeHttpsUrl(o.url));
          const scrapedImg =
            typeof match.imageUrl === 'string' && match.imageUrl.startsWith('https://')
              ? match.imageUrl
              : item.imageUrl;
          return {
            ...item,
            imageUrl: scrapedImg,
            unitPriceBrl: match.bestPriceBrl > 0 ? match.bestPriceBrl : item.unitPriceBrl,
            offers: safeOffers.length > 0 ? safeOffers : item.offers,
            updatedAt: ssgMeta.generatedAt,
          };
        });

        for (const list of listsRegistry.values()) {
          list.items = list.items.map((item) => {
            const match = entryMap.get(item.id);
            if (!match) return item;
            const offersList = Array.isArray(match.offers) ? match.offers : [];
            const safeOffers = offersList.filter((o) => isSafeHttpsUrl(o.url));
            const scrapedImg =
              typeof match.imageUrl === 'string' && match.imageUrl.startsWith('https://')
                ? match.imageUrl
                : item.imageUrl;
            return {
              ...item,
              imageUrl: scrapedImg,
              unitPriceBrl: match.bestPriceBrl > 0 ? match.bestPriceBrl : item.unitPriceBrl,
              offers: safeOffers.length > 0 ? safeOffers : item.offers,
              updatedAt: ssgMeta.generatedAt,
            };
          });
        }
      }
      return;
    } catch {
      // Continue to next candidate
    }
  }
}

initListsRegistry();
loadStaticSsgIndex();

function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function getRequestedListSlug(req: Request): string {
  const q = typeof req.query['list'] === 'string' ? sanitizeSlug(req.query['list']) : '';
  const bodySlug =
    req.body && typeof req.body.listSlug === 'string' ? sanitizeSlug(req.body.listSlug) : '';
  const slug = q || bodySlug || DEFAULT_LIST_SLUG;
  return listsRegistry.has(slug) ? slug : DEFAULT_LIST_SLUG;
}

function getListRecord(slug?: string): ServerEnxovalList {
  const key = slug && listsRegistry.has(slug) ? slug : DEFAULT_LIST_SLUG;
  return listsRegistry.get(key)!;
}

function buildPublicSummary(list: ServerEnxovalList): PublicEnxovalSummary {
  let totalRequired = 0;
  let totalPurchased = 0;
  let remainingValueBrl = 0;
  for (const it of list.items) {
    totalRequired += it.requiredQty;
    const p = Math.min(it.purchasedQty, it.requiredQty);
    totalPurchased += p;
    remainingValueBrl += Math.max(0, it.requiredQty - p) * it.unitPriceBrl;
  }
  const completionPct = totalRequired > 0 ? Math.round((totalPurchased / totalRequired) * 100) : 0;
  const previewImages = list.items
    .map((it) => it.imageUrl)
    .filter((u, idx, arr) => typeof u === 'string' && u.length > 0 && arr.indexOf(u) === idx)
    .slice(0, 3);

  return {
    id: list.config.id,
    slug: list.config.slug,
    title: list.config.title,
    babyName: list.config.babyName,
    creatorName: list.config.creatorName || 'Criador (Entre com Google)',
    creatorCity: list.config.creatorCity,
    dueDate: list.config.dueDate,
    welcomeNote: list.config.welcomeNote,
    totalItems: list.items.length,
    totalRequired,
    totalPurchased,
    remainingValueBrl: Number(remainingValueBrl.toFixed(2)),
    completionPct,
    hasPixKey: Boolean(list.config.pixKey.trim()),
    isCommunityTemplate: list.isCommunityTemplate,
    updatedAt: list.config.updatedAt,
    previewImages,
  };
}

function getAvailableListSummaries(): PublicEnxovalSummary[] {
  return Array.from(listsRegistry.values())
    .map(buildPublicSummary)
    .sort((a, b) => {
      if (a.isCommunityTemplate !== b.isCommunityTemplate) {
        return a.isCommunityTemplate ? 1 : -1;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

const sseClients = new Set<Response>();

function broadcastRealtime(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

function isValidStage(val: unknown): val is EnxovalStage {
  return val === 'gestante' || val === 'bebe_rn' || val === 'quarto_passeio' || val === 'familia';
}

function isValidPriority(val: unknown): val is ItemPriority {
  return val === 'Essencial' || val === 'Recomendado' || val === 'Conforto';
}

function isValidPixKeyType(val: unknown): val is PixKeyType {
  return (
    val === 'cpf' ||
    val === 'cnpj' ||
    val === 'email' ||
    val === 'telefone' ||
    val === 'aleatoria'
  );
}

// Health & Supabase public runtime config
app.get('/api/health', (_req, res) => {
  const def = getListRecord();
  res.json({
    ok: true,
    listsCount: listsRegistry.size,
    itemsCount: def.items.length,
    purchasesCount: def.purchases.length,
  });
});

app.get('/api/config/supabase', (_req, res) => {
  const url = process.env['SUPABASE_URL']?.trim() || '';
  const anonKey = process.env['SUPABASE_ANON_KEY']?.trim() || '';
  res.json({
    configured: Boolean(url && anonKey),
    url,
    anonKey,
  });
});

// Google Sign-In Only Authentication Routes
app.get('/api/auth/session', async (req, res) => {
  const user = await extractBearerUser(req);
  res.json({
    authenticated: Boolean(user),
    user,
    googleOAuthConfigured: Boolean(
      process.env['GOOGLE_CLIENT_ID']?.trim() && process.env['GOOGLE_CLIENT_SECRET']?.trim(),
    ),
  });
});

app.get('/api/auth/google/url', (req, res) => {
  const clientId = process.env['GOOGLE_CLIENT_ID']?.trim() || '';
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET']?.trim() || '';
  if (!clientId || !clientSecret) {
    res.json({configured: false, url: null});
    return;
  }

  const now = Date.now();
  for (const [key, exp] of oauthStates.entries()) {
    if (exp < now) oauthStates.delete(key);
  }
  const state = randomBytes(16).toString('hex');
  oauthStates.set(state, now + 10 * 60 * 1000);
  const redirectUri = `${getAppBaseUrl(req)}/auth/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state,
  });

  res.json({
    configured: true,
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    redirectUri,
  });
});

// Preview Google Account sign-in when external Google OAuth client secrets are not yet configured
app.post('/api/auth/google/preview', (req, res) => {
  const body = req.body ?? {};
  const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const rawName = typeof body.name === 'string' ? body.name.trim() : '';

  if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    res.status(400).json({error: 'Informe um e-mail Google válido.'});
    return;
  }
  const cleanName = (rawName || rawEmail.split('@')[0]).slice(0, 50);

  const user: GoogleUserProfile = {
    id: `google-preview-${Buffer.from(rawEmail).toString('base64url').slice(0, 12)}`,
    email: rawEmail,
    name: cleanName,
    avatarUrl: '',
    provider: 'google',
    authSource: 'preview-google',
  };

  const defList = getListRecord();
  if (!defList.config.ownerEmail || !defList.config.creatorName) {
    defList.config = {
      ...defList.config,
      ownerEmail: defList.config.ownerEmail || user.email,
      creatorName: defList.config.creatorName || user.name.toUpperCase().slice(0, 25),
      updatedAt: new Date().toISOString(),
    };
    const summary = buildPublicSummary(defList);
    broadcastRealtime('list_config_updated', {
      listSlug: defList.config.slug,
      listConfig: defList.config,
      summary,
    });
  }

  const token = signSessionToken(user);
  res.json({user, token, listConfig: defList.config, summary: buildPublicSummary(defList)});
});

// OAuth popup callback handler (supports both Google OAuth 2.0 & Supabase PKCE code handoff)
app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  const code = typeof req.query['code'] === 'string' ? req.query['code'] : '';
  const state = typeof req.query['state'] === 'string' ? req.query['state'] : '';

  const clientId = process.env['GOOGLE_CLIENT_ID']?.trim() || '';
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET']?.trim() || '';

  // Case A: Direct Google OAuth 2.0 popup with valid state
  if (code && state && oauthStates.has(state) && clientId && clientSecret) {
    const expiry = oauthStates.get(state) ?? 0;
    oauthStates.delete(state);
    if (expiry < Date.now()) {
      res.status(400).send('<p>Sessão expirada. Feche esta janela e tente novamente.</p>');
      return;
    }

    try {
      const redirectUri = `${getAppBaseUrl(req)}/auth/callback`;
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const tokenData = (await tokenRes.json()) as {access_token?: string};
      if (!tokenData.access_token) {
        throw new Error('Google access token missing');
      }

      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {Authorization: `Bearer ${tokenData.access_token}`},
      });
      const profile = (await userRes.json()) as {
        sub?: string;
        email?: string;
        name?: string;
        picture?: string;
      };

      const user: GoogleUserProfile = {
        id: `google-${profile.sub ?? randomBytes(6).toString('hex')}`,
        email: String(profile.email ?? ''),
        name: String(profile.name ?? profile.email ?? 'Usuário Google'),
        avatarUrl: typeof profile.picture === 'string' ? profile.picture : '',
        provider: 'google',
        authSource: 'google-oauth',
      };

      const defList = getListRecord();
      if (!defList.config.ownerEmail || !defList.config.creatorName) {
        defList.config = {
          ...defList.config,
          ownerEmail: defList.config.ownerEmail || (user.email || undefined),
          creatorName: defList.config.creatorName || user.name.toUpperCase().slice(0, 25),
          updatedAt: new Date().toISOString(),
        };
        broadcastRealtime('list_config_updated', {
          listSlug: defList.config.slug,
          listConfig: defList.config,
          summary: buildPublicSummary(defList),
        });
      }

      const token = signSessionToken(user);
      const safePayload = JSON.stringify({type: 'GOOGLE_OAUTH_SUCCESS', user, token}).replace(
        /</g,
        '\\u003c',
      );
      res.send(`<!doctype html><html><body><script>
        if (window.opener) {
          window.opener.postMessage(${safePayload}, window.location.origin);
          window.close();
        }
      </script><p>Conectado com Google. Esta janela fechará automaticamente.</p></body></html>`);
      return;
    } catch {
      res.status(500).send('<p>Falha na autenticação Google. Feche esta janela e tente novamente.</p>');
      return;
    }
  }

  // Case B: Supabase Auth PKCE popup callback (pass code to opener)
  const safeCode = JSON.stringify({type: 'SUPABASE_AUTH_CALLBACK', code}).replace(/</g, '\\u003c');
  res.send(`<!doctype html><html><body><script>
    if (window.opener) {
      window.opener.postMessage(${safeCode}, window.location.origin);
      window.close();
    }
  </script><p>Autenticação concluída. Você já pode fechar esta janela.</p></body></html>`);
});

// Discover public enxoval lists (Onboarding Hub)
app.get('/api/enxoval/lists', (_req, res) => {
  res.json({lists: getAvailableListSummaries()});
});

// Protected: Create & share a brand-new Enxoval list from the Onboarding Wizard
app.post('/api/enxoval/lists', requireGoogleAuth, async (req: AuthedRequest, res) => {
  const body = req.body ?? {};
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 80) : '';
  const babyName = typeof body.babyName === 'string' ? body.babyName.trim().slice(0, 40) : '';
  const rawDueDate = typeof body.dueDate === 'string' ? body.dueDate.slice(0, 10) : '';
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDueDate) ? rawDueDate : '';
  const creatorCity =
    typeof body.creatorCity === 'string' && body.creatorCity.trim().length >= 2
      ? body.creatorCity.trim().slice(0, 30)
      : 'SAO PAULO';
  const creatorName =
    typeof body.creatorName === 'string' && body.creatorName.trim().length >= 2
      ? body.creatorName.trim().slice(0, 40)
      : (req.googleUser?.name || 'CRIADOR').toUpperCase().slice(0, 25);
  const rawPixKey = typeof body.pixKey === 'string' ? body.pixKey.trim().slice(0, 120) : '';
  const pixKeyType: PixKeyType = isValidPixKeyType(body.pixKeyType) ? body.pixKeyType : 'email';
  let pixKey = '';
  if (rawPixKey) {
    const check = validatePixKey(rawPixKey, pixKeyType);
    if (!check.valid) {
      res.status(400).json({error: check.error ?? 'Chave Pix inválida.'});
      return;
    }
    pixKey = check.normalized;
  }
  const welcomeNote =
    typeof body.welcomeNote === 'string' && body.welcomeNote.trim().length > 0
      ? body.welcomeNote.trim().slice(0, 300)
      : 'Preparamos esta lista com muito carinho. Escolha um item para presentear via Pix ou nas lojas.';
  const essentialsOnly = Boolean(body.essentialsOnly);

  if (title.length < 3) {
    res.status(400).json({error: 'Informe um título com pelo menos 3 caracteres para sua lista.'});
    return;
  }
  if (babyName.length < 1) {
    res.status(400).json({error: 'Informe o nome ou apelido do bebê.'});
    return;
  }

  const rawStages = Array.isArray(body.selectedStages) ? body.selectedStages : [];
  const selectedStages = rawStages.filter(isValidStage);
  if (selectedStages.length === 0) {
    res.status(400).json({error: 'Selecione ao menos uma etapa do enxoval.'});
    return;
  }

  const baseSlug =
    sanitizeSlug(typeof body.customSlug === 'string' && body.customSlug ? body.customSlug : title) ||
    `enxoval-${sanitizeSlug(babyName) || 'bebe'}`;
  let slug = baseSlug;
  if (listsRegistry.has(slug)) {
    slug = `${baseSlug.slice(0, 40)}-${randomBytes(2).toString('hex')}`;
  }

  const now = new Date().toISOString();
  const listConfig: EnxovalListConfig = {
    id: `lista-${Date.now().toString(36)}-${randomBytes(2).toString('hex')}`,
    slug,
    isPublic: true,
    isCommunityTemplate: false,
    ownerEmail: req.googleUser?.email,
    title,
    babyName,
    dueDate,
    creatorName,
    creatorCity,
    pixKey,
    pixKeyType,
    welcomeNote,
    updatedAt: now,
  };

  const newItems = cloneCatalogItems(selectedStages, essentialsOnly).map((it) => ({
    ...it,
    id: `${slug.slice(0, 18)}-${it.id}`,
  }));
  const record: ServerEnxovalList = {
    config: listConfig,
    items: newItems,
    purchases: [],
    isCommunityTemplate: false,
  };
  listsRegistry.set(slug, record);

  const supaAdmin = getSupabaseAdminClient();
  if (supaAdmin) {
    try {
      await supaAdmin.from('enxoval_lists').upsert({
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
      await supaAdmin.from('enxoval_items').upsert(
        newItems.map((it) => ({
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
      // Continue cleanly in memory if Postgres table isn't migrated yet
    }
  }

  const summary = buildPublicSummary(record);
  const availableLists = getAvailableListSummaries();
  broadcastRealtime('list_created', {summary, availableLists});

  res.status(201).json({
    listConfig,
    items: newItems,
    summary,
    availableLists,
    shareUrl: `${getAppBaseUrl(req)}/?list=${encodeURIComponent(slug)}`,
  });
});

// Full state snapshot for requested list (?list=<slug>)
app.get('/api/enxoval/state', (req, res) => {
  const slug = getRequestedListSlug(req);
  const list = getListRecord(slug);
  const hasSupabase = Boolean(
    process.env['SUPABASE_URL']?.trim() && process.env['SUPABASE_ANON_KEY']?.trim(),
  );
  const googleOAuthConfigured = Boolean(
    process.env['GOOGLE_CLIENT_ID']?.trim() && process.env['GOOGLE_CLIENT_SECRET']?.trim(),
  );
  res.json({
    listConfig: list.config,
    items: list.items,
    purchases: list.purchases.slice(0, 30),
    ssgMeta: {
      ...ssgMeta,
      totalItemsIndexed: list.items.length,
      totalOffersIndexed: list.items.reduce((acc, i) => acc + i.offers.length, 0),
    },
    realtimeMode: hasSupabase ? 'supabase' : 'sse-local',
    googleOAuthConfigured,
    availableLists: getAvailableListSummaries(),
  });
});

// Export layette checklist + indexed prices as CSV
app.get('/api/enxoval/export.csv', (req, res) => {
  const slug = getRequestedListSlug(req);
  const list = getListRecord(slug);
  const escapeCsv = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
  const headers = [
    'Etapa',
    'Categoria',
    'Item',
    'Prioridade',
    'Qtd Necessaria',
    'Qtd Comprada',
    'Qtd Restante',
    'Preco Unitario BRL',
    'Melhor Loja Indexada',
    'Link Seguro',
  ];
  const rows = list.items.map((item) => {
    const remaining = Math.max(0, item.requiredQty - item.purchasedQty);
    const best = item.offers[0];
    return [
      escapeCsv(item.stage),
      escapeCsv(item.category),
      escapeCsv(item.name),
      escapeCsv(item.priority),
      item.requiredQty,
      item.purchasedQty,
      remaining,
      item.unitPriceBrl.toFixed(2),
      escapeCsv(best?.storeName ?? ''),
      escapeCsv(best?.url ?? ''),
    ].join(',');
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="enxoval-${slug}.csv"`);
  res.send(`\uFEFF${headers.join(',')}\n${rows.join('\n')}`);
});

// Server-Sent Events stream for real-time updates
app.get('/api/realtime/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);
  res.write(`event: connected\ndata: ${JSON.stringify({connectedAt: new Date().toISOString()})}\n\n`);

  const keepAlive = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch {
      clearInterval(keepAlive);
      sseClients.delete(res);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

async function quickScrapeProductImage(query: string, includePharmacy: boolean): Promise<string | null> {
  const hosts = includePharmacy
    ? ['https://www.paguemenos.com.br', 'https://www.alobebe.com.br']
    : ['https://www.alobebe.com.br', 'https://www.rihappy.com.br', 'https://www.paguemenos.com.br'];
  for (const host of hosts) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const r = await fetch(
        `${host}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(query)}&_from=0&_to=0`,
        {signal: controller.signal, headers: {Accept: 'application/json'}},
      );
      clearTimeout(timer);
      if (!r.ok && r.status !== 206) continue;
      const list = (await r.json()) as {items?: {images?: {imageUrl?: string}[]}[]}[];
      const img = list?.[0]?.items?.[0]?.images?.[0]?.imageUrl;
      if (typeof img === 'string' && img.startsWith('https://')) {
        return img;
      }
    } catch {
      // Try next host
    }
  }
  return null;
}

function canUserMutateList(list: ServerEnxovalList, user?: GoogleUserProfile): boolean {
  if (!user) return false;
  if (list.isCommunityTemplate || list.config.isCommunityTemplate) return false;
  if (!list.config.ownerEmail) return true;
  return list.config.ownerEmail.toLowerCase() === user.email.toLowerCase();
}

// Protected: Add new item (requires Google Sign-In + List Ownership)
app.post('/api/enxoval/items', requireGoogleAuth, async (req: AuthedRequest, res) => {
  const slug = getRequestedListSlug(req);
  const list = getListRecord(slug);
  if (!canUserMutateList(list, req.googleUser)) {
    res.status(403).json({
      error: 'Somente o criador desta lista pode adicionar novos itens. Crie sua própria lista no assistente!',
    });
    return;
  }
  const body = req.body ?? {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const category = typeof body.category === 'string' ? body.category.trim() : 'Geral';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const stage: EnxovalStage = isValidStage(body.stage) ? body.stage : 'bebe_rn';
  const priority: ItemPriority = isValidPriority(body.priority) ? body.priority : 'Essencial';
  const requiredQty = Number(body.requiredQty);
  const unitPriceBrl = Number(body.unitPriceBrl);
  const searchQuery =
    typeof body.searchQuery === 'string' && body.searchQuery.trim().length > 2
      ? body.searchQuery.trim()
      : name;

  if (name.length < 2 || name.length > 140) {
    res.status(400).json({error: 'Informe um nome válido para o item (2 a 140 caracteres).'});
    return;
  }
  if (!Number.isInteger(requiredQty) || requiredQty < 1 || requiredQty > 200) {
    res.status(400).json({error: 'Quantidade necessária deve ser um número inteiro entre 1 e 200.'});
    return;
  }
  if (!Number.isFinite(unitPriceBrl) || unitPriceBrl < 1 || unitPriceBrl > 50000) {
    res.status(400).json({error: 'Preço unitário deve estar entre R$ 1,00 e R$ 50.000,00.'});
    return;
  }

  const now = new Date().toISOString();
  const id = `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const includePharmacy =
    category.toLowerCase().includes('farm') ||
    name.toLowerCase().includes('fralda') ||
    name.toLowerCase().includes('pomada') ||
    name.toLowerCase().includes('soro');

  const scrapedImage = await quickScrapeProductImage(searchQuery, includePharmacy);

  const newItem: EnxovalItem = {
    id,
    stage,
    category: category.slice(0, 60) || 'Enxoval',
    name,
    description: description.slice(0, 280) || 'Item adicionado ao enxoval.',
    priority,
    requiredQty,
    purchasedQty: 0,
    unitPriceBrl: Number(unitPriceBrl.toFixed(2)),
    imageUrl: scrapedImage ?? STAGE_IMAGES[stage],
    searchQuery,
    offers: buildVerifiedStoreOffers(searchQuery, unitPriceBrl, now, includePharmacy),
    updatedAt: now,
  };

  list.items = [newItem, ...list.items];

  const supaAdmin = getSupabaseAdminClient();
  if (supaAdmin) {
    try {
      await supaAdmin.from('enxoval_items').upsert({
        id: newItem.id,
        list_id: list.config.id,
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
      await supaAdmin.from('enxoval_store_offers').upsert(
        newItem.offers.map((offer) => ({
          item_id: newItem.id,
          store_slug: offer.storeSlug,
          store_name: offer.storeName,
          pharmacy_brand: offer.pharmacyBrand ?? null,
          offer_title: offer.offerTitle,
          price_brl: offer.priceBrl,
          url: offer.url,
          in_stock: offer.inStock,
          delivery_estimate: offer.deliveryEstimate,
          scraped_at: offer.scrapedAt,
        })),
      );
    } catch {
      // Ignore if Postgres schema is not provisioned yet
    }
  }

  const listMeta: SsgIndexMetadata = {
    ...ssgMeta,
    totalItemsIndexed: list.items.length,
    totalOffersIndexed: list.items.reduce((acc, i) => acc + i.offers.length, 0),
  };

  const summary = buildPublicSummary(list);
  broadcastRealtime('item_added', {listSlug: slug, item: newItem, ssgMeta: listMeta, summary});
  res.status(201).json({item: newItem, summary});
});

// Protected: Delete item (requires Google Sign-In + List Ownership)
app.delete('/api/enxoval/items/:id', requireGoogleAuth, async (req: AuthedRequest, res) => {
  const slug = getRequestedListSlug(req);
  const list = getListRecord(slug);
  if (!canUserMutateList(list, req.googleUser)) {
    res.status(403).json({
      error: 'Somente o criador desta lista pode remover itens.',
    });
    return;
  }
  const itemId = String(req.params['id'] ?? '');
  const exists = list.items.some((i) => i.id === itemId);
  if (!exists) {
    res.status(404).json({error: 'Item não encontrado.'});
    return;
  }
  list.items = list.items.filter((i) => i.id !== itemId);

  const supaAdmin = getSupabaseAdminClient();
  if (supaAdmin) {
    try {
      await supaAdmin.from('enxoval_items').delete().eq('id', itemId);
    } catch {
      // Ignore if Postgres schema is not provisioned yet
    }
  }

  const listMeta: SsgIndexMetadata = {
    ...ssgMeta,
    totalItemsIndexed: list.items.length,
    totalOffersIndexed: list.items.reduce((acc, i) => acc + i.offers.length, 0),
  };
  const summary = buildPublicSummary(list);
  broadcastRealtime('item_deleted', {listSlug: slug, itemId, ssgMeta: listMeta, summary});
  res.json({ok: true, itemId, summary});
});

// Protected: Update creator's Pix key & list configuration (requires Google Sign-In + List Ownership)
app.put('/api/enxoval/list-config', requireGoogleAuth, async (req: AuthedRequest, res) => {
  const slug = getRequestedListSlug(req);
  const list = getListRecord(slug);
  if (!canUserMutateList(list, req.googleUser)) {
    res.status(403).json({
      error: 'Somente o criador desta lista pode alterar a Chave Pix ou detalhes.',
    });
    return;
  }
  const body = req.body ?? {};
  const rawPixKey = typeof body.pixKey === 'string' ? body.pixKey.trim() : list.config.pixKey;
  const pixKeyType: PixKeyType = isValidPixKeyType(body.pixKeyType)
    ? body.pixKeyType
    : list.config.pixKeyType;

  const pixCheck = validatePixKey(rawPixKey, pixKeyType);
  if (!pixCheck.valid) {
    res.status(400).json({error: pixCheck.error ?? 'Chave Pix inválida.'});
    return;
  }

  const creatorName =
    typeof body.creatorName === 'string' && body.creatorName.trim().length >= 2
      ? body.creatorName.trim().slice(0, 40)
      : list.config.creatorName;
  const creatorCity =
    typeof body.creatorCity === 'string' && body.creatorCity.trim().length >= 2
      ? body.creatorCity.trim().slice(0, 30)
      : list.config.creatorCity;
  const title =
    typeof body.title === 'string' && body.title.trim().length >= 2
      ? body.title.trim().slice(0, 80)
      : list.config.title;
  const babyName =
    typeof body.babyName === 'string' && body.babyName.trim().length >= 1
      ? body.babyName.trim().slice(0, 40)
      : list.config.babyName;
  const rawDueDate = typeof body.dueDate === 'string' ? body.dueDate.slice(0, 10) : list.config.dueDate;
  const dueDate =
    rawDueDate === '' || /^\d{4}-\d{2}-\d{2}$/.test(rawDueDate) ? rawDueDate : list.config.dueDate;
  const welcomeNote =
    typeof body.welcomeNote === 'string'
      ? body.welcomeNote.trim().slice(0, 300)
      : list.config.welcomeNote;

  const now = new Date().toISOString();
  list.config = {
    ...list.config,
    ownerEmail: list.config.ownerEmail || req.googleUser?.email,
    title,
    babyName,
    dueDate,
    creatorName,
    creatorCity,
    pixKey: pixCheck.normalized,
    pixKeyType,
    welcomeNote,
    updatedAt: now,
  };

  const supaAdmin = getSupabaseAdminClient();
  if (supaAdmin) {
    try {
      await supaAdmin.from('enxoval_lists').upsert({
        id: list.config.id,
        slug: list.config.slug,
        is_public: true,
        is_community_template: Boolean(list.isCommunityTemplate),
        owner_email: list.config.ownerEmail ?? null,
        title: list.config.title,
        baby_name: list.config.babyName,
        due_date: list.config.dueDate || null,
        creator_name: list.config.creatorName,
        creator_city: list.config.creatorCity,
        pix_key: list.config.pixKey,
        pix_key_type: list.config.pixKeyType,
        welcome_note: list.config.welcomeNote,
        updated_at: now,
      });
    } catch {
      // Ignore if schema not applied
    }
  }

  const summary = buildPublicSummary(list);
  broadcastRealtime('list_config_updated', {listSlug: slug, listConfig: list.config, summary});
  res.json({listConfig: list.config, summary});
});

// Generate live Pix EMV BR Code + QR preview
app.post('/api/functions/pix-preview', async (req, res) => {
  try {
    const slug = getRequestedListSlug(req);
    const list = getListRecord(slug);
    const body = req.body ?? {};
    const itemId = typeof body.itemId === 'string' ? body.itemId : '';
    const quantity = Number(body.quantity ?? 1);
    const item = list.items.find((i) => i.id === itemId);

    if (!item) {
      res.status(404).json({error: 'Item não encontrado.'});
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      res.status(400).json({error: 'Quantidade inválida.'});
      return;
    }

    if (!list.config.pixKey.trim()) {
      res.status(400).json({
        error: 'Chave Pix do criador ainda não configurada. Acesse Configurar Pix para definir sua chave.',
      });
      return;
    }

    const totalAmount = Number((item.unitPriceBrl * quantity).toFixed(2));
    const txid = `ENX${Date.now().toString(36).toUpperCase()}`.slice(0, 25);
    const pixPayload = generatePixBrCode({
      pixKey: list.config.pixKey,
      pixKeyType: list.config.pixKeyType,
      merchantName: list.config.creatorName || 'CRIADOR ENXOVAL',
      merchantCity: list.config.creatorCity || 'SAO PAULO',
      amountBrl: totalAmount,
      txid,
      description: item.name,
    });

    const qrDataUrl = await QRCode.toDataURL(pixPayload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 280,
      color: {
        dark: '#421728',
        light: '#FFFFFF',
      },
    });

    res.json({
      pixPayload,
      pixTxid: txid,
      totalAmountBrl: totalAmount,
      qrDataUrl,
      creatorName: list.config.creatorName,
      pixKey: list.config.pixKey,
    });
  } catch (err) {
    res.status(400).json({error: err instanceof Error ? err.message : 'Erro ao gerar Pix.'});
  }
});

// Atomic purchase Edge Function mirror (links Google profile when signed in)
app.post('/api/functions/purchase-item', async (req, res) => {
  try {
    const slug = getRequestedListSlug(req);
    const list = getListRecord(slug);
    const googleUser = await extractBearerUser(req);
    const body = req.body ?? {};
    const itemId = typeof body.itemId === 'string' ? body.itemId : '';
    const quantity = Number(body.quantity ?? 1);

    const fallbackName = googleUser?.name || 'Convidado Carinhoso';
    const buyerName =
      typeof body.buyerName === 'string' && body.buyerName.trim().length > 0
        ? body.buyerName.trim().slice(0, 60)
        : fallbackName;
    const buyerMessage =
      typeof body.buyerMessage === 'string' ? body.buyerMessage.trim().slice(0, 200) : '';
    const paymentMethod = body.paymentMethod === 'loja_externa' ? 'loja_externa' : 'pix';
    const storeName = typeof body.storeName === 'string' ? body.storeName.trim().slice(0, 60) : undefined;

    const idx = list.items.findIndex((i) => i.id === itemId);
    if (idx === -1) {
      res.status(404).json({error: 'Item não encontrado.'});
      return;
    }

    const current = list.items[idx];
    const remaining = current.requiredQty - current.purchasedQty;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > remaining) {
      res.status(409).json({
        error:
          remaining <= 0
            ? 'Este item já foi totalmente comprado!'
            : `Quantidade indisponível. Restam apenas ${remaining} unidade(s).`,
      });
      return;
    }

    if (paymentMethod === 'pix' && !list.config.pixKey.trim()) {
      res.status(400).json({
        error: 'Chave Pix desta lista ainda não foi configurada. Escolha comprar em loja parceira ou configure a chave.',
      });
      return;
    }

    const totalAmount = Number((current.unitPriceBrl * quantity).toFixed(2));
    const rawTxid =
      typeof body.pixTxid === 'string'
        ? body.pixTxid
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]/g, '')
            .toUpperCase()
            .slice(0, 25)
        : '';
    const txid = rawTxid || `ENX${Date.now().toString(36).toUpperCase()}`.slice(0, 25);

    const pixPayload =
      paymentMethod === 'pix' && list.config.pixKey.trim()
        ? generatePixBrCode({
            pixKey: list.config.pixKey,
            pixKeyType: list.config.pixKeyType,
            merchantName: list.config.creatorName || 'CRIADOR ENXOVAL',
            merchantCity: list.config.creatorCity || 'SAO PAULO',
            amountBrl: totalAmount,
            txid,
            description: current.name,
          })
        : '';

    const now = new Date().toISOString();
    const updatedItem: EnxovalItem = {
      ...current,
      purchasedQty: current.purchasedQty + quantity,
      updatedAt: now,
    };

    list.items = list.items.map((item, i) => (i === idx ? updatedItem : item));

    const purchase: PurchaseRecord = {
      id: `pur-${Date.now().toString(36)}-${randomBytes(2).toString('hex')}`,
      itemId: updatedItem.id,
      itemName: updatedItem.name,
      buyerName,
      buyerEmail: googleUser?.email,
      buyerAvatarUrl: googleUser?.avatarUrl,
      buyerMessage,
      quantity,
      unitPriceBrl: updatedItem.unitPriceBrl,
      totalAmountBrl: totalAmount,
      pixTxid: txid,
      pixPayload,
      paymentMethod,
      storeName,
      createdAt: now,
    };

    list.purchases.unshift(purchase);

    const supaAdmin = getSupabaseAdminClient();
    if (supaAdmin) {
      try {
        await supaAdmin
          .from('enxoval_items')
          .update({purchased_qty: updatedItem.purchasedQty, updated_at: now})
          .eq('id', updatedItem.id);
        await supaAdmin.from('enxoval_purchases').insert({
          item_id: updatedItem.id,
          item_name: updatedItem.name,
          buyer_email: googleUser?.email ?? null,
          buyer_avatar_url: googleUser?.avatarUrl ?? null,
          buyer_name: buyerName,
          buyer_message: buyerMessage,
          quantity,
          unit_price_brl: updatedItem.unitPriceBrl,
          total_amount_brl: totalAmount,
          pix_txid: txid,
          pix_payload: pixPayload,
          payment_method: paymentMethod,
          store_name: storeName ?? null,
          created_at: now,
        });
      } catch {
        // Ignore if Postgres schema is not provisioned yet
      }
    }

    const summary = buildPublicSummary(list);
    broadcastRealtime('purchase_completed', {
      listSlug: slug,
      item: updatedItem,
      purchase,
      summary,
    });
    res.json({
      ok: true,
      item: updatedItem,
      purchase,
      summary,
      pixPayload,
      pixTxid: txid,
    });
  } catch (err) {
    res.status(500).json({error: err instanceof Error ? err.message : 'Erro ao processar compra.'});
  }
});

// Trigger SSG index reload
app.post('/api/functions/sync-ssg-index', (req, res) => {
  const slug = getRequestedListSlug(req);
  loadStaticSsgIndex();
  const list = getListRecord(slug);
  ssgMeta = {
    ...ssgMeta,
    generatedAt: new Date().toISOString(),
    totalItemsIndexed: list.items.length,
    totalOffersIndexed: list.items.reduce((acc, i) => acc + i.offers.length, 0),
  };
  const summary = buildPublicSummary(list);
  broadcastRealtime('ssg_synced', {listSlug: slug, ssgMeta, items: list.items, summary});
  res.json({ok: true, ssgMeta, itemsCount: list.items.length, summary});
});

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
