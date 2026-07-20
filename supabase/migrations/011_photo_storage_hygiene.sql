-- Photo storage hygiene (near-zero-cost photo pipeline)
-- 1. documents.thumbnail_path: small client-generated thumbnail stored alongside
--    the original so lists never download full-size images (egress control).
-- 2. Storage DELETE policy: deleting a document now frees its file instead of
--    orphaning it forever (storage-cost control). Scoped to property editors,
--    same as the existing insert/update policies from 007.

alter table public.documents
  add column if not exists thumbnail_path text;

drop policy if exists p6i_home_documents_delete on storage.objects;
create policy p6i_home_documents_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'home-documents'
  and (storage.foldername(name))[1] = 'properties'
  and public.document_storage_property_id(name) is not null
  and public.can_write_property_documents(public.document_storage_property_id(name))
);
