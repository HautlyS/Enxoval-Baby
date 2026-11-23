import {EnxovalItem, EnxovalListConfig, EnxovalStage, StoreOffer} from './models';

export const STAGE_IMAGES = {
  hero: '/src/assets/images/hero_enxoval_nursery_1795393198737.jpg',
  gestante: '/src/assets/images/cat_gestante_maternidade_1795393197903.jpg',
  bebe_rn: '/src/assets/images/cat_bebe_roupinhas_1795393197611.jpg',
  quarto_passeio: '/src/assets/images/cat_passeio_banho_1795393198937.jpg',
  familia: '/src/assets/images/cat_familia_casa_1795441107707.jpg',
} as const;

export const DECORATION_IMAGES = {
  blushSilkPattern: '/src/assets/images/bg_blush_silk_pattern_1795441106855.jpg',
  peonyRibbon: '/src/assets/images/decor_peony_ribbon_1795441106714.jpg',
  layetteGiftbox: '/src/assets/images/decor_layette_giftbox_1795441107136.jpg',
} as const;

export function buildVerifiedStoreOffers(
  searchQuery: string,
  basePriceBrl: number,
  scrapedAt: string,
  includePharmacyHighlight = false,
): StoreOffer[] {
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

  const offers: StoreOffer[] = [
    {
      storeSlug: 'mercadolivre',
      storeName: 'Mercado Livre',
      offerTitle: `${searchQuery} — Entrega Full`,
      priceBrl: mlPrice,
      url: `https://lista.mercadolivre.com.br/${mlSlug}`,
      inStock: true,
      deliveryEstimate: 'Chega amanhã',
      scrapedAt,
    },
    {
      storeSlug: 'amazon',
      storeName: 'Amazon Brasil',
      offerTitle: `${searchQuery} — Envio Prime`,
      priceBrl: amazonPrice,
      url: `https://www.amazon.com.br/s?k=${encoded}`,
      inStock: true,
      deliveryEstimate: '1 a 2 dias úteis',
      scrapedAt,
    },
    {
      storeSlug: 'magalu',
      storeName: 'Magazine Luiza',
      offerTitle: `${searchQuery} — Magalu Indica`,
      priceBrl: magaluPrice,
      url: `https://www.magazineluiza.com.br/busca/${encoded}/`,
      inStock: true,
      deliveryEstimate: 'Retira ou 2 dias',
      scrapedAt,
    },
    {
      storeSlug: 'farmacias',
      storeName: 'Farmácias em Geral',
      pharmacyBrand: includePharmacyHighlight ? 'Pague Menos / Drogasil' : 'Pague Menos / Drogaria SP',
      offerTitle: `${searchQuery} — Rede Farmacêutica`,
      priceBrl: pharmacyPrice,
      url: `https://www.paguemenos.com.br/${mlSlug}`,
      inStock: true,
      deliveryEstimate: 'Entrega em até 2h',
      scrapedAt,
    },
  ];

  return offers.sort((a, b) => a.priceBrl - b.priceBrl);
}

// Neutral clean defaults — Creator identity & Pix key come from logged-in Google user & settings
export const INITIAL_LIST_CONFIG: EnxovalListConfig = {
  id: 'lista-enxoval-principal',
  slug: 'meu-enxoval-principal',
  isPublic: true,
  ownerEmail: '',
  title: 'Meu Enxoval Baby',
  babyName: 'Nosso Bebê',
  dueDate: '',
  creatorName: '',
  creatorCity: 'SAO PAULO',
  pixKey: '',
  pixKeyType: 'email',
  welcomeNote:
    'Organizamos cada etapa do enxoval com carinho. Escolha um item para presentear via Pix direto ou comprar nas lojas indexadas.',
  updatedAt: new Date().toISOString(),
};

interface SeedDef {
  id: string;
  stage: EnxovalItem['stage'];
  category: string;
  name: string;
  description: string;
  priority: EnxovalItem['priority'];
  requiredQty: number;
  unitPriceBrl: number;
  searchQuery: string;
  pharmacy?: boolean;
}

// All items start with purchasedQty = 0 (real deductions only upon actual purchases)
const SEED_DEFS: SeedDef[] = [
  // STAGE 1: GESTANTE (Maternidade & Pós-Parto)
  {
    id: 'item-gestante-mala',
    stage: 'gestante',
    category: 'Mala Maternidade',
    name: 'Kit Mala e Frasqueira Maternidade Impermeável',
    description: 'Conjunto impermeável com divisórias térmicas para o hospital e primeiras consultas.',
    priority: 'Essencial',
    requiredQty: 1,
    unitPriceBrl: 349.9,
    searchQuery: 'mala maternidade',
  },
  {
    id: 'item-gestante-camisola',
    stage: 'gestante',
    category: 'Vestuário Amamentação',
    name: 'Camisola e Pijama de Amamentação Algodão Abertura Frontal',
    description: 'Tecido respirável com botões frontais práticos para o pós-parto na maternidade.',
    priority: 'Essencial',
    requiredQty: 3,
    unitPriceBrl: 129.9,
    searchQuery: 'pijama amamentacao',
  },
  {
    id: 'item-gestante-sutia',
    stage: 'gestante',
    category: 'Vestuário Amamentação',
    name: 'Sutiã de Amamentação Sem Costura Sustentação Suave',
    description: 'Alças largas e fecho click de abertura com uma mão, conforto para gestante.',
    priority: 'Essencial',
    requiredQty: 4,
    unitPriceBrl: 69.9,
    searchQuery: 'sutia amamentacao',
  },
  {
    id: 'item-gestante-almofada',
    stage: 'gestante',
    category: 'Conforto & Apoio',
    name: 'Almofada de Amamentação Ergonômica Capa Lavável',
    description: 'Apoio firme para coluna da mamãe e encaixe seguro do recém-nascido.',
    priority: 'Essencial',
    requiredQty: 1,
    unitPriceBrl: 139.0,
    searchQuery: 'almofada amamentacao',
  },
  {
    id: 'item-gestante-lanolina',
    stage: 'gestante',
    category: 'Farmácia da Mamãe',
    name: 'Pomada de Lanolina Pura Hipoalergênica 30g',
    description: 'Proteção e hidratação segura durante a amamentação, dispensando remoção antes da mamada.',
    priority: 'Essencial',
    requiredQty: 2,
    unitPriceBrl: 58.9,
    searchQuery: 'pomada lanolina',
    pharmacy: true,
  },
  {
    id: 'item-gestante-bomba',
    stage: 'gestante',
    category: 'Amamentação',
    name: 'Bomba Tira-Leite Elétrica Silenciosa Bivolt',
    description: 'Sucção bifásica suave com funil em silicone macio e armazenamento livre de BPA.',
    priority: 'Recomendado',
    requiredQty: 1,
    unitPriceBrl: 389.0,
    searchQuery: 'bomba tira leite',
    pharmacy: true,
  },
  {
    id: 'item-gestante-absorvente',
    stage: 'gestante',
    category: 'Farmácia da Mamãe',
    name: 'Absorvente Pós-Parto Noturno & Absorvente para Seios',
    description: 'Proteção pós-parto respirável e discos de algodão ultramacios.',
    priority: 'Essencial',
    requiredQty: 4,
    unitPriceBrl: 34.5,
    searchQuery: 'absorvente seios',
    pharmacy: true,
  },

  // STAGE 2: BEBÊ RECÉM-NASCIDO (Roupinhas & Higiene)
  {
    id: 'item-rn-body-ml',
    stage: 'bebe_rn',
    category: 'Vestuário RN',
    name: 'Kit Bodies Manga Longa Algodão RN',
    description: 'Gola envelope macia, botões de pressão hipoalergênicos entre as pernas.',
    priority: 'Essencial',
    requiredQty: 3,
    unitPriceBrl: 119.9,
    searchQuery: 'body bebe manga longa',
  },
  {
    id: 'item-rn-mijao',
    stage: 'bebe_rn',
    category: 'Vestuário RN',
    name: 'Kit Mijões (Culotes) com Pé Reversível Suedine',
    description: 'Cós anatômico que não aperta o coto umbilical nos primeiros dias de vida.',
    priority: 'Essencial',
    requiredQty: 3,
    unitPriceBrl: 89.9,
    searchQuery: 'mijao bebe',
  },
  {
    id: 'item-rn-macacao',
    stage: 'bebe_rn',
    category: 'Vestuário RN',
    name: 'Macacão Zíper Bidirecional Algodão Orgânico P/RN',
    description: 'Abertura prática para trocas rápidas na madrugada.',
    priority: 'Essencial',
    requiredQty: 6,
    unitPriceBrl: 94.9,
    searchQuery: 'macacao bebe',
  },
  {
    id: 'item-rn-fraldas',
    stage: 'bebe_rn',
    category: 'Troca & Farmácia',
    name: 'Pacote Fralda Recém-Nascido Corte Umbilical',
    description: 'Canais de absorção extra suaves com indicador de umidade e proteção prolongada.',
    priority: 'Essencial',
    requiredQty: 8,
    unitPriceBrl: 52.9,
    searchQuery: 'fralda pampers recem nascido',
    pharmacy: true,
  },
  {
    id: 'item-rn-lencos',
    stage: 'bebe_rn',
    category: 'Troca & Farmácia',
    name: 'Lenço Umedecido 99% Água Pura Sem Fragrância',
    description: 'Fórmula minimalista dermatologicamente testada para pele sensível do recém-nascido.',
    priority: 'Essencial',
    requiredQty: 6,
    unitPriceBrl: 64.9,
    searchQuery: 'lenco umedecido bebe',
    pharmacy: true,
  },
  {
    id: 'item-rn-pomada',
    stage: 'bebe_rn',
    category: 'Troca & Farmácia',
    name: 'Creme Preventivo de Assaduras Dexpantenol 120g',
    description: 'Barreira respirável transparente sem parabenos ou conservantes irritantes.',
    priority: 'Essencial',
    requiredQty: 4,
    unitPriceBrl: 59.9,
    searchQuery: 'bepantol baby',
    pharmacy: true,
  },
  {
    id: 'item-rn-cueiro',
    stage: 'bebe_rn',
    category: 'Enxoval Têxtil',
    name: 'Kit Cueiros Musselina Bambu & Manta Tricô',
    description: 'Mantas leves e respiráveis para efeito charutinho seguro (swaddle) e passeios.',
    priority: 'Recomendado',
    requiredQty: 2,
    unitPriceBrl: 124.0,
    searchQuery: 'cueiro manta bebe',
  },
  {
    id: 'item-rn-kit-higiene',
    stage: 'bebe_rn',
    category: 'Farmácia & Cuidados',
    name: 'Aspirador Nasal + Termômetro Digital + Tesourinha',
    description: 'Estojo completo para desobstrução nasal suave, medição sem contato e unhas.',
    priority: 'Essencial',
    requiredQty: 1,
    unitPriceBrl: 149.9,
    searchQuery: 'aspirador nasal termometro bebe',
    pharmacy: true,
  },

  // STAGE 3: QUARTO, PASSEIO & BANHO
  {
    id: 'item-qp-berco',
    stage: 'quarto_passeio',
    category: 'Quarto do Bebê',
    name: 'Berço Americano Certificado Inmetro + Colchão D18',
    description: 'Grades fixas seguras, três alturas de estrado e pintura atóxica.',
    priority: 'Essencial',
    requiredQty: 1,
    unitPriceBrl: 1189.0,
    searchQuery: 'berco americano',
  },
  {
    id: 'item-qp-carrinho',
    stage: 'quarto_passeio',
    category: 'Passeio & Segurança',
    name: 'Carrinho Travel System com Bebê Conforto',
    description: 'Fechamento compacto com uma mão, capota UV50+ e certificação lateral.',
    priority: 'Essencial',
    requiredQty: 1,
    unitPriceBrl: 1899.0,
    searchQuery: 'carrinho bebe travel system',
  },
  {
    id: 'item-qp-banheira',
    stage: 'quarto_passeio',
    category: 'Banho Relaxante',
    name: 'Banheira Ergonômica com Termômetro e Suporte',
    description: 'Redutor antiderrapante para recém-nascido, válvula de escoamento e apoio.',
    priority: 'Essencial',
    requiredQty: 1,
    unitPriceBrl: 299.9,
    searchQuery: 'banheira bebe',
  },
  {
    id: 'item-qp-toalha',
    stage: 'quarto_passeio',
    category: 'Banho Relaxante',
    name: 'Toalha Fralda com Capuz Algodão Soft',
    description: 'Dupla camada absorvente que seca sem atrito na pele delicada.',
    priority: 'Essencial',
    requiredQty: 4,
    unitPriceBrl: 69.9,
    searchQuery: 'toalha capuz bebe',
  },
  {
    id: 'item-qp-baba',
    stage: 'quarto_passeio',
    category: 'Monitoramento',
    name: 'Babá Eletrônica Full HD Visão Noturna e Sensor de Temperatura',
    description: 'Conexão criptografada, áudio bidirecional e alerta no monitor portátil.',
    priority: 'Recomendado',
    requiredQty: 1,
    unitPriceBrl: 459.0,
    searchQuery: 'baba eletronica',
  },
  {
    id: 'item-qp-trocador',
    stage: 'quarto_passeio',
    category: 'Quarto do Bebê',
    name: 'Trocador Anatômico Cômoda com Capa Impermeável',
    description: 'Bordas elevadas protetoras e capa removível fácil de higienizar.',
    priority: 'Essencial',
    requiredQty: 1,
    unitPriceBrl: 134.9,
    searchQuery: 'trocador bebe',
  },

  // STAGE 4: FAMÍLIA & REDE DE APOIO
  {
    id: 'item-fam-canguru',
    stage: 'familia',
    category: 'Ergonomia dos Pais',
    name: 'Canguru Ergonômico Posição M Multi-Posições Respirável',
    description: 'Distribui o peso entre ombros e lombar dos pais respeitando o quadril do bebê.',
    priority: 'Recomendado',
    requiredQty: 1,
    unitPriceBrl: 269.0,
    searchQuery: 'canguru bebe',
  },
  {
    id: 'item-fam-esterilizador',
    stage: 'familia',
    category: 'Praticidade em Casa',
    name: 'Esterilizador e Secador a Vapor para Mamadeiras e Chupetas',
    description: 'Elimina 99,9% das bactérias em minutos facilitando a rotina noturna da família.',
    priority: 'Conforto',
    requiredQty: 1,
    unitPriceBrl: 319.0,
    searchQuery: 'esterilizador mamadeira',
  },
  {
    id: 'item-fam-farmacia',
    stage: 'familia',
    category: 'Primeiros Socorros',
    name: 'Soro Fisiológico Monodose & Primeiros Socorros Pediátrico',
    description: 'Soro nasal estéril, algodão em quadrado, curativos suaves e seringa dosadora.',
    priority: 'Essencial',
    requiredQty: 2,
    unitPriceBrl: 39.9,
    searchQuery: 'soro fisiologico',
    pharmacy: true,
  },
  {
    id: 'item-fam-organizador',
    stage: 'familia',
    category: 'Organização Familiar',
    name: 'Kit Higiene e Organização para Cômoda do Bebê',
    description: 'Mantém fraldas, pomadas e algodão sempre à mão para toda a família.',
    priority: 'Conforto',
    requiredQty: 2,
    unitPriceBrl: 84.9,
    searchQuery: 'kit higiene bebe',
  },
];

export const INITIAL_ENXOVAL_ITEMS: EnxovalItem[] = SEED_DEFS.map((def) => {
  const scrapedAt = '2026-11-22T06:00:00.000Z';
  return {
    id: def.id,
    stage: def.stage,
    category: def.category,
    name: def.name,
    description: def.description,
    priority: def.priority,
    requiredQty: def.requiredQty,
    purchasedQty: 0,
    unitPriceBrl: def.unitPriceBrl,
    imageUrl: STAGE_IMAGES[def.stage],
    searchQuery: def.searchQuery,
    offers: buildVerifiedStoreOffers(def.searchQuery, def.unitPriceBrl, scrapedAt, def.pharmacy),
    updatedAt: scrapedAt,
  };
});

export interface CommunityListSeed {
  config: EnxovalListConfig;
  stages: EnxovalStage[];
  itemIds?: string[];
}

export const COMMUNITY_LIST_SEEDS: CommunityListSeed[] = [
  {
    config: {
      id: 'lista-sofia-sp',
      slug: 'enxoval-da-sofia',
      isPublic: true,
      isCommunityTemplate: true,
      ownerEmail: 'comunidade+sofia@enxovalbaby.app',
      title: 'Enxoval Completo da Sofia',
      babyName: 'Sofia',
      dueDate: '2027-04-12',
      creatorName: 'CAMILA MENDES',
      creatorCity: 'SAO PAULO',
      pixKey: 'enxoval.sofia.familia@exemplo.com.br',
      pixKeyType: 'email',
      welcomeNote:
        'Cada cuidado preparado para a chegada da Sofia em abril. Você pode presentear pelo Pix da lista ou escolher direto nas lojas.',
      updatedAt: '2026-11-22T06:00:00.000Z',
    },
    stages: ['gestante', 'bebe_rn', 'quarto_passeio', 'familia'],
  },
  {
    config: {
      id: 'lista-pedro-cwb',
      slug: 'chegada-do-pedro',
      isPublic: true,
      isCommunityTemplate: true,
      ownerEmail: 'comunidade+pedro@enxovalbaby.app',
      title: 'Necessidades RN do Pedro',
      babyName: 'Pedro Henrique',
      dueDate: '2027-02-20',
      creatorName: 'RAFAEL COSTA',
      creatorCity: 'CURITIBA',
      pixKey: 'pedro.enxoval@exemplo.com.br',
      pixKeyType: 'email',
      welcomeNote:
        'Focamos nos itens essenciais de maternidade, fraldas recém-nascido e farmácia para os primeiros 90 dias em Curitiba.',
      updatedAt: '2026-11-22T06:00:00.000Z',
    },
    stages: ['gestante', 'bebe_rn'],
  },
  {
    config: {
      id: 'lista-helena-bh',
      slug: 'quarto-e-passeio-helena',
      isPublic: true,
      isCommunityTemplate: true,
      ownerEmail: 'comunidade+helena@enxovalbaby.app',
      title: 'Quarto e Passeio da Helena',
      babyName: 'Helena',
      dueDate: '2027-05-08',
      creatorName: 'FERNANDA ALMEIDA',
      creatorCity: 'BELO HORIZONTE',
      pixKey: 'helena.maternidade@exemplo.com.br',
      pixKeyType: 'email',
      welcomeNote:
        'Lista compartilhada com avós e padrinhos para berço, carrinho, banheira e organização da família.',
      updatedAt: '2026-11-22T06:00:00.000Z',
    },
    stages: ['quarto_passeio', 'familia'],
  },
];
