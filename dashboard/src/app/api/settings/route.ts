import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";

export async function GET() {
    return NextResponse.json(await getSettings());
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const newSettings = await updateSettings(body);
        return NextResponse.json({ success: true, settings: newSettings });
    } catch (error) {
        console.error("Failed to save settings:", error);
        return NextResponse.json(
            { error: "Failed to save settings" },
            { status: 500 }
        );
    }
}
