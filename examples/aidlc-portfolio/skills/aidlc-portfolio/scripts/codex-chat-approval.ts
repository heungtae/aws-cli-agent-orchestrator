import { runChatApproval } from "./chat-approval.ts";

await runChatApproval("Codex", process.env.CODEX_THREAD_ID);
