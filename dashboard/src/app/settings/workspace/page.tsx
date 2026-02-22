"use client";

import { useMemo, useState } from "react";
import type { Settings } from "@/lib/settings";
import { Header } from "@/components/layout/header";
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
    <div>
      <Header
        title="Workspace Settings"
        description="Workspace pricing and automation mailbox configuration"
      />
      <div className="max-w-2xl space-y-6 p-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Pricing Constants</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
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

            <div className="pt-2">
              <Button onClick={handleSave} disabled={isLoading || saving || !hasUnsavedChanges}>
                {saving ? (
                  "Saving..."
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Save Settings
                  </>
                )}
              </Button>
            </div>

            <p className="border-t pt-4 text-xs text-muted-foreground">
              These values are passed automatically to the serverless automations and pricing
              engine calculations.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Automation Mailbox</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {mailboxLoading ? (
              <Skeleton className="h-28" />
            ) : (
              <>
                <div className="rounded border bg-background p-3 text-sm">
                  <p className="font-medium">
                    Status: {mailboxConnected ? "Connected" : "Disconnected"}
                  </p>
                  <p className="text-muted-foreground">
                    Mailbox: {mailbox?.email ?? "No mailbox connected"}
                  </p>
                  <p className="text-muted-foreground">
                    Access token expiry: {formatDateTime(mailbox?.token_expires_at ?? null)}
                  </p>
                  <p className="text-muted-foreground">
                    Gmail watch expiry: {formatDateTime(mailbox?.watch_expiration ?? null)}
                  </p>
                  {mailbox?.last_error && (
                    <p className="mt-2 text-destructive">Last error: {mailbox.last_error}</p>
                  )}
                </div>

                {!mailboxConnected && (
                  <div className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Automations are paused until a mailbox is connected through Google OAuth.
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleConnectMailbox}
                    disabled={startingMailboxOAuth}
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
    </div>
  );
}
