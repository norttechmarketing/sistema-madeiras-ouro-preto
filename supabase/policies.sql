
-- 1. Tabela de Perfis (Vincula com auth.users)
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  name text,
  email text,
  role text default 'sales' -- 'admin' ou 'sales'
);

-- 2. Clientes
create table clients (
  id text primary key, -- Mantendo text pois o front gera ID com Date.now(). Ideal seria UUID v4.
  name text not null,
  document text,
  phone text,
  email text,
  address text,
  type text,
  "internalNotes" text,
  created_at timestamptz default now(),
  user_id uuid references auth.users(id) -- Opcional: se quiser que cliente seja privado do vendedor
);

-- 3. Produtos
create table products (
  id text primary key,
  code text,
  name text,
  category text,
  price numeric,
  cost numeric,
  unit text,
  created_at timestamptz default now()
);

-- 4. Pedidos
create table orders (
  id text primary key,
  "clientId" text references clients(id),
  "clientName" text,
  "sellerId" uuid references auth.users(id), -- Importante para RLS
  "sellerName" text,
  date timestamptz,
  status text,
  type text,
  subtotal numeric,
  "totalDiscount" numeric,
  total numeric,
  "internalNotes" text,
  "customerNotes" text,
  "createdAt" bigint
);

-- 5. Itens do Pedido
create table order_items (
  id text primary key,
  order_id text references orders(id) on delete cascade,
  "productId" text references products(id),
  description text,
  quantity numeric,
  "unitPrice" numeric,
  unit text,
  "discountType" text,
  "discountValue" numeric,
  total numeric
);

-- ATIVANDO RLS (Row Level Security)
alter table profiles enable row level security;
alter table clients enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

-- POLICIES (Políticas de Segurança)

-- Profiles: Leitura pública (para exibir nome do vendedor), Edição apenas do dono
create policy "Public profiles are viewable by everyone" on profiles
  for select using (true);

create policy "Users can insert their own profile" on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- Clients: Visível para todos logados (Sistema compartilhado) ou restrito
-- Assumindo sistema compartilhado entre vendedores:
create policy "Authenticated users can view clients" on clients
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert clients" on clients
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update clients" on clients
  for update using (auth.role() = 'authenticated');

-- Products: Leitura pública, Escrita restrita (ou liberada para auth)
create policy "Authenticated users can view products" on products
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert products" on products
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update products" on products
  for update using (auth.role() = 'authenticated');

-- Orders: Vendedores veem seus próprios pedidos ou Admins veem tudo
-- Exemplo simplificado: Vendedor vê tudo, mas Update só no seu.
create policy "Authenticated users can view orders" on orders
  for select using (auth.role() = 'authenticated');

create policy "Users can insert orders" on orders
  for insert with check (auth.uid() = "sellerId");

create policy "Users can update own orders" on orders
  for update using (auth.uid() = "sellerId");

create policy "Users can delete own orders" on orders
  for delete using (auth.uid() = "sellerId");

-- Order Items: Segue a permissão do Pedido Pai
-- Simplificação: Permitir auth users
create policy "Authenticated users can manage order items" on order_items
  for all using (auth.role() = 'authenticated');
