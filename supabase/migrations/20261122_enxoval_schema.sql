-- Enxoval Baby: Hardened PostgreSQL + Google Auth RLS + Realtime + Atomic RPC Schema
-- Run via Supabase SQL Editor or `supabase db push`

create extension if not exists "pgcrypto";

create table if not exists public.enxoval_lists (
  id text primary key,
  slug text unique not null,
  is_public boolean not null default true,
  is_community_template boolean not null default false,
  owner_id uuid references auth.users(id) on delete set null,
  owner_email text,
  title text not null,
  baby_name text not null,
  due_date date,
  creator_name text not null,
  creator_city text not null,
  pix_key text not null,
  pix_key_type text not null check (pix_key_type in ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  welcome_note text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.enxoval_items (
  id text primary key,
  list_id text not null references public.enxoval_lists(id) on delete cascade,
  stage text not null check (stage in ('gestante', 'bebe_rn', 'quarto_passeio', 'familia')),
  category text not null,
  name text not null,
  description text not null default '',
  priority text not null default 'Essencial' check (priority in ('Essencial', 'Recomendado', 'Conforto')),
  required_qty integer not null check (required_qty > 0 and required_qty <= 500),
  purchased_qty integer not null default 0 check (purchased_qty >= 0),
  unit_price_brl numeric(10, 2) not null check (unit_price_brl >= 0 and unit_price_brl <= 100000),
  image_url text not null default '',
  search_query text not null default '',
  updated_at timestamptz not null default now(),
  constraint purchased_not_exceeds_required check (purchased_qty <= required_qty)
);

create table if not exists public.enxoval_store_offers (
  id uuid primary key default gen_random_uuid(),
  item_id text not null references public.enxoval_items(id) on delete cascade,
  store_slug text not null check (store_slug in ('magalu', 'mercadolivre', 'amazon', 'farmacias')),
  store_name text not null,
  pharmacy_brand text,
  offer_title text not null,
  price_brl numeric(10, 2) not null check (price_brl >= 0),
  url text not null check (url ~ '^https://'),
  in_stock boolean not null default true,
  delivery_estimate text not null default '',
  scraped_at timestamptz not null default now(),
  unique (item_id, store_slug)
);

create table if not exists public.enxoval_purchases (
  id uuid primary key default gen_random_uuid(),
  item_id text not null references public.enxoval_items(id) on delete cascade,
  item_name text not null,
  buyer_user_id uuid references auth.users(id) on delete set null,
  buyer_email text,
  buyer_avatar_url text,
  buyer_name text not null,
  buyer_message text not null default '',
  quantity integer not null check (quantity > 0 and quantity <= 50),
  unit_price_brl numeric(10, 2) not null,
  total_amount_brl numeric(10, 2) not null,
  pix_txid text not null,
  pix_payload text not null,
  payment_method text not null default 'pix' check (payment_method in ('pix', 'loja_externa')),
  store_name text,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security on every table
alter table public.enxoval_lists enable row level security;
alter table public.enxoval_items enable row level security;
alter table public.enxoval_store_offers enable row level security;
alter table public.enxoval_purchases enable row level security;

-- Public read access for shared baby registry links
create policy "Public read lists"
  on public.enxoval_lists for select using (true);

create policy "Public read items"
  on public.enxoval_items for select using (true);

create policy "Public read offers"
  on public.enxoval_store_offers for select using (true);

create policy "Public read purchases"
  on public.enxoval_purchases for select using (true);

-- Strict Google-authenticated owner-only writes on lists & items
create policy "Owner insert list"
  on public.enxoval_lists for insert
  with check (auth.uid() is not null and auth.uid() = owner_id and is_community_template = false);

create policy "Owner update list"
  on public.enxoval_lists for update
  using (auth.uid() is not null and auth.uid() = owner_id and is_community_template = false)
  with check (auth.uid() = owner_id and is_community_template = false);

create policy "Owner insert items"
  on public.enxoval_items for insert
  with check (
    auth.uid() is not null and exists (
      select 1 from public.enxoval_lists l
      where l.id = list_id and l.owner_id = auth.uid()
    )
  );

create policy "Owner update items"
  on public.enxoval_items for update
  using (
    auth.uid() is not null and exists (
      select 1 from public.enxoval_lists l
      where l.id = list_id and l.owner_id = auth.uid()
    )
  );

create policy "Owner delete items"
  on public.enxoval_items for delete
  using (
    auth.uid() is not null and exists (
      select 1 from public.enxoval_lists l
      where l.id = list_id and l.owner_id = auth.uid()
    )
  );

-- First-run list claim RPC for Google-signed-in creator
create or replace function public.claim_enxoval_list_owner(p_list_id text)
returns public.enxoval_lists
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := coalesce(auth.jwt() ->> 'email', '');
  v_list public.enxoval_lists%rowtype;
begin
  if v_uid is null then
    raise exception 'Autenticação Google obrigatória.';
  end if;

  select * into v_list from public.enxoval_lists where id = p_list_id for update;
  if not found then
    raise exception 'Lista não encontrada.';
  end if;

  if v_list.is_community_template then
    raise exception 'Listas modelo da comunidade não podem ser reivindicadas.';
  end if;

  if v_list.owner_id is not null and v_list.owner_id <> v_uid then
    raise exception 'Esta lista já pertence a outra conta Google.';
  end if;

  update public.enxoval_lists
  set owner_id = v_uid, owner_email = v_email, updated_at = now()
  where id = p_list_id
  returning * into v_list;

  return v_list;
end;
$$;

-- Atomic purchase deduction RPC called by Supabase Edge Function `purchase-item`
create or replace function public.process_enxoval_purchase(
  p_item_id text,
  p_qty integer,
  p_buyer_user_id uuid,
  p_buyer_email text,
  p_buyer_avatar_url text,
  p_buyer_name text,
  p_buyer_message text,
  p_pix_txid text,
  p_pix_payload text,
  p_payment_method text default 'pix',
  p_store_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item public.enxoval_items%rowtype;
  v_remaining integer;
  v_total numeric(10, 2);
  v_purchase public.enxoval_purchases%rowtype;
begin
  if p_qty is null or p_qty <= 0 or p_qty > 50 then
    raise exception 'Quantidade deve estar entre 1 e 50 unidades.';
  end if;

  select * into v_item
  from public.enxoval_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item do enxoval não encontrado.';
  end if;

  v_remaining := v_item.required_qty - v_item.purchased_qty;
  if p_qty > v_remaining then
    raise exception 'Quantidade solicitada (%) excede o restante necessário (%).', p_qty, v_remaining;
  end if;

  v_total := round(v_item.unit_price_brl * p_qty, 2);

  update public.enxoval_items
  set
    purchased_qty = purchased_qty + p_qty,
    updated_at = now()
  where id = p_item_id
  returning * into v_item;

  insert into public.enxoval_purchases (
    item_id, item_name, buyer_user_id, buyer_email, buyer_avatar_url,
    buyer_name, buyer_message, quantity, unit_price_brl, total_amount_brl,
    pix_txid, pix_payload, payment_method, store_name
  ) values (
    p_item_id, v_item.name, p_buyer_user_id, p_buyer_email, p_buyer_avatar_url,
    coalesce(nullif(trim(p_buyer_name), ''), 'Convidado Google'),
    coalesce(p_buyer_message, ''), p_qty, v_item.unit_price_brl, v_total,
    p_pix_txid, p_pix_payload, p_payment_method, p_store_name
  )
  returning * into v_purchase;

  return jsonb_build_object(
    'item', to_jsonb(v_item),
    'purchase', to_jsonb(v_purchase)
  );
end;
$$;

-- Enable Supabase Realtime replication for instant updates across all visitors
alter publication supabase_realtime add table public.enxoval_items;
alter publication supabase_realtime add table public.enxoval_purchases;
alter publication supabase_realtime add table public.enxoval_lists;
