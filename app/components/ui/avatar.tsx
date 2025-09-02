"use client";
import React from "react";


const cx4 = (...cls: Array<string | false | null | undefined>) => cls.filter(Boolean).join(" ");
export function Avatar({ className, children }: React.PropsWithChildren<{ className?: string }>) {
return (
<div className={cx4("inline-flex size-11 items-center justify-center overflow-hidden rounded-full bg-muted", className)}>
{children}
</div>
);
}
export function AvatarImage({ src, alt = "" }: { src?: string; alt?: string }) {
if (!src) return null;
return <img src={src} alt={alt} className="h-full w-full object-cover" />;
}
export function AvatarFallback({ children }: React.PropsWithChildren) {
return <span className="text-xs font-semibold text-muted-foreground">{children}</span>;
}