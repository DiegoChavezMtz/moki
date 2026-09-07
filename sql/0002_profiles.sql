-- Sprint 4. Diego ejecuta manualmente este archivo después de 0001_init.sql.
-- No ha sido ejecutado por el agente. Esperar confirmación antes de integrar perfiles.
BEGIN;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT ''
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Solo el nombre visible vive aquí; el correo sigue en Supabase Auth.
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (name) ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

CREATE POLICY profiles_read_authenticated ON public.profiles
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY profiles_update_own_name ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE FUNCTION public.moki_create_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'name', ''));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.moki_create_profile() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER moki_on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.moki_create_profile();

-- También cubrir cuentas que ya existan antes de instalar el trigger.
INSERT INTO public.profiles (id, name)
SELECT id, COALESCE(raw_user_meta_data ->> 'name', '') FROM auth.users;

COMMIT;
