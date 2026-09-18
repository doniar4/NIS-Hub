"use client";

import { useState, type ButtonHTMLAttributes } from "react";
import { ReloadIcon } from "@radix-ui/react-icons";

export function ReloadButton({ children, className = "", onClick, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const [activation, setActivation] = useState(0);
  return (
    <button {...props} type={props.type ?? "button"} className={`button button-reload ${className}`} onClick={event => {
      setActivation(value => value + 1);
      onClick?.(event);
    }}>
      <ReloadIcon key={activation} className={activation ? "reload-spin" : undefined} aria-hidden="true" />
      {children}
    </button>
  );
}
