-- Archivos efímeros por bloque de lectura. Ejecutar manualmente en Supabase después de 0001-0004.
BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'execution-documents',
  'execution-documents',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]::text[]
);

-- Ruta requerida: <auth.uid>/<execution-id>/<step-id>/<filename>.
-- El usuario autenticado solo puede administrar sus propios archivos efímeros.
CREATE POLICY "Moki: cargar documentos propios de ejecución"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'execution-documents'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY "Moki: leer documentos propios de ejecución"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'execution-documents'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY "Moki: eliminar documentos propios de ejecución"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'execution-documents'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

COMMIT;
