import { userInfo } from "node:os";
import { parseArgs } from "node:util";
import { approveFromChat, errorMessage, PortfolioError, prepareChatApproval } from "./lib.ts";

async function prepare(): Promise<void> {
  const { values: { id, file, mode = "chat" } } = parseArgs({
    args: Bun.argv.slice(3),
    options: { id: { type: "string" }, file: { type: "string" }, mode: { type: "string" } },
  });
  const sessionId = process.env.CODEX_THREAD_ID;
  if (!sessionId || !id || !file || (mode !== "guided" && mode !== "markdown" && mode !== "chat")) {
    throw new PortfolioError("run in a Codex thread: prepare --id ID --file FILE [--mode guided|markdown|chat]");
  }
  const content = await prepareChatApproval(process.cwd(), sessionId, id, file, mode);
  console.log(JSON.stringify({ packet: id, content }));
}

async function onUserPrompt(): Promise<void> {
  const event = await Bun.stdin.json();
  if (event?.hook_event_name !== "UserPromptSubmit" || typeof event.prompt !== "string") return;
  if (event.prompt.trim() !== "승인" && event.prompt.trim() !== "approve") return;
  if (typeof event.cwd !== "string" || typeof event.session_id !== "string") return;

  const result = await approveFromChat(event.cwd, event.session_id, userInfo().username);
  if (result) console.log(`Portfolio recorded human approval ${result.approvalId} for ${result.path}.`);
}

const preparing = Bun.argv[2] === "prepare";
try {
  if (preparing) await prepare();
  else await onUserPrompt();
} catch (error) {
  if (preparing) {
    console.error(errorMessage(error));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ decision: "block", reason: errorMessage(error) }));
  }
}
