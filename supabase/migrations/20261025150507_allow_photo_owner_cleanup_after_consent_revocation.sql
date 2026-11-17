alter policy dentaia_photo_read on storage.objects to authenticated using(bucket_id = 'dental-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
comment on policy dentaia_photo_read on storage.objects is 'El propietario conserva acceso para consultar y eliminar sus archivos incluso si revocó el consentimiento. La revocación bloquea nuevas cargas.';
