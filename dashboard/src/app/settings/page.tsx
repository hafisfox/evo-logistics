"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Save } from "lucide-react";
import { toast } from "sonner";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";

export default function SettingsPage() {
  const { data: savedSettings, isLoading } = useSettings();
  const { mutate: save, isPending: saving } = useUpdateSettings();

  const [profitMargin, setProfitMargin] = useState(13);
  const [quoteThreshold, setQuoteThreshold] = useState(2);

  // Sync local form state when server data loads
  useEffect(() => {
    if (savedSettings) {
      setProfitMargin(savedSettings.profitMargin);
      setQuoteThreshold(savedSettings.quoteThreshold);
    }
  }, [savedSettings]);

  const handleSave = () => {
    save(
      { profitMargin, quoteThreshold },
      {
        onSuccess: () => {
          toast.success("Settings Saved", {
            description: "Pricing constants have been updated successfully.",
          });
        },
        onError: () => {
          toast.error("Error", {
            description: "Failed to save settings.",
          });
        },
      }
    );
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
            {isLoading ? (
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-2 mt-1">
                    <label className="text-sm text-muted-foreground">
                      Profit Margin (%)
                    </label>
                    <span className="font-mono text-sm border px-2 py-1 rounded-md min-w-[3rem] text-center">{profitMargin}</span>
                  </div>
                  <Slider
                    value={[profitMargin]}
                    min={0}
                    max={50}
                    step={0.1}
                    onValueChange={([val]) => setProfitMargin(val)}
                    className="py-2"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2 mt-1">
                    <label className="text-sm text-muted-foreground">
                      Quote Threshold
                    </label>
                    <span className="font-mono text-sm border px-2 py-1 rounded-md min-w-[2.5rem] text-center">{quoteThreshold}</span>
                  </div>
                  <Slider
                    value={[quoteThreshold]}
                    min={1}
                    max={10}
                    step={1}
                    onValueChange={([val]) => setQuoteThreshold(val)}
                    className="py-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum quotes before manager notification
                  </p>
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button onClick={handleSave} disabled={isLoading || saving}>
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
