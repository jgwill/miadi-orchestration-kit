#!/usr/bin/env bash
# Source this file to get the copilot_prepare_orchestration function:
#   source /path/to/scripts/copilot_prepare_orchestration.sh
#
# Usage:
#   copilot_prepare_orchestration "<desire>" [extra-dir ...]
#
# What it does:
#   1. Creates a PDE working folder: ./.pde/<yyMMddHHmm>--<uuid>/
#   2. Runs a fast bash scan of target dirs + all available kits/agents (no AI needed)
#   3. Writes scan-context.md and prompt.md into that folder
#   4. Launches ONE focused copilot session via @.pde/.../prompt.md
#      (direct forge mode — no background subagents, no skill chain)
#   5. The orchestration script is written by copilot into the PDE folder
#   6. Reports path on success; points to PDE folder for retry on failure

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
  if [[ ${#extra_dirs[@]} -eq 0 ]]; then
    echo "[wave-forge] No target dirs provided — using cwd: $(pwd)" >&2
    extra_dirs=("$(pwd)")
  fi

  # -- Derive names -------------------------------------------
  local date_slug
  date_slug=$(date +%y%m%d)
  local desire_slug
  desire_slug=$(printf '%s' "$desire" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-' | cut -c1-40)
  local script_name="orchestration-${desire_slug}-${date_slug}.sh"

  # -- Create PDE working folder: .pde/<yyMMddHHmm>--<uuid>/ --
  local ts
  ts=$(date +%y%m%d%H%M)
  local pde_uuid
  if command -v uuidgen &>/dev/null; then
    pde_uuid=$(uuidgen)
  elif command -v python3 &>/dev/null; then
    pde_uuid=$(python3 -c "import uuid; print(uuid.uuid4())")
  else
    pde_uuid="$(date +%s%N)"
  fi
  local pde_rel_dir=".pde/${ts}--${pde_uuid}"
  local PDE_DIR
  PDE_DIR="$(pwd)/${pde_rel_dir}"
  mkdir -p "$PDE_DIR"

  local script_path="${PDE_DIR}/${script_name}"

  echo "[wave-forge] PDE working folder : $PDE_DIR"
  echo "[wave-forge] Script target      : $script_path"

  # -- Fast bash scan (no AI, ~2 seconds) ---------------------
  echo "[wave-forge] Scanning directories..."
  {
    echo "# Orchestration Scan Context"
    echo "Generated: $(date)"
    echo "Desire: $desire"
    echo ""
    echo "---"
    echo ""
    echo "## Target Directories"
    for dir in "${extra_dirs[@]}"; do
      echo ""
      echo "### \`$dir\`"
      echo ""
      echo "**Top-level entries**:"
      ls -1 "$dir" 2>/dev/null | head -50 | sed 's/^/- /'
      if [[ -f "$dir/.github/copilot-instructions.md" ]]; then
        echo ""
        echo "**copilot-instructions.md**:"
        printf '```\n'; cat "$dir/.github/copilot-instructions.md"; printf '\n```\n'
      fi
      if [[ -f "$dir/AGENTS.md" ]]; then
        echo ""
        echo "**AGENTS.md**:"
        printf '```\n'; cat "$dir/AGENTS.md"; printf '\n```\n'
      fi
      if [[ -f "$dir/README.md" ]]; then
        echo ""
        echo "**README.md** (first 60 lines):"
        printf '```\n'; head -60 "$dir/README.md"; printf '\n```\n'
      fi
      if [[ -f "$dir/package.json" ]]; then
        echo ""
        echo "**package.json** (name/version/description):"
        printf '```\n'
        grep -E '"name"|"version"|"description"' "$dir/package.json" 2>/dev/null | head -8
        printf '```\n'
      fi
    done

    echo ""
    echo "---"
    echo ""
    echo "## Available Kits"
    echo "Kit root: \`${MIADI_KIT}/copilot/\`"
    local kits_dir="${MIADI_KIT}/copilot"
    for kit_dir in "$kits_dir"/*/; do
      [[ -d "$kit_dir" ]] || continue
      local kit_name
      kit_name=$(basename "$kit_dir")
      echo ""
      echo "### \`$kit_name\`"
      echo "**Plugin dir (use as --plugin-dir)**: \`${kit_dir%/}\`"
      local plugin_json="$kit_dir/.github/plugin/plugin.json"
      if [[ -f "$plugin_json" ]]; then
        local kit_ver kit_desc
        kit_ver=$(grep -m1 '"version"' "$plugin_json" | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
        kit_desc=$(grep -m1 '"description"' "$plugin_json" | sed 's/.*"description"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
        echo "Version: $kit_ver | $kit_desc"
      fi
      if [[ -d "$kit_dir/skills" ]]; then
        echo "**Skills**: $(ls "$kit_dir/skills/" 2>/dev/null | tr '\n' ' ')"
      fi
      if [[ -d "$kit_dir/agents" ]]; then
        echo "**Agents**:"
        for agent_f in "$kit_dir/agents/"*.md; do
          [[ -f "$agent_f" ]] || continue
          local a_name a_desc
          a_name=$(grep -m1 "^name:" "$agent_f" 2>/dev/null | sed 's/name:[[:space:]]*//')
          a_desc=$(grep -m1 "^description:" "$agent_f" 2>/dev/null | sed 's/description:[[:space:]]*//')
          printf '- **%s**: %s\n' "$a_name" "$a_desc"
        done
      fi
    done

    echo ""
    echo "---"
    echo ""
    echo "## Available Agents (mia-awesome-copilot)"
    local agents_dir="$AWESOME_COPILOT/agents"
    local total_agents
    total_agents=$(ls "$agents_dir/"*.md 2>/dev/null | wc -l | tr -d ' ')
    echo "Total: $total_agents agents | Source: \`$agents_dir\`"
    echo ""
    # Single awk pass over all files — extracts name + description from frontmatter
    awk '
      FNR == 1 {
        if (name != "") printf "- **%s**: %s\n", name, desc
        name = ""; desc = ""
      }
      /^name:[[:space:]]/ && name == "" {
        sub(/^name:[[:space:]]*/, ""); name = $0
      }
      /^description:[[:space:]]/ && desc == "" {
        sub(/^description:[[:space:]]*/, ""); desc = $0
      }
      END { if (name != "") printf "- **%s**: %s\n", name, desc }
    ' "$agents_dir/"*.md 2>/dev/null
  } > "${PDE_DIR}/scan-context.md"

  local scan_lines
  scan_lines=$(wc -l < "${PDE_DIR}/scan-context.md" | tr -d ' ')
  echo "[wave-forge] Scan context       : ${PDE_DIR}/scan-context.md ($scan_lines lines)"

  # -- Build prompt.md in PDE folder --------------------------
  {
    echo "# Wave Forge — Direct Mode"
    echo ""
    echo "> **IMPORTANT**: Work entirely inline."
    echo "> Do NOT invoke any skills (scan-and-plan, review-wave-plan, forge-wave-script)."
    echo "> Do NOT launch background subagents."
    echo "> Read the scan context below and write the script directly."
    echo ""
    echo "---"
    echo ""
    echo "## Mission"
    echo ""
    echo "**Desire**: ${desire}"
    echo ""
    echo "**Target directories**:"
    printf '- %s\n' "${extra_dirs[@]}"
    echo ""
    echo "**Your working folder**: \`${PDE_DIR}\`"
    echo ""
    echo "**Script to produce**: \`${script_path}\`"
    echo ""
    echo "---"
    echo ""
    echo "## Pre-built Scan Context"
    echo ""
    cat "${PDE_DIR}/scan-context.md"
    echo ""
    echo "---"
    echo ""
    echo "## Steps — Execute in Order"
    echo ""
    echo "### Step 1 — Plan (10-15 lines, no tool calls)"
    echo ""
    echo "From the desire and scan context above, decide inline:"
    echo "- Which kits to use as \`--plugin-dir\` (paths from the scan context)"
    echo "- Which mia-awesome-copilot agents to invoke in each phase"
    echo "- What phases make sense for this desire"
    echo "  (e.g. analysis / research / issue-creation / implementation / review / synthesis)"
    echo ""
    echo "### Step 2 — Write the orchestration script"
    echo ""
    echo "Use the \`create\` tool to write \`${script_path}\`."
    echo ""
    echo "The script MUST:"
    echo ""
    echo "1. Start with \`#!/usr/bin/env bash\` and \`set -euo pipefail\`"
    echo "2. Declare variables for every \`--plugin-dir\` and \`--add-dir\` path (absolute)"
    echo "3. Have a \`_check_preflight()\` function that:"
    echo "   - Verifies \`copilot\` is in PATH"
    echo "   - Verifies every plugin-dir and add-dir variable points to an existing directory"
    echo "   - Exits 1 if anything is missing"
    echo "4. Build the prompt using this EXACT heredoc form (unquoted delimiter):"
    echo '   ```bash'
    echo '   PROMPT=$(cat <<EOPROMPT'
    echo '   ... all phase instructions written literally here ...'
    echo '   EOPROMPT'
    echo '   )'
    echo '   ```'
    echo '   **NEVER use** `read -r -d '"'"''"'"' PROMPT << '"'"'EOF'"'"'` — it silently'
    echo '   exits non-zero with `set -e` and kills the script without any error message.'
    echo "5. End with the copilot invocation:"
    echo '   ```bash'
    echo '   copilot \'
    echo '     --model claude-sonnet-4.6 \'
    echo '     --plugin-dir "$PLUGIN_DIR_1" \'
    echo '     --add-dir "$ADD_DIR_1" \'
    echo '     -p "$PROMPT"'
    echo '   ```'
    echo "6. The PROMPT heredoc must be **self-contained and fully explicit**:"
    echo "   - Name every agent to invoke and in which phase"
    echo "   - State what each agent reads and what it produces"
    echo "   - Use only agent names found in the scan context above"
    echo "   - Do not use vague phrases like 'do the refactoring' — spell it out"
    echo ""
    echo "### Step 3 — Validate"
    echo ""
    echo "\`\`\`bash"
    echo "chmod +x ${script_path}"
    echo "bash -n ${script_path}"
    echo "\`\`\`"
    echo ""
    echo "### Step 4 — Report"
    echo ""
    echo "When done, output:"
    echo "- Full path: \`${script_path}\`"
    echo "- First 50 lines of the script"
  } > "${PDE_DIR}/prompt.md"

  local prompt_lines
  prompt_lines=$(wc -l < "${PDE_DIR}/prompt.md" | tr -d ' ')
  echo "[wave-forge] Prompt             : ${PDE_DIR}/prompt.md ($prompt_lines lines)"

  # -- Build copilot command ----------------------------------
  local -a cmd=(
    copilot
    --model claude-sonnet-4.6
    --plugin-dir "$PLUGIN_DIR_FORGE"
    --plugin-dir "$PLUGIN_DIR_STCKIN"
    --plugin-dir "$PLUGIN_DIR_ADVERSARIAL"
    --add-dir "$AWESOME_COPILOT"
    --add-dir "$MIADI_KIT"
    --add-dir "$PDE_DIR"
  )

  # Deduplicate and add extra dirs
  local -A _seen_dirs=()
  for _dir in "${extra_dirs[@]}"; do
    if [[ -z "${_seen_dirs[$_dir]+x}" ]]; then
      _seen_dirs[$_dir]=1
      cmd+=(--add-dir "$_dir")
    fi
  done

  # Pass prompt via @file reference (relative path from cwd — no cat, no shell escaping)
  cmd+=(-p "@${pde_rel_dir}/prompt.md")

  # -- Launch -------------------------------------------------
  echo ""
  echo "[wave-forge] Desire  : $desire"
  echo "[wave-forge] Targets : ${extra_dirs[*]}"
  echo "[wave-forge] Script  : $script_name"
  echo "[wave-forge] Launching copilot..."
  echo "────────────────────────────────────"
  "${cmd[@]}"

  # -- Post-session check -------------------------------------
  echo ""
  echo "────────────────────────────────────"
  if [[ -f "$script_path" ]]; then
    echo "[wave-forge] ✓ Script created: $script_path"
    ls -lh "$script_path"
  else
    echo "[wave-forge] ✗ Script NOT found at: $script_path" >&2
    echo "[wave-forge]   PDE folder preserved for retry: $PDE_DIR" >&2
    echo "[wave-forge]   To retry the forge step:" >&2
    echo "[wave-forge]     copilot --add-dir '${PDE_DIR}' -p '@${pde_rel_dir}/prompt.md'" >&2
  fi
}

export -f copilot_prepare_orchestration
