-- P12 : retirer un message de cercle.
-- À VÉRIFIER puis appliquer ce soir (préparé par Jerry, pas encore lancé).
-- L'auteur peut retirer son message ; le créateur du cercle peut retirer
-- n'importe quel message de son cercle (modération).
-- Avant d'appliquer : lister les règles existantes sur circle_messages
--   select policyname, cmd, qual from pg_policies where tablename = 'circle_messages';
-- et ne pas créer de doublon si une règle DELETE équivalente existe déjà.

DROP POLICY IF EXISTS circle_messages_delete_own_or_owner ON public.circle_messages;
CREATE POLICY circle_messages_delete_own_or_owner
  ON public.circle_messages
  FOR DELETE
  TO authenticated
  USING (
    sender_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.circles c
      WHERE c.id = circle_messages.circle_id
        AND c.created_by = (select auth.uid())
    )
  );

-- Les likes du message retiré partent avec lui (si la clé étrangère n'est pas
-- déjà en ON DELETE CASCADE, le vérifier sur circle_message_likes).
