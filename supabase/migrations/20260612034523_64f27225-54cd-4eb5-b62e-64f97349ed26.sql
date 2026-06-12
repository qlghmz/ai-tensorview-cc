
-- 1. Extend user_credits
ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS lifetime_tier text,
  ADD COLUMN IF NOT EXISTS lifetime_monthly_allowance integer NOT NULL DEFAULT 0;

-- 2. coupon_codes table
CREATE TABLE IF NOT EXISTS public.coupon_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  tier text NOT NULL DEFAULT 'lifetime_tier_1',
  monthly_credits integer NOT NULL DEFAULT 50,
  batch text,
  source text NOT NULL DEFAULT 'appsumo',
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupon_codes_redeemed_by ON public.coupon_codes(redeemed_by);
CREATE INDEX IF NOT EXISTS idx_coupon_codes_batch ON public.coupon_codes(batch);

GRANT SELECT ON public.coupon_codes TO authenticated;
GRANT ALL ON public.coupon_codes TO service_role;

ALTER TABLE public.coupon_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own redeemed codes"
  ON public.coupon_codes FOR SELECT
  USING (auth.uid() = redeemed_by);

CREATE POLICY "Admins can view all coupon codes"
  ON public.coupon_codes FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage coupon codes"
  ON public.coupon_codes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Redeem function (called by authenticated users)
CREATE OR REPLACE FUNCTION public.redeem_coupon_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  c public.coupon_codes;
  uc public.user_credits;
  new_allowance integer;
  bal integer;
  normalized text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  normalized := upper(trim(_code));

  SELECT * INTO c FROM public.coupon_codes WHERE code = normalized FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'code_not_found');
  END IF;
  IF c.redeemed_by IS NOT NULL THEN
    IF c.redeemed_by = uid THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_redeemed_by_you');
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'code_used');
  END IF;

  -- ensure user_credits row exists
  INSERT INTO public.user_credits (user_id, plan, daily_credits, bonus_credits)
  VALUES (uid, 'free', 5, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO uc FROM public.user_credits WHERE user_id = uid FOR UPDATE;

  -- stack allowance
  new_allowance := COALESCE(uc.lifetime_monthly_allowance, 0) + c.monthly_credits;

  UPDATE public.user_credits
  SET plan = 'lifetime',
      lifetime_tier = c.tier,
      lifetime_monthly_allowance = new_allowance,
      monthly_credits = new_allowance, -- refill to new cap immediately
      monthly_reset_at = now()
  WHERE user_id = uid;

  -- mark code redeemed
  UPDATE public.coupon_codes
  SET redeemed_by = uid, redeemed_at = now()
  WHERE id = c.id;

  SELECT daily_credits + monthly_credits + bonus_credits INTO bal
  FROM public.user_credits WHERE user_id = uid;

  INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after, metadata)
  VALUES (uid, c.monthly_credits, 'coupon_redeem', bal,
          jsonb_build_object('code', c.code, 'tier', c.tier, 'monthly_allowance', new_allowance));

  RETURN jsonb_build_object(
    'success', true,
    'tier', c.tier,
    'monthly_allowance', new_allowance,
    'balance', bal
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_coupon_code(text) TO authenticated;

-- 4. Admin bulk-generate codes
CREATE OR REPLACE FUNCTION public.admin_generate_coupon_codes(
  _count integer,
  _tier text DEFAULT 'lifetime_tier_1',
  _monthly_credits integer DEFAULT 50,
  _batch text DEFAULT NULL
)
RETURNS SETOF text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i integer;
  new_code text;
  segment1 text;
  segment2 text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _count <= 0 OR _count > 5000 THEN
    RAISE EXCEPTION 'invalid_count';
  END IF;

  FOR i IN 1.._count LOOP
    LOOP
      segment1 := upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 4));
      segment2 := upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 4));
      new_code := 'SUMO-' || segment1 || '-' || segment2;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.coupon_codes WHERE code = new_code);
    END LOOP;
    INSERT INTO public.coupon_codes (code, tier, monthly_credits, batch)
    VALUES (new_code, _tier, _monthly_credits, _batch);
    RETURN NEXT new_code;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_generate_coupon_codes(integer, text, integer, text) TO authenticated;

-- 5. Update refill so Lifetime users use stacked allowance
CREATE OR REPLACE FUNCTION public.refill_user_credits(_user_id uuid)
RETURNS public.user_credits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.user_credits;
  new_daily integer;
  new_monthly integer;
  new_total integer;
  monthly_allowance integer;
BEGIN
  SELECT * INTO rec FROM public.user_credits WHERE user_id = _user_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.user_credits (user_id, plan, daily_credits, bonus_credits)
    VALUES (_user_id, 'free', 5, 0)
    RETURNING * INTO rec;
  END IF;

  IF rec.daily_reset_at < (now() - INTERVAL '1 day') THEN
    new_daily := 5;
    IF new_daily > rec.daily_credits THEN
      new_total := new_daily + rec.monthly_credits + rec.bonus_credits;
      INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after)
      VALUES (_user_id, new_daily - rec.daily_credits, 'daily_refill', new_total);
    END IF;
    rec.daily_credits := new_daily;
    rec.daily_reset_at := now();
  END IF;

  monthly_allowance := CASE
    WHEN rec.plan = 'lifetime' THEN COALESCE(rec.lifetime_monthly_allowance, 0)
    WHEN rec.plan = 'pro'  THEN 200
    WHEN rec.plan = 'team' THEN 1000
    ELSE 0
  END;

  IF monthly_allowance > 0 AND rec.monthly_reset_at < (now() - INTERVAL '1 month') THEN
    new_monthly := monthly_allowance;
    IF new_monthly > rec.monthly_credits THEN
      new_total := rec.daily_credits + new_monthly + rec.bonus_credits;
      INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after)
      VALUES (_user_id, new_monthly - rec.monthly_credits, 'monthly_refill', new_total);
    END IF;
    rec.monthly_credits := new_monthly;
    rec.monthly_reset_at := now();
  END IF;

  UPDATE public.user_credits
  SET daily_credits = rec.daily_credits,
      monthly_credits = rec.monthly_credits,
      bonus_credits = rec.bonus_credits,
      daily_reset_at = rec.daily_reset_at,
      monthly_reset_at = rec.monthly_reset_at
  WHERE user_id = _user_id
  RETURNING * INTO rec;

  RETURN rec;
END;
$$;
