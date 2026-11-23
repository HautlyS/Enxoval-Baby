export type EnxovalStage = 'gestante' | 'bebe_rn' | 'quarto_passeio' | 'familia';

export type ItemPriority = 'Essencial' | 'Recomendado' | 'Conforto';

export type StoreSlug = 'magalu' | 'mercadolivre' | 'amazon' | 'farmacias';

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';

export interface GoogleUserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  provider: 'google';
  authSource: 'supabase-google' | 'google-oauth' | 'preview-google';
}

export interface StoreOffer {
  storeSlug: StoreSlug;
  storeName: string;
  pharmacyBrand?: string;
  offerTitle: string;
  priceBrl: number;
  url: string;
  inStock: boolean;
  deliveryEstimate: string;
  scrapedAt: string;
}

export interface EnxovalItem {
  id: string;
  stage: EnxovalStage;
  category: string;
  name: string;
  description: string;
  priority: ItemPriority;
  requiredQty: number;
  purchasedQty: number;
  unitPriceBrl: number;
  imageUrl: string;
  searchQuery: string;
  offers: StoreOffer[];
  updatedAt: string;
}

export interface EnxovalListConfig {
  id: string;
  slug: string;
  isPublic?: boolean;
  isCommunityTemplate?: boolean;
  ownerEmail?: string;
  title: string;
  babyName: string;
  dueDate: string;
  creatorName: string;
  creatorCity: string;
  pixKey: string;
  pixKeyType: PixKeyType;
  welcomeNote: string;
  updatedAt: string;
}

export interface PublicEnxovalSummary {
  id: string;
  slug: string;
  title: string;
  babyName: string;
  creatorName: string;
  creatorCity: string;
  dueDate: string;
  welcomeNote: string;
  totalItems: number;
  totalRequired: number;
  totalPurchased: number;
  remainingValueBrl: number;
  completionPct: number;
  hasPixKey: boolean;
  isCommunityTemplate?: boolean;
  updatedAt: string;
  previewImages: string[];
}

export interface CreateListWizardInput {
  title: string;
  babyName: string;
  dueDate: string;
  creatorName: string;
  creatorCity: string;
  pixKey: string;
  pixKeyType: PixKeyType;
  welcomeNote: string;
  selectedStages: EnxovalStage[];
  essentialsOnly?: boolean;
  customSlug?: string;
}

export interface PurchaseRecord {
  id: string;
  itemId: string;
  itemName: string;
  buyerName: string;
  buyerEmail?: string;
  buyerAvatarUrl?: string;
  buyerMessage: string;
  quantity: number;
  unitPriceBrl: number;
  totalAmountBrl: number;
  pixTxid: string;
  pixPayload: string;
  paymentMethod: 'pix' | 'loja_externa';
  storeName?: string;
  createdAt: string;
}

export interface SsgIndexMetadata {
  generatedAt: string;
  workflowName: string;
  scheduleCron: string;
  totalItemsIndexed: number;
  totalOffersIndexed: number;
  storesCovered: string[];
  sourceMode: 'github-ssg-static' | 'supabase-edge-sync' | 'live-server';
}

export interface EnxovalStateSnapshot {
  listConfig: EnxovalListConfig;
  items: EnxovalItem[];
  purchases: PurchaseRecord[];
  ssgMeta: SsgIndexMetadata;
  realtimeMode: 'supabase' | 'sse-local';
  googleOAuthConfigured: boolean;
  availableLists?: PublicEnxovalSummary[];
}

export interface MaternityBagChecklistItem {
  id: string;
  group: 'Mamãe' | 'Bebê' | 'Documentos & Acompanhante';
  label: string;
  qtyLabel: string;
  packed: boolean;
}
