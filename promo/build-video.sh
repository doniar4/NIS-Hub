#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node promo/render.mjs "${1:?Pass promo/assets/<run>/manifest.json}"

