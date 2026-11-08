#!/usr/bin/env bash
# Runs the whole study. Pass --mock to test the pipeline without API keys.
set -euo pipefail
cd "$(dirname "$0")"
MODE="${1:-}"
OUT=outputs; RES=results
[ "$MODE" = "--mock" ] && OUT=outputs-mock && RES=results-mock
mkdir -p "$RES"

node scripts/generate.js $MODE                         # landing pages, campaigns, persona chats
node scripts/images.js $MODE --concepts                # billboard render test + campaign hero images
node audit/rtl-audit.js "$OUT/landing" --out "$RES/rtl" > "$RES/rtl-log.txt"
node scripts/score-images.js $MODE                     # vision read-back of Arabic in images
node scripts/score-dialect.js $MODE --judge            # dialect markers + LLM judge
node scripts/score-concepts.js $MODE                   # EN-brief vs AR-brief campaigns, tropes
node scripts/rating-sheets.js $MODE                    # blinded sheets for native raters
node scripts/report.js $MODE
