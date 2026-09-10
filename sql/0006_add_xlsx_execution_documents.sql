-- Extiende el bucket efímero del Sprint 6 para admitir libros XLSX.
-- Ejecutar manualmente en Supabase después de 0005_execution_documents.sql.
BEGIN;

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'
]::text[]
WHERE id = 'execution-documents';

COMMIT;
