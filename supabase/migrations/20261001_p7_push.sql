-- P7 / P6 : vraies notifications push (Web Push), même appli fermée.
-- Base → déclencheurs → pg_net → Edge Function `push` → Web Push (FCM, Apple, Mozilla).
-- Les secrets (secret partagé, clés VAPID) vivent dans le coffre (Vault), jamais dans le code.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Un abonnement par appareil (navigateur / appli installée) et par personne.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE CHECK (endpoint ~ '^https://'),
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions (user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subscriptions_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own ON public.push_subscriptions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Enregistrer l'abonnement de cet appareil (un appareil qui change de compte est réattribué).
CREATE OR REPLACE FUNCTION public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  ON CONFLICT (endpoint) DO UPDATE SET user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth,
    user_agent = excluded.user_agent, last_seen_at = now();
END $$;
CREATE OR REPLACE FUNCTION public.delete_push_subscription(p_endpoint text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  DELETE FROM public.push_subscriptions WHERE endpoint = p_endpoint AND user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.save_push_subscription(text, text, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.delete_push_subscription(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_push_subscription(text) TO authenticated;

-- Réglages de notifications, enregistrés en base (respectés par le serveur, D5).
-- Clés : likes, comments, reshakes, follows, circles, messages, streak. Absent = activé.
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  notif_prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_settings_own ON public.user_settings;
CREATE POLICY user_settings_own ON public.user_settings
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Conversations / cercles en sourdine (P12-6) : plus de push ni de pastille.
CREATE TABLE IF NOT EXISTS public.chat_mutes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('dm', 'circle')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, target_id)
);
ALTER TABLE public.chat_mutes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_mutes_own ON public.chat_mutes;
CREATE POLICY chat_mutes_own ON public.chat_mutes
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- @mentions dans les cercles (P28) : les ids sont gardés avec le message.
ALTER TABLE public.circle_messages ADD COLUMN IF NOT EXISTS mentioned_ids uuid[];

-- Secret partagé base → fonction (généré ici, personne ne le voit).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'push_hook_secret') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'push_hook_secret', 'SHAKEMOI : secret base -> fonction push');
  END IF;
END $$;

-- Lus uniquement par la fonction (clé service), jamais par l'appli.
CREATE OR REPLACE FUNCTION public.push_internal_config()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'hook_secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_hook_secret'),
    'vapid', (SELECT decrypted_secret::jsonb FROM vault.decrypted_secrets WHERE name = 'vapid_keys'));
$$;
CREATE OR REPLACE FUNCTION public.push_store_vapid(p_keys jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'vapid_keys') THEN
    PERFORM vault.create_secret(p_keys::text, 'vapid_keys', 'SHAKEMOI : clés VAPID des notifications push');
  END IF;
  RETURN (SELECT decrypted_secret::jsonb FROM vault.decrypted_secrets WHERE name = 'vapid_keys');
END $$;
REVOKE ALL ON FUNCTION public.push_internal_config() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.push_store_vapid(jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_internal_config() TO service_role;
GRANT EXECUTE ON FUNCTION public.push_store_vapid(jsonb) TO service_role;

-- Clé PUBLIQUE VAPID pour l'appli (elle est faite pour être publique).
CREATE OR REPLACE FUNCTION public.get_vapid_public_key()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT decrypted_secret::jsonb ->> 'publicKey' FROM vault.decrypted_secrets WHERE name = 'vapid_keys';
$$;
REVOKE ALL ON FUNCTION public.get_vapid_public_key() FROM public;
GRANT EXECUTE ON FUNCTION public.get_vapid_public_key() TO anon, authenticated;

-- Déclencheur commun : envoie l'évènement à la fonction, sans jamais bloquer l'écriture.
CREATE OR REPLACE FUNCTION public.push_dispatch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://vbjmhtwrfboqziwibsut.supabase.co/functions/v1/push',
      body := jsonb_build_object('table', TG_TABLE_NAME, 'op', TG_OP, 'record', to_jsonb(NEW),
                                 'old', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END),
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-push-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_hook_secret')),
      timeout_milliseconds := 8000);
  EXCEPTION WHEN others THEN
    RAISE WARNING 'push_dispatch: %', SQLERRM;
  END;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.push_dispatch() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS push_on_notification ON public.notifications;
CREATE TRIGGER push_on_notification AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.push_dispatch();
-- M10 : like de story groupé = même ligne mise à jour quand une nouvelle personne like.
DROP TRIGGER IF EXISTS push_on_notification_update ON public.notifications;
CREATE TRIGGER push_on_notification_update AFTER UPDATE ON public.notifications
  FOR EACH ROW WHEN (NEW.type = 'story_like' AND NEW.is_read = false AND NEW.actor_ids IS DISTINCT FROM OLD.actor_ids)
  EXECUTE FUNCTION public.push_dispatch();
DROP TRIGGER IF EXISTS push_on_message ON public.messages;
CREATE TRIGGER push_on_message AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.push_dispatch();
DROP TRIGGER IF EXISTS push_on_circle_message ON public.circle_messages;
CREATE TRIGGER push_on_circle_message AFTER INSERT ON public.circle_messages
  FOR EACH ROW WHEN (NEW.kind IS NULL) EXECUTE FUNCTION public.push_dispatch();
DROP TRIGGER IF EXISTS push_on_message_like ON public.message_likes;
CREATE TRIGGER push_on_message_like AFTER INSERT ON public.message_likes
  FOR EACH ROW EXECUTE FUNCTION public.push_dispatch();
DROP TRIGGER IF EXISTS push_on_circle_message_like ON public.circle_message_likes;
CREATE TRIGGER push_on_circle_message_like AFTER INSERT ON public.circle_message_likes
  FOR EACH ROW EXECUTE FUNCTION public.push_dispatch();
