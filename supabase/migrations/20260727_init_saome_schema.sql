-- SAOME init schema (D.4)
-- 對應 Plan: saome_monorepo_結構計畫_cd254153 Phase D.4
--
-- 三個表：
--   public.profiles   — 跟 auth.users 1:1 連動的業務 profile
--   public.app_sessions — 業務級 sessions（多裝置登入、token 過期）
--   public.audit_log  — 業務審計（會員動作、金流等）
--
-- 命名選擇：
--   - public.users 不用，Supabase 慣例的 profile 表用 profiles 命名
--   - app_sessions 不用 sessions（避免跟 auth.sessions 混淆）
--
-- RLS 政策：
--   - profiles: 每個 auth user 只能看/改自己的 profile
--   - app_sessions: 只能看/管理自己的 sessions
--   - audit_log: 只能 insert (service role 讀)

-- ============================================================
-- 1. public.profiles
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  company_id UUID,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin', 'super_admin')),
  locale TEXT NOT NULL DEFAULT 'zh-TW' CHECK (locale IN ('zh-TW', 'en')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS '業務 profile 表，1:1 連動 auth.users';

-- 自動建立 profile when new auth.user created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by self"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Profiles updatable by self"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Profiles insertable by self on signup"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- 2. public.app_sessions
-- ============================================================
CREATE TABLE public.app_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT,
  user_agent TEXT,
  ip_address INET,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_app_sessions_user_id ON public.app_sessions(user_id);
CREATE INDEX idx_app_sessions_expires_at ON public.app_sessions(expires_at) WHERE revoked_at IS NULL;

ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "App sessions viewable by self"
  ON public.app_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "App sessions insertable by self"
  ON public.app_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "App sessions revocable by self"
  ON public.app_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "App sessions deletable by self"
  ON public.app_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. public.audit_log
-- ============================================================
CREATE TABLE public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_action ON public.audit_log(action);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- 一般使用者只能 insert（自己的 audit 軌跡）
CREATE POLICY "Audit log insertable by authenticated"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 讀：只有 super_admin 才能讀（service role 可 bypass RLS）
CREATE POLICY "Audit log readable by super_admin"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );
