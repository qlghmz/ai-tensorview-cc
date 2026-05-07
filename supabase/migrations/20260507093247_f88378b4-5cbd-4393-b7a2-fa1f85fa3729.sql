GRANT EXECUTE ON FUNCTION public.consume_credits(uuid, integer, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refill_user_credits(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, integer, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_credit_balance(uuid) TO authenticated;