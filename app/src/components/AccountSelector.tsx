"use client";

import { useRouter } from "next/navigation";

export function AccountSelector({
  accounts,
  selectedAccountId,
}: {
  accounts: Array<{ id: string; username: string }>;
  selectedAccountId: string;
}) {
  const router = useRouter();

  if (accounts.length <= 1) return null;

  return (
    <select
      value={selectedAccountId}
      onChange={(event) => router.push(`/panel/analytics?account=${event.target.value}`)}
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
