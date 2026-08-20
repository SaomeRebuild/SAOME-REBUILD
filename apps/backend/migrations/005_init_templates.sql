-- Migration: 005_init_templates
-- Desc: Create templates table for card builder drafts
--
-- templates 表：所有 tenant 的卡片模板在同一張表
-- settings JSONB 欄位：儲存 Step 1~2 的所有欄位值

CREATE TABLE IF NOT EXISTS public.templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  name          TEXT NOT NULL DEFAULT '未命名卡片',
  card_type     TEXT NOT NULL CHECK (card_type IN (
    'stamp_card',
    'cashback_card',
    'reward_card',
    'membership_card',
    'discount_card',
    'coupon_card',
    'multipass',
    'gift_card'
  )),
  -- settings JSONB: 儲存所有卡片設定（Step 1~2 已實作欄位）
  -- 結構為 flat key，不使用 nested object
  settings      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index: 依 tenant_id 快速查詢該 tenant 的所有模板
CREATE INDEX IF NOT EXISTS idx_templates_tenant_id ON public.templates(tenant_id);

-- Index: 依 status 查詢草稿/已發布
CREATE INDEX IF NOT EXISTS idx_templates_status ON public.templates(status);

-- Index: 依 updated_at 排序（編輯器載入最近編輯的模板）
CREATE INDEX IF NOT EXISTS idx_templates_updated_at ON public.templates(updated_at DESC);

-- RLS: Row Level Security（多租戶資料隔離）
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- Policy: 只有該 tenant 的 owner 可以管理自己的模板
-- (auth.uid() 對應到 users.id，users.company_id 對應到 tenants.id)
CREATE POLICY "Templates manageable by tenant"
  ON public.templates
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT company_id
      FROM public.profiles
      WHERE id = auth.uid()
    )
  );

-- Trigger: 自動更新 updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.templates IS '儲存卡片建置器的草稿與已發布模板';
COMMENT ON COLUMN public.templates.tenant_id IS 'FK to tenants.id — 多租戶隔離';
COMMENT ON COLUMN public.templates.status IS '卡片狀態：draft（草稿）或 published（已發布）';
COMMENT ON COLUMN public.templates.card_type IS '卡片類型：stamp_card / cashback_card / reward_card / membership_card / discount_card / coupon_card / multipass / gift_card';
COMMENT ON COLUMN public.templates.settings IS '卡片設定（JSONB）：name, cardType, barcodeType, storeName, issuerName, passValidDays, expiryDate, currency';
