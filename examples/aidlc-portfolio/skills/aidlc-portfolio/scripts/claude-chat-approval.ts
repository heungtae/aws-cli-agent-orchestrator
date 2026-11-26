import { appendFile } from "node:fs/promises";
import { runChatApproval } from "./chat-approval.ts";

await runChatApproval(
  "Claude Code",
  process.env.AIDLC_CLAUDE_SESSION_ID,
  "claude-",
  async (sessionId) => {
    const envFile = process.env.CLAUDE_ENV_FILE;
    if (envFile && typeof sessionId === "string" && /^[a-z0-9][a-z0-9-]*$/.test(sessionId)) {
      await appendFile(envFile, `export AIDLC_CLAUDE_SESSION_ID=${sessionId}\n`);
    }
  },
);
