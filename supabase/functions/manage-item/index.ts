import {createClient} from 'npm:@supabase/supabase-js@2';

function getCorsHeaders(req: Request): Record<string, string> {
  const allowed = Deno.env.get('ALLOWED_ORIGIN')?.trim();
  const origin = req.headers.get('origin') ?? '';
  let allowOrigin = 'https://localhost:3000';
  if (allowed) {
    allowOrigin = allowed;
  } else if (origin.endsWith('.run.app') || origin.startsWith('http://localhost') || origin.startsWith('https://localhost')) {
    allowOrigin = origin;
  } else if (origin.startsWith('https://')) {
    allowOrigin = origin;
  }
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

const VALID_STAGES = new Set(['gestante', 'bebe_rn', 'quarto_passeio', 'familia']);
const VALID_PRIORITIES = new Set(['Essencial', 'Recomendado', 'Conforto']);

function isSafeHttpsUrl(val: unknown): boolean {
  if (typeof val !== 'string' || !val) return false;
  try {
    return new URL(val).protocol === 'https:';
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', {headers: corsHeaders});
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authHeader = req.headers.get('authorization') ?? '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!jwt) {
      return new Response(JSON.stringify({error: 'Login com Google obrigatório.'}), {
        status: 401,
        headers: {...corsHeaders, 'Content-Type': 'application/json'},
      });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: {headers: {Authorization: `Bearer ${jwt}`}},
    });
    const {data: userData, error: userErr} = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({error: 'Sessão Google inválida.'}), {
        status: 401,
        headers: {...corsHeaders, 'Content-Type': 'application/json'},
      });
    }

    const provider = userData.user.app_metadata?.['provider'];
    if (provider && provider !== 'google') {
      return new Response(JSON.stringify({error: 'Somente contas Google são permitidas.'}), {
        status: 403,
        headers: {...corsHeaders, 'Content-Type': 'application/json'},
      });
    }

    const body = await req.json();
    const action = body?.action;

    if (action === 'delete' && typeof body?.itemId === 'string') {
      const {error} = await supabase.from('enxoval_items').delete().eq('id', body.itemId.trim());
      if (error) {
        return new Response(JSON.stringify({error: error.message}), {
          status: 403,
          headers: {...corsHeaders, 'Content-Type': 'application/json'},
        });
      }
      return new Response(JSON.stringify({ok: true, deletedId: body.itemId.trim()}), {
        status: 200,
        headers: {...corsHeaders, 'Content-Type': 'application/json'},
      });
    }

    if (action === 'create' && body?.item) {
      const it = body.item;
      const stage = VALID_STAGES.has(it.stage) ? it.stage : 'bebe_rn';
      const priority = VALID_PRIORITIES.has(it.priority) ? it.priority : 'Essencial';
      const name = typeof it.name === 'string' ? it.name.trim().slice(0, 140) : '';
      const requiredQty = Number(it.requiredQty);
      const unitPriceBrl = Number(it.unitPriceBrl);
      if (name.length < 2 || !Number.isInteger(requiredQty) || requiredQty < 1 || requiredQty > 200) {
        return new Response(JSON.stringify({error: 'Dados do item inválidos.'}), {
          status: 400,
          headers: {...corsHeaders, 'Content-Type': 'application/json'},
        });
      }
      if (!Number.isFinite(unitPriceBrl) || unitPriceBrl < 1 || unitPriceBrl > 50000) {
        return new Response(JSON.stringify({error: 'Preço unitário inválido.'}), {
          status: 400,
          headers: {...corsHeaders, 'Content-Type': 'application/json'},
        });
      }

      const {data, error} = await supabase
        .from('enxoval_items')
        .insert({
          id: String(it.id ?? `item-${Date.now().toString(36)}`).slice(0, 80),
          list_id: String(it.listId ?? ''),
          stage,
          category: String(it.category ?? 'Enxoval').trim().slice(0, 60),
          name,
          description: String(it.description ?? '').trim().slice(0, 280),
          priority,
          required_qty: requiredQty,
          purchased_qty: 0,
          unit_price_brl: Number(unitPriceBrl.toFixed(2)),
          image_url: isSafeHttpsUrl(it.imageUrl) ? it.imageUrl : '',
          search_query: String(it.searchQuery ?? name).trim().slice(0, 100),
        })
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({error: error.message}), {
          status: 403,
          headers: {...corsHeaders, 'Content-Type': 'application/json'},
        });
      }

      return new Response(
        JSON.stringify({
          ok: true,
          item: {
            id: data.id,
            stage: data.stage,
            category: data.category,
            name: data.name,
            description: data.description,
            priority: data.priority,
            requiredQty: data.required_qty,
            purchasedQty: data.purchased_qty,
            unitPriceBrl: Number(data.unit_price_brl),
            imageUrl: data.image_url,
            searchQuery: data.search_query,
            offers: [],
            updatedAt: data.updated_at,
          },
        }),
        {
          status: 201,
          headers: {...corsHeaders, 'Content-Type': 'application/json'},
        },
      );
    }

    return new Response(JSON.stringify({error: 'Ação inválida.'}), {
      status: 400,
      headers: {...corsHeaders, 'Content-Type': 'application/json'},
    });
  } catch (err) {
    return new Response(JSON.stringify({error: err instanceof Error ? err.message : 'Erro interno.'}), {
      status: 500,
      headers: {...corsHeaders, 'Content-Type': 'application/json'},
    });
  }
});
