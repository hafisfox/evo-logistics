"use client";

import { cn } from "@/lib/utils";

interface CircularProgressProps {
    percentage: number;
    total: number;
    label: string;
    size?: number;
    strokeWidth?: number;
    primaryColor?: string;
    secondaryColor?: string;
    className?: string;
}

export function CircularProgress({
    percentage,
    total,
    label,
    size = 180,
    strokeWidth = 14,
    primaryColor = "#F97316", // orange-500
    secondaryColor = "#FDBA74", // orange-300
    className,
}: CircularProgressProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div className={cn("relative flex items-center justify-center", className)}>
            <svg width={size} height={size} className="transform -rotate-90">
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
                {/* Progress Circle Space (simulated with standard circles) */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={primaryColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            {/* Inner Content */}
            <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                    {percentage}%
                </span>
                <span className="text-xs font-medium text-gray-500 mt-1">
                    {label}
                </span>
            </div>
        </div>
    );
}
