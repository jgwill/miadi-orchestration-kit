#!/usr/bin/env sh
# Termux:Boot: the tide daemon and its watchdog (miadi-tide). A phone's boot
# script runs every file in share/miadi/termux-boot/.
exec /usr/bin/miadi-tide-service ensure
