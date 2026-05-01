-- 通用 updated_at 触发函数
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- user_credits
CREATE TABLE public.user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',
  daily_credits INTEGER NOT NULL DEFAULT 5,
  monthly_credits INTEGER NOT NULL DEFAULT 0,
  bonus_credits INTEGER NOT NULL DEFAULT 0,
  daily_reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  monthly_reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own credits" ON public.user_credits FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER update_user_credits_updated_at
BEFORE UPDATE ON public.user_credits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- credit_transactions
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  balance_after INTEGER NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_tx_user_created ON public.credit_transactions(user_id, created_at DESC);
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);

-- 注册赠送 30 积分 + 默认 5 daily
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, plan, daily_credits, bonus_credits)
  VALUES (NEW.id, 'free', 5, 30)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after)
  VALUES (NEW.id, 30, 'signup_bonus', 35);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_credits
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_credits();

-- 余额查询
CREATE OR REPLACE FUNCTION public.get_credit_balance(_user_id UUID)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(daily_credits, 0) + COALESCE(monthly_credits, 0) + COALESCE(bonus_credits, 0)
  FROM public.user_credits WHERE user_id = _user_id;
$$;

-- 消耗积分（按 daily → monthly → bonus 顺序）
CREATE OR REPLACE FUNCTION public.consume_credits(_user_id UUID, _amount INTEGER, _reason TEXT, _metadata JSONB DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec public.user_credits;
  remaining INTEGER := _amount;
  new_daily INTEGER;
  new_monthly INTEGER;
  new_bonus INTEGER;
  total INTEGER;
BEGIN
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  SELECT * INTO rec FROM public.user_credits WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no credits record for user';
  END IF;

  -- 每日补给：上次重置距今超过 24 小时则补到 5
  IF rec.daily_reset_at < (now() - INTERVAL '1 day') THEN
    rec.daily_credits := 5;
    rec.daily_reset_at := now();
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
      bonus_credits = new_bonus,
      daily_reset_at = rec.daily_reset_at
  WHERE user_id = _user_id;

  total := new_daily + new_monthly + new_bonus;

  INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after, metadata)
  VALUES (_user_id, -_amount, _reason, total, _metadata);

  RETURN jsonb_build_object('success', true, 'balance', total);
END;
$$;

-- 增加积分（充值/赠送/会员补给）
CREATE OR REPLACE FUNCTION public.add_credits(_user_id UUID, _amount INTEGER, _kind TEXT, _reason TEXT, _metadata JSONB DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total INTEGER;
BEGIN
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;
  IF _kind NOT IN ('daily', 'monthly', 'bonus') THEN
    RAISE EXCEPTION 'invalid kind';
  END IF;

  IF _kind = 'daily' THEN
    UPDATE public.user_credits SET daily_credits = daily_credits + _amount, daily_reset_at = now() WHERE user_id = _user_id;
  ELSIF _kind = 'monthly' THEN
    UPDATE public.user_credits SET monthly_credits = monthly_credits + _amount, monthly_reset_at = now() WHERE user_id = _user_id;
  ELSE
    UPDATE public.user_credits SET bonus_credits = bonus_credits + _amount WHERE user_id = _user_id;
  END IF;

  SELECT daily_credits + monthly_credits + bonus_credits INTO total FROM public.user_credits WHERE user_id = _user_id;

  INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after, metadata)
  VALUES (_user_id, _amount, _reason, total, _metadata);

  RETURN jsonb_build_object('success', true, 'balance', total);
END;
$$;

-- 为已存在的用户补建记录
INSERT INTO public.user_credits (user_id, plan, daily_credits, bonus_credits)
SELECT id, 'free', 5, 30 FROM auth.users
ON CONFLICT (user_id) DO NOTHING;