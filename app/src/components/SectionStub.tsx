export function SectionStub({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <h1 className="font-semibold text-2xl text-foreground">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        Раздел в разработке.
      </div>
    </div>
  );
}
