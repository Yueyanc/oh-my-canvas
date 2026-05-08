import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence, motion } from "motion/react";
import {
  BellDotIcon,
  BookTypeIcon,
  Camera01Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  ColorsIcon,
  Globe02Icon,
  LockPasswordIcon,
  Logout03Icon,
  Menu01Icon,
  MenuCollapseIcon,
  Message02Icon,
  UserCircleIcon
} from "@hugeicons/core-free-icons";
import { Button } from "../../../components/ui/button";
import { AnimatedThemeToggler, runThemeTransition } from "../../../components/ui/animated-theme-toggler";
import { Input } from "../../../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { fontOptions, type FontKey } from "../../../shared/config/fonts";
import { themeOptions, type ThemeMode, type ThemeScheme } from "../../../shared/hooks/use-theme-mode";

type AccountUpdateInput = { username: string; avatarUrl: string | null };
type PasswordChangeInput = { currentPassword: string; newPassword: string };
type IconData = React.ComponentProps<typeof HugeiconsIcon>["icon"];

export function DashboardTopbar({
  avatarUrl,
  fontKey,
  isSidebarExpanded,
  themeMode,
  themeScheme,
  username,
  onAccountUpdate,
  onFontChange,
  onThemeModeChange,
  onThemeSchemeChange,
  onPasswordChange,
  onLogout,
  onSidebarToggle
}: {
  avatarUrl?: string | null;
  fontKey: FontKey;
  isSidebarExpanded: boolean;
  themeMode: ThemeMode;
  themeScheme: ThemeScheme;
  username?: string;
  onAccountUpdate: (input: AccountUpdateInput) => Promise<void>;
  onFontChange: (fontKey: FontKey) => void;
  onThemeModeChange: (mode: ThemeMode) => void;
  onThemeSchemeChange: (scheme: ThemeScheme) => void;
  onPasswordChange: (input: PasswordChangeInput) => Promise<void>;
  onLogout: () => void;
  onSidebarToggle: () => void;
}) {
  const [isFontMenuOpen, setIsFontMenuOpen] = React.useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = React.useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = React.useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const [isAccountPanelOpen, setIsAccountPanelOpen] = React.useState(false);
  const [language, setLanguage] = React.useState("中文");
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) closeMenus();
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenus();
        setIsAccountPanelOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function closeMenus() {
    setIsFontMenuOpen(false);
    setIsLanguageMenuOpen(false);
    setIsThemeMenuOpen(false);
    setIsUserMenuOpen(false);
  }

  return (
    <>
      <header className="flex min-h-[88px] w-full items-center gap-4 py-2 pl-2 pr-4 sm:pl-3 sm:pr-6 lg:pl-4 lg:pr-8">
        <div className="flex min-w-0 items-center">
          <button
            aria-label={isSidebarExpanded ? "收起侧边栏" : "展开侧边栏"}
            className="flex h-10 w-10 items-center justify-center rounded-full text-radar-ink-muted transition-colors duration-200 hover:bg-radar-surface hover:text-radar-ink"
            onClick={onSidebarToggle}
            type="button"
          >
            <HugeiconsIcon icon={isSidebarExpanded ? MenuCollapseIcon : Menu01Icon} className="h-5 w-5" />
          </button>
        </div>

        <div className="min-w-0 flex-1" />

        <div className="flex shrink-0 justify-end">
          <div className="flex items-center gap-2" ref={menuRef}>
            <div className="relative">
              <TopbarIconButton
                ariaLabel="切换字体"
                icon={BookTypeIcon}
                isActive={isFontMenuOpen}
                onClick={() => {
                  setIsFontMenuOpen((current) => !current);
                  setIsLanguageMenuOpen(false);
                  setIsThemeMenuOpen(false);
                  setIsUserMenuOpen(false);
                }}
              />

              <AnimatePresence>
                {isFontMenuOpen ? (
                  <AnimatedMenu className="w-44">
                    {fontOptions.map((option) => (
                      <button
                        className="flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-left text-radar-ink-soft transition-colors duration-200 hover:bg-radar-surface-soft hover:text-radar-ink"
                        key={option.key}
                        onClick={() => {
                          onFontChange(option.key);
                          setIsFontMenuOpen(false);
                        }}
                        type="button"
                      >
                        <span>{option.label}</span>
                        {option.key === fontKey ? (
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-4 w-4 text-primary" />
                        ) : null}
                      </button>
                    ))}
                  </AnimatedMenu>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="relative">
              <TopbarIconButton
                ariaLabel="切换语言"
                icon={Globe02Icon}
                isActive={isLanguageMenuOpen}
                onClick={() => {
                  setIsLanguageMenuOpen((current) => !current);
                  setIsFontMenuOpen(false);
                  setIsThemeMenuOpen(false);
                  setIsUserMenuOpen(false);
                }}
              />

              <AnimatePresence>
                {isLanguageMenuOpen ? (
                  <AnimatedMenu className="w-32">
                    {["中文", "English", "日本語"].map((option) => (
                      <button
                        className="flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-left text-radar-ink-soft transition-colors duration-200 hover:bg-radar-surface-soft hover:text-radar-ink"
                        key={option}
                        onClick={() => {
                          setLanguage(option);
                          setIsLanguageMenuOpen(false);
                        }}
                        type="button"
                      >
                        <span>{option}</span>
                        {option === language ? (
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-4 w-4 text-primary" />
                        ) : null}
                      </button>
                    ))}
                  </AnimatedMenu>
                ) : null}
              </AnimatePresence>
            </div>

            <TopbarIconButton ariaLabel="通知" badge="9" className="hidden sm:flex" icon={BellDotIcon} />
            <TopbarIconButton ariaLabel="消息" className="hidden sm:flex" icon={Message02Icon} />

            <div className="relative">
              <TopbarIconButton
                ariaLabel="切换主题"
                icon={ColorsIcon}
                isActive={isThemeMenuOpen}
                onClick={() => {
                  setIsThemeMenuOpen((current) => !current);
                  setIsFontMenuOpen(false);
                  setIsLanguageMenuOpen(false);
                  setIsUserMenuOpen(false);
                }}
              />

              <AnimatePresence>
                {isThemeMenuOpen ? (
                  <AnimatedMenu className="w-44">
                    {themeOptions.map((option) => (
                      <button
                        className="flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-xl px-3 py-2 text-left text-radar-ink-soft transition-colors duration-200 hover:bg-radar-surface-soft hover:text-radar-ink"
                        key={option.key}
                        onClick={(event) => {
                          setIsThemeMenuOpen(false);
                          if (option.key === themeScheme) return;
                          void runThemeTransition({
                            origin: event.currentTarget,
                            onThemeChange: () => onThemeSchemeChange(option.key)
                          });
                        }}
                        type="button"
                      >
                        <span className="flex items-center gap-2">
                          <span className={`h-3.5 w-3.5 rounded-full border border-radar-line ${option.swatch}`} />
                          {option.label}
                        </span>
                        {option.key === themeScheme ? (
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-4 w-4 text-primary" />
                        ) : null}
                      </button>
                    ))}
                  </AnimatedMenu>
                ) : null}
              </AnimatePresence>
            </div>

            <AnimatedThemeToggler mode={themeMode} onModeChange={onThemeModeChange} />

            <div className="relative">
              <button
                aria-expanded={isUserMenuOpen}
                aria-label="打开账号菜单"
                aria-haspopup="menu"
                className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground shadow-card transition-colors duration-200 hover:bg-primary/90"
                onClick={() => {
                  setIsUserMenuOpen((current) => !current);
                  setIsFontMenuOpen(false);
                  setIsLanguageMenuOpen(false);
                  setIsThemeMenuOpen(false);
                }}
                type="button"
              >
                {avatarUrl ? (
                  <img alt="" className="h-full w-full object-cover" src={avatarUrl} />
                ) : (
                  <HugeiconsIcon icon={UserCircleIcon} className="h-5 w-5" />
                )}
              </button>

              <AnimatePresence>
                {isUserMenuOpen ? (
                  <AnimatedMenu className="w-[11.5rem] min-w-[11.5rem]" role="menu">
                    <button
                      className="flex w-full items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-left text-radar-ink-soft transition-colors duration-200 hover:bg-radar-surface-soft hover:text-radar-ink"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsAccountPanelOpen(true);
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <HugeiconsIcon icon={UserCircleIcon} className="h-4 w-4" />
                      账户设置
                    </button>
                    <button
                      className="flex w-full items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-left text-radar-ink-soft transition-colors duration-200 hover:bg-radar-surface-soft hover:text-radar-ink"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogout();
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <HugeiconsIcon icon={Logout03Icon} className="h-4 w-4" />
                      退出登录
                    </button>
                  </AnimatedMenu>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isAccountPanelOpen ? (
          <AccountPanel
            avatarUrl={avatarUrl}
            username={username}
            onAccountUpdate={onAccountUpdate}
            onClose={() => setIsAccountPanelOpen(false)}
            onPasswordChange={onPasswordChange}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

function TopbarIconButton({
  ariaLabel,
  badge,
  className = "flex",
  icon,
  isActive = false,
  onClick
}: {
  ariaLabel: string;
  badge?: string;
  className?: string;
  icon: IconData;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={isActive || undefined}
      className={`relative h-10 w-10 items-center justify-center rounded-full text-radar-ink-muted transition-colors duration-200 hover:bg-radar-surface-soft hover:text-radar-ink ${
        isActive ? "bg-radar-surface-soft text-radar-ink" : ""
      } ${className}`}
      onClick={onClick}
      type="button"
    >
      <HugeiconsIcon icon={icon} className="h-5 w-5" />
      {badge ? (
        <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function AnimatedMenu({
  children,
  className,
  role
}: {
  children: React.ReactNode;
  className?: string;
  role?: React.AriaRole;
}) {
  return (
    <motion.div
      className={`absolute right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-radar-line bg-radar-surface p-1 text-sm shadow-popover ${
        className ?? ""
      }`}
      initial={{ opacity: 0, y: -4, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.96 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      role={role}
      style={{ originX: 1, originY: 0 }}
    >
      {children}
    </motion.div>
  );
}

function AccountPanel({
  avatarUrl,
  username,
  onAccountUpdate,
  onClose,
  onPasswordChange
}: {
  avatarUrl?: string | null;
  username?: string;
  onAccountUpdate: (input: AccountUpdateInput) => Promise<void>;
  onClose: () => void;
  onPasswordChange: (input: PasswordChangeInput) => Promise<void>;
}) {
  const [profileUsername, setProfileUsername] = React.useState(username ?? "admin");
  const [profileAvatarUrl, setProfileAvatarUrl] = React.useState(avatarUrl ?? "");
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"profile" | "password">("profile");
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setProfileUsername(username ?? "admin");
    setProfileAvatarUrl(avatarUrl ?? "");
  }, [avatarUrl, username]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextUsername = profileUsername.trim();
    if (!nextUsername) {
      setError("用户名不能为空");
      setMessage("");
      return;
    }

    setIsSavingProfile(true);
    setError("");
    setMessage("");
    try {
      await onAccountUpdate({
        username: nextUsername,
        avatarUrl: profileAvatarUrl.trim() ? profileAvatarUrl.trim() : null
      });
      setMessage("账户信息已保存");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存账户信息失败");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 8) {
      setError("新密码至少需要 8 位");
      setMessage("");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      setMessage("");
      return;
    }

    setIsChangingPassword(true);
    setError("");
    setMessage("");
    try {
      await onPasswordChange({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("密码已更新");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "修改密码失败");
    } finally {
      setIsChangingPassword(false);
    }
  }

  function clearStatus() {
    setError("");
    setMessage("");
  }

  function handleTabChange(value: string) {
    setActiveTab(value === "password" ? "password" : "profile");
    clearStatus();
  }

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-radar-ink/20 px-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      onMouseDown={onClose}
    >
      <motion.div
        layout
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.985 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[36rem] rounded-3xl border border-white/70 bg-radar-surface/95 p-6 shadow-popover"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <AvatarPreview avatarUrl={profileAvatarUrl.trim() || null} size="lg" />
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-radar-ink-muted">ACCOUNT</p>
              <h2 className="mt-1 text-2xl font-semibold text-radar-ink">账户设置</h2>
            </div>
          </div>
          <button
            aria-label="关闭账户设置"
            className="flex h-10 w-10 items-center justify-center rounded-full text-radar-ink-muted transition-[background-color,color,transform] duration-200 hover:bg-white hover:text-radar-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-radar-lime"
            onClick={onClose}
            type="button"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="h-5 w-5 stroke-[2.2]" />
          </button>
        </div>

        <Tabs value={activeTab} className="mt-6" onValueChange={handleTabChange}>
          <TabsList className="relative grid w-full grid-cols-2 overflow-hidden">
            <motion.span
              aria-hidden="true"
              className="absolute bottom-1 left-1 top-1 w-[calc(50%-0.25rem)] rounded-full bg-radar-surface shadow-card"
              animate={{ x: activeTab === "password" ? "100%" : "0%" }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            />
            <TabsTrigger value="profile" className="relative z-10">
              <HugeiconsIcon icon={Camera01Icon} className="h-4 w-4" />
              资料
            </TabsTrigger>
            <TabsTrigger value="password" className="relative z-10">
              <HugeiconsIcon icon={LockPasswordIcon} className="h-4 w-4" />
              密码
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <form className="space-y-4" onSubmit={saveProfile}>
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-radar-ink">
                  <HugeiconsIcon icon={Camera01Icon} className="h-4 w-4 text-primary" />
                  资料
                </div>
                <p className="mt-1 text-sm text-radar-ink-muted">修改名称和头像地址。</p>
              </div>
              <label className="block text-sm text-radar-ink-soft">
                用户名
                <Input
                  className="mt-2 rounded-2xl bg-white/70"
                  maxLength={64}
                  value={profileUsername}
                  onChange={(event) => setProfileUsername(event.target.value)}
                />
              </label>
              <label className="block text-sm text-radar-ink-soft">
                头像 URL
                <Input
                  className="mt-2 rounded-2xl bg-white/70"
                  placeholder="https://..."
                  value={profileAvatarUrl}
                  onChange={(event) => setProfileAvatarUrl(event.target.value)}
                />
              </label>
              <Button className="w-full rounded-full" disabled={isSavingProfile} type="submit">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-4 w-4" />
                {isSavingProfile ? "保存中" : "保存资料"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="password">
            <form className="space-y-4" onSubmit={savePassword}>
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-radar-ink">
                  <HugeiconsIcon icon={LockPasswordIcon} className="h-4 w-4 text-primary" />
                  密码
                </div>
                <p className="mt-1 text-sm text-radar-ink-muted">使用当前密码确认后更新。</p>
              </div>
              <label className="block text-sm text-radar-ink-soft">
                当前密码
                <Input
                  className="mt-2 rounded-2xl bg-white/70"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </label>
              <label className="block text-sm text-radar-ink-soft">
                新密码
                <Input
                  className="mt-2 rounded-2xl bg-white/70"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>
              <label className="block text-sm text-radar-ink-soft">
                确认新密码
                <Input
                  className="mt-2 rounded-2xl bg-white/70"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
              <Button className="w-full rounded-full" disabled={isChangingPassword} type="submit">
                <HugeiconsIcon icon={LockPasswordIcon} className="h-4 w-4" />
                {isChangingPassword ? "更新中" : "更新密码"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        {error || message ? (
          <div
            className={
              error
                ? "mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                : "mt-5 rounded-2xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-800"
            }
          >
            {error || message}
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

function AvatarPreview({ avatarUrl, size = "sm" }: { avatarUrl?: string | null; size?: "sm" | "lg" }) {
  const className =
    size === "lg"
      ? "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary text-primary-foreground"
      : "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground";

  return (
    <div className={className}>
      {avatarUrl ? (
        <img alt="" className="h-full w-full object-cover" src={avatarUrl} />
      ) : (
        <HugeiconsIcon icon={UserCircleIcon} className={size === "lg" ? "h-6 w-6" : "h-5 w-5"} />
      )}
    </div>
  );
}
