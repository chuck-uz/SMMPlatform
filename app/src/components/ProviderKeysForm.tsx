"use client";

import { useState, useTransition } from "react";
import { removeProviderKeyAction, saveProviderKeyAction } from "@/app/panel/connections/actions";

export interface ProviderCredentialView {
  provider: string;
  verified: boolean;
}

const PROVIDER_META: Record<string, { label: string; hint: string; placeholder: string }> = {
  anthropic: {
    label: "Anthropic",
    hint: "Claude напрямую. Ключ — console.anthropic.com",
    placeholder: "sk-ant-…",
  },
  openrouter: {
    label: "OpenRouter",
    hint: "Шлюз к сотням моделей — удобен, чтобы перебирать варианты",
    placeholder: "sk-or-…",
  },
  deepseek: {
    label: "DeepSeek",
    hint: "Нативный API DeepSeek (platform.deepseek.com)",
    placeholder: "sk-…",
  },
};

function ProviderRow({ provider, existing }: { provider: string; existing?: ProviderCredentialView }) {
  const meta = PROVIDER_META[provider];
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (isPending || !apiKey.trim()) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const { verified } = await saveProviderKeyAction(provider, apiKey);
        setApiKey("");
        setNotice(verified ? "Ключ сохранён и проверен" : "Ключ сохранён, но провайдер его не принял");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось сохранить ключ");
      }
    });
  }

  function handleRemove() {
    if (isPending) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        await removeProviderKeyAction(provider);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось удалить ключ");
      }
    });
  }

  return (
    <div className="border-t border-border px-4 py-3 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[13.5px] font-medium text-foreground">{meta.label}</div>
          <div className="mt-0.5 text-[12px] text-subtle">{meta.hint}</div>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-[10px] py-1 text-xs font-semibold ${
            !existing
              ? "bg-muted text-subtle"
              : existing.verified
                ? "bg-accent/10 text-accent-hover"
                : "bg-warning/10 text-warning"
          }`}
        >
          {!existing ? "Не подключён" : existing.verified ? "Подключён" : "Не проверен"}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={existing ? "Ввести новый ключ" : meta.placeholder}
          disabled={isPending}
          className="min-w-0 flex-1 rounded-sm border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !apiKey.trim()}
          className="cursor-pointer rounded-sm bg-accent px-3 py-2 text-[13px] font-medium text-white transition-colors duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Сохранение…" : "Сохранить"}
        </button>
        {existing ? (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isPending}
            className="cursor-pointer rounded-sm border border-border px-3 py-2 text-[13px] text-subtle transition-colors duration-200 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
          >
            Удалить
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-[12.5px] text-destructive">{error}</p> : null}
      {notice ? <p className="mt-2 text-[12.5px] text-subtle">{notice}</p> : null}
    </div>
  );
}

export function ProviderKeysForm({ credentials }: { credentials: ProviderCredentialView[] }) {
  return (
    <div className="rounded-[14px] border border-border bg-card shadow-card">
      {["anthropic", "openrouter", "deepseek"].map((provider) => (
        <ProviderRow
          key={provider}
          provider={provider}
          existing={credentials.find((credential) => credential.provider === provider)}
        />
      ))}
    </div>
  );
}
