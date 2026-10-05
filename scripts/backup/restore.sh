#!/usr/bin/env bash
# R10 — Restauration d'une sauvegarde dans un projet Supabase NEUF (lancée à la
# main par .github/workflows/restore.yml). Mode d'emploi : docs/restauration.md.
# Comme pour la sauvegarde : aucun secret ici, aucune donnée dans les journaux.
set -euo pipefail
umask 077
export LC_ALL=C
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
say() { echo "▶ $*"; }
fail() { echo "::error::$*"; exit 1; }

[ "${CONFIRM:-}" = "RESTAURER" ] || fail "Tape RESTAURER dans la case de confirmation"
for v in RESTORE_DB_URL RESTORE_REF BACKUP_AGE_KEY B2_KEY_ID B2_APP_KEY B2_BUCKET B2_ENDPOINT ARCHIVE; do
  [ -n "${!v:-}" ] || fail "Manquant : $v (voir docs/restauration.md)"
done
[ "${RESTORE_DB_URL}" != "${SUPABASE_DB_URL:-}" ] || fail "RESTORE_DB_URL pointe sur la base actuelle : la restauration se fait dans un projet NEUF"
# Garde-fou : la base cible doit être vide (aucune table dans public).
N=$(psql "$RESTORE_DB_URL" -X -q -At -c "select count(*) from information_schema.tables where table_schema='public'")
[ "$N" = 0 ] || fail "La base cible n'est pas vide ($N tables dans public) : on ne touche à rien"

printf '%s\n' "$BACKUP_AGE_KEY" > "$WORK/key.txt"
B2_REGION="$(printf '%s' "$B2_ENDPOINT" | sed -nE 's#.*s3\.([^.]+)\.backblazeb2.*#\1#p')"
b2() { AWS_DEFAULT_REGION="${B2_REGION:-us-east-1}" AWS_ACCESS_KEY_ID="$B2_KEY_ID" AWS_SECRET_ACCESS_KEY="$B2_APP_KEY" aws s3 "$@" --endpoint-url "$B2_ENDPOINT" --only-show-errors; }

say "1. Téléchargement + déchiffrement de $ARCHIVE"
b2 cp "s3://$B2_BUCKET/$ARCHIVE" "$WORK/a.age"
mkdir -p "$WORK/db"; age -d -i "$WORK/key.txt" "$WORK/a.age" | tar -C "$WORK/db" -xzf -
# L'adresse de l'ancien projet est écrite en dur à quelques endroits (appels des
# fonctions par la base, adresses des photos) : on la remplace par la nouvelle.
if [ -n "${OLD_REF:-}" ] && [ "$OLD_REF" != "$RESTORE_REF" ]; then
  sed -i "s/$OLD_REF/$RESTORE_REF/g" "$WORK/db/schema.sql" "$WORK/db/data.sql" "$WORK/db/cron_jobs.sql"
  echo "   adresse du projet remplacée ($(grep -c "$RESTORE_REF" "$WORK/db/data.sql") lignes de données concernées)"
fi

say "2. Base : rôles, structure, données"
psql "$RESTORE_DB_URL" -X -q -f "$WORK/db/roles.sql" >/dev/null 2>"$WORK/roles.err" || true
psql "$RESTORE_DB_URL" -X -q --single-transaction -v ON_ERROR_STOP=1 \
  -f "$WORK/db/schema.sql" -c 'SET session_replication_role = replica' -f "$WORK/db/data.sql" >/dev/null
say "3. Tâches planifiées + secrets du coffre"
psql "$RESTORE_DB_URL" -X -q -f "$WORK/db/cron_jobs.sql" >/dev/null 2>&1 || echo "   (tâches planifiées : à vérifier, voir la doc)"
psql "$RESTORE_DB_URL" -X -q -f "$WORK/db/vault_secrets.sql" >/dev/null 2>&1 || echo "   (secrets du coffre : à vérifier, voir la doc)"

say "4. Comptage"
psql "$RESTORE_DB_URL" -X -q -At -F $'\t' -c "select table_schema||'.'||table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text from information_schema.tables where table_type='BASE TABLE' and table_schema in ('public','auth','storage') and table_name not in ('backup_runs','schema_migrations','migrations','buckets_vectors','vector_indexes','s3_multipart_uploads','s3_multipart_uploads_parts','buckets_analytics') order by 1" > "$WORK/after.tsv"
DIFF=$(join -t $'\t' -a1 -e MISSING -o 0,1.2,2.2 <(sort "$WORK/db/counts.tsv") <(sort "$WORK/after.tsv") | awk -F'\t' '$2!=$3 {print $1" : "$2" → "$3}')
say "   $(awk -F'\t' '{s+=$2} END {print s+0}' "$WORK/after.tsv") lignes restaurées sur $(awk -F'\t' '{s+=$2} END {print s+0}' "$WORK/db/counts.tsv")"
[ -z "$DIFF" ] || { echo "$DIFF"; fail "Écarts de lignes"; }

if [ -n "${FILES_ARCHIVE:-}" ]; then
  [ -n "${RESTORE_REF:-}" ] && [ -n "${RESTORE_S3_KEY_ID:-}" ] && [ -n "${RESTORE_S3_SECRET:-}" ] || fail "Fichiers : RESTORE_REF / RESTORE_S3_KEY_ID / RESTORE_S3_SECRET manquants"
  say "5. Fichiers : $FILES_ARCHIVE"
  b2 cp "s3://$B2_BUCKET/$FILES_ARCHIVE" "$WORK/f.age"
  mkdir -p "$WORK/files"; age -d -i "$WORK/key.txt" "$WORK/f.age" | tar -C "$WORK/files" -xf -
  for b in "$WORK"/files/*/; do
    b="$(basename "$b")"
    AWS_ACCESS_KEY_ID="$RESTORE_S3_KEY_ID" AWS_SECRET_ACCESS_KEY="$RESTORE_S3_SECRET" \
      aws s3 sync "$WORK/files/$b" "s3://$b" --endpoint-url "https://$RESTORE_REF.storage.supabase.co/storage/v1/s3" --region "${RESTORE_REGION:-eu-west-1}" --only-show-errors
    echo "   $b : $(find "$WORK/files/$b" -type f | wc -l) fichiers"
  done
fi
say "Restauration terminée. Suite (Vercel, fonctions, secrets) : docs/restauration.md"
