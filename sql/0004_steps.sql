-- Sprint 5. Ejecutar manualmente después de 0003_agents.sql.
-- El agente NO ejecuta migraciones. Confirmar el resultado antes de integrar persistencia.
BEGIN;

CREATE TABLE public.steps (
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  id uuid NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  block_type text NOT NULL CHECK (block_type IN ('pensar', 'buscar-web', 'leer-documento', 'calcular', 'escribir')),
  instruction text NOT NULL,
  -- ForkAgent conserva IDs de pasos dentro de una cadena nueva.
  PRIMARY KEY (agent_id, id),
  UNIQUE (agent_id, position) DEFERRABLE INITIALLY DEFERRED
);

ALTER TABLE public.steps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.steps FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.steps TO authenticated;
GRANT UPDATE (position, block_type, instruction) ON TABLE public.steps TO authenticated;
GRANT ALL ON TABLE public.steps TO service_role;

CREATE POLICY steps_read_authenticated ON public.steps
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY steps_create_own ON public.steps
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_id AND a.owner_id = (SELECT auth.uid()))
  );
CREATE POLICY steps_update_own ON public.steps
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_id AND a.owner_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_id AND a.owner_id = (SELECT auth.uid())));
CREATE POLICY steps_delete_own ON public.steps
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.agents a WHERE a.id = agent_id AND a.owner_id = (SELECT auth.uid()))
  );

-- Guardado atómico de metadatos y cadena mediante supabase.rpc().
-- SECURITY INVOKER conserva RLS; no acepta owner_id desde el cliente.
CREATE FUNCTION public.moki_save_agent(
  p_id uuid,
  p_title text,
  p_description text,
  p_steps jsonb,
  p_forked_from uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  requester uuid := auth.uid();
  current_owner uuid;
BEGIN
  IF requester IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_steps IS NULL OR jsonb_typeof(p_steps) <> 'array' THEN
    RAISE EXCEPTION 'Steps must be an array' USING ERRCODE = '22023';
  END IF;
  -- Validar tipos JSON antes de convertir: no aceptar objetos/números como instrucciones.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_steps) s
    WHERE jsonb_typeof(s) IS DISTINCT FROM 'object'
      OR jsonb_typeof(s -> 'id') IS DISTINCT FROM 'string'
      OR jsonb_typeof(s -> 'blockType') IS DISTINCT FROM 'string'
      OR jsonb_typeof(s -> 'instruction') IS DISTINCT FROM 'string'
  ) THEN
    RAISE EXCEPTION 'Invalid step format' USING ERRCODE = '22023';
  END IF;

  -- Serializa escrituras concurrentes del mismo agente sin bloquear otros agentes.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  SELECT owner_id INTO current_owner FROM public.agents WHERE id = p_id;
  IF FOUND THEN
    IF current_owner <> requester THEN
      RAISE EXCEPTION 'Not the owner' USING ERRCODE = '42501';
    END IF;
    UPDATE public.agents SET title = p_title, description = p_description WHERE id = p_id;
  ELSE
    INSERT INTO public.agents (id, owner_id, title, description, forked_from)
    VALUES (p_id, requester, p_title, p_description, p_forked_from);
  END IF;

  DELETE FROM public.steps WHERE agent_id = p_id;
  INSERT INTO public.steps (agent_id, id, position, block_type, instruction)
  SELECT p_id, (s.value ->> 'id')::uuid, (s.ordinality - 1)::integer,
    s.value ->> 'blockType', s.value ->> 'instruction'
  FROM jsonb_array_elements(p_steps) WITH ORDINALITY AS s(value, ordinality);
  -- Cualquier error revierte la operación completa, incluidos metadatos y DELETE.
END;
$$;

REVOKE ALL ON FUNCTION public.moki_save_agent(uuid, text, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moki_save_agent(uuid, text, text, jsonb, uuid) TO authenticated;

COMMIT;
