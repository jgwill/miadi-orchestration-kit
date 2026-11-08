"""Redact before JSON serialization, so quoted/newline values cannot break the ledger.

Patterns follow the Claude capture sanitizer; this Python implementation is canonical
for Hermes. No credential files are opened and no secret prefixes are retained.
"""

import os
import re

REDACTED = "[REDACTED]"
SENSITIVE = re.compile(
    r"api[_-]?key|secret|password|passwd|credential|authorization|cookie|private[_-]?key|"
    r"(?:access|refresh|auth)[_-]?token|(?:^|_)token$", re.I,
)
SHAPES = re.compile(
    r"-----BEGIN [^-]*PRIVATE KEY-----.*?-----END [^-]*PRIVATE KEY-----|"
    r"PuTTY-User-Key-File-\d[^\n]*(?:\n.*)*|"
    r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|"
    r"\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}|"
    r"\bglpat-[A-Za-z0-9_-]{18,}|"
    r"(?<![A-Za-z0-9])sk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}|"
    r"\bxox[baprs]-[A-Za-z0-9-]{10,}|"
    r"\bAIza[A-Za-z0-9_-]{35}|\bya29\.[A-Za-z0-9_-]{20,}|"
    r"\bhf_[A-Za-z0-9]{20,}|\bnpm_[A-Za-z0-9]{30,}|"
    r"\b(?:sk|pk|rk)_live_[A-Za-z0-9]{20,}|"
    r"\b(?:dop_v1_|shpat_)[A-Za-z0-9]{32,}|"
    r"\b(?:mwt_|mr_)[A-Za-z0-9_-]{32,}|"
    r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}",
    re.S,
)
URL_PASSWORD = re.compile(r"(\b[A-Za-z][A-Za-z0-9+.-]*://[^\s/:@\"'<>]*:)[^\s@/\"'<>]+(@)")
BEARER = re.compile(r"(\bBearer\s+)[A-Za-z0-9._~+/=-]+", re.I)
ASSIGNMENT = re.compile(
    r"(\b[A-Za-z0-9_.-]*(?:api[_-]?key|secret|token|passwd|password|private[_-]?key)"
    r"[A-Za-z0-9_.-]*\b[\"'\s]*[:=]\s*)(?:\"[^\"]*\"|'[^']*'|[^\s,;}]+)", re.I,
)
PHP_DEFINE = re.compile(
    r"(\bdefine\(\s*[\"'][A-Za-z0-9_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|KEY|SALT)"
    r"[A-Za-z0-9_]*[\"']\s*,\s*)('[^']*'|\"[^\"]*\")", re.I,
)


class Redactor:
    def __init__(self, environ=None):
        env = os.environ if environ is None else environ
        # Only held values, not the environment itself, leave this constructor.
        self.held = sorted({v for k, v in env.items()
                            if SENSITIVE.search(k) and isinstance(v, str) and len(v) >= 8},
                           key=len, reverse=True)

    def text(self, value):
        for secret in self.held:
            value = value.replace(secret, REDACTED)
        value = SHAPES.sub(REDACTED, value)
        value = URL_PASSWORD.sub(lambda m: m[1] + REDACTED + m[2], value)
        value = BEARER.sub(lambda m: m[1] + REDACTED, value)
        value = PHP_DEFINE.sub(lambda m: m[1] + "'" + REDACTED + "'", value)
        return ASSIGNMENT.sub(lambda m: m[1] + REDACTED, value)

    def clean(self, value, depth=0):
        if depth > 64:
            return "[omitted: nesting limit]"
        if isinstance(value, str):
            return self.text(value)
        if value is None or isinstance(value, (bool, int, float)):
            return value
        if isinstance(value, dict):
            return {self.text(str(k)): REDACTED if SENSITIVE.search(str(k))
                    else self.clean(v, depth + 1) for k, v in value.items()}
        if isinstance(value, (list, tuple)):
            return [self.clean(v, depth + 1) for v in value]
        # Never repr() an SDK object; it might contain headers or credentials.
        return "[omitted: non-JSON value]"
