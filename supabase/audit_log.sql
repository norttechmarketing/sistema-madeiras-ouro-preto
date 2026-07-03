
-- 1. Tabela public.audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    action TEXT NOT NULL, -- INSERT | UPDATE | DELETE
    record_id TEXT, -- Pode ser UUID ou o ID gerado pelo front (Date.now())
    user_id UUID,
    user_email TEXT,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Política SELECT apenas para admins
-- Assumindo que a role está em public.profiles. Se não houver, ajustaremos.
CREATE POLICY "Admins can view audit logs" ON public.audit_log
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Não permitir INSERT/UPDATE/DELETE via API cliente (apenas via trigger / service_role)
-- Removendo políticas de escrita se existirem

-- 2. Função trigger genérica public.log_audit()
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_user_email TEXT;
BEGIN
    v_user_id := auth.uid();
    
    -- Tenta capturar email do profiles
    IF v_user_id IS NOT NULL THEN
        SELECT email INTO v_user_email FROM public.profiles WHERE id = v_user_id;
    END IF;

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_log (table_name, action, record_id, user_id, user_email, old_data, new_data)
        VALUES (TG_TABLE_NAME, 'INSERT', NEW.id::text, v_user_id, v_user_email, NULL, to_jsonb(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.audit_log (table_name, action, record_id, user_id, user_email, old_data, new_data)
        VALUES (TG_TABLE_NAME, 'UPDATE', NEW.id::text, v_user_id, v_user_email, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_log (table_name, action, record_id, user_id, user_email, old_data, new_data)
        VALUES (TG_TABLE_NAME, 'DELETE', OLD.id::text, v_user_id, v_user_email, to_jsonb(OLD), NULL);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar triggers nas tabelas
-- Clientes
DROP TRIGGER IF EXISTS trg_audit_clients ON public.clients;
CREATE TRIGGER trg_audit_clients AFTER INSERT OR UPDATE OR DELETE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- Produtos
DROP TRIGGER IF EXISTS trg_audit_products ON public.products;
CREATE TRIGGER trg_audit_products AFTER INSERT OR UPDATE OR DELETE ON public.products FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- Pedidos
DROP TRIGGER IF EXISTS trg_audit_orders ON public.orders;
CREATE TRIGGER trg_audit_orders AFTER INSERT OR UPDATE OR DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- Orçamentos ( quotes se existir, senão pular ou ajustar )
-- O projeto usa a tabela 'orders' para ambos com coluna 'type'? 
-- Verificando em policies.sql anterior: criava table 'orders' com 'type' text.
-- Se houver uma tabela 'quotes' separada, aplicar. Se for tudo em 'orders', já está coberto.
-- No storage.ts: storage.getOrders() busca de 'orders'.
-- Então vamos aplicar em 'orders'.
