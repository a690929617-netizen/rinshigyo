#!/bin/bash
# Downloads the Japanese fonts the EP36 lab uses (SIL Open Font License) into app/public/fonts/jp/.
set -e
cd "$(dirname "$0")/../app/public/fonts/jp"
base=https://raw.githubusercontent.com/google/fonts/main/ofl
get() { [ -f "$2" ] || curl -sSfL -o "$2" "$base/$1"; echo "ok $2"; }
get 'notosansjp/NotoSansJP%5Bwght%5D.ttf' NotoSansJP-VF.ttf
get zenoldmincho/ZenOldMincho-Regular.ttf ZenOldMincho-Regular.ttf
get zenoldmincho/ZenOldMincho-Bold.ttf ZenOldMincho-Bold.ttf
get bizudgothic/BIZUDGothic-Regular.ttf BIZUDGothic-Regular.ttf
get bizudgothic/BIZUDGothic-Bold.ttf BIZUDGothic-Bold.ttf
