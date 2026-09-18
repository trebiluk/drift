import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans font-medium transition-[opacity,transform,background-color] duration-[var(--motion-fast)] ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cloud/80 focus-visible:ring-offset-2 focus-visible:ring-offset-sky-deep disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-cloud text-ink shadow-[0_10px_30px_rgba(28,40,56,0.16)] hover:opacity-95",
        ghost:
          "bg-ink/25 text-cloud backdrop-blur-sm hover:bg-ink/40",
      },
      size: {
        lg: "h-12 min-w-44 rounded-[var(--radius-pill)] px-7 text-base",
        icon: "size-11 rounded-[var(--radius-pill)]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "lg",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { Button, buttonVariants };
