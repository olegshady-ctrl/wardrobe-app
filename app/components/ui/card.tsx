"use client";
import React from "react";


type DivProps = React.HTMLAttributes<HTMLDivElement>;
const cx = (...cls: Array<string | false | null | undefined>) => cls.filter(Boolean).join(" ");


export function Card({ className, ...props }: DivProps) {
return <div className={cx("rounded-2xl border bg-card text-card-foreground shadow-sm", className)} {...props} />;
}
export function CardHeader({ className, ...props }: DivProps) {
return <div className={cx("p-4", className)} {...props} />;
}
export function CardContent({ className, ...props }: DivProps) {
return <div className={cx("p-4", className)} {...props} />;
}