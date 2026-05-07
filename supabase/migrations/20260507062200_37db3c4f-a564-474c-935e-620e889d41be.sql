
-- 1) refill：每日补到 10、新人 100 bonus
CREATE OR REPLACE FUNCTION public.refill_user_credits(_user_id uuid)
 RETURNS user_credits
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    VALUES (_user_id, 'free', 10, 100)
    RETURNING * INTO rec;

    INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after)
    VALUES (_user_id, 100, 'signup_bonus', 110);
  END IF;

  IF rec.daily_reset_at < (now() - INTERVAL '1 day') THEN
    new_daily := 10;
    IF new_daily > rec.daily_credits THEN
      new_total := new_daily + rec.monthly_credits + rec.bonus_credits;
      INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after)
      VALUES (_user_id, new_daily - rec.daily_credits, 'daily_refill', new_total);
    END IF;
    rec.daily_credits := new_daily;
    rec.daily_reset_at := now();
  END IF;

  monthly_allowance := CASE rec.plan
    WHEN 'pro' THEN 200
    WHEN 'team' THEN 1000
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
$function$;

-- 2) 新人触发器：100 bonus + daily 10
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_credits (user_id, plan, daily_credits, bonus_credits)
  VALUES (NEW.id, 'free', 10, 100)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after)
  VALUES (NEW.id, 100, 'signup_bonus', 110);
  RETURN NEW;
END;
$function$;

-- 3) admin_set_plan：pro=200 team=1000
CREATE OR REPLACE FUNCTION public.admin_set_plan(_target uuid, _plan text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  monthly_allowance integer;
  bal integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _plan NOT IN ('free','pro','team') THEN
    RAISE EXCEPTION 'invalid plan';
  END IF;

  monthly_allowance := CASE _plan WHEN 'pro' THEN 200 WHEN 'team' THEN 1000 ELSE 0 END;

  UPDATE public.user_credits
  SET plan = _plan,
      monthly_credits = GREATEST(monthly_credits, monthly_allowance),
      monthly_reset_at = CASE WHEN monthly_allowance > 0 THEN now() ELSE monthly_reset_at END
  WHERE user_id = _target;

  SELECT daily_credits + monthly_credits + bonus_credits INTO bal
  FROM public.user_credits WHERE user_id = _target;

  INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after, metadata)
  VALUES (_target, monthly_allowance, 'admin_set_plan', bal, jsonb_build_object('plan', _plan, 'by', auth.uid()));

  RETURN jsonb_build_object('success', true, 'plan', _plan, 'balance', bal);
END;
$function$;

-- 4) activate_paid_order：pro=200 team=1000
CREATE OR REPLACE FUNCTION public.activate_paid_order(_order_no text, _provider text, _provider_trade_no text, _amount_cny integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  o public.payment_orders;
  monthly_allowance integer;
  bal integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO o FROM public.payment_orders WHERE order_no = _order_no FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
  END IF;

  IF o.status = 'paid' THEN
    RETURN jsonb_build_object('success', true, 'already_paid', true);
  END IF;

  IF _amount_cny IS NOT NULL AND _amount_cny < o.amount_cny THEN
    RETURN jsonb_build_object('success', false, 'error', 'amount_mismatch',
                              'expected', o.amount_cny, 'got', _amount_cny);
  END IF;

  UPDATE public.payment_orders
  SET status = 'paid',
      paid_at = now(),
      provider = _provider,
      provider_trade_no = _provider_trade_no
  WHERE id = o.id;

  monthly_allowance := CASE o.plan WHEN 'pro' THEN 200 WHEN 'team' THEN 1000 ELSE 0 END;

  UPDATE public.user_credits
  SET plan = o.plan,
      monthly_credits = GREATEST(monthly_credits, monthly_allowance),
      monthly_reset_at = CASE WHEN monthly_allowance > 0 THEN now() ELSE monthly_reset_at END
  WHERE user_id = o.user_id;

  SELECT daily_credits + monthly_credits + bonus_credits INTO bal
  FROM public.user_credits WHERE user_id = o.user_id;

  INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after, metadata)
  VALUES (o.user_id, monthly_allowance, 'payment_activate',
          bal,
          jsonb_build_object('plan', o.plan, 'provider', _provider, 'trade_no', _provider_trade_no, 'order_no', _order_no));

  RETURN jsonb_build_object('success', true, 'plan', o.plan, 'user_id', o.user_id);
END;
$function$;

-- 5) feedback 表
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  subject text,
  message text NOT NULL,
  url text,
  status text NOT NULL DEFAULT 'open',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit feedback" ON public.feedback
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view feedback" ON public.feedback
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own feedback" ON public.feedback
  FOR SELECT USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Admins can update feedback" ON public.feedback
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::app_role));
