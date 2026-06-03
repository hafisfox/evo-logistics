"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

interface CircularProgressProps {
    percentage: number;
    total: number;
    label: string;
    /** Optional numerator to show under the percentage (e.g. "3 / 20"). */
    count?: number;
    size?: number;
    strokeWidth?: number;
    primaryColor?: string;
    secondaryColor?: string;
    /** Optional second stop for a gradient stroke. Falls back to a solid
     *  primaryColor when omitted. */
    gradientTo?: string;
    className?: string;
}

export function CircularProgress({
    percentage,
    total,
    label,
    count,
    size = 180,
    strokeWidth = 14,
    primaryColor = "#F97316", // orange-500
    secondaryColor = "#FDBA74", // orange-300
    gradientTo,
    className,
}: CircularProgressProps) {
    const gradientId = useId();
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;
    const strokeColor = gradientTo ? `url(#${gradientId})` : primaryColor;

    return (
        <div className={cn("relative flex items-center justify-center", className)}>
            <svg width={size} height={size} className="transform -rotate-90">
                {gradientTo && (
                    <defs>
                        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor={primaryColor} />
                            <stop offset="100%" stopColor={gradientTo} />
                        </linearGradient>
                    </defs>
                )}
                {/* Background Circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={secondaryColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    className="opacity-20"
                />
                {/* Progress Arc */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none [filter:drop-shadow(0_0_6px_color-mix(in_oklch,currentColor_40%,transparent))]"
                    style={{ color: gradientTo ?? primaryColor }}
                />
            </svg>
            {/* Inner Content */}
            <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                    {percentage}%
                </span>
                {count != null ? (
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-0.5 tabular-nums">
                        {count.toLocaleString("en-US")} / {total.toLocaleString("en-US")}
                    </span>
                ) : null}
                <span className="text-xs font-medium text-gray-500 mt-1">
                    {label}
                </span>
            </div>
        </div>
    );
}
