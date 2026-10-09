import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      {children}
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return <Icon {...props}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
}

export function ArrowLeftIcon(props: IconProps) {
  return <Icon {...props}><path d="M19 12H5m6 6-6-6 6-6" /></Icon>;
}

export function BookIcon(props: IconProps) {
  return <Icon {...props}><path d="M7 3h13v14H7Z" fill="currentColor" fillOpacity=".1" stroke="none" /><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" /><path d="M4 19a2 2 0 0 1 2-2h14M8 7h8M8 10h5" /><path d="M7 3v14M7 20h11" strokeWidth=".8" opacity=".55" /></Icon>;
}

export function CalendarIcon(props: IconProps) {
  return <Icon {...props}><path d="M4 5h16v5H4Z" fill="currentColor" fillOpacity=".12" stroke="none" /><rect height="16" rx="2.5" width="16" x="4" y="5" /><path d="M8 3v4m8-4v4M4 10h16" /><path d="M8 13h1m3 0h1m3 0h.1M8 17h1m3 0h1" strokeWidth="1.5" /><rect x="15" y="16" width="2" height="2" rx=".5" fill="currentColor" stroke="none" /></Icon>;
}

export function BookmarkIcon(props: IconProps) {
  return <Icon {...props}><path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-3-6 3V4Z" fill="currentColor" fillOpacity=".08" /><path d="M9 6h6M9 9h4" strokeWidth="1.2" opacity=".65" /></Icon>;
}

export function RefreshIcon(props: IconProps) {
  return <Icon {...props}><path d="M20 11a8.1 8.1 0 0 0-14.6-3.7L3 10" /><path d="M3 5v5h5M4 13a8.1 8.1 0 0 0 14.6 3.7L21 14" /><path d="M21 19v-5h-5" /></Icon>;
}

export function UserIcon(props: IconProps) {
  return <Icon {...props}><circle cx="12" cy="8" r="3.5" fill="currentColor" fillOpacity=".1" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /><path d="M8 16.2q4 3 8 0M8 20v1m8-1v1" strokeWidth="1" opacity=".6" /></Icon>;
}

export function CheckIcon(props: IconProps) {
  return <Icon {...props}><path d="m5 12 4.2 4L19 6.5" /></Icon>;
}
