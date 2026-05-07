import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex h-6 max-w-full items-center gap-1 rounded-control px-2 text-xs font-medium transition-colors [&_svg]:h-3.5 [&_svg]:w-3.5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border bg-background text-muted-foreground",
        accent: "bg-accent text-accent-foreground",
        source: "bg-muted text-foreground",
        success: "bg-radar-lime text-radar-lime-ink",
        warning: "bg-radar-yellow text-radar-yellow-ink",
        destructive: "bg-destructive text-destructive-foreground",
        muted: "bg-muted text-muted-foreground"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
