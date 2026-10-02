import { cloneElement, isValidElement, type ButtonHTMLAttributes, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" | "secondary"; asChild?: boolean };
export function Button({ className, variant = "default", asChild = false, children, ...props }: ButtonProps) {
  const classes = cn("nis-ui-button", `nis-ui-button-${variant}`, className);
  if (asChild) {
    if (!isValidElement<HTMLAttributes<HTMLElement>>(children)) throw new Error("Button asChild requires one element");
    return cloneElement(children, { ...props, className: cn(classes, children.props.className) });
  }
  return <button type="button" className={classes} {...props}>{children}</button>;
}
