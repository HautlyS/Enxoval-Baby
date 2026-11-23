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

function computeCrc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(tag: string, value: string): string {
  return `${tag}${value.length.toString().padStart(2, '0')}${value}`;
}

function cleanText(val: string, maxLen: number): string {
  return (
    val
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 .,-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase() || 'ENXOVAL'
  ).slice(0, maxLen);
}

function sanitizePixKey(rawKey: string, keyType: string): string {
  const trimmed = rawKey
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
  if (!trimmed) return '';
  if (keyType === 'cpf' || keyType === 'cnpj') return trimmed.replace(/\D/g, '');
  if (keyType === 'telefone') {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return `+${digits}`;
    if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
    return `+${digits}`;
  }
  return trimmed.toLowerCase().slice(0, 77);
}

function buildPixPayload(
  pixKey: string,
  pixKeyType: string,
  creatorName: string,
  creatorCity: string,
  amountBrl: number,
  txid: string,
): string {
  const cleanKey = sanitizePixKey(pixKey, pixKeyType);
  const tag26 = tlv('26', `${tlv('00', 'br.gov.bcb.pix')}${tlv('01', cleanKey)}`);
  const tag54 = tlv('54', amountBrl.toFixed(2));
  const tag62 = tlv('62', tlv('05', txid));
  const base =
    tlv('00', '01') +
    tlv('01', '11') +
    tag26 +
    tlv('52', '0000') +
    tlv('53', '986') +
    tag54 +
    tlv('58', 'BR') +
    tlv('59', cleanText(creatorName, 25)) +
    tlv('60', cleanText(creatorCity, 15)) +
    tag62 +
    '6304';
  return `${base}${computeCrc16(base)}`;
}

function toCamelItem(row: Record<string, unknown>) {
  return {
    id: String(row['id'] ?? ''),
    stage: String(row['stage'] ?? 'bebe_rn'),
    category: String(row['category'] ?? 'Geral'),
    name: String(row['name'] ?? ''),
    description: String(row['description'] ?? ''),
    priority: String(row['priority'] ?? 'Essencial'),
    requiredQty: Number(row['required_qty'] ?? 1),
    purchasedQty: Number(row['purchased_qty'] ?? 0),
    unitPriceBrl: Number(row['unit_price_brl'] ?? 0),
    imageUrl: String(row['image_url'] ?? ''),
    searchQuery: String(row['search_query'] ?? ''),
    offers: Array.isArray(row['offers']) ? row['offers'] : [],
    updatedAt: String(row['updated_at'] ?? new Date().toISOString()),
  };
}

function toCamelPurchase(row: Record<string, unknown>) {
  return {
    id: String(row['id'] ?? ''),
    itemId: String(row['item_id'] ?? ''),
    itemName: String(row['item_name'] ?? ''),
    buyerName: String(row['buyer_name'] ?? 'Convidado Carinhoso'),
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
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', {headers: corsHeaders});
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({error: 'Método não permitido.'}), {
      status: 405,
      headers: {...corsHeaders, 'Content-Type': 'application/json'},
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get('authorization') ?? '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    let googleUser: {
      id: string;
      email?: string;
      user_metadata?: Record<string, unknown>;
      app_metadata?: Record<string, unknown>;
    } | null = null;

    if (jwt && jwt !== anonKey) {
      const authClient = createClient(supabaseUrl, anonKey, {
        global: {headers: {Authorization: `Bearer ${jwt}`}},
      });
      const {data: userData, error: userErr} = await authClient.auth.getUser();
      if (!userErr && userData?.user) {
        const provider = userData.user.app_metadata?.['provider'];
        if (provider && provider !== 'google') {
          return new Response(JSON.stringify({error: 'Somente contas Google são permitidas.'}), {
            status: 403,
            headers: {...corsHeaders, 'Content-Type': 'application/json'},
          });
        }
        googleUser = userData.user;
      }
    }

    const body = await req.json();
    const itemId = typeof body?.itemId === 'string' ? body.itemId.trim() : '';
    const quantity = Number(body?.quantity ?? 1);
    const rawBuyerName =
      typeof body?.buyerName === 'string' && body.buyerName.trim().length > 0
        ? body.buyerName.trim()
        : String(googleUser?.user_metadata?.['full_name'] || googleUser?.email || 'Convidado Carinhoso');
    const buyerName = rawBuyerName.slice(0, 60);
    const buyerMessage =
      typeof body?.buyerMessage === 'string' ? body.buyerMessage.trim().slice(0, 200) : '';
    const paymentMethod = body?.paymentMethod === 'loja_externa' ? 'loja_externa' : 'pix';
    const storeName = typeof body?.storeName === 'string' ? body.storeName.trim().slice(0, 60) : null;

    if (!/^[a-zA-Z0-9_-]{3,80}$/.test(itemId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      return new Response(JSON.stringify({error: 'Dados de compra inválidos.'}), {
        status: 400,
        headers: {...corsHeaders, 'Content-Type': 'application/json'},
      });
    }

    const {data: item, error: itemErr} = await supabaseAdmin
      .from('enxoval_items')
      .select('*, enxoval_lists(*)')
      .eq('id', itemId)
      .single();

    if (itemErr || !item || !item.enxoval_lists) {
      return new Response(JSON.stringify({error: 'Item não encontrado.'}), {
        status: 404,
        headers: {...corsHeaders, 'Content-Type': 'application/json'},
      });
    }

    const list = item.enxoval_lists;
    if (paymentMethod === 'pix' && !list.pix_key) {
      return new Response(JSON.stringify({error: 'Chave Pix do criador não configurada.'}), {
        status: 400,
        headers: {...corsHeaders, 'Content-Type': 'application/json'},
      });
    }

    const totalAmount = Number((Number(item.unit_price_brl) * quantity).toFixed(2));
    const rawTxid = typeof body?.pixTxid === 'string' ? body.pixTxid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 25) : '';
    const txid = rawTxid || `ENX${Date.now().toString(36).toUpperCase()}`.slice(0, 25);
    const pixPayload =
      paymentMethod === 'pix' && list.pix_key
        ? buildPixPayload(
            list.pix_key,
            list.pix_key_type || 'email',
            list.creator_name || 'CRIADOR ENXOVAL',
            list.creator_city || 'SAO PAULO',
            totalAmount,
            txid,
          )
        : '';

    const {data: result, error: rpcErr} = await supabaseAdmin.rpc('process_enxoval_purchase', {
      p_item_id: itemId,
      p_qty: quantity,
      p_buyer_user_id: googleUser?.id ?? null,
      p_buyer_email: googleUser?.email ?? null,
      p_buyer_avatar_url: String(googleUser?.user_metadata?.['avatar_url'] ?? ''),
      p_buyer_name: buyerName,
      p_buyer_message: buyerMessage,
      p_pix_txid: txid,
      p_pix_payload: pixPayload,
      p_payment_method: paymentMethod,
      p_store_name: storeName,
    });

    if (rpcErr) {
      return new Response(JSON.stringify({error: rpcErr.message}), {
        status: 409,
        headers: {...corsHeaders, 'Content-Type': 'application/json'},
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        pixPayload,
        pixTxid: txid,
        item: toCamelItem(result.item as Record<string, unknown>),
        purchase: toCamelPurchase(result.purchase as Record<string, unknown>),
      }),
      {
        status: 200,
        headers: {...corsHeaders, 'Content-Type': 'application/json'},
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({error: err instanceof Error ? err.message : 'Erro interno.'}), {
      status: 500,
      headers: {...corsHeaders, 'Content-Type': 'application/json'},
    });
  }
});
