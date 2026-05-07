export function ContentPlaceholder() {
  return (
    <section className="flex min-h-[480px] w-full items-center justify-center rounded-card border border-dashed border-radar-line bg-radar-surface/70 text-radar-ink-muted">
      <div className="text-center">
        <p className="text-sm font-medium text-radar-ink-soft">内容区占位</p>
        <p className="mt-1 text-xs">Dashboard 内容已临时屏蔽</p>
      </div>
    </section>
  );
}
