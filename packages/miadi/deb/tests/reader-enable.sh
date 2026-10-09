#!/usr/bin/env bash
# Run as an ordinary user inside test-install.sh's container, after
# miadi-terminal is installed: what `miadi-terminal enable/disable` does to
# that user's own configs. ConfigObj (python3-configobj) is the parser
# Terminator reads its config with.
set -euo pipefail
cd "$HOME"
plugins() {
	python3 -c 'import configobj, sys; print(",".join(configobj.ConfigObj(sys.argv[1])["global_config"]["enabled_plugins"]))' \
		~/.config/terminator/config
}
mkdir -p ~/.config/terminator ~/bin ~/.config/environment.d
printf '[Default Applications]\ntext/html=firefox.desktop\n' > ~/.config/mimeapps.list
printf '[global_config] # mine\n  enabled_plugins = LaunchpadBugURLHandler, APTURLHandler  # keep these\n[plugins]\n  [[x]]\n    enabled_plugins = y\n' \
	> ~/.config/terminator/config
for f in ~/bin/miadi-chronicle-open ~/.config/environment.d/50-miadi-chronicle.conf; do
	printf '# jgwill/Miadi packages/inquiry-weave/src/terminal-install.ts\n' > "$f"
done

miadi-terminal enable desktop terminator >/dev/null
test "$(plugins)" = LaunchpadBugURLHandler,APTURLHandler,MiadiChronicleURLHandler
grep -q '# keep these' ~/.config/terminator/config
grep -qx '    enabled_plugins = y' ~/.config/terminator/config
test "$(grep -c '^\[global_config\]' ~/.config/terminator/config)" = 1
test -f ~/.config/terminator/config.bak-miadi-terminal
test ! -e ~/bin/miadi-chronicle-open
test -f ~/.local/share/miadi-terminal/legacy/miadi-chronicle-open
test -f ~/.config/environment.d/50-miadi-chronicle.conf
! miadi-terminal status | grep -q 'earlier inquiry-weave environment file'
printf 'MIADI_URL_BASE=https://old.test\nMIADI_CHRONICLE_ROOT=/old\n' >> ~/.config/environment.d/50-miadi-chronicle.conf
miadi-terminal status | grep -q 'earlier inquiry-weave environment file'
miadi-terminal status | grep -qx '  MIADI_URL_BASE=https://old.test wins over miadi.env.s MIADI_URL_BASE=https://example.test'
! miadi-terminal status | grep -q 'MIADI_CHRONICLE_ROOT'
for scheme in miadi-chronicle miadi-ceremony miadi-circle; do
	test "$(xdg-mime query default x-scheme-handler/$scheme)" = miadi-chronicle-open.desktop
done
grep -qx 'text/html=firefox.desktop' ~/.config/mimeapps.list.bak-miadi-terminal
miadi-terminal enable terminator | grep -q 'already enabled'
miadi-terminal status | grep -qx 'terminator: its application is not installed here'
miadi-terminal disable terminator >/dev/null
test "$(plugins)" = LaunchpadBugURLHandler,APTURLHandler

printf '[global_config]\n  enabled_plugins = APTURLHandler, MiadiChronicleURLHandler\n' > ~/.config/terminator/config
miadi-terminal disable terminator >/dev/null
test "$(plugins)" = APTURLHandler
grep -qx '  enabled_plugins = APTURLHandler,' ~/.config/terminator/config
grep -q '# mine' ~/.config/terminator/config.bak-miadi-terminal
rm ~/.config/terminator/config
miadi-terminal enable terminator >/dev/null
test "$(plugins)" = LaunchpadBugURLHandler,LaunchpadCodeURLHandler,APTURLHandler,MiadiChronicleURLHandler
rm ~/.config/terminator/config ~/.config/terminator/config.bak-miadi-terminal
printf '[ global_config ]\n  title_hide_sizetext = True\n[profiles]\n' > ~/.config/terminator/config
miadi-terminal enable terminator >/dev/null
test "$(grep -c 'global_config' ~/.config/terminator/config)" = 1
test "$(plugins)" = LaunchpadBugURLHandler,LaunchpadCodeURLHandler,APTURLHandler,MiadiChronicleURLHandler
echo "terminator: [global_config] only (spaced header too), comments kept, one-plugin lists stay lists, the first backup kept; mimeapps.list backed up"

# /etc/miadi/tmux.conf sets the mouse on; this config turns it off again, and the last setting wins.
printf 'set -g history-limit 5000\nset -g mouse off\n#source-file -q /usr/share/miadi-terminal/tmux/miadi-chronicle.conf\nbind C source-file /usr/share/miadi-terminal/tmux/miadi-chronicle.conf\n' > ~/.tmux.conf
miadi-terminal enable tmux > enable.out
grep -q 'set -g mouse on' enable.out
grep -qx 'source-file -q /usr/share/miadi-terminal/tmux/miadi-chronicle.conf  # miadi-terminal' ~/.tmux.conf
tmux -L check new-session -d -s c 'sleep 5'
tmux -L check list-keys -T root | grep -q 'MouseUp1Pane .*miadi-chronicle-open --open --tmux'
tmux -L check kill-server
miadi-terminal status | grep -qx 'tmux: enabled'
miadi-terminal disable tmux >/dev/null
! grep -q '# miadi-terminal' ~/.tmux.conf
grep -qx 'bind C source-file /usr/share/miadi-terminal/tmux/miadi-chronicle.conf' ~/.tmux.conf
grep -qx 'set -g history-limit 5000' ~/.tmux.conf
echo "tmux: a commented line is not enabled, disable removes only our line, the mouse hint shows with no server"

# /etc/tmux.conf reads /etc/miadi/tmux.conf; enable defaults comments out what a config repeats of it
# (a binding whose continuation line is indented differently included) and keeps the rest.
cat > ~/.tmux.conf <<'CONF'
set -g status-left-length 50
set -g mouse on
bind -n WheelUpPane if -Ft= '#{mouse_any_flag}' 'send -M' \
    'if -Ft= "#{pane_in_mode}" "send -M" "copy-mode -e; send -X -N 3 scroll-up"'
set -g history-limit 9000
CONF
cp ~/.tmux.conf before.conf
miadi-terminal status | grep -qx 'defaults: not enabled — miadi-terminal enable defaults'
miadi-terminal enable defaults | grep -q '2 settings'
test "$(grep -c '^# in /etc/miadi/tmux.conf: ' ~/.tmux.conf)" = 3
grep -qx 'set -g status-left-length 50' ~/.tmux.conf
grep -qx 'set -g history-limit 9000' ~/.tmux.conf
miadi-terminal status | grep -qx 'defaults: enabled'
miadi-terminal enable defaults | grep -q 'repeats nothing'
tmux -L defaults new-session -d -s d 'sleep 5'
test "$(tmux -L defaults show -gv mouse)" = on
test "$(tmux -L defaults show -gv history-limit)" = 9000
test "$(tmux -L defaults show -gv status-left-length)" = 50
test "$(tmux -L defaults show -sv extended-keys)" = on
tmux -L defaults list-keys -T root | grep -q 'WheelUpPane .*scroll-up'
tmux -L defaults list-keys -T root | grep -q 'WheelDownPane .*scroll-down'
tmux -L defaults kill-server
miadi-terminal disable defaults >/dev/null
cmp ~/.tmux.conf before.conf
rm ~/.tmux.conf
miadi-terminal enable defaults | grep -q 'repeats nothing'
echo "defaults: a new server reads /etc/miadi/tmux.conf, the user's lines win, repeats are commented out and come back on disable"
