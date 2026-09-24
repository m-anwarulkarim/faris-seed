import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        soft: "border-transparent bg-primary-soft text-primary",
        // "In Stock"
        stock: "border-transparent bg-success/12 text-success",
        // "Best Seller"
        bestseller: "border-transparent bg-accent-gradient text-accent-foreground shadow-soft",
        // "Only 5 left" / urgency
        limited: "border-transparent bg-terracotta/12 text-terracotta",
        outOfStock: "border-transparent bg-muted text-muted-foreground",
        outline: "border-primary/25 bg-transparent text-primary",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
