"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Settings, DollarSign, Link2 } from "lucide-react";

export default function SettingsPage() {
  return (
    <div>
      <Header
        title="Settings"
        description="Dashboard configuration"
      />
      <div className="p-6 space-y-6 max-w-2xl">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Pricing Constants</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">
                  Exchange Rate (USD to AED)
                </label>
                <Input value="3.685" disabled className="mt-1 font-mono" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">
                  Profit Margin (%)
                </label>
                <Input value="13" disabled className="mt-1 font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">
                  Quote Threshold
                </label>
                <Input value="2" disabled className="mt-1 font-mono" />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum quotes before manager notification
                </p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">
                  Rounding
                </label>
                <Input
                  value="Nearest 10 AED"
                  disabled
                  className="mt-1 font-mono"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              These values are managed in the Modal automation code
              (automations/phase_3_select_and_quote.py).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Modal Integration</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">
                Select Agent Endpoint
              </label>
              <Input
                value={process.env.NEXT_PUBLIC_MODAL_URL || "Not configured"}
                disabled
                className="mt-1 font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">
                Backend
              </label>
              <Input
                value="Modal.com (Serverless Python)"
                disabled
                className="mt-1 font-mono text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Configure Modal webhook URLs via environment variables.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Data Source</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Spreadsheet</span>
              <span className="font-mono text-xs">
                Pricing Automation Database
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sheets</span>
              <span>
                Master_RFQs, Agent_Outbound_Log, Agents, DO Charges,
                Destination Charges, Transportation Charges
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Database</span>
              <span className="text-muted-foreground">
                PostgreSQL (planned)
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
