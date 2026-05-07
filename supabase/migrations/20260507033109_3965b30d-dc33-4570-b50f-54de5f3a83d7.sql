-- Track third-party payment metadata on orders
ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_trade_no text;

CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_provider_trade_no_uniq
  ON public.payment_orders (provider, provider_trade_no)
  WHERE provider_trade_no IS NOT NULL;

-- Webhook activation: callable only by service_role (webhook server route).
-- Marks order paid + upgrades user's plan in one atomic step.
CREATE OR REPLACE FUNCTION public.activate_paid_order(
  _order_no text,
  _provider text,
  _provider_trade_no text,
  _amount_cny integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.payment_orders;
  monthly_allowance integer;
  bal integer;
BEGIN
  -- Only service_role (webhook) may call this.
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

  -- Apply plan (mirrors admin_set_plan logic)
  monthly_allowance := CASE o.plan WHEN 'pro' THEN 100 WHEN 'team' THEN 500 ELSE 0 END;

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
$$;