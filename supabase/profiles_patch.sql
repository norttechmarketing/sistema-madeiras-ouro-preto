
-- Garantir que a tabela profiles tenha as colunas necessárias para vendedores
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Ajustar permissões para permitir que admins gerenciem perfis (ou via Service Role pela API)
-- O endpoint api/admin/create-user já usa Service Role, então não precisa mudar RLS para inserção.
-- Mas para listagem no front (getSellers), a política atual de leitura já cobre:
-- "Public profiles are viewable by everyone" on profiles for select using (true);
