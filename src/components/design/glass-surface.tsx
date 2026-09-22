import type {ComponentPropsWithoutRef} from "react";
export function GlassSurface({tone="glass",className="",...props}:ComponentPropsWithoutRef<"section">&{tone?:"glass"|"calm"}){
 return <section {...props} data-tone={tone} className={"glass-surface "+className}/>;
}
