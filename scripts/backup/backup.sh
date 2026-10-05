#!/usr/bin/env bash
# R10 — Sauvegarde nocturne de SHAKEmoi (lancée par .github/workflows/backup.yml).
#
# ⚠️ Le dépôt est PUBLIC, les journaux de la tâche aussi :
#   - aucun secret dans ce fichier (tout vient des secrets GitHub, en variables) ;
#   - on n'affiche jamais de données : seulement des totaux (tables, lignes, tailles) ;
#   - la sauvegarde est chiffrée (age) AVANT de quitter la machine, puis envoyée
#     sur un stockage privé (Backblaze B2) ; jamais dans le dépôt ni en artefact.
#
# Étapes : 1. base (rôles, structure, données + tâches planifiées + secrets du
# coffre) → 2. fichiers (photos), le dimanche → 3. chiffrement + envoi →
# 4. rotation (7 jours + 8 semaines) → 5. TEST DE RESTAURATION : on retélécharge
# l'archive chiffrée, on la déchiffre, on la restaure dans une base Supabase vide
# (locale) et on compare le nombre de lignes table par table → 6. témoin en base
# (page Admin).
#
# MODE=essai : sans aucun secret, sur une base d'exemple locale (vérifie toute la
# mécanique : dump, chiffrement, restauration, comptage).
set -euo pipefail
umask 077
export LC_ALL=C
# Clients S3 (B2, Supabase) : pas de sommes de contrôle « nouvelle génération » non prises en charge.
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required

MODE="${MODE:-normal}"
WITH_FILES="${WITH_FILES:-auto}"
DAY="$(date -u +%F)"
START_TS=$(date +%s)
WORK="$(mktemp -d)"
LOCAL_DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
trap 'rm -rf "$WORK"' EXIT

say() { echo "▶ $*"; }
fail() { echo "::error::$*"; exit 1; }

# --- Comptage exact des lignes (public, auth, storage) -----------------------
COUNT_SQL="select table_schema||'.'||table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
  from information_schema.tables
  where table_type = 'BASE TABLE' and table_schema in ('public','auth','storage')
    and table_name not in ('backup_runs','schema_migrations','migrations','buckets_vectors','vector_indexes','s3_multipart_uploads','s3_multipart_uploads_parts','buckets_analytics')
  order by 1"
count_rows() { psql "$1" -X -q -At -F $'\t' -c "$COUNT_SQL"; }

# --- Base Supabase locale vide (pour l'essai et pour le test de restauration) -
start_local() {
  mkdir -p "$WORK/local" && cd "$WORK/local"
  [ -f supabase/config.toml ] || supabase init --force >/dev/null
  sed -i -E 's/^major_version = .*/major_version = 17/' supabase/config.toml
  # Le registre d'images limite parfois le débit : jusqu'à 3 essais.
  local i
  for i in 1 2 3; do
    if supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,supavisor,postgres-meta,mailpit >/dev/null 2>"$WORK/start.err"; then cd - >/dev/null; return 0; fi
    echo "   démarrage de la base locale : essai $i raté, on recommence"; tail -n 3 "$WORK/start.err"; sleep $((i * 20))
  done
  fail "La base locale ne démarre pas"
}
stop_local() { (cd "$WORK/local" && supabase stop --no-backup >/dev/null 2>&1) || true; }

# Restauration (même procédure que docs/restauration.md) : les rôles à part (certains
# réglages de rôles réservés sont refusés, sans conséquence), puis structure +
# données en UNE transaction, déclencheurs coupés pendant les données.
restore_into() { # url, dossier
  psql "$1" -X -q -f "$2/roles.sql" >/dev/null 2>"$WORK/roles.err" || true
  [ -s "$WORK/roles.err" ] && echo "   rôles : $(grep -c ERROR "$WORK/roles.err") réglage(s) ignoré(s)"
  psql "$1" -X -q --single-transaction -v ON_ERROR_STOP=1 \
    -f "$2/schema.sql" -c 'SET session_replication_role = replica' -f "$2/data.sql" >/dev/null
}

# --- 0. Vérifications ----------------------------------------------------------
if [ "$MODE" = "essai" ]; then
  say "Mode essai : base d'exemple locale, clé de chiffrement jetable, pas d'envoi"
  AGE_KEY="$(age-keygen 2>/dev/null | grep '^AGE-SECRET-KEY')"
  start_local
  psql "$LOCAL_DB" -X -q -v ON_ERROR_STOP=1 <<'SQL'
create table public.essai_posts (id bigserial primary key, titre text not null, cree timestamptz default now());
insert into public.essai_posts(titre) select 'son '||g from generate_series(1,250) g;
create table public.essai_likes (post bigint references public.essai_posts(id), n int);
insert into public.essai_likes select id, id % 7 from public.essai_posts;
create or replace function public.essai_trigger() returns trigger language plpgsql as $$ begin raise exception 'les déclencheurs ne doivent pas tourner pendant la restauration'; end $$;
create trigger essai_t before insert on public.essai_likes for each row execute function public.essai_trigger();
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values ('00000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','essai@exemple.test',now(),now());
insert into storage.buckets (id, name, public) values ('essai','essai',true);
SQL
  DB_URL="$LOCAL_DB"
else
  for v in SUPABASE_DB_URL BACKUP_AGE_KEY B2_KEY_ID B2_APP_KEY B2_BUCKET B2_ENDPOINT; do
    [ -n "${!v:-}" ] || fail "Secret GitHub manquant : $v (voir docs/restauration.md, « Mise en place »)"
  done
  AGE_KEY="$BACKUP_AGE_KEY"
  DB_URL="$SUPABASE_DB_URL"
fi
RECIPIENT="$(printf '%s\n' "$AGE_KEY" | age-keygen -y 2>/dev/null)" || fail "Clé de chiffrement illisible (BACKUP_AGE_KEY)"
KEYFILE="$WORK/key.txt"; printf '%s\n' "$AGE_KEY" > "$KEYFILE"

# --- 1. Base -------------------------------------------------------------------
say "1. Copie de la base"
DUMP="$WORK/db"; mkdir -p "$DUMP"
supabase db dump --db-url "$DB_URL" -f "$DUMP/roles.sql" --role-only >/dev/null
supabase db dump --db-url "$DB_URL" -f "$DUMP/schema.sql" >/dev/null
# Tables internes du stockage (non utilisées, et protégées : la restauration les refuse).
supabase db dump --db-url "$DB_URL" -f "$DUMP/data.sql" --data-only --use-copy \n  -x storage.buckets_vectors -x storage.vector_indexes -x storage.s3_multipart_uploads -x storage.s3_multipart_uploads_parts -x storage.buckets_analytics >/dev/null
# Hors du dump standard : les tâches planifiées (pg_cron) et les secrets du coffre
# (clés VAPID des notifications…), prêts à rejouer.
psql "$DB_URL" -X -q -At -c "select format('select cron.schedule(%L, %L, %L);', jobname, schedule, command) from cron.job order by jobid" > "$DUMP/cron_jobs.sql" 2>/dev/null || echo "-- pas de pg_cron" > "$DUMP/cron_jobs.sql"
psql "$DB_URL" -X -q -At -c "select format('select vault.create_secret(%L, %L, %L);', decrypted_secret, name, coalesce(description,'')) from vault.decrypted_secrets order by name" > "$DUMP/vault_secrets.sql" 2>/dev/null || echo "-- coffre illisible" > "$DUMP/vault_secrets.sql"
count_rows "$DB_URL" > "$DUMP/counts.tsv"
TABLES=$(wc -l < "$DUMP/counts.tsv"); ROWS=$(awk -F'\t' '{s+=$2} END {print s+0}' "$DUMP/counts.tsv")
[ "$TABLES" -gt 0 ] || fail "Aucune table comptée"
grep -q 'CREATE TABLE' "$DUMP/schema.sql" || fail "Structure vide"
say "   $TABLES tables, $ROWS lignes"

DB_ARCHIVE="db-$DAY.tar.gz.age"
tar -C "$DUMP" -czf - . | age -r "$RECIPIENT" -o "$WORK/$DB_ARCHIVE"
rm -rf "$DUMP"
DB_BYTES=$(stat -c %s "$WORK/$DB_ARCHIVE")
say "   archive chiffrée : $((DB_BYTES / 1024)) Ko"

# --- 2. Fichiers (le dimanche, ou à la demande) ---------------------------------
DOW=$(date -u +%u)
if [ "$WITH_FILES" = "true" ] || { [ "$WITH_FILES" = "auto" ] && [ "$DOW" = "7" ]; }; then DO_FILES=1; else DO_FILES=0; fi
FILES=""; FILES_BYTES=""; FILES_ARCHIVE="files-$DAY.tar.age"
if [ "$DO_FILES" = 1 ] && [ "$MODE" != "essai" ]; then
  [ -n "${SUPABASE_S3_KEY_ID:-}" ] && [ -n "${SUPABASE_S3_SECRET:-}" ] || fail "Secrets SUPABASE_S3_KEY_ID / SUPABASE_S3_SECRET manquants (fichiers)"
  say "2. Copie des fichiers (photos, médias)"
  F="$WORK/files"; mkdir -p "$F"
  REF="${SUPABASE_REF:?}"
  EXPECTED=$(psql "$DB_URL" -X -q -At -c "select count(*) from storage.objects")
  for b in $(psql "$DB_URL" -X -q -At -c "select id from storage.buckets order by id"); do
    AWS_ACCESS_KEY_ID="$SUPABASE_S3_KEY_ID" AWS_SECRET_ACCESS_KEY="$SUPABASE_S3_SECRET" \
      aws s3 sync "s3://$b" "$F/$b" --endpoint-url "https://$REF.storage.supabase.co/storage/v1/s3" --region "${SUPABASE_REGION:-eu-west-1}" --only-show-errors
  done
  FILES=$(find "$F" -type f | wc -l)
  say "   $FILES fichiers (attendus : $EXPECTED)"
  [ "$FILES" -ge "$EXPECTED" ] || fail "Fichiers manquants : $FILES sur $EXPECTED"
  tar -C "$F" -cf - . | age -r "$RECIPIENT" -o "$WORK/$FILES_ARCHIVE"
  rm -rf "$F"
  FILES_BYTES=$(stat -c %s "$WORK/$FILES_ARCHIVE")
  say "   archive chiffrée : $((FILES_BYTES / 1024 / 1024)) Mo"
fi

# --- 3. Envoi + 4. rotation ------------------------------------------------------
B2_REGION="$(printf '%s' "${B2_ENDPOINT:-}" | sed -nE 's#.*s3\.([^.]+)\.backblazeb2.*#\1#p')"
b2() { AWS_DEFAULT_REGION="${B2_REGION:-us-east-1}" AWS_ACCESS_KEY_ID="$B2_KEY_ID" AWS_SECRET_ACCESS_KEY="$B2_APP_KEY" aws s3 "$@" --endpoint-url "$B2_ENDPOINT" --only-show-errors; }
keep_newest() { # dossier, préfixe, nombre à garder
  b2 ls "s3://$B2_BUCKET/$1/" | awk '{print $4}' | grep "^$2" | sort -r | tail -n +$(( $3 + 1 )) | while read -r old; do
    b2 rm "s3://$B2_BUCKET/$1/$old"; echo "   supprimée (rotation) : $1/$old"; done
}
if [ "$MODE" = "essai" ]; then
  say "3. (essai) pas d'envoi : on « retélécharge » la copie locale"
  cp "$WORK/$DB_ARCHIVE" "$WORK/back.age"
else
  say "3. Envoi sur le stockage privé"
  b2 cp "$WORK/$DB_ARCHIVE" "s3://$B2_BUCKET/daily/$DB_ARCHIVE"
  if [ "$DOW" = "7" ]; then b2 cp "$WORK/$DB_ARCHIVE" "s3://$B2_BUCKET/weekly/$DB_ARCHIVE"; fi
  [ -f "$WORK/$FILES_ARCHIVE" ] && b2 cp "$WORK/$FILES_ARCHIVE" "s3://$B2_BUCKET/weekly/$FILES_ARCHIVE"
  say "4. Rotation : 7 jours + 8 semaines"
  keep_newest daily db- 7
  keep_newest weekly db- 8
  keep_newest weekly files- 8
  # Le test part de ce qui est VRAIMENT sur le stockage.
  b2 cp "s3://$B2_BUCKET/daily/$DB_ARCHIVE" "$WORK/back.age"
fi

# --- 5. Test de restauration -------------------------------------------------------
say "5. Test de restauration dans une base vide"
R="$WORK/restore"; mkdir -p "$R"
age -d -i "$KEYFILE" "$WORK/back.age" | tar -C "$R" -xzf -
stop_local; rm -rf "$WORK/local"; start_local
restore_into "$LOCAL_DB" "$R"
count_rows "$LOCAL_DB" > "$R/counts_restored.tsv"
# Écart toléré : quelques lignes écrites entre la copie et le comptage.
DIFF=$(join -t $'\t' -a1 -e MISSING -o 0,1.2,2.2 <(sort "$R/counts.tsv") <(sort "$R/counts_restored.tsv") \
  | awk -F'\t' '$3=="MISSING" || ($2-$3 > 5 && ($2-$3)/($2+1) > 0.01) || $3-$2 > 5 {print $1" : "$2" → "$3}')
RESTORED_ROWS=$(awk -F'\t' '{s+=$2} END {print s+0}' "$R/counts_restored.tsv")
if [ "$MODE" = "essai" ]; then
  [ "$(psql "$LOCAL_DB" -X -At -c 'select count(*) from public.essai_posts')" = 250 ] || fail "essai : lignes manquantes"
fi
rm -rf "$R"
stop_local
if [ -n "$DIFF" ]; then echo "$DIFF"; RESTORE_OK=false; else RESTORE_OK=true; fi
say "   restauré : $RESTORED_ROWS lignes sur $ROWS — $([ "$RESTORE_OK" = true ] && echo 'OK' || echo 'ÉCARTS')"

# --- 6. Témoin (page Admin) ----------------------------------------------------------
if [ "$MODE" != "essai" ]; then
  KIND=$([ -n "$FILES" ] && echo 'db+files' || echo 'db')
  psql "$DB_URL" -X -q -c "insert into public.backup_runs(kind, ok, restore_ok, db_bytes, files_bytes, tables, rows_total, files, message)
    values ('$KIND', true, $RESTORE_OK, $DB_BYTES, ${FILES_BYTES:-null}, $TABLES, $ROWS, ${FILES:-null}, 'durée $(( $(date +%s) - START_TS )) s')" || true
fi
[ "$RESTORE_OK" = true ] || fail "La restauration ne retrouve pas toutes les lignes"
say "Terminé en $(( $(date +%s) - START_TS )) s"
