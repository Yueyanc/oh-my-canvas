import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon, LockPasswordIcon, Radar02Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";

const glowOrbs = [
  {
    className: "left-[4%] top-[8%] h-80 w-80 bg-[#B9FF3D]/55",
    duration: 8,
    x: [0, 120, 42, 0],
    y: [0, 46, 118, 0],
    scale: [1, 1.18, 0.94, 1]
  },
  {
    className: "bottom-[2%] right-[6%] h-96 w-96 bg-[#7C5CFF]/42",
    duration: 9,
    x: [0, -128, -48, 0],
    y: [0, -74, 58, 0],
    scale: [1, 0.88, 1.14, 1]
  },
  {
    className: "right-[28%] top-[14%] h-64 w-64 bg-[#FF8FC7]/38",
    duration: 7,
    x: [0, -92, 84, 0],
    y: [0, 96, -46, 0],
    scale: [1, 1.2, 0.9, 1]
  },
  {
    className: "bottom-[22%] left-[24%] h-72 w-72 bg-[#52D6FF]/36",
    duration: 10,
    x: [0, 74, 156, 0],
    y: [0, -86, 28, 0],
    scale: [1, 0.9, 1.16, 1]
  }
];

export function LoginPage({ onLogin }: { onLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = React.useState("admin");
  const [password, setPassword] = React.useState("admin123");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const shouldReduceMotion = useReducedMotion();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onLogin(username, password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-radar-canvas px-4 py-10 text-radar-ink">
      <div className="pointer-events-none absolute inset-0 login-field" aria-hidden="true">
        {glowOrbs.map((orb) => (
          <motion.div
            key={orb.className}
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    x: orb.x,
                    y: orb.y,
                    scale: orb.scale,
                    opacity: [0.46, 0.82, 0.58, 0.46]
                  }
            }
            className={`absolute rounded-full blur-xl will-change-transform ${orb.className}`}
            transition={{
              duration: orb.duration,
              ease: "easeInOut",
              repeat: Infinity,
              repeatType: "mirror"
            }}
          />
        ))}

        <motion.div
          animate={shouldReduceMotion ? undefined : { opacity: [0, 0.68, 0], scale: [0.86, 1, 1.1] }}
          className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-radar-line/70"
          transition={{ duration: 7, ease: [0.22, 1, 0.36, 1], repeat: Infinity }}
        />
        <motion.div
          animate={shouldReduceMotion ? undefined : { opacity: [0, 0.52, 0], scale: [0.82, 1, 1.08] }}
          className="absolute left-1/2 top-1/2 h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-radar-line/60"
          transition={{ delay: 1.6, duration: 7, ease: [0.22, 1, 0.36, 1], repeat: Infinity }}
        />
      </div>

      <section className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-center">
        <div className="absolute h-[32rem] w-[32rem] rounded-full bg-radar-surface/78 blur-2xl" aria-hidden="true" />
        <motion.div
          animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[24rem]"
        >
          <Card className="w-full border-white/55 bg-radar-surface/58 shadow-[0_28px_90px_rgb(35_38_32_/_0.16)] backdrop-blur-2xl">
            <CardHeader className="space-y-4 p-6 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/70 bg-white/55 text-radar-ink-soft shadow-card backdrop-blur-xl">
                  <HugeiconsIcon icon={Radar02Icon} className="h-7 w-7" />
                </div>
                <div className="rounded-full border border-radar-line/70 bg-white/35 px-3 py-1 text-xs text-radar-ink-soft backdrop-blur-xl">
                  安全入口
                </div>
              </div>
              <div>
                <CardTitle className="text-2xl font-semibold tracking-normal text-radar-ink">登录信息雷达</CardTitle>
                <CardDescription className="mt-2 text-sm text-radar-ink-soft">
                  输入账号密码后进入工作台。
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <form className="space-y-3" onSubmit={submit}>
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-radar-ink-soft">用户名</span>
                  <div className="relative">
                    <HugeiconsIcon
                      icon={UserCircleIcon}
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-radar-ink-muted"
                    />
                    <Input
                      className="h-11 border-white/60 bg-white/45 pl-9 shadow-inner backdrop-blur-xl placeholder:text-radar-ink-muted focus-visible:ring-radar-lime"
                      placeholder="请输入用户名"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                    />
                  </div>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-radar-ink-soft">密码</span>
                  <div className="relative">
                    <HugeiconsIcon
                      icon={LockPasswordIcon}
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-radar-ink-muted"
                    />
                    <Input
                      className="h-11 border-white/60 bg-white/45 pl-9 shadow-inner backdrop-blur-xl placeholder:text-radar-ink-muted focus-visible:ring-radar-lime"
                      placeholder="请输入密码"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </div>
                </label>

                {error ? (
                  <p className="rounded-control border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}

                <Button
                  className="mt-2 h-11 w-full rounded-full shadow-[0_14px_34px_rgb(35_38_32_/_0.18)]"
                  disabled={isSubmitting || !username.trim() || !password}
                  type="submit"
                >
                  {isSubmitting ? (
                    <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin" />
                  ) : (
                    <HugeiconsIcon icon={LockPasswordIcon} className="h-4 w-4" />
                  )}
                  {isSubmitting ? "登录中" : "登录"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </section>
    </main>
  );
}
