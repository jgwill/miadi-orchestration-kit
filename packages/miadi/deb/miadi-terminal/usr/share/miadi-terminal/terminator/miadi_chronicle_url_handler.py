"""miadi_chronicle_url_handler.py — Terminator URL handler for miadi-chronicle references.

Installed by miadi-terminal (jgwill/miadi-orchestration-kit). Enable it for your
user with `miadi-terminal enable`, then restart Terminator.

Makes a bare `miadi-chronicle:311` in ANY terminal output Ctrl-clickable — a git
log, a grep hit, an agent's raw text — output that knows nothing about miadi and
will never wrap itself in an OSC 8 escape. A ceremony or circle is clickable
the same way: `miadi-circle:<id>`, `miadi-ceremony:<id>`, or the bare wheel id
`circle:1790787727155:2slscw`. So is what an episode holds: `miadi-notebook:`,
`miadi-prototype:`, `miadi-tracing:` (and its aliases `miadi-trace:`,
`miadi-prompt:`), and a specification, `rise://<owner>/<repo>/<path>`.

Terminator has two click paths (terminal.py): an OSC 8 hyperlink goes straight
to xdg-open, which reaches the desktop handler this package also installs,
while a regex match is the only path that consults url_handler plugins. Both
end at /usr/bin/miadi-chronicle-open.

Spec: jgwill/Miadi rispecs/miadi-chronicle-dsl/SPEC-TERMINAL.md §3
"""

import subprocess

import terminatorlib.plugin as plugin

AVAILABLE = ['MiadiChronicleURLHandler']

OPEN = '/usr/bin/miadi-chronicle-open'


class MiadiChronicleURLHandler(plugin.URLHandler):
    capabilities = ['url_handler']
    handler_name = 'miadi_chronicle_uri'
    # The opener's REFERENCE, character for character. r'''...''' because the
    # pattern contains a double quote; (?i) because the scheme is
    # case-insensitive (RFC 3986, and the Miadi parser).
    match = r'''(?i)\bmiadi-(?:(?:chronicle|foundation):(?://)?[A-Za-z0-9._~/\-]+|(?:ceremony|circle):(?://)?[A-Za-z0-9._~\-]+(?::[A-Za-z0-9._~\-]+)*|(?:notebook|prototype|tracing|trace|prompt):(?://)?[A-Za-z0-9._~/:+@\-]+)(?:\?[^\s<>"'`]*)?(?:#[^\s<>"'`]*)?|\brise://[A-Za-z0-9][A-Za-z0-9._\-]*/[A-Za-z0-9][A-Za-z0-9._\-]*/[A-Za-z0-9._~/\-]+(?:@[A-Za-z0-9._/\-]+)?(?:\?[^\s<>"'`]*)?(?:#[^\s<>"'`]*)?|\b(?:circle|ceremony):(?:\d{10,}|ep\d+):[A-Za-z0-9._~\-]+(?::[A-Za-z0-9._~\-]+)*'''
    nameopen = 'Open chronicle reference'
    namecopy = 'Copy reference'

    def callback(self, url):
        """Return the URL that opens the reference, or the reference itself.

        Never raises: a handler that throws takes the click with it and the
        user sees nothing. Returning the reference hands it to xdg-open, which
        reaches the desktop handler and reports its own failure.
        """
        try:
            result = subprocess.run([OPEN, url], capture_output=True, text=True, timeout=10)
        except (OSError, subprocess.TimeoutExpired):
            return url
        if result.returncode != 0:
            return url
        return result.stdout.strip() or url
