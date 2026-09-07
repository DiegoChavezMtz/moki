-- Sprint 5. Ejecutar manualmente después de 0002_profiles.sql.
-- El agente NO ejecuta migraciones. Confirmar el resultado antes de integrar persistencia.
BEGIN;

CREATE TABLE public.agents (
  id uuid PRIMARY KEY,
  -- No se aplica borrado en cascada al eliminar una cuenta: esa regla sigue pendiente.
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE NO ACTION,
  title text NOT NULL CHECK (title ~ '[^[:space:]]'),
  description text NOT NULL CHECK (description ~ '[^[:space:]]'),
  -- Referencia histórica: borrar el original no borra ni bloquea sus copias.
  forked_from uuid
);

CREATE INDEX agents_owner_id_idx ON public.agents(owner_id);
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.agents FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.agents TO authenticated;
-- No se transfiere la propiedad ni se cambia el origen mediante UPDATE.
GRANT UPDATE (title, description) ON TABLE public.agents TO authenticated;
GRANT ALL ON TABLE public.agents TO service_role;

CREATE POLICY agents_read_authenticated ON public.agents
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY agents_create_own ON public.agents
  FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY agents_update_own ON public.agents
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));
CREATE POLICY agents_delete_own ON public.agents
  FOR DELETE TO authenticated USING (owner_id = (SELECT auth.uid()));

COMMIT;
