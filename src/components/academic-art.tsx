/** Original line illustrations, drawn in code so they follow both colour themes. */
export function BotanicalFlourish({ className = "" }: { className?: string }) {
  return <svg aria-hidden="true" focusable="false" className={`botanical-flourish ${className}`} viewBox="0 0 240 560" fill="none">
    <g stroke="var(--ornament-green)" strokeWidth="1.05" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 557c5-87 44-137 98-189 45-44 73-81 61-127-10-40-46-65-44-102 1-29 36-64 67-94" />
      <path d="M27 541c12-97 89-128 139-193 48-61 39-95 9-135-34-43-32-66 6-100" />
      <path d="M31 489c-17-58-4-112 52-125-10 26-5 48-27 65-27 20-24 37-25 60Z" fill="var(--ornament-leaf)" />
      <path d="M32 478c0-37 11-65 36-86m-28 59c-3-16 2-36 11-47" />
      <path d="M43 470c28-42 56-56 88-57-13 25-53 25-73 42m-15 15c30-21 56-30 80-35" />
      <path d="M68 429c31-19 65-15 91-8 19 5 34-1 44-9-9 26-32 28-54 19-37-15-58-11-81-2Z" fill="var(--ornament-leaf)" />
      <path d="M110 387c23-31 63-53 105-49-22 25-19 40-56 38-21-2-34 1-49 11Z" fill="var(--ornament-leaf)" />
      <path d="M117 382c35-24 59-30 84-35m-62 24c22-3 33-6 45-15" />
      <path d="M164 337c16-41 29-56 74-64-13 24-42 25-60 45m-14 19c16-20 34-34 59-48" />
      <path d="M161 279c-9-51-53-87-54-123-1-15 5-28 17-41-10 33-3 53 19 75" />
      <path d="M160 243c-31-44-13-85 23-98-2 25-16 28-27 38-12 11-8 34 4 60Z" fill="var(--ornament-leaf)" />
      <path d="M150 215c-2-35 9-48 24-58M113 184c-24-21-26-44-17-65-2 32 4 46 17 65Z" />
      <path d="M62 527c17-21 43-27 60-23 18 5 8 25-10 27-29 3-52 14-61 24" />
    </g>
    <g stroke="var(--ornament-gold)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 557c3-101 45-144 91-192 53-54 53-91 25-133-20-31-59-53-91-51 38 12 71 40 92 80 23 44 6 72-29 108" />
      <path d="M99 397c40-41 47-64 39-101-8-38-36-72-67-87" />
      <path d="M154 291c29-51 14-74-11-120-36-67 82-81 85-156-8 65-56 82-71 125-15 42 18 54 28 92 13 46-24 94-51 123" />
      <path d="M27 506c8-74 60-121 116-151 28-15 63-27 97-27M137 366c29-15 60-26 90-27" />
      <path d="M29 439c-4-21-14-38-29-47m7-10c19 6 33 23 36 41" opacity=".65" />
    </g>
  </svg>;
}

export function PanelGlyph({ kind }: { kind: "library" | "schedule" | "profile" }) {
  return <span aria-hidden="true" className="panel-glyph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    {kind === "schedule" ? <><path d="M4 6h16v15H4ZM4 11h16M8 3v6m8-6v6M8 15h2m4 0h2M8 18h2" /></> : kind === "library" ? <><path d="M3 4h6l3 2 3-2h6v15h-6l-3 2-3-2H3ZM12 6v15M6 8h3m6 0h3M6 11h3m6 0h3" /></> : <path d="M6 3h12v18l-6-4-6 4ZM9 7h6M9 10h4" />}
  </svg></span>;
}

export function KazakhOrnament({ className = "" }: { className?: string }) {
  return <svg aria-hidden="true" focusable="false" className={className} viewBox="0 0 240 240" fill="none">
    <g stroke="currentColor" strokeWidth="1.2">
      {[0, 90, 180, 270].map(angle => <g key={angle} transform={`rotate(${angle} 120 120)`}>
        <path d="M120 120V80c0-30-19-49-39-45-18 4-18 28-2 29 13 1 15-16 5-17M120 120V80c0-30 19-49 39-45 18 4 18 28 2 29-13 1-15-16-5-17" />
        <path d="M120 106c-14-28-45-29-52-10-6 17 16 25 21 12 3-9-8-13-11-6M120 106c14-28 45-29 52-10 6 17-16 25-21 12-3-9 8-13 11-6M120 21l7 10-7 10-7-10Z" />
      </g>)}
      <path d="m120 108 12 12-12 12-12-12Z" />
    </g>
  </svg>;
}

export function BookEngraving({ className = "" }: { className?: string }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 560 460" fill="none" className={`book-engraving ${className}`}>
    <g className="engraving-orbits" stroke="currentColor" strokeWidth=".8" opacity=".42">
      <circle cx="294" cy="209" r="157" />
      <circle cx="294" cy="209" r="147" />
      <ellipse cx="294" cy="209" rx="107" ry="157" transform="rotate(38 294 209)" />
      <path d="M92 209h404M294 21v376M157 72l274 274M157 346 431 72" strokeDasharray="2 7" />
      {Array.from({ length: 36 }, (_, i) => <path key={i} d="M294 52v7" transform={`rotate(${i * 10} 294 209)`} />)}
    </g>
    <g className="engraving-stars" stroke="currentColor" strokeWidth="1.1">
      <path d="M135 96v20m-10-10h20M444 180v16m-8-8h16M388 54v14m-7-7h14M479 299v12m-6-6h12" />
      <path d="m238 66 4 6-4 6-4-6ZM448 102l5 7-5 7-5-7Z" />
    </g>
    <g className="engraving-laurel" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round">
      <path d="M135 380C67 320 53 236 100 150M122 365c-40 1-61-18-67-41 26-3 47 13 67 41ZM101 332c-42-7-57-27-57-52 28 3 46 23 57 52ZM84 294c-35-15-45-40-38-61 25 10 39 32 38 61ZM80 254c-27-22-28-46-15-65 21 19 23 43 15 65ZM84 212c-12-31-5-53 16-66 12 24 5 47-16 66ZM105 339c-9-32 5-54 27-65 11 26 1 49-27 65ZM86 296c-1-33 18-50 41-55 3 28-13 47-41 55ZM81 252c8-31 28-42 53-38-7 28-26 41-53 38Z" />
      <path d="m62 332 60 33m-73-77 52 44m-50-91 33 53m-17-97 13 57m50 29-25 56m18-90-37 47m44-77-49 33" opacity=".55" />
    </g>
    <g className="engraving-book" stroke="currentColor" strokeLinejoin="round">
      <path d="m119 284 164 95 217-111-165-87Z" fill="var(--art-cover)" strokeWidth="2" />
      <path d="m121 276 162 91 213-108v-15l-170-77-205 90Z" fill="var(--art-paper)" strokeWidth="1.5" />
      <path d="m126 279 157 87 208-106M129 275l154 87 207-105M132 271l151 86 204-103" opacity=".5" />
      <path d="M284 345c-42-60-97-81-150-93l30-131c55 5 114 34 155 79 46-15 99-12 161 19l-19 117c-63-25-123-22-177 9Z" fill="var(--art-paper)" strokeWidth="2" />
      <path d="M284 345 319 200M291 335l34-129M278 333c-37-49-76-68-132-82l27-119c50 8 97 31 137 70" strokeWidth="1.1" />
      <path d="M306 330c43-23 96-23 143-4l19-102c-46-22-96-31-141-15" strokeWidth="1.1" />
      <g strokeWidth=".8" opacity=".58">
        {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${177 - i * 1.6} ${154 + i * 8}q69 19 118 68`} />)}
        {Array.from({ length: 11 }, (_, i) => <path key={i} d={`M${339 - i * 1.9} ${225 + i * 8}q52-13 109 8`} />)}
      </g>
      <path d="m350 210-19 113 10-2 8 5 19-114" fill="var(--bronze)" strokeWidth=".7" />
      <path d="m182 134-25 114M185 136l-25 113M452 227l-16 87" opacity=".25" />
    </g>
    <g stroke="currentColor" strokeWidth=".8" opacity=".35">
      <path d="M173 403h219M210 409h145M248 415h69" />
      <path d="m369 364 67-26m-54 31 58-23m-44 27 45-17" />
    </g>
  </svg>;
}

export function RouteIllustration({ kind }: { kind: "library" | "schedule" | "profile" }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 160 120" fill="none" className="route-illustration">
    <g stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round">
      {kind === "library" ? <>
        <path d="m25 80 61 24 54-29-59-21ZM25 73l61 24 54-29-59-21ZM28 73V62l59 23 50-27v11M28 62l50-27 59 23M40 59V42l46 15 38-21v21M40 42l38-21 46 15M85 57v20M86 85v12" />
        <path d="m34 68 46 18m-25-40 24 8m13 7 26-14M90 91l39-21" opacity=".5" />
      </> : kind === "schedule" ? <>
        <rect x="30" y="24" width="100" height="74" rx="3" /><path d="M30 43h100M50 16v17m60-17v17M42 56h10m13 0h10m13 0h10m13 0h8M42 70h10m13 0h10m13 0h10m13 0h8M42 84h10m13 0h10m13 0h10" />
        <path d="M27 101h99M26 29v67M60 52v36m23-36v36m23-36v36" opacity=".35" />
      </> : <>
        <path d="M48 17h65v84H48zM40 26v84h65M60 17v84M81 17v36l9-7 9 7V17M73 72h27M73 81h21" />
        <path d="m29 64-8 9 8 9 8-9ZM123 42l6-8 6 8-6 8Z" /><path d="M67 24h7M67 29h7M67 34h7M67 39h7M67 44h7M67 49h7M67 54h7" opacity=".45" />
      </>}
    </g>
  </svg>;
}
