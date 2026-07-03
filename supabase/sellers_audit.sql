
-- 1. Tabela de Vendedores
CREATE TABLE IF NOT EXISTS sellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    action TEXT NOT NULL,
    record_id TEXT NOT NULL,
    before JSONB,
    after JSONB,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS para novas tabelas
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para Vendedores (Acesso total para autenticados)
CREATE POLICY "Authenticated users can manage sellers" ON sellers
    FOR ALL USING (auth.role() = 'authenticated');

-- Políticas para Auditoria (Leitura para autenticados, Escrita via sistema/trigger)
CREATE POLICY "Authenticated users can view audit_logs" ON audit_logs
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "System can insert audit_logs" ON audit_logs
    FOR INSERT WITH CHECK (true);

-- 3. Função de Auditoria para Triggers
CREATE OR REPLACE FUNCTION process_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_logs (table_name, action, record_id, before, after, user_id)
        VALUES (TG_TABLE_NAME, 'DELETE', OLD.id::text, to_jsonb(OLD), NULL, auth.uid());
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_logs (table_name, action, record_id, before, after, user_id)
        VALUES (TG_TABLE_NAME, 'UPDATE', NEW.id::text, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_logs (table_name, action, record_id, before, after, user_id)
        VALUES (TG_TABLE_NAME, 'INSERT', NEW.id::text, NULL, to_jsonb(NEW), auth.uid());
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Aplicar Triggers nas Tabelas
-- Clientes
DROP TRIGGER IF EXISTS audit_clients_trigger ON clients;
CREATE TRIGGER audit_clients_trigger
AFTER INSERT OR UPDATE OR DELETE ON clients
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- Produtos
DROP TRIGGER IF EXISTS audit_products_trigger ON products;
CREATE TRIGGER audit_products_trigger
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- Vendedores
DROP TRIGGER IF EXISTS audit_sellers_trigger ON sellers;
CREATE TRIGGER audit_sellers_trigger
AFTER INSERT OR UPDATE OR DELETE ON sellers
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- Pedidos (Orders)
DROP TRIGGER IF EXISTS audit_orders_trigger ON orders;
CREATE TRIGGER audit_orders_trigger
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- Itens do Pedido
DROP TRIGGER IF EXISTS audit_order_items_trigger ON order_items;
CREATE TRIGGER audit_order_items_trigger
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 5. Vincular Pedidos aos Vendedores (Adicionar coluna se não existir)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'seller_id') THEN
        ALTER TABLE orders ADD COLUMN seller_id UUID REFERENCES sellers(id);
    END IF;
END $$;
