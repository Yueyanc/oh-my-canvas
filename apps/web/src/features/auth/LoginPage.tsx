import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { EyeIcon, Loading03Icon, LockPasswordIcon, UserCircleIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";

const glowOrbs = [
  {
    id: "lime-orb",
    className: "h-[44rem] w-[44rem]",
    color: "rgba(223, 247, 166, 0.95)",
    size: 704,
    start: { x: 0.08, y: 0.18 },
    velocity: { x: 38, y: 26 }
  },
  {
    id: "warm-orb",
    className: "h-[44rem] w-[44rem]",
    color: "rgba(232, 224, 204, 0.9)",
    size: 704,
    start: { x: 0.78, y: 0.12 },
    velocity: { x: -64, y: 42 }
  },
  {
    id: "sage-orb",
    className: "h-[46rem] w-[46rem]",
    color: "rgba(198, 222, 214, 0.9)",
    size: 736,
    start: { x: 0.42, y: 0.88 },
    velocity: { x: 52, y: -72 }
  }
];

function getOrbBounds(viewport: { width: number; height: number }, size: number) {
  const edgeBleed = size * 0.35;
  return {
    minX: -edgeBleed,
    maxX: viewport.width - size + edgeBleed,
    minY: -edgeBleed,
    maxY: viewport.height - size + edgeBleed
  };
}

function lerp(min: number, max: number, value: number) {
  return min + (max - min) * value;
}

function BouncingGlowOrbs({ reducedMotion }: { reducedMotion: boolean | null }) {
  const orbRefs = React.useRef<Array<HTMLDivElement | null>>([]);

  React.useEffect(() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const orbs = glowOrbs.map((orb) => {
      const bounds = getOrbBounds(viewport, orb.size);
      return {
        x: lerp(bounds.minX, bounds.maxX, orb.start.x),
        y: lerp(bounds.minY, bounds.maxY, orb.start.y),
        vx: orb.velocity.x,
        vy: orb.velocity.y,
        size: orb.size
      };
    });

    function placeOrbs() {
      orbRefs.current.forEach((element, index) => {
        const orb = orbs[index];
        if (!element || !orb) return;
        element.style.transform = `translate3d(${orb.x}px, ${orb.y}px, 0)`;
      });
    }

    placeOrbs();
    if (reducedMotion) return undefined;

    let frameId = 0;
    let previousTime = performance.now();

    function resize() {
      viewport.width = window.innerWidth;
      viewport.height = window.innerHeight;
      orbs.forEach((orb) => {
        const bounds = getOrbBounds(viewport, orb.size);
        orb.x = Math.max(bounds.minX, Math.min(bounds.maxX, orb.x));
        orb.y = Math.max(bounds.minY, Math.min(bounds.maxY, orb.y));
      });
      placeOrbs();
    }

    function tick(time: number) {
      const delta = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;

      orbs.forEach((orb) => {
        const bounds = getOrbBounds(viewport, orb.size);
        orb.x += orb.vx * delta;
        orb.y += orb.vy * delta;

        if (orb.x <= bounds.minX || orb.x >= bounds.maxX) {
          orb.x = Math.max(bounds.minX, Math.min(bounds.maxX, orb.x));
          orb.vx *= -1;
        }
        if (orb.y <= bounds.minY || orb.y >= bounds.maxY) {
          orb.y = Math.max(bounds.minY, Math.min(bounds.maxY, orb.y));
          orb.vy *= -1;
        }
      });

      placeOrbs();
      frameId = requestAnimationFrame(tick);
    }

    window.addEventListener("resize", resize);
    frameId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameId);
    };
  }, [reducedMotion]);

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {glowOrbs.map((orb, index) => (
        <div
          key={orb.id}
          ref={(element) => {
            orbRefs.current[index] = element;
          }}
          className={`absolute left-0 top-0 rounded-full blur-[40px] will-change-transform ${orb.className}`}
          style={{
            background: `radial-gradient(circle at center, ${orb.color} 0%, ${orb.color.replace(
              /0\.\d+\)$/,
              "0.58)"
            )} 44%, transparent 72%)`
          }}
        />
      ))}
    </div>
  );
}

export function LoginPage({ onLogin }: { onLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = React.useState("admin");
  const [password, setPassword] = React.useState("admin123");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
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
      <BouncingGlowOrbs reducedMotion={shouldReduceMotion} />
      <div className="pointer-events-none absolute inset-0 login-field" aria-hidden="true">
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
        <motion.div
          animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[25rem]"
        >
          <Card className="relative w-full border-white/70 bg-white/[0.12] backdrop-blur-[52px] backdrop-saturate-150 [background:linear-gradient(135deg,rgb(255_255_255_/_0.34),rgb(255_255_255_/_0.1))] [box-shadow:0_36px_120px_rgb(35_38_32_/_0.16),0_14px_36px_rgb(35_38_32_/_0.08),inset_0_1px_0_rgb(255_255_255_/_0.65)]">
            <div className="absolute right-7 top-7 rounded-full border border-white/60 bg-white/30 px-3 py-1 text-xs font-medium leading-none text-radar-ink-soft backdrop-blur-xl">
              安全入口
            </div>
            <CardHeader className="space-y-0 p-8 pb-6 pr-28">
              <div className="space-y-2.5">
                <CardTitle className="text-[1.7rem] font-semibold leading-tight tracking-normal text-radar-ink">
                  登录项目模板
                </CardTitle>
                <CardDescription className="max-w-[15rem] text-sm leading-6 text-radar-ink-soft">
                  输入账号密码，进入你的项目面板。
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-8 pt-0">
              <form className="space-y-5" onSubmit={submit}>
                <label className="block space-y-2">
                  <span className="text-[13px] font-medium leading-none text-radar-ink-soft">用户名</span>
                  <div className="relative">
                    <HugeiconsIcon
                      icon={UserCircleIcon}
                      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-radar-ink-muted"
                    />
                    <Input
                      className="h-12 border-white/60 bg-white/45 pl-11 text-[15px] shadow-inner backdrop-blur-xl placeholder:text-radar-ink-muted focus-visible:ring-ring"
                      placeholder="输入用户名"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                    />
                  </div>
                </label>

                <label className="block space-y-2">
                  <span className="text-[13px] font-medium leading-none text-radar-ink-soft">密码</span>
                  <div className="relative">
                    <HugeiconsIcon
                      icon={LockPasswordIcon}
                      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-radar-ink-muted"
                    />
                    <Input
                      className="h-12 border-white/60 bg-white/45 pl-11 pr-11 text-[15px] shadow-inner backdrop-blur-xl placeholder:text-radar-ink-muted focus-visible:ring-ring"
                      placeholder="输入密码"
                      type={isPasswordVisible ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <button
                      aria-label={isPasswordVisible ? "隐藏密码" : "显示密码"}
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-radar-ink-muted transition-[background-color,color,box-shadow,transform] duration-200 ease-out hover:bg-white/45 hover:text-radar-ink-soft hover:shadow-[0_6px_18px_rgb(35_38_32_/_0.08)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setIsPasswordVisible((visible) => !visible)}
                      type="button"
                    >
                      <HugeiconsIcon icon={isPasswordVisible ? ViewOffIcon : EyeIcon} className="h-4 w-4" />
                    </button>
                  </div>
                </label>

                {error ? (
                  <p className="rounded-control border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}

                <Button
                  className="h-12 w-full rounded-full text-[15px] shadow-[0_14px_34px_rgb(35_38_32_/_0.18)]"
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
