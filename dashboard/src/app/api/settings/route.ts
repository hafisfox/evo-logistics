import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");

const defaultSettings = {
    exchangeRate: 3.685,
    profitMargin: 13,
    quoteThreshold: 2,
    rounding: "Nearest 10 AED",
};

export async function GET() {
    try {
        const data = await fs.readFile(SETTINGS_FILE, "utf-8");
        return NextResponse.json(JSON.parse(data));
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
        // Return defaults if file doesn't exist yet
        return NextResponse.json(defaultSettings);
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Merge with existing settings
        let currentSettings = defaultSettings;
        try {
            const data = await fs.readFile(SETTINGS_FILE, "utf-8");
            currentSettings = JSON.parse(data);
            // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
        } catch (_e) { }

        const newSettings = { ...currentSettings, ...body };

        // Ensure directory exists
        await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });

        await fs.writeFile(SETTINGS_FILE, JSON.stringify(newSettings, null, 2), "utf-8");
        return NextResponse.json({ success: true, settings: newSettings });
    } catch (error) {
        console.error("Failed to save settings:", error);
        return NextResponse.json(
            { error: "Failed to save settings" },
            { status: 500 }
        );
    }
}
