#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
hermes_root="${HERMES_HOME:-/opt/data}"
skills_root="${hermes_root}/skills"

mkdir -p "${skills_root}"

for skill in news_help news_run_daily news_status news_latest news_weekly news_retry_weekly news_search news_coverage news_sources news_edit news_delist raisesea-news-intelligence; do
  source_dir="${repo_root}/hermes/skills/${skill}"
  target_dir="${skills_root}/${skill}"
  mkdir -p "${target_dir}"
  cp "${source_dir}/SKILL.md" "${target_dir}/SKILL.md"
done

# Remove the retired command name so Telegram and new sessions expose only
# /news_run_daily.
rm -rf "${skills_root}/news_daily"

echo "Installed RaiseSEA news skills in ${skills_root}. Start a new Telegram session to load them."
echo "Merge hermes/telegram-command-menu.yaml.example into ${hermes_root}/config.yaml, then restart the Hermes gateway once."
