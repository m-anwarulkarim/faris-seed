import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const sectionVariants = cva("w-full", {
  variants: {
    tone: {
      default: "bg-background text-foreground",
      muted: "bg-muted text-foreground",
      soft: "bg-secondary text-secondary-foreground",
      brand: "bg-primary text-primary-foreground",
      gradient: "bg-hero-gradient text-primary-foreground",
    },
    spacing: {
      sm: "py-10 md:py-14",
      md: "py-14 md:py-20",
      lg: "py-20 md:py-28",
    },
  },
  defaultVariants: { tone: "default", spacing: "md" },
});

const containerVariants = cva("mx-auto w-full px-4 sm:px-6 lg:px-8", {
  variants: {
    width: {
      narrow: "max-w-3xl",
      default: "max-w-6xl",
      wide: "max-w-7xl",
      full: "max-w-none",
    },
  },
  defaultVariants: { width: "default" },
});

export interface SectionProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof sectionVariants> {
  width?: "narrow" | "default" | "wide" | "full";
  as?: "section" | "div" | "header" | "footer";
  containerClassName?: string;
}

const Section = React.forwardRef<HTMLElement, SectionProps>(
  (
    { className, containerClassName, tone, spacing, width, as = "section", children, ...props },
    ref,
  ) => {
    const Comp = as as React.ElementType;
    return (
      <Comp ref={ref} className={cn(sectionVariants({ tone, spacing }), className)} {...props}>
        <div className={cn(containerVariants({ width }), containerClassName)}>{children}</div>
      </Comp>
    );
  },
);
Section.displayName = "Section";

export interface SectionHeadingProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
}

function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
  ...props
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className,
      )}
      {...props}
    >
      {eyebrow ? (
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-foreground/80">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="text-balance-tight text-3xl md:text-4xl">{title}</h2>
      {description ? (
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export { Section, SectionHeading, sectionVariants, containerVariants };
