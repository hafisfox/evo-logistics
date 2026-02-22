import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateFullPricing } from "@/lib/pricing-engine";
import { getSettings } from "@/lib/settings";
import type { DestinationCharge, TransportCharge } from "@/types/pricing";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createClient();

    // Maximize parallel execution for internal reads and Supabase queries
    const [doRes, destRes, transpRes, settings] = await Promise.all([
      supabase.from('do_charges').select('*'),
      supabase.from('destination_charges').select('*'),
      supabase.from('transportation_charges').select('*'),
      getSettings()
    ]);

    if (doRes.error) throw doRes.error;
    if (destRes.error) throw destRes.error;
    if (transpRes.error) throw transpRes.error;

    // Map snake_case columns back to original Google Sheets format expected by pricing engine
    const mappedDestCharges = ((destRes.data || []) as Record<string, unknown>[]).map(d => ({
      "Charge Type": d.charge_type,
      Basis: d.basis,
      "20FT": d["20FT"],
      "40FT": d["40FT"]
    }));

    const mappedTranspCharges = ((transpRes.data || []) as Record<string, unknown>[]).map(t => ({
      Place: t.place,
      Price: t.price
    }));

    const result = calculateFullPricing({
      rfq: body.rfq,
      quote: body.quote,
      doCharges: doRes.data,
      destCharges: mappedDestCharges as DestinationCharge[],
      transpCharges: mappedTranspCharges as TransportCharge[],
      settings: {
        margin: settings.profitMargin / 100,
        quoteThreshold: settings.quoteThreshold,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to calculate pricing:", error);
    return NextResponse.json(
      { error: "Failed to calculate pricing" },
      { status: 500 }
    );
  }
}
