import { userInfo } from "node:os";
import { parseArgs } from "node:util";
import { approveFromChat, errorMessage, PortfolioError, prepareChatApproval } from "./lib.ts";

async function prepare(sessionId: string | undefined, client: string): Promise<void> {
  const { values: { id, file, mode = "chat" } } = parseArgs({
    args: Bun.argv.slice(3),
    options: { id: { type: "string" }, file: { type: "string" }, mode: { type: "string" } },
  });
  if (!sessionId || !id || !file || (mode !== "guided" && mode !== "markdown" && mode !== "chat")) {
    throw new PortfolioError(`run in a ${client} session: prepare --id ID --file FILE [--mode guided|markdown|chat]`);
  }
  const content = await prepareChatApproval(process.cwd(), sessionId, id, file, mode);
  console.log(JSON.stringify({ packet: id, content }));
}

async function onUserPrompt(event: { hook_event_name?: string; prompt?: unknown; cwd?: unknown; session_id?: unknown }, sessionPrefix: string): Promise<void> {
  if (event?.hook_event_name !== "UserPromptSubmit" || typeof event.prompt !== "string") return;
  const prompt = event.prompt.trim();
  if (prompt !== "승인" && prompt !== "approve") return;
  if (typeof event.cwd !== "string" || typeof event.session_id !== "string") return;

  const result = await approveFromChat(event.cwd, sessionPrefix + event.session_id, userInfo().username);
  if (result) console.log(`Portfolio recorded human approval ${result.approvalId} for ${result.path}.`);
}

export async function runChatApproval(
  client: string,
  sessionId: string | undefined,
  sessionPrefix = "",
  onSessionStart?: (sessionId: unknown) => Promise<void>,
): Promise<void> {
  const preparing = Bun.argv[2] === "prepare";
  try {
    if (preparing) {
      await prepare(sessionId && sessionPrefix + sessionId, client);
      return;
    }
    const event = await Bun.stdin.json();
    if (event?.hook_event_name === "SessionStart" && onSessionStart) {
      await onSessionStart(event.session_id);
      return;
    }
    await onUserPrompt(event, sessionPrefix);
  } catch (error) {
    if (preparing) {
      console.error(errorMessage(error));
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify({ decision: "block", reason: errorMessage(error) }));
    }
  }
}
