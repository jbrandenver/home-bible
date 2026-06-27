#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR" || exit 1

PASS_COUNT=0
WARNING_COUNT=0
FAIL_COUNT=0

SCAN_TARGETS=(apps packages supabase .github package.json README.md)
RG_EXCLUDES=(
  --glob '!**/.git/**'
  --glob '!**/.env'
  --glob '!**/.env.local'
  --glob '!**/.env.*.local'
  --glob '!**/node_modules/**'
  --glob '!**/.next/**'
  --glob '!**/dist/**'
  --glob '!**/build/**'
)

section() {
  printf '\n== %s ==\n' "$1"
}

status_line() {
  local status="$1"
  local message="$2"

  case "$status" in
    PASS) PASS_COUNT=$((PASS_COUNT + 1)) ;;
    WARNING) WARNING_COUNT=$((WARNING_COUNT + 1)) ;;
    FAIL) FAIL_COUNT=$((FAIL_COUNT + 1)) ;;
  esac

  printf '%s: %s\n' "$status" "$message"
}

print_line_refs() {
  awk -F: 'NF >= 2 { print "  " $1 ":" $2 }' | sort -u
}

print_matches() {
  local status="$1"
  local label="$2"
  local pattern="$3"
  shift 3
  local targets=("$@")

  section "$label"

  if ! command -v rg >/dev/null 2>&1; then
    status_line WARNING "ripgrep is not installed; skipped $label."
    return
  fi

  local matches
  matches="$(rg -n --no-heading --hidden -i "$pattern" "${targets[@]}" "${RG_EXCLUDES[@]}" 2>/dev/null || true)"

  if [ -n "$matches" ]; then
    status_line "$status" "Review matching file/line references. Matching text is intentionally hidden."
    printf '%s\n' "$matches" | print_line_refs
  else
    status_line PASS "No matches found."
  fi
}

print_command_output() {
  local command_label="$1"
  shift

  printf '%s\n' "$command_label"
  "$@" 2>/dev/null | sed 's/^/  /'
}

section "Current Git Branch"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  current_branch="$(git branch --show-current 2>/dev/null || true)"
  if [ -n "$current_branch" ]; then
    status_line PASS "Current branch: $current_branch"
  else
    status_line WARNING "Detached HEAD or no current branch detected."
  fi
else
  status_line FAIL "Not inside a Git worktree."
fi

section "Git Status"
if git diff --quiet 2>/dev/null && git diff --cached --quiet 2>/dev/null; then
  untracked_count="$(git ls-files --others --exclude-standard | wc -l | tr -d ' ')"
  if [ "$untracked_count" = "0" ]; then
    status_line PASS "Working tree is clean."
  else
    status_line WARNING "Untracked files are present."
    git ls-files --others --exclude-standard | sed 's/^/  /'
  fi
else
  status_line WARNING "Tracked changes are present."
  git status --short | sed 's/^/  /'
fi

section "Tracked Env Files"
tracked_env="$(git ls-files | grep -E '(^|/)\.env($|\.|/)' || true)"
tracked_non_example_env="$(printf '%s\n' "$tracked_env" | grep -Ev '(^|/)\.env\.example$' || true)"
if [ -n "$tracked_non_example_env" ]; then
  status_line FAIL "Tracked non-example env files found."
  printf '%s\n' "$tracked_non_example_env" | sed 's/^/  /'
elif [ -n "$tracked_env" ]; then
  status_line PASS "Only example env files are tracked."
  printf '%s\n' "$tracked_env" | sed 's/^/  /'
else
  status_line PASS "No env files are tracked."
fi

section "Local Branches"
print_command_output "Local branches:" git branch --format='%(refname:short)'
status_line PASS "Listed local branches from local Git metadata."

section "Remote Branches"
print_command_output "Remote branches:" git branch -r --format='%(refname:short)'
status_line PASS "Listed remote-tracking branches from local Git metadata. Run git fetch --prune manually before final cleanup decisions."

section "Stale Merged Branches"
merged_local="$(git branch --merged main --format='%(refname:short)' 2>/dev/null | grep -Ev '^(main|\*)$' || true)"
merged_remote="$(git branch -r --merged origin/main --format='%(refname:short)' 2>/dev/null | grep -Ev '^(origin/main|origin/HEAD)$' || true)"
if [ -n "$merged_local$merged_remote" ]; then
  status_line WARNING "Merged branches found. Review before deleting anything."
  if [ -n "$merged_local" ]; then
    printf '  Local merged branches:\n'
    printf '%s\n' "$merged_local" | sed 's/^/    /'
  fi
  if [ -n "$merged_remote" ]; then
    printf '  Remote merged branches:\n'
    printf '%s\n' "$merged_remote" | sed 's/^/    /'
  fi
else
  status_line PASS "No stale merged branches found from local metadata."
fi

section "Supabase Local Branch And Temp Folders"
if [ -d supabase/.branches ]; then
  status_line WARNING "supabase/.branches exists locally. Review for stale preview branch metadata; this script will not delete it."
else
  status_line PASS "supabase/.branches is not present."
fi
if [ -d supabase/.temp ]; then
  status_line WARNING "supabase/.temp exists locally as CLI cache. It is ignored; review only if troubleshooting."
else
  status_line PASS "supabase/.temp is not present."
fi

section "Edge Function Folder Presence"
if [ -d supabase/functions ]; then
  function_files="$(find supabase/functions -mindepth 1 -type f ! -name 'README.md' 2>/dev/null || true)"
  function_dirs="$(find supabase/functions -mindepth 1 -type d 2>/dev/null || true)"
  if [ -n "$function_files$function_dirs" ]; then
    status_line WARNING "Supabase functions folder contains implementation files or directories."
    printf '%s\n%s\n' "$function_dirs" "$function_files" | sed '/^$/d; s/^/  /'
  else
    status_line PASS "Only the functions README is present."
  fi
else
  status_line PASS "No Supabase functions folder found."
fi

print_matches WARNING "Scheduled Job Or Cron References" 'pg_cron|cron|scheduled job|scheduled_job|create extension[[:space:]]+.*cron|net\.http|schedule\(' "${SCAN_TARGETS[@]}"
print_matches WARNING "Realtime, Channel, Or Subscription References" 'supabase\.channel|\.channel\(|\.subscribe\(|realtime|broadcast|presence' "${SCAN_TARGETS[@]}"
print_matches WARNING "Vector Or Embedding References" 'pgvector|vector search|embedding|embeddings|embed\(' "${SCAN_TARGETS[@]}"
print_matches WARNING "AI Or OCR References" 'openai|artificial intelligence|ai parse|ai_import|future_ai_parse|ocr|future_ocr_parse|receipt parse|parse receipt' "${SCAN_TARGETS[@]}"
print_matches WARNING "Storage Bucket References" 'storage\.buckets|bucket_name|bucket_id|home-documents|storage\.from|create bucket|bucket' "${SCAN_TARGETS[@]}"
print_matches FAIL "Public Bucket Or Public File URL References" 'public[[:space:]]*=[[:space:]]*true|getPublicUrl|publicUrl|public_url|createPublicUrl' "${SCAN_TARGETS[@]}"
print_matches WARNING "File Size Limit References" 'file_size_limit|MAX_.*FILE_SIZE|upload limit|[0-9]+[[:space:]]*(MB|MiB|KB|KiB)' "${SCAN_TARGETS[@]}"
print_matches FAIL "Service Role References" 'service_role|SUPABASE_SERVICE_ROLE|sb_secret' "${SCAN_TARGETS[@]}"
print_matches WARNING "Forbidden Sensitive Field Strings" 'access code|lock code|garage code|safe code|alarm code|wi-fi password|wifi password|hidden key|door code|keypad code|access_code|lock_code|garage_code|safe_code|alarm_code|wifi_password|hidden_key|door_code|keypad_code' "${SCAN_TARGETS[@]}"
print_matches WARNING "Migrations Creating Buckets" 'insert into storage\.buckets|storage\.buckets|create bucket' supabase/migrations
print_matches WARNING "Migrations Creating Cron, Jobs, Or Cost-Sensitive Extensions" 'pg_cron|cron|create extension[[:space:]]+.*cron|create extension[[:space:]]+.*pg_net|create extension[[:space:]]+.*vector|schedule\(|net\.http|job' supabase/migrations

section "Migrations Creating Tables Without RLS"
if ! command -v rg >/dev/null 2>&1; then
  status_line WARNING "ripgrep is not installed; skipped migration RLS pairing check."
else
  create_table_matches="$(rg -n --no-heading -i 'create table( if not exists)? public\.[a-z_][a-z0-9_]*' supabase/migrations 2>/dev/null || true)"
  missing_rls=""

  if [ -n "$create_table_matches" ]; then
    while IFS=: read -r file line text; do
      table_name="$(printf '%s\n' "$text" | sed -E 's/.*public\.([a-z_][a-z0-9_]*).*/\1/I')"
      if [ -n "$table_name" ] && ! rg -q -i "alter table public\\.$table_name enable row level security" supabase/migrations; then
        missing_rls="${missing_rls}${file}:${line} public.${table_name}"$'\n'
      fi
    done <<EOF
$create_table_matches
EOF
  fi

  if [ -n "$missing_rls" ]; then
    status_line FAIL "Public table creation found without matching RLS enable statement in migrations."
    printf '%s' "$missing_rls" | sed 's/^/  /'
  else
    status_line PASS "Every detected public table creation has a matching RLS enable statement in migrations."
  fi
fi

section "Manual Supabase Dashboard Review"
printf '%s\n' \
  "WARNING: Manual review required for hosted resources this local script cannot safely query." \
  "  - Confirm no stale Supabase preview branches." \
  "  - Confirm no unused Edge Functions are deployed." \
  "  - Confirm no public buckets exist." \
  "  - Confirm storage usage is expected." \
  "  - Confirm auth test users are still needed." \
  "  - Confirm no scheduled jobs, cron jobs, or background workers are enabled." \
  "  - Confirm no Realtime, AI, OCR, vector, email, SMS, analytics, or monitoring usage was added without approval."
WARNING_COUNT=$((WARNING_COUNT + 1))

section "Summary"
printf 'PASS: %s\n' "$PASS_COUNT"
printf 'WARNING: %s\n' "$WARNING_COUNT"
printf 'FAIL: %s\n' "$FAIL_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
  printf '\nFAIL: Review failed checks before committing.\n'
  exit 1
fi

printf '\nPASS: No blocking local security or cost hygiene failures found. Review warnings manually.\n'
