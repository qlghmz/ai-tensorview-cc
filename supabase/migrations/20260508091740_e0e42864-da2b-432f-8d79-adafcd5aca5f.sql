GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON TYPE public.app_role TO authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_credit_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refill_user_credits(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credits(uuid, integer, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, integer, text, text, jsonb) TO authenticated;