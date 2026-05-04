
-- payment_orders 订单表
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no text UNIQUE NOT NULL DEFAULT ('LV' || to_char(now(),'YYYYMMDDHH24MISS') || lpad((floor(random()*10000))::text, 4, '0')),
  user_id uuid NOT NULL,
  plan text NOT NULL CHECK (plan IN ('pro','team')),
  amount_cny integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled','failed')),
  note text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders" ON public.payment_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders" ON public.payment_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all orders" ON public.payment_orders
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update orders" ON public.payment_orders
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_payment_orders_updated_at
  BEFORE UPDATE ON public.payment_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 管理员对核心表的额外读写权限
CREATE POLICY "Admins can view all credits" ON public.user_credits
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all credits" ON public.user_credits
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all projects" ON public.projects
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all projects" ON public.projects
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete all projects" ON public.projects
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all transactions" ON public.credit_transactions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all email logs" ON public.email_send_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 管理员手动改套餐：升级时一次性补发该套餐月度配额
CREATE OR REPLACE FUNCTION public.admin_set_plan(_target uuid, _plan text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  monthly_allowance := CASE _plan WHEN 'pro' THEN 100 WHEN 'team' THEN 500 ELSE 0 END;

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
$$;

-- 管理员给用户加减积分
CREATE OR REPLACE FUNCTION public.admin_adjust_credits(_target uuid, _amount integer, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE bal integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _amount = 0 THEN
    RAISE EXCEPTION 'amount cannot be zero';
  END IF;

  IF _amount > 0 THEN
    UPDATE public.user_credits SET bonus_credits = bonus_credits + _amount WHERE user_id = _target;
  ELSE
    UPDATE public.user_credits
    SET bonus_credits = GREATEST(0, bonus_credits + _amount)
    WHERE user_id = _target;
  END IF;

  SELECT daily_credits + monthly_credits + bonus_credits INTO bal
  FROM public.user_credits WHERE user_id = _target;

  INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after, metadata)
  VALUES (_target, _amount, _reason, bal, jsonb_build_object('by', auth.uid()));

  RETURN jsonb_build_object('success', true, 'balance', bal);
END;
$$;

-- 管理员激活订单（标记 paid → 自动升级套餐）
CREATE OR REPLACE FUNCTION public.admin_activate_order(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.payment_orders;
  res jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO o FROM public.payment_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF o.status = 'paid' THEN
    RETURN jsonb_build_object('success', true, 'already_paid', true);
  END IF;

  UPDATE public.payment_orders
  SET status = 'paid', paid_at = now()
  WHERE id = _order_id;

  res := public.admin_set_plan(o.user_id, o.plan);
  RETURN jsonb_build_object('success', true, 'plan', o.plan, 'user_id', o.user_id, 'detail', res);
END;
$$;
