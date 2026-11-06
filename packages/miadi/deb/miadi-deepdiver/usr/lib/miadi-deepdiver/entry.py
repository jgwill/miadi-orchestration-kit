"""Small packaging boundary; the upstream CLI and browser lifecycle stay canonical."""
import os
import subprocess
import sys


def launch_guard(args):
    if os.geteuid() == 0:
        raise RuntimeError('ROOT BROWSER REFUSED: run as your desktop user, without sudo.')
    display = os.environ.get('DISPLAY', '')
    for i, arg in enumerate(args):
        if arg.startswith('--display='):
            display = arg.split('=', 1)[1]
        elif arg == '--display' and i+1 < len(args):
            display = args[i+1]
    if not display:
        raise RuntimeError('DISPLAY UNAVAILABLE: use a desktop session (or X forwarding); headless smoke is miadi-deepdiver doctor --browser-smoke. SIGN-IN NEEDED on a real desktop.')
    try:
        result = subprocess.run(['/usr/bin/xdpyinfo', '-display', display], stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL, timeout=5)
    except (OSError, subprocess.TimeoutExpired):
        raise RuntimeError('DISPLAY UNAVAILABLE: X display check failed.') from None
    if result.returncode:
        raise RuntimeError('DISPLAY UNAVAILABLE: check DISPLAY/XAUTHORITY as the desktop user.')
    return display


if __name__ == '__main__':
    if sys.argv[1:3] == ['chrome', 'launch']:
        try:
            os.environ['DISPLAY'] = launch_guard(sys.argv[3:])
            os.umask(0o077)
            # Chrome for Testing and Google Chrome may use different keyring
            # names. Never automatically open/rewrite a pre-existing Google
            # profile with the newly installed browser. Keep an APT-only home.
            if not any(a == '--user-data-dir' or a.startswith('--user-data-dir=') or a == '--fresh' or a.startswith('--clone-profile') for a in sys.argv[3:]):
                profile = os.path.expanduser('~/.chrome-deepdiver-apt')
                sys.argv.extend(['--user-data-dir', profile])
                print('APT browser profile: '+profile+' (existing Chrome profiles preserved).')
        except RuntimeError as e:
            print(e, file=sys.stderr)
            sys.exit(1)
    from deepdiver.deepdive import main
    main()
