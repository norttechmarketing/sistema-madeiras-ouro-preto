import React from "react";

export default function PrimaryButton({
    children,
    className = "",
    ...props
}: any) {
    return (
        <button
            className={`
        bg-[#02904b] text-white
        px-5 py-2.5
        rounded-xl
        font-medium
        transition
        hover:bg-[#017a3f]
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
