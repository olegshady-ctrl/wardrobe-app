"use client";
import React from "react";


const cx3 = (...cls: Array<string | false | null | undefined>) => cls.filter(Boolean).join(" ");
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
export function Textarea({ className, ...props }: TextareaProps) {
return (
<textarea
className={cx3(
"w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-0 focus:border-primary/50",
className,
)}
{...props}
/>
);
}