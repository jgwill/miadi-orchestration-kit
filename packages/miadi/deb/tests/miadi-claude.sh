#!/usr/bin/env bash
# miadi-claude setup and status against a fake claude in disposable homes.
#   bash tests/miadi-claude.sh                         every branch, with a fake claude
#   REAL=1 KIT=<checkout> bash tests/miadi-claude.sh   also the real claude CLI, in a disposable
#                                                      home with the checkout as its marketplace.
#                                                      No sign-in and no model call.
set -uo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
tool=$here/miadi-claude/usr/bin/miadi-claude
python=$(command -v python3)
work=$(mktemp -d)
trap 'chmod -R u+rwx "$work"; rm -rf "$work"' EXIT
failures=0 checks=0
ok() { checks=$((checks + 1)); echo "ok    $1"; }
no() { checks=$((checks + 1)); failures=$((failures + 1)); echo "FAIL  $1"; }
expect() { if eval "$2"; then ok "$1"; else no "$1"; fi; }

mkdir "$work/bin"
cat > "$work/bin/claude" <<'E'
#!/usr/bin/env bash
# State lives in $FAKE: markets.json, plugins.json, and files that change how it behaves.
echo "$*" >> "$FAKE/calls"
if [ -e "$FAKE/old" ]; then
  case "$*" in
    "plugin list --json") echo "error: unknown command 'list'" >&2; exit 1 ;;
    "install stable") rm "$FAKE/old"; exit 0 ;;
  esac
fi
case "$*" in
  --version) echo "2.1.319 (Claude Code)" ;;
  "plugin list --json")
    # As the real CLI does, enabled is what settings.json says for a plugin it installed.
    if [ -e "$FAKE/installed" ]; then
      python3 - "$FAKE/plugins.json" "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json" <<'P'
import json, sys
rows = json.load(open(sys.argv[1]))
on = json.load(open(sys.argv[2])).get("enabledPlugins", {})
for r in rows: r["enabled"] = on.get(r["id"], False)
print(json.dumps(rows))
P
    else cat "$FAKE/plugins.json"; fi ;;
  "plugin marketplace list --json") cat "$FAKE/markets.json" ;;
  "plugin marketplace add "*)
    echo '[{"name":"miadi-orchestration-kit","source":"github","repo":"jgwill/miadi-orchestration-kit"}]' > "$FAKE/markets.json" ;;
  "plugin marketplace update "*) ;;
  "plugin install "*)
    [ ! -e "$FAKE/install-fails" ] || exit 1
    mkdir -p "$FAKE/plugin/hooks/claude_hooks"; echo '{}' > "$FAKE/plugin/hooks/hooks.json"
    cat > "$FAKE/plugin/hooks/claude_hooks/notification_hook.sh" <<'H'
[ ! -e "$FAKE/hook-fails" ] || exit 3
input=$(cat -); mkdir -p "$CLAUDE_SESSIONDATA_ROOT/miadi-claude-probe"
printf '%s\n' "$input" > "$CLAUDE_SESSIONDATA_ROOT/miadi-claude-probe/_claude_Notification.jsonl"
H
    printf '[{"id":"miadi-session-observability@miadi-orchestration-kit","enabled":true,"scope":"user","version":"0.1.40","installPath":"%s/plugin"}]\n' "$FAKE" > "$FAKE/plugins.json"
    touch "$FAKE/installed"
    # As the real CLI does, installing writes the plugin's entry into settings.json.
    python3 - "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json" <<'P'
import json, os, sys
path = os.path.realpath(sys.argv[1])
d = json.load(open(path)) if os.path.exists(path) else {}
d.setdefault("enabledPlugins", {})["miadi-session-observability@miadi-orchestration-kit"] = True
mode = os.stat(path).st_mode & 0o7777 if os.path.exists(path) else 0o600
json.dump(d, open(path, "w"), indent=2); os.chmod(path, mode)
P
    ;;
  *) echo "fake claude: $*" >&2; exit 64 ;;
esac
E
chmod +x "$work/bin/claude"

# fresh <name>: a disposable account with no settings, no marketplace, no plugin.
fresh() {
  acct=$work/$1; mkdir -p "$acct/home/.claude" "$acct/fake"
  echo '[]' > "$acct/fake/plugins.json"; echo '[]' > "$acct/fake/markets.json"
  settings=$acct/home/.claude/settings.json
}
tool_as_acct() {
  env -u CLAUDE_CONFIG_DIR -u CLAUDE_SESSIONDATA_ROOT -u MIADI_SESSION_DIR -u SESSION_DATA_ROOT \
    -u MIADI_ORCHESTRATION_KIT_ROOT -u MIADI_TEAMS_FILE \
    HOME="$acct/home" FAKE="$acct/fake" PATH="${path_override:-$work/bin:$PATH}" \
    MIADI_SESSIONDATA_ROOT="${capture_override:-$acct/capture}" \
    "$python" "$tool" "$@" > "$acct/out" 2>&1
}
wired() { # the 14 retired hooks across their events, and whatever JSON follows as extra keys
  python3 - "$settings" <<'E'
import json, sys
names = {"Stop":["stop"],"UserPromptSubmit":["user_prompt_submit","corrective_feedback","accepted_redirection"],
 "SessionStart":["session_start"],"PreToolUse":["pre_tool_use"],"PostToolUse":["post_tool_use"],"Notification":["notification"],
 "SubagentStop":["subagent_stop"],"PreCompact":["pre_compact"],"SessionEnd":["session_end"],
 "PermissionRequest":["permission_request"],"PostToolUseFailure":["post_tool_use_failure"],"SubagentStart":["subagent_start"]}
hooks = {e:[{"hooks":[{"type":"command","command":f"bash /src/scripts/claude_hooks/{n}_hook.sh"} for n in ns]}] for e,ns in names.items()}
json.dump({"model":"opus","hooks":hooks,"enabledPlugins":{"x@y":True}}, open(sys.argv[1],"w"), indent=2)
E
  chmod 600 "$settings"
}
py() { python3 -c "import json,sys; d=json.load(open('$settings')); sys.exit(0 if ($1) else 1)"; }

# A1 a new account
fresh a1; tool_as_acct status; expect "status: a new account is not ready, exit 1" '[ $? -eq 1 ]'
expect "status: changes nothing" '[ ! -e "$acct/fake/calls" ] || ! grep -qE "add|install" "$acct/fake/calls"'
tool_as_acct setup; rc=$?
expect "setup: a new account succeeds" '[ $rc -eq 0 ]'
expect "setup: adds the marketplace from the kit" 'grep -q "marketplace add jgwill/miadi-orchestration-kit" "$acct/fake/calls"'
expect "setup: installs for the user" 'grep -q "plugin install miadi-session-observability@miadi-orchestration-kit --scope user" "$acct/fake/calls"'
expect "setup: creates the capture folder" '[ -d "$acct/capture" ]'
expect "setup: makes no backup when it removed nothing" '[ ! -e "$settings.bak-miadi-claude" ]'
expect "setup: says to restart" 'grep -q "restart any Claude session" "$acct/out"'
tool_as_acct status; expect "status: ready after setup, exit 0" '[ $? -eq 0 ]'
expect "status: notes the missing teams file" 'grep -q "team unassigned" "$acct/out"'

# A2 hooks wired by hand, beside a hook of the person's own
fresh a2; wired
python3 - "$settings" <<'E'
import json, sys
d = json.load(open(sys.argv[1]))
d["hooks"]["Stop"][0]["hooks"].append({"type":"command","command":"bash /home/me/my_hook.sh"})
d["hooks"]["Stop"].append({"matcher":"x","hooks":[{"type":"command","command":"/opt/notify.sh"}]})
json.dump(d, open(sys.argv[1],"w"), indent=2)
E
chmod 600 "$settings"; cp "$settings" "$acct/original"
tool_as_acct setup; rc=$?
expect "setup: removes hand-wired hooks" '[ $rc -eq 0 ] && ! grep -q "claude_hooks/" "$settings"'
expect "setup: counts the 14 entries" 'grep -q "removed  14 " "$acct/out"'
expect "setup: keeps the hook in the same group" 'py "d[\"hooks\"][\"Stop\"][0][\"hooks\"][0][\"command\"]==\"bash /home/me/my_hook.sh\""'
expect "setup: keeps the person's group" 'py "d[\"hooks\"][\"Stop\"][1][\"matcher\"]==\"x\""'
expect "setup: drops events it emptied" 'py "list(d[\"hooks\"])==[\"Stop\"]"'
expect "setup: keeps the other settings" 'py "d[\"model\"]==\"opus\" and d[\"enabledPlugins\"][\"x@y\"] is True"'
expect "setup: keeps the entry the plugin install wrote" 'py "d[\"enabledPlugins\"][\"miadi-session-observability@miadi-orchestration-kit\"] is True"'
tool_as_acct status; expect "status: ready after the hooks were removed" '[ $? -eq 0 ]'
expect "setup: keeps the file's mode" '[ "$(stat -c %a "$settings")" = 600 ]'
expect "setup: backup is settings.json as it was" 'cmp -s "$acct/original" "$settings.bak-miadi-claude"'
expect "setup: leaves no temporary file" '[ -z "$(find "$acct/home/.claude" -name ".settings.*")" ]'
cp "$settings" "$acct/after"; tool_as_acct setup; rc=$?
expect "setup again: exit 0, changes nothing" '[ $rc -eq 0 ] && cmp -s "$acct/after" "$settings"'
expect "setup again: the backup stays the first one" 'cmp -s "$acct/original" "$settings.bak-miadi-claude"'
expect "setup again: does not add the marketplace twice" '[ "$(grep -c "marketplace add" "$acct/fake/calls")" = 1 ]'

# A3 only retired hooks: the hooks key goes
fresh a3; wired; tool_as_acct setup
expect "setup: drops a hooks key it emptied" 'py "\"hooks\" not in d and d[\"model\"]==\"opus\""'

# A4 a failed install leaves the old capture running
fresh a4; wired; cp "$settings" "$acct/original"; touch "$acct/fake/install-fails"
tool_as_acct setup; rc=$?
expect "install fails: exit 1" '[ $rc -eq 1 ]'
expect "install fails: settings unchanged, no backup" 'cmp -s "$acct/original" "$settings" && [ ! -e "$settings.bak-miadi-claude" ]'

# A4b hooks that cannot record leave the old capture running
fresh a4b; wired; cp "$settings" "$acct/original"; touch "$acct/fake/hook-fails"
tool_as_acct setup; rc=$?
expect "the plugin's hook cannot record: exit 1" '[ $rc -eq 1 ] && grep -q "did not record" "$acct/out"'
expect "the plugin's hook cannot record: old hooks stay, no backup" '[ "$(grep -c claude_hooks/ "$settings")" = 14 ] && [ ! -e "$settings.bak-miadi-claude" ]'

# A5 a disabled plugin stays disabled
fresh a5; wired; cp "$settings" "$acct/original"
mkdir -p "$acct/fake/plugin/hooks"; echo '{}' > "$acct/fake/plugin/hooks/hooks.json"
printf '[{"id":"miadi-session-observability@miadi-orchestration-kit","enabled":false,"scope":"user","version":"0.1.39","installPath":"%s/plugin"}]\n' "$acct/fake" > "$acct/fake/plugins.json"
echo '[{"name":"miadi-orchestration-kit","source":"github","repo":"jgwill/miadi-orchestration-kit"}]' > "$acct/fake/markets.json"
tool_as_acct setup; rc=$?
expect "disabled: exit 1, settings unchanged" '[ $rc -eq 1 ] && cmp -s "$acct/original" "$settings"'
expect "disabled: names the enable command" 'grep -q "claude plugin enable" "$acct/out"'
expect "disabled: never enables it" '! grep -qE "plugin (enable|install)" "$acct/fake/calls"'

# A6 a marketplace of that name from elsewhere
fresh a6; echo '[{"name":"miadi-orchestration-kit","source":"github","repo":"someone/else"}]' > "$acct/fake/markets.json"
tool_as_acct setup; rc=$?
expect "marketplace from elsewhere: refused" '[ $rc -eq 1 ] && ! grep -q "plugin install" "$acct/fake/calls"'
fresh a7; echo '[{"name":"miadi-orchestration-kit","source":"directory","path":"/a/checkout"}]' > "$acct/fake/markets.json"
tool_as_acct setup; rc=$?
expect "a checkout as the marketplace is accepted" '[ $rc -eq 0 ]'

# A8 commands that only mention a retired hook stay
fresh a8
cat > "$settings" <<'E'
{"hooks":{"Stop":[{"hooks":[
  {"type":"command","command":"bash /x/claude_hooks/stop_hook.sh; bash /mine/after.sh"},
  {"type":"command","command":"bash \"/y/claude_hooks/stop_hook.sh\""},
  {"type":"command","command":"/z/claude_hooks/my_own_hook.sh"},
  {"type":"prompt","prompt":"claude_hooks/stop_hook.sh"}]}]}}
E
tool_as_acct setup; rc=$?
expect "mixed: quoted retired hook removed" '[ $rc -eq 0 ] && ! grep -q "/y/claude_hooks" "$settings"'
expect "mixed: chained command stays" 'grep -q "/mine/after.sh" "$settings"'
expect "mixed: chained command is named" 'grep -q "left     bash /x/claude_hooks" "$acct/out"'
expect "mixed: a hook name outside the list stays" 'grep -q "my_own_hook" "$settings"'
expect "mixed: a non-command hook stays" 'grep -q "\"prompt\"" "$settings"'

# A9 settings that cannot be read
fresh a9; printf '{not json' > "$settings"
tool_as_acct setup; rc=$?
expect "invalid JSON: exit 1 before anything is installed" '[ $rc -eq 1 ] && [ ! -e "$acct/fake/calls" ]'
expect "invalid JSON: file unchanged" '[ "$(cat "$settings")" = "{not json" ]'

# A10 a capture folder the account cannot write
if [ "$(id -u)" != 0 ]; then
  fresh a10; wired; cp "$settings" "$acct/original"; mkdir -m 555 "$acct/capture"
  tool_as_acct setup; rc=$?
  expect "capture not writable: exit 1 before anything is installed" '[ $rc -eq 1 ] && [ ! -e "$acct/fake/calls" ] && cmp -s "$acct/original" "$settings"'
  expect "capture not writable: says how to join the group" 'grep -q "usermod" "$acct/out"'
fi

# A11 no claude, an old claude
fresh a11; mkdir "$acct/nobin"; ln -s "$(command -v jq)" "$acct/nobin/jq"
path_override=$acct/nobin tool_as_acct setup; rc=$?
expect "no claude: exit 1 and names the installer" '[ $rc -eq 1 ] && grep -q "claude.ai/install.sh" "$acct/out"'
fresh a12; touch "$acct/fake/old"
tool_as_acct setup; rc=$?
expect "old claude: brought forward, then set up" '[ $rc -eq 0 ] && grep -q "install stable" "$acct/fake/calls" && grep -q "plugin install" "$acct/fake/calls"'

# A13 CLAUDE_CONFIG_DIR, and a settings.json that is a link
fresh a13; mkdir "$acct/dotfiles" "$acct/cfg"; settings=$acct/dotfiles/settings.json; wired
ln -s "$settings" "$acct/cfg/settings.json"
CLAUDE_CONFIG_DIR_VALUE=$acct/cfg
env HOME="$acct/home" FAKE="$acct/fake" PATH="$work/bin:$PATH" MIADI_SESSIONDATA_ROOT="$acct/capture" \
  CLAUDE_CONFIG_DIR="$CLAUDE_CONFIG_DIR_VALUE" python3 "$tool" setup > "$acct/out" 2>&1; rc=$?
expect "CLAUDE_CONFIG_DIR is honored" '[ $rc -eq 0 ] && ! grep -q claude_hooks "$settings"'
expect "a linked settings.json stays a link" '[ -L "$acct/cfg/settings.json" ]'

# A14 usage
fresh a14; tool_as_acct; expect "no command: exit 2" '[ $? -eq 2 ]'
tool_as_acct --help; expect "--help: exit 0" '[ $? -eq 0 ]'

# A15 the real claude CLI: its JSON shapes and a real install from a checkout
if [ "${REAL:-}" = 1 ]; then
  fresh a15; wired
  real_claude=$(command -v claude)
  ( HOME=$acct/home "$real_claude" plugin marketplace add "${KIT:?KIT is the kit checkout}" >/dev/null 2>&1 )
  real() { env -u CLAUDE_CONFIG_DIR -u CLAUDE_SESSIONDATA_ROOT -u MIADI_SESSION_DIR -u SESSION_DATA_ROOT HOME="$acct/home" MIADI_SESSIONDATA_ROOT="$acct/capture" python3 "$tool" "$1" > "$acct/out" 2>&1; }
  real setup; rc=$?
  cat "$acct/out"
  expect "real claude: setup succeeds" '[ $rc -eq 0 ]'
  expect "real claude: hooks removed" '! grep -q claude_hooks "$settings"'
  expect "real claude: captures to the account's folder" 'grep -q "capturing to $acct/capture" "$acct/out"'
  expect "real claude: the backup has the hooks and no plugin entry" 'grep -q claude_hooks "$settings.bak-miadi-claude" && ! grep -q miadi-session-observability "$settings.bak-miadi-claude"'
  real status; rc=$?
  cat "$acct/out"
  expect "real claude: status says ready" '[ $rc -eq 0 ]'
fi

echo; echo "$checks checks, $failures failed"
[ "$failures" -eq 0 ]
