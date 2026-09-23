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
miadi-terminal status | grep -q 'earlier inquiry-weave environment file'
test "$(xdg-mime query default x-scheme-handler/miadi-chronicle)" = miadi-chronicle-open.desktop
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
echo "terminator: [global_config] only, comments kept, one-plugin lists stay lists, the first backup kept"

printf 'set -g history-limit 5000\n#source-file -q /usr/share/miadi-terminal/tmux/miadi-chronicle.conf\nbind C source-file /usr/share/miadi-terminal/tmux/miadi-chronicle.conf\n' > ~/.tmux.conf
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
