
-- 1. Adicionar coluna para forma de pagamento se não existir
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_method') THEN
        ALTER TABLE public.orders ADD COLUMN payment_method TEXT;
    END IF;
END $$;

-- 2. Função para garantir que o vendedor exista no banco ao logar/salvar
-- Esta função pode ser chamada via RPC ou simplesmente usaremos o fluxo de UPSERT no Frontend.

-- 3. Adicionar coluna para categoria/tipo de madeira nos itens se não existirem
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'category') THEN
        ALTER TABLE public.order_items ADD COLUMN category TEXT;
    END IF;
END $$;
