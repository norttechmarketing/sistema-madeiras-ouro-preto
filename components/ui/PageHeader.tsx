import React from "react";

export default function PageHeader({ title, subtitle }: any) {
    return (
        <div className="mb-8 animate-in fade-in slide-in-from-left-4 duration-500">
            <h1 className="text-2xl font-bold text-[#9b2b29] tracking-tight uppercase">
                {title}
            </h1>

            {subtitle && (
                <p className="text-slate-500 mt-1 text-sm font-medium">
                    {subtitle}
                </p>
            )}
        </div>
    );
}
