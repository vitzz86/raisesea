#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
hermes_root="${HERMES_HOME:-/opt/data}"
knowledge_root="${RAISESEA_KNOWLEDGE_DIR:-${hermes_root}/raisesea-knowledge}"

mkdir -p "${knowledge_root}/canonical" "${knowledge_root}/inbox" "${knowledge_root}/archive"
cp -R "${repo_root}/knowledge/." "${knowledge_root}/canonical/"

install_skill() {
  local profile_root="$1"
  local skill="$2"
  local source_dir="${repo_root}/hermes/skills/${skill}"
  local target_dir="${profile_root}/skills/${skill}"
  mkdir -p "${target_dir}"
  cp "${source_dir}/SKILL.md" "${target_dir}/SKILL.md"
}

install_profile() {
  local profile="$1"
  shift
  local profile_root="${hermes_root}/profiles/${profile}"
  if [[ ! -d "${profile_root}" ]]; then
    printf 'SKIP %s: create the profile in Hermes first.\n' "${profile}"
    return
  fi

  if [[ ! -f "${profile_root}/SOUL.md" || "${FORCE_PROFILE_PROMPTS:-0}" == "1" ]]; then
    cp "${repo_root}/hermes/profiles/${profile}/SOUL.md" "${profile_root}/SOUL.md"
  else
    printf 'KEEP %s/SOUL.md (set FORCE_PROFILE_PROMPTS=1 to replace).\n' "${profile}"
  fi

  install_skill "${profile_root}" raisesea_knowledge
  install_skill "${profile_root}" raisesea_handoff
  for skill in "$@"; do
    install_skill "${profile_root}" "${skill}"
  done
  printf 'READY %s\n' "${profile}"
}

install_profile raisesea-news-intelligence
install_profile raisesea-social-media-manager content_draft content_plan
install_profile raisesea-software-engineer engineering_plan engineering_status
install_profile raisesea-chief-of-staff idea_save task_add team_status

printf 'Knowledge installed at %s\n' "${knowledge_root}"
printf 'Start a new session for each profile so Hermes reloads its skills.\n'
printf 'Configure a unique Telegram bot token per profile before enabling its channel.\n'
