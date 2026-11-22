#!/usr/bin/env bun

import { readFile } from "node:fs/promises";
import { userInfo } from "node:os";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { approveQuestionFromOperator, errorMessage, PortfolioError } from "./lib.ts";

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      root: { type: "string" },
      id: { type: "string" },
      file: { type: "string" },
      mode: { type: "string" },
    },
  });
  const { root, id, file, mode } = values;
  if (!root || !id || !file || (mode !== "guided" && mode !== "markdown" && mode !== "chat")) {
    throw new PortfolioError(
      "Usage: bun operator-answer.ts --root PATH --id ID --file FILE --mode guided|markdown|chat",
    );
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new PortfolioError("operator approval requires an interactive terminal");
  }

  const name = userInfo().username;
  const reviewedContent = await readFile(file, "utf8");
  console.log(`Portfolio: ${JSON.stringify(root)}`);
  console.log(`Question packet: ${JSON.stringify(id)}`);
  console.log(`Operator account: ${JSON.stringify(name)}`);
  console.log("Review the question and answers below.");
  for (const line of reviewedContent.split("\n")) {
    console.log(JSON.stringify(line));
  }

  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (await terminal.question("Type approve to submit these answers: ") !== "approve") {
      throw new PortfolioError("operator approval cancelled");
    }
  } finally {
    terminal.close();
  }
  const result = await approveQuestionFromOperator(root, id, file, mode, { name, reviewedContent });
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main().catch((error: unknown) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
