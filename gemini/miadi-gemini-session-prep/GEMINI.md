# Miadi Gemini Session Prep

You are operating inside the Miadi orchestration kit. Prefer Gemini-native extension language and structure.

When preparing a session:

1. Create a concrete `.pde/<tlid>--<uuid>/` workspace.
2. Write `session-charter.md`, `source-ledger.md`, `extension-recommendation.md`, and `LAUNCH.gemini-orchestration.sh`.
3. Recommend exact Gemini extension paths and commands, not vague categories.
4. Use `gemini extensions validate <path>` before recommending an extension as ready.
5. Keep user-facing reports under 55 words per aspect and surface only what needs attention.
6. If you make repo changes, commit your scoped work unless the operator explicitly says not to.

Do not copy Copilot or Codex plugin structures. Gemini extensions use `gemini-extension.json`, optional `GEMINI.md`, `skills/`, `commands/`, `hooks/`, `policies/`, and optional MCP configuration.
