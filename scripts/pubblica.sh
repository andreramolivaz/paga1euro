#!/usr/bin/env bash
# Costruisce il sito in _site/, aggiorna il numero e lo pubblica sul branch gh-pages,
# ma solo se qualcosa è cambiato rispetto a quello che è già online.
set -euo pipefail
cd "$(dirname "$0")/.."

git fetch --quiet --depth=1 origin +refs/heads/gh-pages:refs/remotes/origin/gh-pages 2>/dev/null || true

rm -rf _site
mkdir _site
cp -R index.html favicon.svg apple-touch-icon.png og.png fonts _site/
touch _site/.nojekyll
node scripts/conta.mjs _site/count.json

# Un indice a parte, così il checkout di main resta intatto.
GIT_INDEX_FILE="$(mktemp -d)/index"
export GIT_INDEX_FILE
git --work-tree=_site add --all
albero=$(git write-tree)
online=$(git rev-parse --quiet --verify 'refs/remotes/origin/gh-pages^{tree}' || true)

if [ "$albero" = "$online" ]; then
  echo "Online è già tutto aggiornato."
  exit 0
fi

persone=$(node -p 'require("./_site/count.json").persone')
commit=$(git commit-tree "$albero" -m "Pubblica il sito ($persone)")
git push --quiet --force origin "$commit:refs/heads/gh-pages"
echo "Pubblicato. Persone che hanno pagato: $persone."
