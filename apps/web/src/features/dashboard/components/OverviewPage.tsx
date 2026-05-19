import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  LockPasswordIcon,
  Settings02Icon,
  UserCircleIcon
} from "@hugeicons/core-free-icons";

const features = [
  {
    icon: UserCircleIcon,
    title: "账号登录",
    description: "内置默认账号、Cookie 会话、账号资料编辑和退出登录流程。"
  },
  {
    icon: LockPasswordIcon,
    title: "权限保护",
    description: "所有 /api 路由默认受会话保护，登录状态失效会自动回到登录页。"
  },
  {
    icon: Settings02Icon,
    title: "前端面板",
    description: "保留侧边栏、顶栏、主题切换、字体切换和账号设置抽屉。"
  }
];

export function OverviewPage() {
  return (
    <section className="flex w-full flex-col gap-5">
      <div className="rounded-card border border-radar-line bg-radar-surface/90 p-6 shadow-card">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase text-radar-ink-muted">
          <HugeiconsIcon icon={DashboardSquare01Icon} className="h-4 w-4 text-primary" />
          Project Template
        </div>
        <h1 className="mt-3 text-[1.8rem] font-semibold leading-tight text-radar-ink sm:text-3xl">
          基础项目模板
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-radar-ink-soft">
          这是一个干净的全栈模板，保留登录、权限、账户设置和基础后台面板。你可以从这里继续接入自己的业务模块。
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {features.map((feature) => (
          <article className="rounded-card border border-radar-line bg-radar-surface/90 p-4 shadow-card" key={feature.title}>
            <HugeiconsIcon icon={feature.icon} className="h-5 w-5 text-primary" />
            <h2 className="mt-3 text-sm font-semibold text-radar-ink">{feature.title}</h2>
            <p className="mt-2 text-sm leading-6 text-radar-ink-soft">{feature.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
