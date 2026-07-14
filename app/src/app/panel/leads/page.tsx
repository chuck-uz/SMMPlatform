import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { LeadCard } from "@/components/LeadCard";

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Все" },
  { value: "new", label: "Новые" },
  { value: "in_progress", label: "В работе" },
  { value: "closed", label: "Закрытые" },
];

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const status = STATUS_TABS.some((tab) => tab.value === statusParam) ? statusParam : "all";

  const leads = await prisma.lead.findMany({
    where: status === "all" ? {} : { status },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6 sm:p-8 sm:px-10">
      <p className="max-w-[640px] text-[14.5px] leading-relaxed text-muted-foreground">
        Заявки, которые агент собрал в диалогах — с полнотой данных, источником и рабочим
        статусом. Возьмите заявку в работу, когда начнёте её вести.
      </p>

      <div className="mt-5 flex gap-1">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === "all" ? "/panel/leads" : `/panel/leads?status=${tab.value}`}
            className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
              status === tab.value
                ? "bg-accent/10 text-accent"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 max-w-[1020px] space-y-3">
        {leads.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-border bg-card p-6 text-sm text-subtle">
            Заявок пока нет.
          </div>
        ) : (
          leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)
        )}
      </div>
    </div>
  );
}
