#!/usr/bin/env python3
"""Exercise mirror reconciliation with fake outputs; never touch the live desktop."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(os.environ.get("MIRROR_MONITOR_SCRIPT", Path(__file__).resolve().parents[1] / "66-mirror-monitor.sh"))

XRANDR = r'''#!/usr/bin/python3
import json, os, sys
from pathlib import Path
p = Path(os.environ['MOCK_DISPLAY'])
s = json.loads(p.read_text())
args = sys.argv[1:]
if args == ['--query']:
    if not s.get('ready', True):
        sys.exit('Cannot open display')
    active = [o for o in s['outputs'].values() if o['connected'] and o.get('mode')]
    width = max((int(o['mode'].split('x')[0]) + o.get('x', 0) for o in active), default=320)
    height = max((int(o['mode'].split('x')[1]) for o in active), default=200)
    print(f'Screen 0: minimum 8 x 8, current {width} x {height}, maximum 32767 x 32767')
    for name, o in s['outputs'].items():
        primary = 'primary ' if o.get('primary') else ''
        geometry = f"{o['mode']}+{o.get('x', 0)}+0 " if o.get('mode') and o['connected'] else ''
        print(f"{name} {'connected' if o['connected'] else 'disconnected'} {primary}{geometry}(normal left inverted right x axis y axis)")
        if not o['connected']:
            continue
        for mode, rates in o['modes'].items():
            fields = []
            for hz in rates:
                mark = '*' if o.get('mode') == mode and o.get('rate') == hz else ''
                mark += '+' if mode == o['preferred'] and hz == rates[0] else ''
                fields.append(f'{hz:.2f}{mark}')
            print('   ' + mode + '     ' + ' '.join(fields))
    sys.exit(0)
with open(os.environ['MOCK_CALLS'], 'a') as log:
    log.write(json.dumps(args) + '\n')
if s.get('apply_fail'):
    sys.exit('temporary modeset failure')
current = None
i = 0
while i < len(args):
    arg = args[i]
    if arg == '--output':
        current = s['outputs'][args[i+1]]
        i += 2
    elif arg == '--primary':
        for o in s['outputs'].values():
            o['primary'] = False
        current['primary'] = True
        i += 1
    elif arg == '--off':
        current['mode'] = None
        i += 1
    elif arg == '--auto':
        current['mode'] = current['preferred']
        current['rate'] = current['modes'][current['mode']][0]
        i += 1
    elif arg == '--mode':
        current['mode'] = args[i+1]
        i += 2
    elif arg == '--rate':
        current['rate'] = float(args[i+1])
        i += 2
    elif arg == '--pos':
        current['x'] = int(args[i+1].split('x')[0])
        i += 2
    elif arg == '--same-as':
        current['x'] = s['outputs'][args[i+1]].get('x', 0)
        i += 2
    else:
        sys.exit('unexpected option: ' + arg)
p.write_text(json.dumps(s))
'''


class MirrorMonitorTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        bin_dir = self.root / 'bin'
        bin_dir.mkdir()
        for name, content in [('xrandr', XRANDR), ('systemctl', '#!/bin/bash\nprintf "%s\\n" "$*" >> "$MOCK_SYSTEMCTL"\n')]:
            exe = bin_dir / name
            exe.write_text(content)
            exe.chmod(0o755)
        self.state = self.root / 'display.json'
        self.calls = self.root / 'calls.jsonl'
        self.lid = self.root / 'lid'
        self.lid.write_text('state:      open\n')
        self.env = dict(os.environ, HOME=str(self.root), XDG_CONFIG_HOME=str(self.root / 'config'),
                        PATH=f'{bin_dir}:/usr/bin:/bin', DISPLAY=':55', XAUTHORITY='/test/authority',
                        MIRROR_LID_STATE_FILE=str(self.lid), MOCK_DISPLAY=str(self.state),
                        MOCK_CALLS=str(self.calls), MOCK_SYSTEMCTL=str(self.root / 'systemctl.log'))
        self.env.pop('MIRROR_EXTERNAL_MAX_HZ', None)
        self.save({'outputs': {
            'HDMI-0': {'connected': True, 'mode': '1920x1080', 'rate': 143.99, 'x': 0,
                       'preferred': '1920x1080', 'modes': {'1920x1080': [60.0, 180.0, 143.99], '3840x2160': [59.94]}},
            'eDP-1-1': {'connected': True, 'mode': '3840x2160', 'rate': 60.0, 'primary': True, 'x': 0,
                        'preferred': '3840x2160', 'modes': {'3840x2160': [60.0], '1920x1080': [60.0]}}
        }})

    def save(self, state):
        self.state.write_text(json.dumps(state))

    def load(self):
        return json.loads(self.state.read_text())

    def run_script(self, *args, ok=True):
        result = subprocess.run(['bash', str(SCRIPT), *args], env=self.env, text=True, capture_output=True, timeout=8)
        if ok:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0)
        return result

    def commands(self):
        return [json.loads(l) for l in self.calls.read_text().splitlines()] if self.calls.exists() else []

    def test_cropped_4k_desktop_becomes_native_full_clone(self):
        self.run_script('--ensure')
        outputs = self.load()['outputs']
        self.assertEqual(outputs['eDP-1-1']['mode'], '1920x1080')
        self.assertEqual(outputs['HDMI-0']['rate'], 143.99)  # never the marginal 180Hz timing
        self.assertEqual(len(self.commands()), 1)

    def test_correct_layout_is_a_quiet_noop(self):
        self.run_script('--ensure')
        result = self.run_script('--ensure')
        self.assertEqual(result.stdout, '')
        self.assertEqual(len(self.commands()), 1)

    def test_monitor_appearing_after_old_timeout_is_still_repaired(self):
        state = self.load()
        state['outputs']['HDMI-0']['connected'] = False
        self.save(state)
        self.env['MIRROR_WAIT_TIMEOUT'] = '0'
        self.run_script('--wait')  # old autostart would stop here forever
        before = len(self.commands())
        for _ in range(3):
            self.run_script('--ensure')
        self.assertEqual(len(self.commands()), before)
        state = self.load()
        state['outputs']['HDMI-0']['connected'] = True
        self.save(state)
        self.run_script('--ensure')
        self.assertEqual(self.load()['outputs']['eDP-1-1']['mode'], '1920x1080')
        self.assertEqual(len(self.commands()), before + 1)

    def test_lid_close_uses_external_only_and_open_restores_mirror(self):
        self.lid.write_text('state:      closed\n')
        self.run_script('--ensure')
        outputs = self.load()['outputs']
        self.assertIsNone(outputs['eDP-1-1']['mode'])
        self.assertTrue(outputs['HDMI-0']['primary'])
        self.run_script('--ensure')
        self.assertEqual(len(self.commands()), 1)
        self.lid.write_text('state:      open\n')
        self.run_script('--ensure')
        outputs = self.load()['outputs']
        self.assertEqual(outputs['eDP-1-1']['mode'], '1920x1080')
        self.assertTrue(outputs['eDP-1-1']['primary'])
        self.assertFalse(outputs['HDMI-0']['primary'])

    def test_never_blanks_only_display_with_lid_closed(self):
        state = self.load()
        state['outputs']['HDMI-0']['connected'] = False
        self.save(state)
        self.lid.write_text('state:      closed\n')
        self.run_script('--ensure')
        self.assertEqual(self.commands(), [])

    def test_disconnect_restores_native_laptop_mode(self):
        self.run_script('--ensure')
        state = self.load()
        state['outputs']['HDMI-0']['connected'] = False
        self.save(state)
        self.run_script('--ensure')
        self.assertEqual(self.load()['outputs']['eDP-1-1']['mode'], '3840x2160')
        self.run_script('--ensure')
        self.assertEqual(len(self.commands()), 2)

    def test_layout_overwritten_by_kscreen_is_repaired_again(self):
        self.run_script('--ensure')
        state = self.load()
        state['outputs']['HDMI-0']['x'] = 1920
        self.save(state)
        self.run_script('--ensure')
        self.assertEqual(self.load()['outputs']['HDMI-0']['x'], 0)
        self.assertEqual(len(self.commands()), 2)

    def test_wrong_refresh_is_repaired(self):
        self.run_script('--ensure')
        state = self.load()
        state['outputs']['HDMI-0']['rate'] = 180.0
        self.save(state)
        self.run_script('--ensure')
        self.assertEqual(self.load()['outputs']['HDMI-0']['rate'], 143.99)

    def test_temporary_x_or_modeset_failure_is_retryable(self):
        state = self.load()
        state['ready'] = False
        self.save(state)
        self.run_script('--ensure', ok=False)
        self.assertEqual(self.commands(), [])
        state['ready'] = True
        state['apply_fail'] = True
        self.save(state)
        self.run_script('--ensure', ok=False)
        state['apply_fail'] = False
        self.save(state)
        self.run_script('--ensure')
        self.assertEqual(self.load()['outputs']['eDP-1-1']['mode'], '1920x1080')

    def test_panel_not_ready_is_retried_without_changing_outputs(self):
        state = self.load()
        state['outputs']['eDP-1-1']['connected'] = False
        self.save(state)
        self.run_script('--ensure')
        self.assertEqual(self.commands(), [])
        state['outputs']['eDP-1-1']['connected'] = True
        self.save(state)
        self.run_script('--ensure')
        self.assertEqual(len(self.commands()), 1)

    def test_install_is_opt_in_and_timer_survives_late_detection(self):
        config = Path(self.env['XDG_CONFIG_HOME'])
        self.run_script('--help')
        self.assertFalse(config.exists())
        self.run_script('--install-autostart')
        unit = (config / 'systemd/user/mirror-monitor.service').read_text()
        timer = (config / 'systemd/user/mirror-monitor.timer').read_text()
        desktop = (config / 'autostart/mirror-monitor.desktop').read_text()
        self.assertIn('--ensure', unit)
        self.assertIn('ConditionEnvironment=DISPLAY', unit)
        self.assertIn('OnUnitInactiveSec=10', timer)
        self.assertIn('WantedBy=timers.target', timer)
        self.assertNotIn('--wait', desktop)
        self.assertIn('import-environment DISPLAY XAUTHORITY', desktop)
        self.assertIn('restart mirror-monitor.timer mirror-monitor.service', desktop)
        calls = (self.root / 'systemctl.log').read_text()
        self.assertIn('enable --now mirror-monitor.timer', calls)
        self.run_script('--install-autostart')
        self.assertEqual((config / 'systemd/user/mirror-monitor.timer').read_text(), timer)
        self.run_script('--uninstall-autostart')
        self.assertFalse((config / 'autostart/mirror-monitor.desktop').exists())
        self.assertFalse((config / 'systemd/user/mirror-monitor.timer').exists())

    def test_no_common_mode_leaves_screen_untouched(self):
        state = self.load()
        state['outputs']['eDP-1-1']['modes'] = {'1366x768': [60.0]}
        self.save(state)
        self.run_script('--ensure', ok=False)
        self.assertEqual(self.commands(), [])


if __name__ == '__main__':
    unittest.main()
