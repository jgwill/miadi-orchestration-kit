#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""atelier_portal.py -- a Pixel Recorder portal client for the atelier.

Standard library only (urllib, ssl, json). No `requests`: the host this plugin was
built for has no third-party HTTP library, and a plugin that imports one fails on
the machine it was made for.

NO HOST, PORT OR URL IS HARDCODED IN LOGIC.
The portal base URL comes from --url or the environment variable ATELIER_PORTAL_URL.
Values named in the studio brief appear only in --help text, as documented defaults
the operator must still supply.

THE IDENTITY OF A SERVICE IS THE TRIPLET (host, port, code tree).
A name and a port do not identify a service. `identify` says so on every run,
because this was paid for twice in one session.

CONSENT
  This client will not call /clips/<f>/transcribe. Transcription ships a human's
  audio to a third party. That is the human's action, not an agent's.
  Every mutating call is --dry-run by default when it publishes.
"""

from __future__ import annotations

import argparse
import io
import json
import mimetypes
import os
import shlex
import ssl
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

PROG = "atelier_portal.py"

ENV_URL = "ATELIER_PORTAL_URL"
ENV_WORKSPACE = "ATELIER_WORKSPACE"
ENV_TIMEOUT = "ATELIER_PORTAL_TIMEOUT"
ENV_RECDIR = "ATELIER_RECORDINGS_DIR"
ENV_RECDIR_TEMPLATE = "ATELIER_RECORDINGS_DIR_TEMPLATE"
ENV_SSH_USER = "ATELIER_SSH_USER"
ENV_SSH_PORT = "ATELIER_SSH_PORT"

# Documented default only -- used to *describe* the remote recordings directory in a
# diagnosis message. It is never opened by this script, and it is overridable.
DEFAULT_RECDIR_TEMPLATE = "/sdcard/Recordings-{workspace}"

TRIPLET_WARNING = (
    "\n"
    "  WARNING -- a name and a port do not identify a service.\n"
    "  The triplet (host, port, code tree) does.\n"
    "  Two portals can answer on the same port number from different hosts and be\n"
    "  entirely different studios; a port that is not declared in a tailnet gateway\n"
    "  does not travel, and the local service answers in its place.\n"
)

TRANSCRIBE_REFUSAL = (
    "REFUSED: /clips/<f>/transcribe is not callable from this client.\n"
    "  Transcription uploads the recording to a third-party service.\n"
    "  The human's recorded words on this: \"I don't consent that my voice and my\n"
    "  original recording goes outside of the boundary here.\"\n"
    "  Transcription is the human's action, triggered by the human, in the portal UI.\n"
    "  An agent asking for it is the agent deciding for him. It does not happen here.\n"
)


# --------------------------------------------------------------------------- #
# consent ledger (best effort -- the guard lives in atelier_consent.py next door)
# --------------------------------------------------------------------------- #

def _ledger(event, **fields):
    """Append an entry to the consent ledger if the guard module is reachable.

    Never fatal: the portal must keep working if the ledger cannot be written,
    but it says so on stderr rather than swallowing the fact.
    """
    try:
        here = os.path.dirname(os.path.abspath(__file__))
        if here not in sys.path:
            sys.path.insert(0, here)
        import atelier_consent  # noqa: WPS433 (deliberate late import)
        atelier_consent.record_event(event, **fields)
    except Exception as exc:  # pragma: no cover - defensive
        sys.stderr.write("  (ledger not written: %s)\n" % exc)


# --------------------------------------------------------------------------- #
# transport
# --------------------------------------------------------------------------- #

class PortalError(RuntimeError):
    pass


class Portal(object):
    """A Pixel Recorder portal reached over HTTP(S)."""

    def __init__(self, base_url, timeout=20.0, insecure=True):
        if not base_url:
            raise PortalError(
                "no portal URL. Pass --url, or set %s.\n"
                "  This script hardcodes no host and no port on purpose: the studio\n"
                "  URL is part of the operator's environment, not of the tool."
                % ENV_URL
            )
        self.base = base_url.rstrip("/")
        parsed = urllib.parse.urlsplit(self.base)
        if not parsed.scheme or not parsed.netloc:
            raise PortalError("malformed portal URL: %r (want scheme://host:port)" % base_url)
        self.scheme = parsed.scheme
        self.host = parsed.hostname or ""
        self.port = parsed.port
        self.timeout = timeout
        # These portals present self-signed certificates. Accepting them is a
        # deliberate, stated choice -- not a silent one.
        self._ctx = ssl.create_default_context()
        if insecure:
            self._ctx.check_hostname = False
            self._ctx.verify_mode = ssl.CERT_NONE

    # -- low level -------------------------------------------------------- #

    def _url(self, path):
        if not path.startswith("/"):
            path = "/" + path
        return self.base + path

    def request(self, path, method="GET", data=None, content_type=None, raw=False):
        if "/transcribe" in path:
            raise PortalError(TRANSCRIBE_REFUSAL)
        url = self._url(path)
        req = urllib.request.Request(url, data=data, method=method)
        if content_type:
            req.add_header("Content-Type", content_type)
        if data is not None:
            req.add_header("Content-Length", str(len(data)))
        req.add_header("User-Agent", "atelier-jerry/" + PROG)
        opener_kwargs = {"timeout": self.timeout}
        if self.scheme == "https":
            opener_kwargs["context"] = self._ctx
        try:
            with urllib.request.urlopen(req, **opener_kwargs) as resp:
                body = resp.read()
                status = resp.getcode()
        except urllib.error.HTTPError as exc:
            body = exc.read()
            status = exc.code
        except urllib.error.URLError as exc:
            raise PortalError(
                "UNREACHABLE %s -- %s\n"
                "  This is a transport failure, not an empty answer. Do not read it\n"
                "  as 'nothing was deposited'." % (url, exc.reason)
            )
        if raw:
            return status, body
        text = body.decode("utf-8", "replace")
        return status, text

    def get_json(self, path):
        status, text = self.request(path)
        try:
            return status, json.loads(text)
        except ValueError:
            raise PortalError(
                "HTTP %s from %s but the body is not JSON (first 200 bytes):\n  %r"
                % (status, self._url(path), text[:200])
            )

    # -- endpoints -------------------------------------------------------- #

    def identify(self):
        """Fetch / and report data-current-workspace and the page <title>."""
        import re

        status, text = self.request("/")
        ws = None
        title = None
        m = re.search(r'data-current-workspace\s*=\s*["\']([^"\']*)["\']', text)
        if m:
            ws = m.group(1)
        m = re.search(r"<title[^>]*>(.*?)</title>", text, re.S | re.I)
        if m:
            title = " ".join(m.group(1).split())
        return {
            "url": self.base,
            "http_status": status,
            "workspace": ws,
            "title": title,
            "host": self.host,
            "port": self.port,
        }

    def recordings(self):
        status, data = self.get_json("/recordings")
        if not isinstance(data, list):
            raise PortalError("/recordings did not return a list (HTTP %s)" % status)
        return data

    def compositions(self):
        status, data = self.get_json("/api/compositions")
        if not isinstance(data, list):
            raise PortalError("/api/compositions did not return a list (HTTP %s)" % status)
        return data

    def composition(self, slug):
        status, data = self.get_json("/api/compositions/" + urllib.parse.quote(slug))
        if not isinstance(data, dict):
            raise PortalError(
                "/api/compositions/%s did not return an object (HTTP %s)" % (slug, status)
            )
        return data

    def fetch(self, filename, dest):
        """Download /audio/<filename> to dest. Returns (path, bytes)."""
        path = "/audio/" + urllib.parse.quote(filename)
        status, body = self.request(path, raw=True)
        if status != 200:
            raise PortalError(
                "HTTP %s fetching %s -- nothing written" % (status, self._url(path))
            )
        if os.path.isdir(dest):
            dest = os.path.join(dest, os.path.basename(filename))
        parent = os.path.dirname(os.path.abspath(dest))
        if parent and not os.path.isdir(parent):
            os.makedirs(parent)
        with open(dest, "wb") as fh:
            fh.write(body)
        return dest, len(body)

    def import_file(self, path, dry_run=True):
        """POST multipart to /import, field `audioFile`.

        Returns the portal's re-timestamped filename. The portal renames on import:
        the name you sent is not the name it keeps.
        """
        with open(path, "rb") as fh:
            data = fh.read()
        filename = os.path.basename(path)
        ctype = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        body, content_type = build_multipart(
            fields=[], files=[("audioFile", filename, ctype, data)]
        )
        if dry_run:
            print("DRY RUN -- nothing was sent.")
            print("  POST %s" % self._url("/import"))
            print("  Content-Type: %s" % content_type)
            print("  part: name=\"audioFile\" filename=%r type=%s" % (filename, ctype))
            print("  payload: %d bytes of file, %d bytes of body" % (len(data), len(body)))
            print("  re-run with --commit to actually import.")
            return None
        status, text = self.request(
            "/import", method="POST", data=body, content_type=content_type
        )
        try:
            answer = json.loads(text)
        except ValueError:
            raise PortalError("/import answered HTTP %s, not JSON: %r" % (status, text[:200]))
        if not answer.get("success"):
            raise PortalError("/import refused: %s" % json.dumps(answer))
        new_name = answer.get("filename")
        _ledger(
            "published",
            portal=self.base,
            action="import",
            source=os.path.abspath(path),
            bytes=len(data),
            portal_filename=new_name,
        )
        return new_name

    def attach(self, slug, filename, label=None, dry_run=True, workspace=None):
        """POST /api/compositions/<slug>/clips -- attach a recording to a room."""
        path = "/api/compositions/%s/clips" % urllib.parse.quote(slug)
        payload = {"filename": filename}
        if label:
            payload["label"] = label
        data = json.dumps(payload).encode("utf-8")
        if dry_run:
            print("DRY RUN -- nothing was sent.")
            print("  POST %s" % self._url(path))
            print("  body: %s" % json.dumps(payload))
            print("  re-run with --commit to actually attach.")
            return None
        status, text = self.request(
            path, method="POST", data=data, content_type="application/json"
        )
        try:
            answer = json.loads(text)
        except ValueError:
            answer = {"raw": text}
        if isinstance(answer, dict) and "Recording not found" in json.dumps(answer):
            print(recording_not_found_diagnosis(filename, workspace))
            raise PortalError("attach refused: Recording not found")
        if isinstance(answer, dict) and answer.get("success") is False:
            raise PortalError("attach refused (HTTP %s): %s" % (status, json.dumps(answer)))
        _ledger(
            "published",
            portal=self.base,
            action="attach",
            slug=slug,
            filename=filename,
            label=label,
        )
        return answer

    def note_append(self, slug, text, replace=False, dry_run=True, separator="\n"):
        """Append to a composition's notes, PUT back preserving title and bpm.

        A note is a room's memory. This never replaces one wholesale without --replace.
        """
        comp = self.composition(slug)
        title = comp.get("title")
        bpm = comp.get("bpm")
        old = comp.get("notes") or ""
        if replace:
            new = text
        else:
            new = (old + separator + text) if old else text
        payload = {"title": title, "bpm": bpm, "notes": new}
        path = "/api/compositions/%s" % urllib.parse.quote(slug)
        if dry_run:
            print("DRY RUN -- nothing was sent.")
            print("  PUT %s" % self._url(path))
            print("  title preserved: %r" % (title,))
            print("  bpm   preserved: %r" % (bpm,))
            print("  notes: %d chars -> %d chars (%s)"
                  % (len(old), len(new), "REPLACED" if replace else "appended"))
            if replace:
                print("  !! --replace discards %d characters the human wrote." % len(old))
            print("  --- new notes ---")
            print(new)
            print("  --- end ---")
            print("  re-run with --commit to actually write.")
            return None
        data = json.dumps(payload).encode("utf-8")
        status, body = self.request(
            path, method="PUT", data=data, content_type="application/json"
        )
        _ledger(
            "published",
            portal=self.base,
            action="note_replace" if replace else "note_append",
            slug=slug,
            chars_before=len(old),
            chars_after=len(new),
        )
        try:
            return json.loads(body)
        except ValueError:
            return {"http_status": status, "raw": body[:200]}

    def add_image(self, slug, path, label=None, dry_run=True):
        """POST multipart /api/compositions/<slug>/images -- field `imageFile` + label."""
        with open(path, "rb") as fh:
            data = fh.read()
        filename = os.path.basename(path)
        ctype = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        fields = []
        if label:
            fields.append(("label", label))
        body, content_type = build_multipart(
            fields=fields, files=[("imageFile", filename, ctype, data)]
        )
        endpoint = "/api/compositions/%s/images" % urllib.parse.quote(slug)
        if dry_run:
            print("DRY RUN -- nothing was sent.")
            print("  POST %s" % self._url(endpoint))
            print("  Content-Type: %s" % content_type)
            print("  part: name=\"imageFile\" filename=%r type=%s" % (filename, ctype))
            if label:
                print("  part: name=\"label\" value=%r" % (label,))
            print("  payload: %d bytes of file, %d bytes of body" % (len(data), len(body)))
            print("  re-run with --commit to actually upload.")
            return None
        status, text = self.request(
            endpoint, method="POST", data=body, content_type=content_type
        )
        _ledger(
            "published",
            portal=self.base,
            action="add_image",
            slug=slug,
            filename=filename,
            bytes=len(data),
            label=label,
        )
        try:
            return json.loads(text)
        except ValueError:
            return {"http_status": status, "raw": text[:200]}

    def transcribe(self, *_args, **_kwargs):
        raise PortalError(TRANSCRIBE_REFUSAL)


# --------------------------------------------------------------------------- #
# multipart, hand-built
# --------------------------------------------------------------------------- #

def build_multipart(fields, files):
    """Build a multipart/form-data body by hand.

    fields: iterable of (name, value)
    files:  iterable of (field_name, filename, content_type, bytes)
    returns (body_bytes, content_type_header)
    """
    boundary = "----atelier" + uuid.uuid4().hex
    buf = io.BytesIO()
    sep = ("--" + boundary + "\r\n").encode("utf-8")
    for name, value in fields:
        buf.write(sep)
        buf.write(
            ('Content-Disposition: form-data; name="%s"\r\n\r\n' % name).encode("utf-8")
        )
        buf.write(str(value).encode("utf-8"))
        buf.write(b"\r\n")
    for field, filename, ctype, data in files:
        buf.write(sep)
        buf.write(
            ('Content-Disposition: form-data; name="%s"; filename="%s"\r\n'
             % (field, filename)).encode("utf-8")
        )
        buf.write(("Content-Type: %s\r\n\r\n" % ctype).encode("utf-8"))
        buf.write(data)
        buf.write(b"\r\n")
    buf.write(("--" + boundary + "--\r\n").encode("utf-8"))
    return buf.getvalue(), "multipart/form-data; boundary=" + boundary


# --------------------------------------------------------------------------- #
# diagnoses
# --------------------------------------------------------------------------- #

def recordings_dir_hint(workspace):
    explicit = os.environ.get(ENV_RECDIR)
    if explicit:
        return explicit, ENV_RECDIR
    template = os.environ.get(ENV_RECDIR_TEMPLATE, DEFAULT_RECDIR_TEMPLATE)
    if not workspace:
        return template.replace("{workspace}", "<workspace>"), "template (workspace unknown)"
    return template.replace("{workspace}", workspace), "template"


def recording_not_found_diagnosis(filename, workspace=None):
    where, how = recordings_dir_hint(workspace)
    return (
        "\nDIAGNOSIS -- \"Recording not found\" is not about the composition.\n"
        "  The /clips endpoint looks in the portal's RECORDINGS DIRECTORY, not in the\n"
        "  composition folder. A file that is visibly inside the composition will still\n"
        "  be refused if it is not in the recordings directory.\n"
        "  Likely directory on the device: %s   (%s)\n"
        "  The portal reads it from PIXEL_RECORDER_RECORDINGS_DIR, otherwise from\n"
        "  /sdcard/Recordings${WORKSPACE_SUFFIX}.\n"
        "  The fix is to place %r in that directory first (copy it there on the device),\n"
        "  or to import it through POST /import, which lands it there and re-timestamps\n"
        "  the name -- then attach the NAME THE PORTAL RETURNED, not the one you sent.\n"
        % (where, how, filename)
    )


def crop_remote_command(host, src, start, end, out, ssh_user=None, ssh_port=None,
                        recordings_dir=None):
    """Build the ssh command that crops ON THE DEVICE.

    Returns (argv_list, printable_string).
    """
    target = ("%s@%s" % (ssh_user, host)) if ssh_user else host
    remote = (
        "ffmpeg -y -i %s -ss %s -to %s -c:a aac -b:a 160k %s"
        % (shlex.quote(src), shlex.quote(str(start)), shlex.quote(str(end)),
           shlex.quote(out))
    )
    if recordings_dir:
        remote += " && cp %s %s/" % (shlex.quote(out), shlex.quote(recordings_dir.rstrip("/")))
    argv = ["ssh"]
    if ssh_port:
        argv += ["-p", str(ssh_port)]
    argv += [target, remote]
    printable = " ".join(shlex.quote(a) for a in argv)
    return argv, printable


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def add_dry_run(parser, default_dry=True):
    grp = parser.add_mutually_exclusive_group()
    grp.add_argument(
        "--dry-run", dest="dry_run", action="store_true", default=default_dry,
        help="print the request, send nothing" + (" (DEFAULT)" if default_dry else ""),
    )
    grp.add_argument(
        "--commit", "--no-dry-run", dest="dry_run", action="store_false",
        help="actually perform the call" + ("" if default_dry else " (DEFAULT)"),
    )
    return parser


def build_parser():
    epilog = """\
ENVIRONMENT (nothing below is hardcoded in this script's logic)
  ATELIER_PORTAL_URL       base URL of the portal. Required unless --url is given.
  ATELIER_WORKSPACE        workspace name, used only to name a likely directory in a
                           diagnosis message.
  ATELIER_PORTAL_TIMEOUT   HTTP timeout in seconds (default 20).
  ATELIER_RECORDINGS_DIR   exact recordings directory on the device, for diagnoses.
  ATELIER_RECORDINGS_DIR_TEMPLATE
                           template with {workspace}; documented default is
                           /sdcard/Recordings-{workspace} (the portal's own default is
                           PIXEL_RECORDER_RECORDINGS_DIR, else
                           /sdcard/Recordings${WORKSPACE_SUFFIX}).
  ATELIER_SSH_USER / ATELIER_SSH_PORT
                           only used to build a printable ssh command. If unset, the
                           command is built without -p and without user@, so the
                           operator's ~/.ssh/config decides -- which is the honest
                           default, since a port typed from memory identifies nothing.

DOCUMENTED STUDIO VALUES (from the brief -- supply them, they are NOT defaults here)
  the two rooms on the human's phone answer on two different ports of the same host;
  a local studio on this machine answers on a port with the SAME NUMBER as one of them
  and is a DIFFERENT STUDIO. Always pass --url explicitly, or export ATELIER_PORTAL_URL
  once per shell and check it with `identify`.

CONSENT
  transcribe is refused by this client, always. It sends a human's audio to a third
  party; the human triggers that himself.
"""
    p = argparse.ArgumentParser(
        prog=PROG,
        description="Pixel Recorder portal client for the atelier (stdlib only).",
        epilog=epilog,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--url", default=os.environ.get(ENV_URL),
                   help="portal base URL, e.g. https://<host>:<port>. "
                        "Defaults to $" + ENV_URL + ".")
    p.add_argument("--timeout", type=float,
                   default=float(os.environ.get(ENV_TIMEOUT) or 20.0),
                   help="HTTP timeout in seconds (default 20, or $" + ENV_TIMEOUT + ")")
    p.add_argument("--verify-tls", action="store_true",
                   help="verify the TLS certificate. These portals use self-signed "
                        "certificates, so the default is to accept them; this flag is "
                        "here so that choice is visible rather than silent.")
    p.add_argument("--json", action="store_true", help="print raw JSON instead of a table")
    sub = p.add_subparsers(dest="cmd")

    sp = sub.add_parser("identify", help="say which studio this URL actually is")

    sp = sub.add_parser("recordings", help="GET /recordings")

    sp = sub.add_parser("compositions", help="GET /api/compositions")

    sp = sub.add_parser("composition", help="GET /api/compositions/<slug>")
    sp.add_argument("slug")

    sp = sub.add_parser("fetch", help="download /audio/<filename> to a local path")
    sp.add_argument("filename")
    sp.add_argument("dest", help="destination file, or a directory")
    add_dry_run(sp, default_dry=False)

    sp = sub.add_parser("import", help="POST multipart /import (field audioFile)")
    sp.add_argument("path")
    add_dry_run(sp, default_dry=True)

    sp = sub.add_parser("attach", help="POST /api/compositions/<slug>/clips")
    sp.add_argument("slug")
    sp.add_argument("filename", help="the name AS THE PORTAL KNOWS IT (see import)")
    sp.add_argument("--label", default=None)
    sp.add_argument("--workspace", default=os.environ.get(ENV_WORKSPACE),
                    help="only used to name a likely directory if the attach is refused")
    add_dry_run(sp, default_dry=True)

    sp = sub.add_parser("note-append", help="append to a composition's notes")
    sp.add_argument("slug")
    sp.add_argument("text")
    sp.add_argument("--replace", action="store_true",
                    help="REPLACE the note instead of appending. Discards what the "
                         "human wrote. Never implied.")
    sp.add_argument("--separator", default="\n")
    add_dry_run(sp, default_dry=True)

    sp = sub.add_parser("add-image", help="POST multipart /api/compositions/<slug>/images")
    sp.add_argument("slug")
    sp.add_argument("path")
    sp.add_argument("--label", default=None)
    add_dry_run(sp, default_dry=True)

    sp = sub.add_parser(
        "crop-remote",
        help="build the ssh command that crops ON THE DEVICE (print-only by default)",
    )
    sp.add_argument("--host", required=True, help="ssh target host")
    sp.add_argument("--slug", default=None, help="composition the crop belongs to (label only)")
    sp.add_argument("--src", required=True, help="source path ON THE DEVICE")
    sp.add_argument("--start", required=True, help="start, seconds or hh:mm:ss")
    sp.add_argument("--end", required=True, help="end, seconds or hh:mm:ss")
    sp.add_argument("--out", required=True, help="output path ON THE DEVICE")
    sp.add_argument("--recordings-dir", default=os.environ.get(ENV_RECDIR),
                    help="if given, the command also copies the crop there so that "
                         "attach can find it")
    sp.add_argument("--ssh-user", default=os.environ.get(ENV_SSH_USER))
    sp.add_argument("--ssh-port", default=os.environ.get(ENV_SSH_PORT))
    sp.add_argument("--run", action="store_true",
                    help="execute it. Without this the command is only printed.")

    sp = sub.add_parser("transcribe", help="REFUSED -- see the message it prints")
    sp.add_argument("rest", nargs="*")

    return p


def print_recordings(items, as_json=False):
    if as_json:
        print(json.dumps(items, indent=2))
        return
    if not items:
        print("EMPTY -- /recordings returned a list of length 0.")
        print("  An empty list is a finding, not a clearance. It means the portal "
              "answered and has nothing.")
        return
    print("%-44s %12s  %s" % ("filename", "bytes", "flags"))
    for r in items:
        flags = []
        for key, mark in (("hasTranscription", "T"), ("isVideo", "V"), ("isMidi", "M")):
            if r.get(key):
                flags.append(mark)
        print("%-44s %12s  %s" % (r.get("filename"), r.get("size"), "".join(flags)))
    print("(%d recordings)" % len(items))


def cmd_identify(portal, args):
    info = portal.identify()
    if args.json:
        print(json.dumps(info, indent=2))
    else:
        print("url                    : %s" % info["url"])
        print("http status            : %s" % info["http_status"])
        print("data-current-workspace : %s" % (info["workspace"] or "<absent>"))
        print("page <title>           : %s" % (info["title"] or "<absent>"))
    print(TRIPLET_WARNING)
    host = (info["host"] or "").lower()
    if host not in ("localhost", "127.0.0.1", "::1", ""):
        port = info["port"]
        print(
            "  This is a REMOTE host. The workspace name above is what the service\n"
            "  calls itself; it is not proof of which code tree answered. If %s is not\n"
            "  declared in your tailnet gateway's peers.conf, a LOCAL service can answer\n"
            "  in its place and look convincing.\n"
            "  The only honest check for an undeclared port:\n"
            "      ssh %s 'curl 127.0.0.1:%s'\n"
            % (("port %s" % port) if port else "that port", host, port if port else "<port>")
        )
    return 0


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    if not args.cmd:
        parser.print_help()
        return 1

    if args.cmd == "transcribe":
        sys.stderr.write(TRANSCRIBE_REFUSAL)
        _ledger(
            "held",
            name="transcribe",
            why="client refuses to send the human's audio to a third party",
            quote="I don't consent that my voice and my original recording goes "
                  "outside of the boundary here.",
        )
        return 3

    if args.cmd == "crop-remote":
        argv_cmd, printable = crop_remote_command(
            host=args.host, src=args.src, start=args.start, end=args.end, out=args.out,
            ssh_user=args.ssh_user, ssh_port=args.ssh_port,
            recordings_dir=args.recordings_dir,
        )
        print("CROP ON THE DEVICE -- the source never leaves it.")
        if args.slug:
            print("  for composition: %s" % args.slug)
        print("  -c copy fails here: the audio is opus and the .m4a (ipod) container "
              "refuses that codec, so ffmpeg writes a 0-byte file; -c:a aac -b:a 160k "
              "re-encodes and works.")
        print()
        print("  " + printable)
        print()
        if not args.run:
            print("PRINT-ONLY. Re-run with --run to execute it.")
            return 0
        print("RUNNING...")
        proc = subprocess.run(argv_cmd)
        _ledger("published", action="crop_remote", host=args.host, slug=args.slug,
                src=args.src, out=args.out, start=args.start, end=args.end,
                exit_code=proc.returncode)
        return proc.returncode

    try:
        portal = Portal(args.url, timeout=args.timeout, insecure=not args.verify_tls)
    except PortalError as exc:
        sys.stderr.write("ERROR: %s\n" % exc)
        return 2

    try:
        if args.cmd == "identify":
            return cmd_identify(portal, args)

        if args.cmd == "recordings":
            print_recordings(portal.recordings(), as_json=args.json)
            return 0

        if args.cmd == "compositions":
            items = portal.compositions()
            if args.json:
                print(json.dumps(items, indent=2))
            elif not items:
                print("EMPTY -- /api/compositions returned a list of length 0.")
                print("  The portal answered. It has no composition. That is a finding.")
            else:
                for c in items:
                    print(c.get("slug"))
                print("(%d compositions)" % len(items))
            return 0

        if args.cmd == "composition":
            comp = portal.composition(args.slug)
            if args.json:
                print(json.dumps(comp, indent=2))
            else:
                print("slug   : %s" % args.slug)
                print("title  : %s" % comp.get("title"))
                print("bpm    : %s" % comp.get("bpm"))
                print("clips  : %d" % len(comp.get("clips") or []))
                print("texts  : %d" % len(comp.get("texts") or []))
                print("images : %d" % len(comp.get("images") or []))
                print("notes  : %d chars" % len(comp.get("notes") or ""))
            return 0

        if args.cmd == "fetch":
            if args.dry_run:
                print("DRY RUN -- nothing downloaded.")
                print("  GET %s" % portal._url("/audio/" + urllib.parse.quote(args.filename)))
                print("  would write to: %s" % os.path.abspath(args.dest))
                return 0
            path, size = portal.fetch(args.filename, args.dest)
            print("fetched %s -> %s (%d bytes)" % (args.filename, path, size))
            _ledger("fetched", portal=portal.base, filename=args.filename,
                    dest=os.path.abspath(path), bytes=size)
            print("  This is a local copy of the human's material. When the measurement\n"
                  "  is done, destroy it:  atelier_consent.py shred %s" % path)
            return 0

        if args.cmd == "import":
            name = portal.import_file(args.path, dry_run=args.dry_run)
            if name:
                print("imported. The portal re-timestamped it: %s" % name)
                print("  Attach THIS name, not the one you sent.")
            return 0

        if args.cmd == "attach":
            res = portal.attach(args.slug, args.filename, label=args.label,
                                dry_run=args.dry_run, workspace=args.workspace)
            if res is not None:
                print(json.dumps(res, indent=2))
            return 0

        if args.cmd == "note-append":
            res = portal.note_append(args.slug, args.text, replace=args.replace,
                                     dry_run=args.dry_run, separator=args.separator)
            if res is not None:
                print("note written (title and bpm preserved).")
            return 0

        if args.cmd == "add-image":
            res = portal.add_image(args.slug, args.path, label=args.label,
                                   dry_run=args.dry_run)
            if res is not None:
                print(json.dumps(res, indent=2))
            return 0

    except PortalError as exc:
        sys.stderr.write("ERROR: %s\n" % exc)
        return 2
    except OSError as exc:
        sys.stderr.write("ERROR: %s\n" % exc)
        return 2

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
