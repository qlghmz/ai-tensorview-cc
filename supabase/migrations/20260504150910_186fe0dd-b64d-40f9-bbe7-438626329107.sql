DO $$
DECLARE
  new_uid uuid;
  existing_uid uuid;
BEGIN
  SELECT id INTO existing_uid FROM auth.users WHERE email = '123123@123.com';

  IF existing_uid IS NOT NULL THEN
    new_uid := existing_uid;
    UPDATE auth.users
    SET encrypted_password = crypt('123123', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = new_uid;
  ELSE
    new_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', new_uid, 'authenticated', 'authenticated',
      '123123@123.com', crypt('123123', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', '测试管理员'),
      false
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), new_uid,
      jsonb_build_object('sub', new_uid::text, 'email', '123123@123.com', 'email_verified', true),
      'email', new_uid::text, now(), now(), now()
    );
  END IF;

  INSERT INTO public.profiles (id, display_name) VALUES (new_uid, '测试管理员')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (new_uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_credits (user_id, plan, daily_credits, bonus_credits)
  VALUES (new_uid, 'pro', 5, 1000)
  ON CONFLICT (user_id) DO NOTHING;
END $$;