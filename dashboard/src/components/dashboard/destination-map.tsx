"use client";

import { MapPin } from "lucide-react";

export function DestinationMap() {
    return (
        <div className="flex flex-col rounded-[24px] bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-white/5 p-6 shadow-sm h-full">
            <div className="mb-6">
                <h3 className="font-semibold text-gray-900 dark:text-white">Top Delivery Destination States</h3>
                <div className="flex gap-4 mt-3 text-xs font-medium">
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-orange-600"></span>
                        <span className="text-gray-500">Most</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-orange-300"></span>
                        <span className="text-gray-500">Medium</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-orange-100"></span>
                        <span className="text-gray-500">Least</span>
                    </div>
                </div>
            </div>

            {/* Map Placeholder matching 1.webp style */}
            <div className="flex-1 flex items-center justify-center relative min-h-[250px]">
                {/* We use a simplified SVG approximation for the map based on the screenshot */}
                <svg viewBox="0 0 800 500" className="w-full h-full drop-shadow-sm max-w-[100%] max-h-[100%] text-orange-200">
                    {/* Outline of US, simplified */}
                    <path
                        d="M 100 100 L 700 120 L 750 350 L 550 450 L 400 480 L 150 400 L 80 250 Z"
                        fill="currentColor"
                        stroke="white"
                        strokeWidth="3"
                        className="hover:fill-orange-300 transition-colors duration-300 cursor-pointer text-orange-300"
                    />
                    {/* Fictional state splits */}
                    <path d="M 100 100 L 300 300 L 150 400" fill="#fed7aa" stroke="white" strokeWidth="2" className="hover:fill-orange-400 cursor-pointer transition-colors" />
                    <path d="M 300 300 L 550 450 L 750 350 L 500 200 Z" fill="#fdba74" stroke="white" strokeWidth="2" className="hover:fill-orange-500 cursor-pointer transition-colors" />
                    <path d="M 300 300 L 500 200 L 700 120 L 400 100 Z" fill="#ea580c" stroke="white" strokeWidth="2" className="hover:fill-orange-600 cursor-pointer transition-colors" />
                    <path d="M 100 100 L 400 100 L 300 300 Z" fill="#f97316" stroke="white" strokeWidth="2" className="hover:fill-orange-500 cursor-pointer transition-colors" />

                    {/* Map pins indicating active endpoints like Berlin/Poznan from 2.webp conceptually adapted */}
                    <circle cx="350" cy="220" r="8" fill="white" className="drop-shadow-md" />
                    <circle cx="350" cy="220" r="4" fill="#ea580c" />

                    <circle cx="600" cy="280" r="8" fill="white" className="drop-shadow-md" />
                    <circle cx="600" cy="280" r="4" fill="#ea580c" />
                </svg>
            </div>
        </div>
    );
}
