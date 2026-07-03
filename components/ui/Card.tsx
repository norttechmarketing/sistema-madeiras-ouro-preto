import React from "react";

export default function Card({ children, className = "" }: any) {
    return (
        <div
            className={`
        bg-white
        rounded-xl
        shadow-sm
        border border-[#d9d7d8]
        p-6
        ${className}
      `}
        >
            {children}
        </div>
    );
}
