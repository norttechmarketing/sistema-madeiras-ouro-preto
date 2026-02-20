
-- Criar a tabela de vendedores se não existir
CREATE TABLE IF NOT EXISTS public.sellers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    whatsapp TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar coluna seller_id na tabela orders se não existir
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'seller_id') THEN
        ALTER TABLE public.orders ADD COLUMN seller_id UUID REFERENCES public.sellers(id);
    END IF;
END $$;

-- Habilitar RLS se necessário (padrão do projeto parece ser aberto para autenticados)
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public sellers are viewable by everyone" ON public.sellers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage sellers" ON public.sellers FOR ALL USING (auth.role() = 'authenticated');
