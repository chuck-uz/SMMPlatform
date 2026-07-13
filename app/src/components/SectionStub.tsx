export function SectionStub({ description }: { description: string }) {
  return (
    <div className="p-6 sm:p-8 sm:px-10">
      <p className="max-w-[640px] text-[14.5px] leading-relaxed text-muted-foreground">
        {description}
      </p>
      <div className="mt-6 max-w-[1020px] rounded-[14px] border border-dashed border-border bg-card p-6 text-sm text-subtle">
        Раздел в разработке.
      </div>
    </div>
  );
}
