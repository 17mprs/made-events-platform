#!/usr/bin/env bash
# scripts/deploy-backend.sh — push + deploy del backend GAS di produzione con APP_VERSION aggiornata.
#
# Perché: la versione GAS (@N) esiste solo dopo `clasp deploy`. Questo script calcola N = ultima
# versione + 1, scrive backend/Version.js, fa push, deploya e VERIFICA che la versione creata sia N
# (se non lo è, segnala di correggere Version.js e rideployare). Chiede conferma prima di pushare.
#
# Uso:  scripts/deploy-backend.sh "descrizione deploy"
# Dopo: committare backend/Version.js.
set -euo pipefail

DEPLOYMENT_ID="AKfycbywK-f8EOav2gS7MKNlLRT38eVe9h4SH827Zv91kFp7l0A4LEg2s13IJXwvwNns_UKA-g"
EXPECTED_USER="madeeventssrls@gmail.com"
DESC="${1:-backend deploy}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/backend"

user="$(clasp show-authorized-user 2>&1 | head -1)"
case "$user" in *"$EXPECTED_USER"*) ;; *) echo "Account clasp errato: $user (atteso $EXPECTED_USER)" >&2; exit 1;; esac

if [ -n "$(git status --porcelain -- . | grep -v 'Version.js' || true)" ]; then
  echo "Working tree backend con modifiche non committate. Committa prima di deployare." >&2; exit 1
fi

last="$(clasp list-versions 2>&1 | grep -oE '^[0-9]+ -' | grep -oE '^[0-9]+' | sort -n | tail -1)"
[ -n "$last" ] || { echo "Impossibile leggere le versioni GAS." >&2; exit 1; }
next=$((last + 1))
sha="$(git rev-parse --short HEAD)"

cat > Version.js <<JS
// === VERSION.JS — scritto da scripts/deploy-backend.sh a ogni deploy ===
// Non modificare a mano: il valore è la versione GAS (@N) del deployment di produzione.
var APP_VERSION = '@${next}';
var APP_BUILD   = '${sha}';
JS

echo "Branch: $(git branch --show-current) @ $sha | ultima versione GAS: @$last -> nuova: @$next | rollback: clasp deploy -i $DEPLOYMENT_ID -V $last"
read -r -p "Procedo con push -f + deploy? [y/N] " ok
[ "$ok" = "y" ] || { git checkout -- Version.js; echo "Annullato."; exit 1; }

clasp push -f
out="$(clasp deploy -i "$DEPLOYMENT_ID" -d "$DESC" 2>&1)"; echo "$out"
case "$out" in
  *"@${next}"*) echo "OK: deployment alla versione @${next}. Ora committa backend/Version.js.";;
  *) echo "ATTENZIONE: la versione creata non è @${next}. Correggi backend/Version.js e rilancia." >&2; exit 2;;
esac
