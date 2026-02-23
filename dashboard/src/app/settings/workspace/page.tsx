"use client";

import { useMemo, useState } from "react";
import type { Settings } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, DollarSign, Link2, Mail, Save, Unplug } from "lucide-react";
import { toast } from "sonner";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import {
  useDisconnectWorkspaceMailbox,
  useStartWorkspaceMailboxOAuth,
  useWorkspaceMailbox,
} from "@/hooks/use-workspace-mailbox";

function formatSliderValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDateTime(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString();
}

export default function WorkspaceSettingsPage() {
  const { data: savedSettings, isLoading } = useSettings();
  const { mutate: save, isPending: saving } = useUpdateSettings();
  const [draftSettings, setDraftSettings] = useState<Settings | null>(null);

  const { data: mailbox, isLoading: mailboxLoading } = useWorkspaceMailbox();
  const { mutate: startMailboxOAuth, isPending: startingMailboxOAuth } =
    useStartWorkspaceMailboxOAuth();
  const { mutate: disconnectMailbox, isPending: disconnectingMailbox } =
    useDisconnectWorkspaceMailbox();

  const persistedSettings = useMemo<Settings>(
    () => ({
      profitMargin: savedSettings?.profitMargin ?? 13,
      quoteThreshold: savedSettings?.quoteThreshold ?? 2,
    }),
    [savedSettings]
  );

  const formSettings = draftSettings ?? persistedSettings;
  const hasUnsavedChanges = draftSettings !== null;
  const mailboxConnected = mailbox?.status === "connected";

  const updateDraft = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setDraftSettings((current) => ({
      ...(current ?? persistedSettings),
      [key]: value,
    }));
  };

  const handleSave = () => {
    save(formSettings, {
      onSuccess: () => {
        setDraftSettings(null);
        toast.success("Settings Saved", {
          description: "Pricing constants have been updated successfully.",
        });
      },
      onError: () => {
        toast.error("Error", {
          description: "Failed to save settings.",
        });
      },
    });
  };

  const handleConnectMailbox = () => {
    startMailboxOAuth(undefined, {
      onSuccess: ({ authorizationUrl }) => {
        window.location.href = authorizationUrl;
      },
      onError: () => {
        toast.error("Failed to start mailbox OAuth flow");
      },
    });
  };

  const handleDisconnectMailbox = () => {
    disconnectMailbox(undefined, {
      onSuccess: () => {
        toast.success("Mailbox disconnected");
      },
      onError: () => {
        toast.error("Failed to disconnect mailbox");
      },
    });
  };

  return (
    <div className="max-w-2xl space-y-6 md:space-y-8 p-4 md:p-6 lg:p-8 animate-in fade-in zoom-in-95 duration-700">
      <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
        <CardHeader className="pb-3 px-6 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <DollarSign className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg font-bold tracking-tight">Pricing Constants</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 px-6 pb-6">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="mb-2 mt-1 flex items-center justify-between">
                  <label id="profit-margin-label" className="text-sm text-muted-foreground">
                    Profit Margin (%)
                  </label>
                  <span
                    id="profit-margin-value"
                    className="min-w-[3rem] rounded-md border px-2 py-1 text-center font-mono text-sm"
                    aria-live="polite"
                  >
                    {formatSliderValue(formSettings.profitMargin)}
                  </span>
                </div>
                <Slider
                  value={[formSettings.profitMargin]}
                  min={0}
                  max={50}
                  step={0.1}
                  onValueChange={([value = formSettings.profitMargin]) => {
                    updateDraft("profitMargin", value);
                  }}
                  aria-labelledby="profit-margin-label"
                  aria-describedby="profit-margin-help"
                  aria-valuetext={`${formatSliderValue(formSettings.profitMargin)} percent`}
                  className="py-2"
                />
                <p id="profit-margin-help" className="mt-1 text-xs text-muted-foreground">
                  Added to computed shipment costs before final rounding.
                </p>
              </div>

              <div>
                <div className="mb-2 mt-1 flex items-center justify-between">
                  <label id="quote-threshold-label" className="text-sm text-muted-foreground">
                    Quote Threshold
                  </label>
                  <span
                    id="quote-threshold-value"
                    className="min-w-[2.5rem] rounded-md border px-2 py-1 text-center font-mono text-sm"
                    aria-live="polite"
                  >
                    {formatSliderValue(formSettings.quoteThreshold)}
                  </span>
                </div>
                <Slider
                  value={[formSettings.quoteThreshold]}
                  min={1}
                  max={10}
                  step={1}
                  onValueChange={([value = formSettings.quoteThreshold]) => {
                    updateDraft("quoteThreshold", value);
                  }}
                  aria-labelledby="quote-threshold-label"
                  aria-describedby="quote-threshold-help"
                  aria-valuetext={`${formatSliderValue(formSettings.quoteThreshold)} quotes`}
                  className="py-2"
                />
                <p id="quote-threshold-help" className="mt-1 text-xs text-muted-foreground">
                  Minimum quotes before manager notification.
                </p>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-white/10 dark:border-white/5">
            <Button onClick={handleSave} disabled={isLoading || saving || !hasUnsavedChanges} className="h-11 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
              {saving ? (
                "Saving..."
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Save Settings
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground/80 font-medium">
            These values are passed automatically to the serverless automations and pricing
            engine calculations.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
        <CardHeader className="pb-3 px-6 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg font-bold tracking-tight">Automation Mailbox</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 px-6 pb-6">
          {mailboxLoading ? (
            <Skeleton className="h-28" />
          ) : (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/5 dark:bg-black/5 p-5 text-sm shadow-inner space-y-1">
                <p className="font-semibold tracking-tight">
                  Status: <span className="opacity-90 font-medium">{mailboxConnected ? "Connected" : "Disconnected"}</span>
                </p>
                <p className="text-muted-foreground/90 font-medium">
                  Mailbox: {mailbox?.email ?? "No mailbox connected"}
                </p>
                <p className="text-muted-foreground/80 text-xs">
                  Access token expiry: {formatDateTime(mailbox?.token_expires_at ?? null)}
                </p>
                <p className="text-muted-foreground/80 text-xs">
                  Gmail watch expiry: {formatDateTime(mailbox?.watch_expiration ?? null)}
                </p>
                {mailbox?.last_error && (
                  <p className="mt-2 text-destructive font-medium border-t border-destructive/20 pt-2">Last error: {mailbox.last_error}</p>
                )}
              </div>

              {!mailboxConnected && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400 font-medium shadow-inner">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <p>
                    Automations are paused until a mailbox is connected through Google OAuth.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  onClick={handleConnectMailbox}
                  disabled={startingMailboxOAuth}
                  className="h-11 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  {startingMailboxOAuth
                    ? "Opening Google OAuth..."
                    : mailboxConnected
                      ? "Reconnect Mailbox"
                      : "Connect Mailbox"}
                </Button>

                {mailbox && (
                  <Button
                    variant="outline"
                    onClick={handleDisconnectMailbox}
                    disabled={disconnectingMailbox}
                    className="h-11 rounded-xl border-white/10 dark:border-white/5 bg-white/5 dark:bg-black/5 text-destructive hover:bg-destructive/10 hover:text-destructive shadow-sm transition-all"
                  >
                    <Unplug className="mr-2 h-4 w-4" />
                    {disconnectingMailbox ? "Disconnecting..." : "Disconnect"}
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
