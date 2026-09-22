import type {ReactNode} from "react";
export function StatusChip({children,tone="neutral"}:{children:ReactNode;tone?:"neutral"|"success"|"warning"|"danger"}){
 return <span className="status-chip" data-tone={tone}>{children}</span>;
}
