
INSERT INTO public.user_credits (user_id, plan, daily_credits, bonus_credits)
SELECT u.id, 'free', 5, 30
FROM auth.users u
LEFT JOIN public.user_credits c ON c.user_id = u.id
WHERE c.user_id IS NULL;
