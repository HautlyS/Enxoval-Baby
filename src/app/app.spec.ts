import {provideHttpClient} from '@angular/common/http';
import {TestBed} from '@angular/core/testing';
import {App} from './app';
import {FULL_ENXOVAL_CATALOG} from './core/catalog-seed';
import {EnxovalStore} from './core/enxoval-store';
import {
  computeCrc16CcittFalse,
  generatePixBrCode,
  sanitizePixKey,
  validatePixKey,
} from './core/pix-brcode';

describe('App & Pix BR Code', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should sanitize and validate all 5 Bacen DICT Pix key types', () => {
    expect(sanitizePixKey('(11) 99999-8888', 'telefone')).toBe('+5511999998888');
    expect(sanitizePixKey('+5511999998888', 'telefone')).toBe('+5511999998888');
    expect(validatePixKey('11999998888', 'telefone').valid).toBe(true);
    expect(validatePixKey('1234', 'telefone').valid).toBe(false);

    expect(validatePixKey('123.456.789-01', 'cpf').valid).toBe(true);
    expect(validatePixKey('11111111111', 'cpf').valid).toBe(false);

    expect(validatePixKey('12.345.678/0001-90', 'cnpj').valid).toBe(true);
    expect(validatePixKey('00000000000000', 'cnpj').valid).toBe(false);

    expect(validatePixKey('criador@enxoval.com.br', 'email').valid).toBe(true);
    expect(validatePixKey('invalido', 'email').valid).toBe(false);

    expect(validatePixKey('550e8400-e29b-41d4-a716-446655440000', 'aleatoria').valid).toBe(true);
    expect(validatePixKey('nao-e-uuid', 'aleatoria').valid).toBe(false);
  });

  it('should generate a valid EMV BR Code with CRC16-CCITT-FALSE and accent normalization', () => {
    const payload = generatePixBrCode({
      pixKey: 'criador@enxoval.com.br',
      pixKeyType: 'email',
      merchantName: 'Ana Cláudia Pereira',
      merchantCity: 'São José dos Campos',
      amountBrl: 129.9,
      txid: 'ENXTEST123',
    });
    expect(payload.startsWith('000201010211')).toBe(true);
    expect(payload).toContain('br.gov.bcb.pix');
    expect(payload).toContain('5406129.90');
    expect(payload).toContain('5919ANA CLAUDIA PEREIRA');
    expect(payload).toContain('6015SAO JOSE DOS CA');
    const bodyWithoutCrc = payload.slice(0, -4);
    const crc = payload.slice(-4);
    expect(computeCrc16CcittFalse(bodyWithoutCrc)).toBe(crc);
  });

  it('should filter by stage, category, and sort catalog items accurately in EnxovalStore', () => {
    const store = TestBed.inject(EnxovalStore);
    const total = store.items().length;
    expect(total).toBeGreaterThan(10);

    expect(FULL_ENXOVAL_CATALOG.length).toBeGreaterThanOrEqual(70);
    expect(new Set(FULL_ENXOVAL_CATALOG.map((it) => it.id)).size).toBe(FULL_ENXOVAL_CATALOG.length);
    expect(FULL_ENXOVAL_CATALOG.every((it) => it.offers.length === 4)).toBe(true);

    store.selectedStage.set('gestante');
    const gestanteItems = store.filteredItems();
    expect(gestanteItems.length).toBeGreaterThan(0);
    expect(gestanteItems.every((it) => it.stage === 'gestante')).toBe(true);

    store.selectedStage.set('all');
    const cats = store.availableCategories();
    expect(cats.length).toBeGreaterThan(3);
    store.selectedCategory.set(cats[0]);
    expect(store.filteredItems().every((it) => it.category === cats[0])).toBe(true);
    store.selectedCategory.set('all');

    store.sortOrder.set('price_asc');
    const sorted = store.filteredItems();
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].unitPriceBrl).toBeGreaterThanOrEqual(sorted[i - 1].unitPriceBrl);
    }

    store.searchQuery.set('Fralda');
    const fraldas = store.filteredItems();
    expect(fraldas.length).toBeGreaterThan(0);
    expect(
      fraldas.every((it) => `${it.name} ${it.category} ${it.description}`.toLowerCase().includes('fralda')),
    ).toBe(true);
  });
});
