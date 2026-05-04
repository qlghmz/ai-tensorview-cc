INSERT INTO public.user_roles (user_id, role)
VALUES ('f381a987-007d-49ac-9284-87b83506c124', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;