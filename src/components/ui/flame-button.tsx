"use client";

import type { ButtonHTMLAttributes, CSSProperties } from "react";

type FlameButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  height?: number;
  textColor?: string;
  borderColor?: string;
};

/** A calm primary action for the authentication flow. */
export function FlameButton({
  children,
  className = "",
  height = 54,
  textColor = "#174c96",
  borderColor = "#adc9f5",
  style,
  ...props
}: FlameButtonProps) {
  const buttonStyle = {
    ...style,
    height: `${height}px`,
    border: `1px solid ${borderColor}`,
    "--flame-text": textColor,
  } as CSSProperties & Record<"--flame-text", string>;

  return <button {...props} className={`flame-button ${className}`.trim()} type={props.type ?? "button"} style={buttonStyle}>
    {children}
  </button>;
}
