"use client";

import { useMemo, useState, useTransition } from "react";
import { runModelComparisonAction } from "@/app/panel/models/actions";
import {
  extractClientTurns,
  parseManualTurns,
  planComparison,
  summariseRun,
  targetKey,
  type ComparisonResultRow,
  type ComparisonTarget,
} from "@/lib/modelComparison";

export interface ExampleOption {
  id: string;
  preview: string;
  turns: Array<{ role: string; content: string }>;
}

export interface ModelOption extends ComparisonTarget {
  label: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
};

export function ModelComparison({
  examples,
  modelOptions,
  availableProviders,
}: {
  examples: ExampleOption[];
  modelOptions: ModelOption[];
  availableProviders: string[];
}) {
  const [exampleId, setExampleId] = useState<string>(examples[0]?.id ?? "");
  const [manualText, setManualText] = useState("");
  const [useManual, setUseManual] = useState(examples.length === 0);
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState<ModelOption[]>([]);
  const [newProvider, setNewProvider] = useState(availableProviders[0] ?? "anthropic");
  const [newModel, setNewModel] = useState("");
  const [rows, setRows] = useState<ComparisonResultRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const clientTurns = useMemo(() => {
    if (useManual) return parseManualTurns(manualText);
    const example = examples.find((item) => item.id === exampleId);
    return example ? extractClientTurns(example.turns) : [];
  }, [useManual, manualText, exampleId, examples]);

  const allOptions = [...modelOptions, ...custom];
  const targets = allOptions.filter((option) => selected.includes(targetKey(option)));
  const plan = planComparison(clientTurns, targets);
  const summaries = rows ? summariseRun(rows) : [];

  function toggle(option: ModelOption) {
    const key = targetKey(option);
    setSelected((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  function handleAddCustom() {
    const model = newModel.trim();
    if (!model) return;
    const option: ModelOption = { provider: newProvider, model, label: `${PROVIDER_LABELS[newProvider]} · ${model}` };
    const key = targetKey(option);
    if (!allOptions.some((item) => targetKey(item) === key)) {
      setCustom((current) => [...current, option]);
    }
    setSelected((current) => (current.includes(key) ? current : [...current, key]));
    setNewModel("");
  }

  function handleRun() {
    if (isPending || plan.calls === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await runModelComparisonAction({
          scenarioSource: useManual ? "manual" : "example",
          clientTurns,
          targets: targets.map((target) => ({ provider: target.provider, model: target.model })),
        });
        setRows(result.rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось выполнить прогон");
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[14px] border border-border bg-card p-5 shadow-card">
        <h2 className="text-[13.5px] font-semibold text-foreground">1. Сценарий</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          Все модели отвечают на один и тот же список реплик клиента — иначе сравнение
          получится не о моделях, а о том, что вы по-разному напечатали.
        </p>

        <div className="mt-3 flex flex-wrap gap-3 text-[13px]">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={!useManual}
              onChange={() => setUseManual(false)}
              disabled={examples.length === 0}
            />
            Из сохранённого примера
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={useManual} onChange={() => setUseManual(true)} />
            Ввести вручную
          </label>
        </div>

        {useManual ? (
          <textarea
            value={manualText}
            onChange={(event) => setManualText(event.target.value)}
            rows={5}
            placeholder={"Одна реплика клиента на строку:\nХочу в Дубай в мае\nНас двое\nБюджет до 2000$"}
            className="mt-3 w-full rounded-sm border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent"
          />
        ) : examples.length === 0 ? (
          <p className="mt-3 text-[12.5px] text-subtle">
            Сохранённых примеров пока нет — соберите диалог в песочнице и сохраните его как пример,
            либо введите реплики вручную.
          </p>
        ) : (
          <select
            value={exampleId}
            onChange={(event) => setExampleId(event.target.value)}
            className="mt-3 w-full rounded-sm border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {examples.map((example) => (
              <option key={example.id} value={example.id}>
                {example.preview}
              </option>
            ))}
          </select>
        )}

        {clientTurns.length > 0 ? (
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-[12.5px] text-subtle">
            {clientTurns.map((turn, index) => (
              <li key={index}>{turn}</li>
            ))}
          </ol>
        ) : null}
      </section>

      <section className="rounded-[14px] border border-border bg-card p-5 shadow-card">
        <h2 className="text-[13.5px] font-semibold text-foreground">2. Модели</h2>
        {modelOptions.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-subtle">
            Нет доступных моделей — добавьте ключ провайдера в «Подключениях».
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {allOptions.map((option) => {
              const key = targetKey(option);
              const active = selected.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(option)}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-[12.5px] transition-colors duration-200 ${
                    active
                      ? "border-accent bg-accent/10 text-accent-hover"
                      : "border-border text-subtle hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Catalogues run to hundreds of models, so arbitrary ones are typed in rather than
            listed as chips. With no provider key there is nothing to add against, and an
            empty provider dropdown just reads as broken. */}
        {availableProviders.length === 0 ? (
          <p className="mt-3 text-[12.5px] text-subtle">
            Чтобы добавить другую модель, сначала подключите провайдера в{" "}
            <a href="/panel/connections" className="underline underline-offset-2 hover:text-foreground">
              «Подключениях»
            </a>
            .
          </p>
        ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            aria-label="Провайдер новой модели"
            value={newProvider}
            onChange={(event) => setNewProvider(event.target.value)}
            className="rounded-sm border border-border bg-background px-2 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {availableProviders.map((provider) => (
              <option key={provider} value={provider}>
                {PROVIDER_LABELS[provider] ?? provider}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newModel}
            onChange={(event) => setNewModel(event.target.value)}
            placeholder="ID модели, например deepseek-chat"
            className="min-w-0 flex-1 rounded-sm border border-border bg-background px-3 py-2 font-mono text-[12.5px] text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="button"
            onClick={handleAddCustom}
            disabled={!newModel.trim()}
            className="cursor-pointer rounded-sm border border-border px-3 py-2 text-[13px] text-subtle transition-colors duration-200 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            Добавить
          </button>
        </div>
        )}
      </section>

      <section className="rounded-[14px] border border-border bg-card p-5 shadow-card">
        <h2 className="text-[13.5px] font-semibold text-foreground">3. Прогон</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          Будет выполнено <strong className="text-foreground">{plan.calls}</strong> платных вызовов
          ({plan.targets} мод. × {plan.turns} реплик). Точная стоимость зависит от тарифа модели —
          фактические токены видны в таблице после прогона.
        </p>
        <button
          type="button"
          onClick={handleRun}
          disabled={isPending || plan.calls === 0}
          className="mt-3 cursor-pointer rounded-sm bg-accent px-4 py-2 text-[13px] font-medium text-white transition-colors duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Идёт прогон…" : "Запустить сравнение"}
        </button>
        {error ? <p className="mt-2 text-[12.5px] text-destructive">{error}</p> : null}
      </section>

      {summaries.length > 0 ? (
        <section className="rounded-[14px] border border-border bg-card p-5 shadow-card">
          <h2 className="text-[13.5px] font-semibold text-foreground">Итоги</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[12.5px]">
              <thead className="text-subtle">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Модель</th>
                  <th className="pb-2 pr-4 font-medium">Полей заявки</th>
                  <th className="pb-2 pr-4 font-medium">Механизм</th>
                  <th className="pb-2 pr-4 font-medium">Ретраи</th>
                  <th className="pb-2 pr-4 font-medium">Сбои</th>
                  <th className="pb-2 pr-4 font-medium">Задержка</th>
                  <th className="pb-2 font-medium">Токены вх/исх</th>
                </tr>
              </thead>
              <tbody className="text-foreground">
                {summaries.map((summary) => (
                  <tr key={targetKey(summary)} className="border-t border-border">
                    <td className="py-2 pr-4 font-mono text-[12px]">
                      {summary.provider}/{summary.model}
                    </td>
                    <td className="py-2 pr-4">{summary.fieldsFilled} / 6</td>
                    <td className="py-2 pr-4">{summary.mechanism}</td>
                    <td className={`py-2 pr-4 ${summary.totalRetries > 0 ? "text-warning" : ""}`}>
                      {summary.totalRetries}
                    </td>
                    <td className={`py-2 pr-4 ${summary.failures > 0 ? "text-destructive" : ""}`}>
                      {summary.failures}
                    </td>
                    <td className="py-2 pr-4">{summary.avgLatencyMs} мс</td>
                    <td className="py-2">
                      {summary.totalInputTokens} / {summary.totalOutputTokens}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {rows && rows.length > 0 ? (
        <section className="rounded-[14px] border border-border bg-card p-5 shadow-card">
          <h2 className="text-[13.5px] font-semibold text-foreground">Ответы по репликам</h2>
          <div className="mt-3 space-y-4">
            {clientTurns.map((turn, turnIndex) => (
              <div key={turnIndex}>
                <p className="text-[12.5px] font-medium text-foreground">
                  {turnIndex + 1}. Клиент: {turn}
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {rows
                    .filter((row) => row.turnIndex === turnIndex)
                    .map((row) => (
                      <div key={`${targetKey(row)}-${turnIndex}`} className="rounded-[10px] border border-border p-3">
                        <div className="font-mono text-[11.5px] text-subtle">
                          {row.provider}/{row.model}
                        </div>
                        {row.error ? (
                          <p className="mt-1 text-[12.5px] text-destructive">{row.error}</p>
                        ) : (
                          <p className="mt-1 text-[13px] leading-relaxed text-foreground">{row.reply}</p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
