"use client";

import { useEffect, useMemo, useState } from "react";
import type { Settings } from "@/lib/settings";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Mail, Save } from "lucide-react";
import { toast } from "sonner";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import {
  useUpdateWorkspaceMailbox,
  useWorkspaceMailbox,
} from "@/hooks/use-workspace-mailbox";

function formatSliderValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function WorkspaceSettingsPage() {
  const { data: savedSettings, isLoading } = useSettings();
  const { mutate: save, isPending: saving } = useUpdateSettings();
  const [draftSettings, setDraftSettings] = useState<Settings | null>(null);
  const { data: mailbox, isLoading: mailboxLoading } = useWorkspaceMailbox();
  const { mutate: updateMailbox, isPending: mailboxSaving } = useUpdateWorkspaceMailbox();
  const [mailboxEmail, setMailboxEmail] = useState("");
  const [mailboxStatus, setMailboxStatus] = useState<"connected" | "disconnected">("connected");

  const persistedSettings = useMemo<Settings>(
    () => ({
      profitMargin: savedSettings?.profitMargin ?? 13,
      quoteThreshold: savedSettings?.quoteThreshold ?? 2,
    }),
    [savedSettings]
  );

  const formSettings = draftSettings ?? persistedSettings;
  const hasUnsavedChanges = draftSettings !== null;

  useEffect(() => {
    if (!mailbox) return;
    setMailboxEmail(mailbox.email || "");
    if (mailbox.status === "disconnected") {
      setMailboxStatus("disconnected");
      return;
    }
    setMailboxStatus("connected");
  }, [mailbox]);

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

  const handleMailboxSave = () => {
    if (!mailboxEmail.trim()) {
      toast.error("Mailbox email is required");
      return;
    }

    updateMailbox(
      {
        email: mailboxEmail.trim(),
        status: mailboxStatus,
      },
      {
        onSuccess: () => {
          toast.success("Mailbox settings updated");
        },
        onError: () => {
          toast.error("Failed to update mailbox settings");
        },
      }
    );
  };

  return (
    <div>
      <Header title="Workspace Settings" description="Workspace pricing and threshold configuration" />
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
                    <label
                      id="profit-margin-label"
                      className="text-sm text-muted-foreground"
                    >
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
                    <label
                      id="quote-threshold-label"
                      className="text-sm text-muted-foreground"
                    >
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
              <Button
                onClick={handleSave}
                disabled={isLoading || saving || !hasUnsavedChanges}
              >
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
              These values are passed automatically to the serverless automations and pricing engine calculations.
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
              <Skeleton className="h-24" />
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="mailbox-email">Mailbox Email</Label>
                  <Input
                    id="mailbox-email"
                    value={mailboxEmail}
                    onChange={(event) => setMailboxEmail(event.target.value)}
                    placeholder="ops@company.com"
                  />
                </div>

                <div className="max-w-xs space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={mailboxStatus}
                    onValueChange={(value) =>
                      setMailboxStatus(value as "connected" | "disconnected")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="connected">Connected</SelectItem>
                      <SelectItem value="disconnected">Disconnected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {mailbox?.watch_expiration ? (
                  <p className="text-xs text-muted-foreground">
                    Watch expiration:{" "}
                    {new Date(mailbox.watch_expiration).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Watch expiration: not set yet
                  </p>
                )}

                {mailbox?.last_error && (
                  <p className="text-xs text-destructive">Last error: {mailbox.last_error}</p>
                )}

                <Button onClick={handleMailboxSave} disabled={mailboxSaving}>
                  {mailboxSaving ? "Saving..." : "Save Mailbox"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
