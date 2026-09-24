import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Brand primary — deep forest green
        default:
          "bg-primary text-primary-foreground shadow-soft hover:bg-primary-deep hover:shadow-card",
        // Warm CTA — used for "Order Now" / Cash on Delivery actions
        cta: "bg-accent-gradient text-accent-foreground shadow-accent hover:brightness-105 active:translate-y-px",
        secondary: "bg-secondary text-secondary-foreground shadow-soft hover:bg-primary-soft",
        outline:
          "border border-primary/25 bg-transparent text-primary hover:bg-primary-soft/60 hover:border-primary/40",
        terracotta: "bg-terracotta text-terracotta-foreground shadow-soft hover:brightness-105",
        ghost: "bg-transparent hover:bg-secondary text-foreground",
        link: "text-primary underline-offset-4 hover:underline rounded-md",
        destructive:
          "bg-destructive text-destructive-foreground shadow-soft hover:brightness-105",
      },
      size: {
        sm: "h-9 px-4 text-xs",
        default: "h-11 px-6 text-sm",
        lg: "h-[3.25rem] px-8 text-base",
        xl: "h-14 px-10 text-base md:text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
