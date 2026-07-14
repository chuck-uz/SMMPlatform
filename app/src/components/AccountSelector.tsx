"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function AccountSelector({
  accounts,
  selectedAccountId,
}: {
  accounts: Array<{ id: string; username: string }>;
  selectedAccountId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (accounts.length <= 1) return null;

  function handleChange(accountId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("account", accountId);
    router.push(`/panel/analytics?${params.toString()}`);
  }

  return (
    <select
      value={selectedAccountId}
      onChange={(event) => handleChange(event.target.value)}
      className="rounded-[10px] border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-card"
    >
      {accounts.map((account) => (
        <option key={account.id} value={account.id}>
          @{account.username}
        </option>
      ))}
    </select>
  );
}
