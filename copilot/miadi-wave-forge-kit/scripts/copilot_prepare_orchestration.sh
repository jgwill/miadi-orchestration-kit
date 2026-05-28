#!/usr/bin/env bash
# Source this file to get the copilot_prepare_orchestration function:
#   source /path/to/scripts/copilot_prepare_orchestration.sh
#
# Usage:
#   copilot_prepare_orchestration "<desire>" [extra-dir ...]
#
# Example:
#   copilot_prepare_orchestration "refactor Ava Decomposer Studio and ava-langchainjs packages" \
#     /workspace/repos/avadisabelle/Ava-Decomposer-Studio \
#     /workspace/repos/avadisabelle/ava-langchainjs

_WAVE_FORGE_KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

copilot_prepare_orchestration() {
  local desire="${1:?'Usage: copilot_prepare_orchestration <desire> [extra-dir ...]'}"
  shift
  local -a raw_extra_dirs=("$@")

  # -- Preflight: require copilot binary ----------------------
  if ! command -v copilot &>/dev/null; then
    echo "[wave-forge] ERROR: 'copilot' binary not found in PATH. Install it first." >&2
    return 1
  fi

  local PLUGIN_DIR_FORGE="$_WAVE_FORGE_KIT_DIR"
  local PLUGIN_DIR_STCKIN="/workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit"
  local PLUGIN_DIR_ADVERSARIAL="/workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-adversarial-review-kit"
  local AWESOME_COPILOT="/workspace/repos/miadisabelle/mia-awesome-copilot"
  local MIADI_KIT="/workspace/repos/jgwill/miadi-orchestration-kit"

  # -- Preflight: verify required dirs exist ------------------
  local preflight_ok=true
  for _req in "$PLUGIN_DIR_FORGE" "$PLUGIN_DIR_STCKIN" "$PLUGIN_DIR_ADVERSARIAL" "$AWESOME_COPILOT" "$MIADI_KIT"; do
    if [[ ! -d "$_req" ]]; then
      echo "[wave-forge] ERROR: required directory not found: $_req" >&2
      preflight_ok=false
    fi
  done
  [[ "$preflight_ok" == true ]] || return 1

  # -- Normalize extra dirs to absolute paths -----------------
  local -a extra_dirs=()
  for _dir in "${raw_extra_dirs[@]}"; do
    local _abs
    _abs="$(cd "$_dir" 2>/dev/null && pwd)" || {
      echo "[wave-forge] WARNING: directory not found, skipping: $_dir" >&2
      continue
    }
    extra_dirs+=("$_abs")
  done

  # -- Default: add cwd only when no extra dirs were provided -
  if [[ ${#extra_dirs[@]} -eq 0 ]]; then
    echo "[wave-forge] No target directories provided — adding current working directory: $(pwd)" >&2
    extra_dirs=("$(pwd)")
  fi

  # -- Build command array ------------------------------------
  local -a cmd=(
    copilot
    --model claude-sonnet-4.6
    --plugin-dir "$PLUGIN_DIR_FORGE"
    --plugin-dir "$PLUGIN_DIR_STCKIN"
    --plugin-dir "$PLUGIN_DIR_ADVERSARIAL"
    --add-dir "$AWESOME_COPILOT"
    --add-dir "$MIADI_KIT"
  )

  # Deduplicate and add extra dirs
  local -A _seen_dirs=()
  for _dir in "${extra_dirs[@]}"; do
    if [[ -z "${_seen_dirs[$_dir]+x}" ]]; then
      _seen_dirs[$_dir]=1
      cmd+=(--add-dir "$_dir")
    fi
  done

  # -- Derive script name from desire -------------------------
  local date_slug
  date_slug=$(date +%y%m%d)
  local desire_slug
  desire_slug=$(printf '%s' "$desire" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-' | cut -c1-40)
  local script_name="orchestration-${desire_slug}-${date_slug}.sh"

  # -- Build initial prompt -----------------------------------
  local dirs_display
  dirs_display=$(printf '%s\n' "${extra_dirs[@]}")

  local initial_prompt
  initial_prompt="## Wave Forge Session

**User desire**: ${desire}

**Extra directories to analyze**:
${dirs_display}

**Output script name**: ${script_name}

Use the following sequence:
1. Use the 'scan-and-plan' skill:
   - Invoke Orchestration Context Scanner on all target directories and plugin sources
   - Invoke Orchestration Wave Planner with the desire and scan report
2. Use the 'review-wave-plan' skill to validate the WavePlan (required before forging)
3. If the plan passes review (ADVANCE), use the 'forge-wave-script' skill to write the script
4. If the plan needs revision (REVISE), fix the named items then re-run review-wave-plan

The final script must be named '${script_name}' and saved in the current working directory ($(pwd)).
Report the full path and the first 50 lines when done."

  cmd+=(-p "$initial_prompt")

  # -- Launch -------------------------------------------------
  echo "[wave-forge] Launching orchestration preparation"
  echo "[wave-forge] Desire : $desire"
  echo "[wave-forge] Target dirs: ${extra_dirs[*]}"
  echo "[wave-forge] Script name: $script_name"
  echo ""
  "${cmd[@]}"
}

export -f copilot_prepare_orchestration
