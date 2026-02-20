import React from "react";

export default function PrimaryButton({
    children,
    className = "",
    ...props
}: any) {
    return (
        <button
            className={`
        bg-[#9b2b29] text-white
        px-5 py-2.5
        rounded-xl
        font-medium
        transition
        hover:bg-[#852523]
        disabled:opacity-50
        flex items-center justify-center gap-2
        active:scale-[0.98]
        ${className}
      `}
            {...props}
        >
            {children}
        </button>
    );
}
