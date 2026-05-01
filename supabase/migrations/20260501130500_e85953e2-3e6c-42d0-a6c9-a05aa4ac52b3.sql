-- Ensure profile and credit provisioning triggers exist for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_created_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_credits
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_credits();

-- Keep credit rows updated_at current
DROP TRIGGER IF EXISTS update_user_credits_updated_at ON public.user_credits;
CREATE TRIGGER update_user_credits_updated_at
BEFORE UPDATE ON public.user_credits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Centralize daily/monthly refill rules
CREATE OR REPLACE FUNCTION public.refill_user_credits(_user_id uuid)
RETURNS public.user_credits
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
    VALUES (_user_id, 'free', 5, 30)
    RETURNING * INTO rec;

    INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after)
    VALUES (_user_id, 30, 'signup_bonus', 35);
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

  monthly_allowance := CASE rec.plan
    WHEN 'pro' THEN 100
    WHEN 'team' THEN 500
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

REVOKE ALL ON FUNCTION public.refill_user_credits(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refill_user_credits(uuid) TO service_role;

-- Update consume function to use the same refill rules
CREATE OR REPLACE FUNCTION public.consume_credits(_user_id uuid, _amount integer, _reason text, _metadata jsonb DEFAULT NULL::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec public.user_credits;
  remaining integer := _amount;
  new_daily integer;
  new_monthly integer;
  new_bonus integer;
  total integer;
BEGIN
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  SELECT * INTO rec FROM public.refill_user_credits(_user_id);
  IF rec.user_id IS NULL THEN
    RAISE EXCEPTION 'no credits record for user';
  END IF;

  total := rec.daily_credits + rec.monthly_credits + rec.bonus_credits;
  IF total < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits', 'balance', total);
  END IF;

  new_daily := GREATEST(0, rec.daily_credits - remaining);
  remaining := remaining - (rec.daily_credits - new_daily);
  new_monthly := GREATEST(0, rec.monthly_credits - remaining);
  remaining := remaining - (rec.monthly_credits - new_monthly);
  new_bonus := GREATEST(0, rec.bonus_credits - remaining);

  UPDATE public.user_credits
  SET daily_credits = new_daily,
      monthly_credits = new_monthly,
      bonus_credits = new_bonus
  WHERE user_id = _user_id;

  total := new_daily + new_monthly + new_bonus;

  INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after, metadata)
  VALUES (_user_id, -_amount, _reason, total, _metadata);

  RETURN jsonb_build_object('success', true, 'balance', total);
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_credits(uuid, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credits(uuid, integer, text, jsonb) TO service_role;