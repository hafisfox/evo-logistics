"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { DollarSign, Save } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    exchangeRate: 3.685,
    profitMargin: 13,
    quoteThreshold: 2,
    rounding: "Nearest 10 AED"
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then(res => res.json())
      .then(data => {
        setSettings(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load settings:", err);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exchangeRate: Number(settings.exchangeRate),
          profitMargin: Number(settings.profitMargin),
          quoteThreshold: Number(settings.quoteThreshold),
          rounding: settings.rounding
        })
      });

      if (res.ok) {
        toast.success("Settings Saved", {
          description: "Pricing constants have been updated successfully.",
        });
      } else {
        throw new Error("Failed to save");
      }
    } catch (err) {
      toast.error("Error", {
        description: "Failed to save settings.",
      });
    } finally {
      setSaving(false);
    }
  };

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
                <div className="flex justify-between items-center mb-2 mt-1">
                  <label className="text-sm text-muted-foreground">
                    Exchange Rate (USD to AED)
                  </label>
                  <span className="font-mono text-sm border px-2 py-1 rounded-md min-w-[4rem] text-center">{settings.exchangeRate.toFixed(3)}</span>
                </div>
                <Slider
                  value={[settings.exchangeRate]}
                  min={3.0}
                  max={4.5}
                  step={0.001}
                  onValueChange={([val]) => setSettings({ ...settings, exchangeRate: val })}
                  disabled={loading}
                  className="py-2"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2 mt-1">
                  <label className="text-sm text-muted-foreground">
                    Profit Margin (%)
                  </label>
                  <span className="font-mono text-sm border px-2 py-1 rounded-md min-w-[3rem] text-center">{settings.profitMargin}</span>
                </div>
                <Slider
                  value={[settings.profitMargin]}
                  min={0}
                  max={50}
                  step={0.1}
                  onValueChange={([val]) => setSettings({ ...settings, profitMargin: val })}
                  disabled={loading}
                  className="py-2"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-2 mt-1">
                  <label className="text-sm text-muted-foreground">
                    Quote Threshold
                  </label>
                  <span className="font-mono text-sm border px-2 py-1 rounded-md min-w-[2.5rem] text-center">{settings.quoteThreshold}</span>
                </div>
                <Slider
                  value={[settings.quoteThreshold]}
                  min={1}
                  max={10}
                  step={1}
                  onValueChange={([val]) => setSettings({ ...settings, quoteThreshold: val })}
                  disabled={loading}
                  className="py-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum quotes before manager notification
                </p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">
                  Rounding
                </label>
                <Input
                  value={settings.rounding}
                  onChange={e => setSettings({ ...settings, rounding: e.target.value })}
                  disabled={loading}
                  className="mt-1 font-mono"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button onClick={handleSave} disabled={loading || saving}>
                {saving ? "Saving..." : <><Save className="mr-2 h-4 w-4" /> Save Settings</>}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground pt-4 border-t">
              These values are passed automatically to the serverless automations and pricing engine calculations.
            </p>
          </CardContent>
        </Card>


      </div>
    </div>
  );
}
