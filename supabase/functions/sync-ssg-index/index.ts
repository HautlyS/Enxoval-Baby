import {createClient} from 'npm:@supabase/supabase-js@2';

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

function isSafeHttpsUrl(rawUrl: unknown): rawUrl is string {
  if (typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isSafeStoreUrl(rawUrl: unknown): rawUrl is string {
  if (!isSafeHttpsUrl(rawUrl)) return false;
  try {
    const parsed = new URL(rawUrl);
    return ALLOWED_STORE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function constantTimeEquals(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({error: 'Método não permitido.'}), {
      status: 405,
      headers: {'Content-Type': 'application/json'},
    });
  }

  try {
    // Automatically injected inside Supabase Edge Functions runtime (never stored in GitHub Actions)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const syncSecret = Deno.env.get('SSG_SYNC_SECRET')?.trim() ?? '';

    const providedSecret = req.headers.get('x-sync-secret')?.trim() ?? '';
    const authorizedBySecret = constantTimeEquals(providedSecret, syncSecret);

    if (!authorizedBySecret) {
      return new Response(JSON.stringify({error: 'Não autorizado para sincronização SSG.'}), {
        status: 401,
        headers: {'Content-Type': 'application/json'},
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const payload = await req.json();
    const entries = Array.isArray(payload?.entries) ? payload.entries : [];

    let updatedOffers = 0;
    let rejectedUrls = 0;

    for (const entry of entries) {
      if (typeof entry?.itemId !== 'string' || !Array.isArray(entry?.offers)) continue;

      let bestValidPrice: number | null = null;
      for (const offer of entry.offers) {
        if (!isSafeStoreUrl(offer?.url)) {
          rejectedUrls++;
          continue;
        }
        const price = Number(offer.priceBrl);
        if (!Number.isFinite(price) || price <= 0 || price > 100000) continue;

        const {error} = await supabase.from('enxoval_store_offers').upsert(
          {
            item_id: entry.itemId,
            store_slug: offer.storeSlug,
            store_name: String(offer.storeName).slice(0, 60),
            pharmacy_brand: offer.pharmacyBrand ? String(offer.pharmacyBrand).slice(0, 80) : null,
            offer_title: String(offer.offerTitle).slice(0, 140),
            price_brl: Number(price.toFixed(2)),
            url: offer.url,
            in_stock: Boolean(offer.inStock),
            delivery_estimate: String(offer.deliveryEstimate ?? '').slice(0, 60),
            scraped_at: offer.scrapedAt ?? new Date().toISOString(),
          },
          {onConflict: 'item_id,store_slug'},
        );
        if (!error) {
          updatedOffers++;
          if (bestValidPrice === null || price < bestValidPrice) {
            bestValidPrice = Number(price.toFixed(2));
          }
        }
      }

      const itemUpdate: Record<string, unknown> = {updated_at: new Date().toISOString()};
      if (bestValidPrice !== null) {
        itemUpdate['unit_price_brl'] = bestValidPrice;
      }
      if (isSafeHttpsUrl(entry.imageUrl)) {
        itemUpdate['image_url'] = entry.imageUrl;
      }

      if (Object.keys(itemUpdate).length > 1) {
        await supabase.from('enxoval_items').update(itemUpdate).eq('id', entry.itemId);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        updatedOffers,
        rejectedUrls,
        syncedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({error: err instanceof Error ? err.message : 'Erro interno.'}), {
      status: 500,
      headers: {'Content-Type': 'application/json'},
    });
  }
});
