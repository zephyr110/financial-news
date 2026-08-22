"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Info, Loader2, RotateCcw, Save } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

/**
 * 设置弹窗（avatar 菜单 → 设置）：
 * - 模型：LLM_MODEL / LLM_BASE_URL / LLM_API_KEY（30s 缓存热生效，无需重启）
 * - 数据源：TURSO_DATABASE_URL / TURSO_AUTH_TOKEN（需重启应用生效）
 * - 定时任务：CRON_SECRET（30s 缓存热生效）
 * - 账号：修改登录名 / 密码（需当前密码）
 * 文本类字段留空保存 = 清除该项（恢复环境变量默认）；密钥类留空 = 保持不变。
 */
export default function SettingsDialog({ open, onOpenChange, username, onAccountChanged }) {
  // 表单状态（初始值在 open 时从 GET /api/settings 拉取）
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);
  const [tab, setTab] = useState("model");

  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [clearedKeys, setClearedKeys] = useState(new Set());

  const [tursoUrl, setTursoUrl] = useState("");
  const [tursoToken, setTursoToken] = useState("");
  const [tursoUrlSet, setTursoUrlSet] = useState(false);
  const [tursoTokenSet, setTursoTokenSet] = useState(false);

  const [cronSecret, setCronSecret] = useState("");
  const [cronSecretSet, setCronSecretSet] = useState(false);

  // 账号表单
  const [accUsername, setAccUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 打开时拉取当前配置（仅在打开/关闭转换时重置；账号改名回调更新 username prop 时保持 okMsg 可见）
  const prevOpen = useRef(false);
  useEffect(() => {
    if (prevOpen.current === open) return;
    prevOpen.current = open;
    if (!open) return;
    setLoaded(false);
    setError(null);
    setOkMsg(null);
    setClearedKeys(new Set());
    setApiKey("");
    setTursoToken("");
    setCronSecret("");
    setAccUsername(username || "");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        setModel(d.llm?.model ?? "");
        setBaseUrl(d.llm?.baseUrl ?? "");
        setApiKeySet(Boolean(d.llm?.apiKeySet));
        setTursoUrl(d.turso?.urlSet ? "" : "");
        setTursoUrlSet(Boolean(d.turso?.urlSet));
        setTursoTokenSet(Boolean(d.turso?.tokenSet));
        setCronSecretSet(Boolean(d.cronSecretSet));
        setLoaded(true);
      })
      .catch(() => {
        setError("读取配置失败，请稍后重试");
        setLoaded(true);
      });
  }, [open, username]);

  const clearKey = (key) => {
    setClearedKeys((s) => new Set(s).add(key));
  };
  const restoreKey = (key) => {
    setClearedKeys((s) => {
      const next = new Set(s);
      next.delete(key);
      return next;
    });
  };

  const secretInputProps = (key, value, setter, isSet) => ({
    value,
    onChange: (e) => {
      setter(e.target.value);
      if (e.target.value) restoreKey(key);
    },
    type: "password",
    autoComplete: "new-password",
    placeholder: isSet ? "已设置，留空保持不变" : "未设置",
  });

  const saveSettings = async () => {
    setSaving(true);
    setError(null);
    setOkMsg(null);
    const body = {
      llmModel: model,
      llmBaseUrl: baseUrl,
      ...(apiKey ? { llmApiKey: apiKey } : clearedKeys.has("llmApiKey") ? { llmApiKey: "" } : {}),
      ...(tursoUrl ? { tursoUrl } : clearedKeys.has("tursoUrl") ? { tursoUrl: "" } : {}),
      ...(tursoToken ? { tursoToken } : clearedKeys.has("tursoToken") ? { tursoToken: "" } : {}),
      ...(cronSecret ? { cronSecret } : clearedKeys.has("cronSecret") ? { cronSecret: "" } : {}),
    };
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "保存失败，请重试");
        return;
      }
      // 刷新掩码状态
      const d = await fetch("/api/settings").then((r) => r.json());
      setApiKeySet(Boolean(d.llm?.apiKeySet));
      setTursoUrlSet(Boolean(d.turso?.urlSet));
      setTursoTokenSet(Boolean(d.turso?.tokenSet));
      setCronSecretSet(Boolean(d.cronSecretSet));
      setClearedKeys(new Set());
      setApiKey("");
      setTursoToken("");
      setCronSecret("");
      setOkMsg("已保存" + (tursoUrl || clearedKeys.has("tursoUrl") || tursoToken || clearedKeys.has("tursoToken") ? "（Turso 数据源改动需重启应用生效）" : ""));
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const saveAccount = async () => {
    setSaving(true);
    setError(null);
    setOkMsg(null);
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      setSaving(false);
      return;
    }
    try {
      const res = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          ...(accUsername !== username ? { username: accUsername } : {}),
          ...(newPassword ? { password: newPassword } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "修改失败，请重试");
        return;
      }
      setOkMsg("账号信息已更新");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onAccountChanged?.(accUsername.trim() || username);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const hint = (text) => (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Info className="size-3.5 shrink-0" />
      {text}
    </p>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>模型 / 数据源 / 定时任务 / 账号配置</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>
        )}
        {okMsg && (
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5 shrink-0" />
            {okMsg}
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="model" className="flex-1">模型</TabsTrigger>
            <TabsTrigger value="turso" className="flex-1">数据源</TabsTrigger>
            <TabsTrigger value="cron" className="flex-1">定时任务</TabsTrigger>
            <TabsTrigger value="account" className="flex-1">账号</TabsTrigger>
          </TabsList>

          {/* ── 模型 ── */}
          <TabsContent value="model" className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">模型 (LLM_MODEL)</label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="留空使用环境变量（默认 deepseek-v4-flash）"
                disabled={!loaded}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">接口地址 (LLM_BASE_URL)</label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="留空使用环境变量（默认 https://api.deepseek.com/v1）"
                disabled={!loaded}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">API Key (LLM_API_KEY)</label>
              <div className="flex gap-2">
                <Input
                  {...secretInputProps("llmApiKey", apiKey, setApiKey, apiKeySet)}
                  className="flex-1"
                  disabled={!loaded}
                />
                {apiKeySet && (
                  <Button type="button" variant="outline" size="icon" onClick={() => clearKey("llmApiKey")} title="清除已保存的 Key">
                    <RotateCcw className="size-4" />
                  </Button>
                )}
              </div>
            </div>
            {hint("模型/接口/Key 保存在应用内（app_settings 表），保存后约 30 秒内热生效，无需重启。")}
            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={saveSettings} disabled={saving || !loaded}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                保存
              </Button>
            </div>
          </TabsContent>

          {/* ── 数据源 ── */}
          <TabsContent value="turso" className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">远端数据库 URL (TURSO_DATABASE_URL)</label>
              <div className="flex gap-2">
                <Input
                  value={tursoUrl}
                  onChange={(e) => {
                    setTursoUrl(e.target.value);
                    if (e.target.value) restoreKey("tursoUrl");
                  }}
                  placeholder={tursoUrlSet ? "已设置，留空保持不变" : "未设置（可选）"}
                  disabled={!loaded}
                  className="flex-1"
                />
                {tursoUrlSet && (
                  <Button type="button" variant="outline" size="icon" onClick={() => clearKey("tursoUrl")} title="清除">
                    <RotateCcw className="size-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">鉴权 Token (TURSO_AUTH_TOKEN)</label>
              <div className="flex gap-2">
                <Input
                  {...secretInputProps("tursoToken", tursoToken, setTursoToken, tursoTokenSet)}
                  className="flex-1"
                  disabled={!loaded}
                />
                {tursoTokenSet && (
                  <Button type="button" variant="outline" size="icon" onClick={() => clearKey("tursoToken")} title="清除">
                    <RotateCcw className="size-4" />
                  </Button>
                )}
              </div>
            </div>
            {hint("留空时使用本地文件数据库（news.db）。配置了 Turso 后数据存远端；改动需重启应用后生效。")}
            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={saveSettings} disabled={saving || !loaded}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                保存
              </Button>
            </div>
          </TabsContent>

          {/* ── 定时任务 ── */}
          <TabsContent value="cron" className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">CRON_SECRET（Vercel Cron / QStash 鉴权）</label>
              <div className="flex gap-2">
                <Input
                  {...secretInputProps("cronSecret", cronSecret, setCronSecret, cronSecretSet)}
                  className="flex-1"
                  disabled={!loaded}
                />
                {cronSecretSet && (
                  <Button type="button" variant="outline" size="icon" onClick={() => clearKey("cronSecret")} title="清除">
                    <RotateCcw className="size-4" />
                  </Button>
                )}
              </div>
            </div>
            {hint("用于保护 /api/cron/* 定时任务接口（Bearer 或 ?token=）。保存在应用内，约 30 秒内热生效。")}
            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={saveSettings} disabled={saving || !loaded}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                保存
              </Button>
            </div>
          </TabsContent>

          {/* ── 账号 ── */}
          <TabsContent value="account" className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">登录名</label>
              <Input
                value={accUsername}
                onChange={(e) => setAccUsername(e.target.value)}
                placeholder="当前登录名"
                autoComplete="off"
                disabled={!loaded}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">当前密码（必填验证）</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="输入当前密码以确认修改"
                autoComplete="current-password"
                disabled={!loaded}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">新密码（可选）</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少 6 位；留空则不修改密码"
                autoComplete="new-password"
                disabled={!loaded}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">确认新密码</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
                autoComplete="new-password"
                disabled={!loaded}
              />
            </div>
            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={saveAccount} disabled={saving || !loaded || !currentPassword}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                保存
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
