"use client";
import React from "react";


const cx2 = (...cls: Array<string | false | null | undefined>) => cls.filter(Boolean).join(" ");
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
variant?: "default" | "ghost";
size?: "default" | "icon";
};
export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
const base = "inline-flex items-center justify-center rounded-2xl text-sm font-medium transition active:scale-[0.99]";
const variants = {
default: "bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 shadow",
ghost: "bg-transparent hover:bg-muted px-2 py-2",
} as const;
const sizes = { default: "h-10", icon: "size-10" } as const;
return <button className={cx2(base, variants[variant], sizes[size], className)} {...props} />;
}