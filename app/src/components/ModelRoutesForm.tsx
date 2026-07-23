"use client";

import { useEffect, useState, useTransition } from "react";
import { loadProviderModelsAction, saveModelRouteAction } from "@/app/panel/connections/actions";

export interface RouteView {
  interactionType: string;
  provider: string;
  model: string;
}

interface CatalogModel {
  id: string;
  label: string;
  supportsStructuredOutputs: boolean;
}

const INTERACTION_LABELS: Record<string, { title: string; hint: string }> = {
  agent_dialog: { title: "Диалог агента", hint: "Общение с клиентом и сбор заявки" },
  comment_reply: { title: "Автоответы на комментарии", hint: "Короткие публичные ответы" },
  analytics: { title: "AI-разбор аналитики", hint: "Внутренний отчёт, не виден клиентам" },
  content_plan: { title: "Контент-план (AI)", hint: "Стратегия и план публикаций" },
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
};

function RouteRow({ route, availableProviders }: { route: RouteView; availableProviders: string[] }) {
  const meta = INTERACTION_LABELS[route.interactionType];
  const [provider, setProvider] = useState(route.provider);
  const [model, setModel] = useState(route.model);
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  // The effect only starts the fetch; the "loading" flag is raised by whatever triggered the
  // change (initial state or the provider selector), so no state is set synchronously here.
  useEffect(() => {
    let cancelled = false;
    loadProviderModelsAction(provider)
      .then((result) => {
        if (cancelled) return;
        setModels(result.models);
        setCatalogError(result.error ?? null);
        setIsLoadingCatalog(false);
      })
      .catch(() => {
        if (cancelled) return;
        setCatalogError("Не удалось загрузить список моделей");
        setIsLoadingCatalog(false);
      });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  const selected = models.find((item) => item.id === model);

  // The stored model must stay selectable even when the catalogue does not list it (a
  // provider outage, a model retired upstream). Otherwise the select would silently land on
  // a different model and a save would swap it without the admin noticing.
  const options: Array<{ id: string }> = selected || !model ? models : [{ id: model }, ...models];

  function handleSave() {
    if (isPending || !model.trim()) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        await saveModelRouteAction({ interactionType: route.interactionType, provider, model });
        setNotice("Сохранено");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось сохранить");
      }
    });
  }

  function handleRefresh() {
    setIsLoadingCatalog(true);
    loadProviderModelsAction(provider, true)
      .then((result) => {
        setModels(result.models);
        setCatalogError(result.error ?? null);
      })
      .finally(() => setIsLoadingCatalog(false));
  }

  return (
    <div className="border-t border-border px-4 py-3 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-[13.5px] font-medium text-foreground">{meta?.title ?? route.interactionType}</div>
          <div className="mt-0.5 text-[12px] text-subtle">{meta?.hint}</div>
        </div>
        {selected ? (
          <span className="text-[11.5px] text-subtle">
            {selected.supportsStructuredOutputs ? "схема поддерживается" : "схемы нет — ответ по промпту"}
          </span>
        ) : null}
      </div>

      <div className="mt-2.5 grid gap-2 sm:grid-cols-[minmax(0,150px)_minmax(0,1fr)_auto]">
        <select
          aria-label="Провайдер"
          value={provider}
          onChange={(event) => {
            setProvider(event.target.value);
            setModel("");
            setIsLoadingCatalog(true);
            setCatalogError(null);
          }}
          disabled={isPending}
          className="rounded-sm border border-border bg-background px-2 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
        >
          {Object.keys(PROVIDER_LABELS).map((item) => (
            <option key={item} value={item} disabled={!availableProviders.includes(item)}>
              {PROVIDER_LABELS[item]}
              {availableProviders.includes(item) ? "" : " (нет ключа)"}
            </option>
          ))}
        </select>

        <select
          aria-label="Модель"
          value={model}
          onChange={(event) => setModel(event.target.value)}
          disabled={isPending || isLoadingCatalog || options.length === 0}
          className="min-w-0 rounded-sm border border-border bg-background px-2 py-2 font-mono text-[12.5px] text-foreground focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
        >
          {isLoadingCatalog ? (
            <option value={model}>Загрузка моделей…</option>
          ) : options.length === 0 ? (
            <option value="">Моделей нет</option>
          ) : (
            options.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id}
              </option>
            ))
          )}
        </select>

        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !model.trim()}
            className="cursor-pointer rounded-sm bg-accent px-3 py-2 text-[13px] font-medium text-white transition-colors duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "…" : "Сохранить"}
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoadingCatalog}
            title="Обновить список моделей"
            className="cursor-pointer rounded-sm border border-border px-3 py-2 text-[13px] text-subtle transition-colors duration-200 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            ↻
          </button>
        </div>
      </div>

      {catalogError ? <p className="mt-2 text-[12.5px] text-warning">{catalogError}</p> : null}
      {error ? <p className="mt-2 text-[12.5px] text-destructive">{error}</p> : null}
      {notice ? <p className="mt-2 text-[12.5px] text-subtle">{notice}</p> : null}
    </div>
  );
}

export function ModelRoutesForm({
  routes,
  availableProviders,
}: {
  routes: RouteView[];
  availableProviders: string[];
}) {
  return (
    <div className="rounded-[14px] border border-border bg-card shadow-card">
      {routes.map((route) => (
        <RouteRow key={route.interactionType} route={route} availableProviders={availableProviders} />
      ))}
    </div>
  );
}
