#!/usr/bin/env bash
# OpenReply — günlük otomatik yedekleme
# Postgres (pg_dump) + Redis (RDB kopyası), 7 gün rotasyon
set -euo pipefail

APP_DIR=/home/ubuntu/openreply
BACKUP_DIR=/home/ubuntu/backups
KEEP_DAYS=7
STAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# .env'den DB bağlantısını yükle (parolayı script'e gömme)
set -a
# shellcheck disable=SC1091
source "$APP_DIR/.env"
set +a

# --- 1. Postgres dump (tek DB: openreply) ---
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump "$DATABASE_URL" --no-owner --format=custom \
    --file="$BACKUP_DIR/postgres_${STAMP}.dump" 2>"$BACKUP_DIR/postgres_${STAMP}.err" \
  && gzip -f "$BACKUP_DIR/postgres_${STAMP}.dump" \
  && echo "OK postgres $STAMP ($(du -h "$BACKUP_DIR/postgres_${STAMP}.dump.gz" | cut -f1))"
else
  echo "UYARI: pg_dump bulunamadı — Postgres yedeği alınamadı"
fi

# --- 2. Redis RDB (redis-cli --rdb ile indir — /var/lib/redis izin sorunu yok) ---
# REDIS_URL=redis://:PAROLA@host:port formatından parolayı çıkar
REDIS_PASS=$(printf '%s' "$REDIS_URL" | sed -E 's#redis://:([^@]+)@.*#\1#')
if [ -n "$REDIS_PASS" ] && [ "$REDIS_PASS" != "$REDIS_URL" ]; then
  if redis-cli -a "$REDIS_PASS" --rdb "$BACKUP_DIR/redis_${STAMP}.rdb" >/dev/null 2>&1; then
    echo "OK redis $STAMP ($(du -h "$BACKUP_DIR/redis_${STAMP}.rdb" | cut -f1))"
  else
    echo "UYARI: Redis --rdb indirme başarısız"
  fi
else
  echo "UYARI: REDIS_URL'den parola çıkarılamadı"
fi

# --- 3. Rotasyon: 7 günden eski yedekleri sil ---
find "$BACKUP_DIR" -type f \( -name "postgres_*.dump.gz" -o -name "redis_*.rdb" \) -mtime +"$KEEP_DAYS" -delete

# --- 4. Sonuç özeti ---
echo "=== Backup durumu ($(date -u) ) ==="
ls -lh "$BACKUP_DIR" | tail -n +2
