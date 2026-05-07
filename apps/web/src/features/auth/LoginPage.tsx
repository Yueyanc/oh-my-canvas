import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon, LockPasswordIcon } from "@hugeicons/core-free-icons";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";

export function LoginPage({ onLogin }: { onLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = React.useState("admin");
  const [password, setPassword] = React.useState("admin123");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
            <HugeiconsIcon icon={LockPasswordIcon} className="h-5 w-5" />
          </div>
          <CardTitle className="text-lg">登录信息雷达</CardTitle>
          <CardDescription>输入账号密码后进入工作台。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={submit}>
            <Input placeholder="用户名" value={username} onChange={(event) => setUsername(event.target.value)} />
            <Input
              placeholder="密码"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button className="w-full" disabled={isSubmitting || !username.trim() || !password} type="submit">
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
    </main>
  );
}
