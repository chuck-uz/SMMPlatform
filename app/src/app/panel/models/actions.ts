"use server";

import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { respondAndExtractLead } from "@/lib/agentClient";
import { buildCurrentAgentSystemPrompt } from "@/lib/currentAgentPrompt";
import { LlmCompletionError } from "@/lib/llm";
import { isSupportedProvider } from "@/lib/llm/router";
import type { ComparisonResultRow, ComparisonTarget } from "@/lib/modelComparison";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    throw new Error("Доступно только администратору");
  }
}

export async function runModelComparisonAction(params: {
  scenarioSource: string;
  clientTurns: string[];
  targets: ComparisonTarget[];
}): Promise<{ runId: string; rows: ComparisonResultRow[] }> {
  await requireAdmin();

  const clientTurns = params.clientTurns.map((turn) => turn.trim()).filter((turn) => turn.length > 0);
  if (clientTurns.length === 0) {
    throw new Error("Сценарий пуст — добавьте хотя бы одну реплику клиента");
  }
  if (params.targets.length === 0) {
    throw new Error("Выберите хотя бы одну модель");
  }
  for (const target of params.targets) {
    if (!isSupportedProvider(target.provider) || !target.model.trim()) {
      throw new Error("Некорректная модель в списке");
    }
  }

  const systemPrompt = await buildCurrentAgentSystemPrompt();
  const rows: ComparisonResultRow[] = [];

  for (const target of params.targets) {
    // Each model replays the identical script with its own conversation history.
    const history: Array<{ role: "user" | "assistant"; content: string }> = [];

    for (let turnIndex = 0; turnIndex < clientTurns.length; turnIndex++) {
      history.push({ role: "user", content: clientTurns[turnIndex] });

      try {
        const outcome = await respondAndExtractLead(systemPrompt, history, {
          provider: target.provider as never,
          model: target.model,
        });

        history.push({ role: "assistant", content: outcome.reply });
        rows.push({
          provider: target.provider,
          model: target.model,
          turnIndex,
          reply: outcome.reply,
          fields: outcome.fields,
          mechanism: outcome.mechanism,
          retries: outcome.retries,
          latencyMs: outcome.latencyMs,
          inputTokens: outcome.inputTokens ?? null,
          outputTokens: outcome.outputTokens ?? null,
          error: null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[model-comparison] ${target.provider}/${target.model} failed on turn ${turnIndex}`, error);
        rows.push({
          provider: target.provider,
          model: target.model,
          turnIndex,
          reply: null,
          fields: null,
          mechanism: "—",
          // A failed turn still cost calls; reporting 0 here would make a weak model look free.
          retries: error instanceof LlmCompletionError ? error.retries : 0,
          latencyMs: 0,
          inputTokens: null,
          outputTokens: null,
          error: message,
        });
        // Without a reply the conversation cannot continue for this model; the remaining
        // turns would compare nothing. Other models keep running.
        break;
      }
    }
  }

  const run = await prisma.modelComparisonRun.create({
    data: {
      scenarioSource: params.scenarioSource,
      scenarioTurns: clientTurns as unknown as Prisma.InputJsonValue,
      results: {
        create: rows.map((row) => ({
          provider: row.provider,
          model: row.model,
          turnIndex: row.turnIndex,
          reply: row.reply,
          fields: (row.fields ?? undefined) as unknown as Prisma.InputJsonValue,
          mechanism: row.mechanism,
          retries: row.retries,
          latencyMs: row.latencyMs,
          inputTokens: row.inputTokens,
          outputTokens: row.outputTokens,
          error: row.error,
        })),
      },
    },
  });

  return { runId: run.id, rows };
}
