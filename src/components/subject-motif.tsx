import type { SubjectRow } from "@/lib/database.types";

/**
 * Architectural, precision-engraved subject emblems.
 * Designed with academic geometry, golden ratio curves, and authentic Kazakh motifs.
 */
export function SubjectMotif({ subject }: { subject: SubjectRow | undefined }) {
  const name = [subject?.name, subject?.name_en, subject?.short_name]
    .join(" ")
    .toLowerCase();

  let content: React.ReactNode;

  if (/матем|алгеб|геомет|math|algebra|geometry/.test(name)) {
    // Mathematics / Geometry: Golden ratio logarithmic curve, drafting compass & set-square
    content = (
      <>
        <circle cx="60" cy="55" r="46" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />
        <path d="M22 84 L98 84 L60 22 Z" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <path d="M38 84 L82 84 L60 48 Z" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2" fill="none" />
        <circle cx="60" cy="55" r="28" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M32 55 H88 M60 27 V83" stroke="currentColor" strokeWidth="0.75" opacity="0.6" />
        <path d="M42 75 Q60 30 78 75" stroke="currentColor" strokeWidth="1.3" fill="none" />
        <circle cx="60" cy="22" r="3" fill="currentColor" />
        <circle cx="22" cy="84" r="2.5" fill="currentColor" />
        <circle cx="98" cy="84" r="2.5" fill="currentColor" />
      </>
    );
  } else if (/физ|physics/.test(name)) {
    // Physics: Quantum atomic orbitals, harmonic wave vectors, focal nucleus
    content = (
      <>
        <circle cx="60" cy="55" r="46" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />
        <ellipse cx="60" cy="55" rx="42" ry="15" transform="rotate(-30 60 55)" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <ellipse cx="60" cy="55" rx="42" ry="15" transform="rotate(30 60 55)" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <ellipse cx="60" cy="55" rx="42" ry="15" transform="rotate(90 60 55)" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" fill="none" />
        <circle cx="60" cy="55" r="6" fill="currentColor" />
        <circle cx="60" cy="55" r="12" stroke="currentColor" strokeWidth="0.75" fill="none" opacity="0.6" />
        <circle cx="30" cy="38" r="3" fill="currentColor" />
        <circle cx="90" cy="72" r="3" fill="currentColor" />
        <circle cx="30" cy="72" r="2.5" fill="currentColor" />
        <circle cx="90" cy="38" r="2.5" fill="currentColor" />
      </>
    );
  } else if (/хим|chem/.test(name)) {
    // Chemistry: Benzene molecular ring, graduated Erlenmeyer flask, covalent bonds
    content = (
      <>
        <circle cx="60" cy="55" r="46" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />
        {/* Erlenmeyer flask */}
        <path d="M54 22 H66 V38 L84 76 A6 6 0 0 1 78 84 H42 A6 6 0 0 1 36 76 L54 38 Z" stroke="currentColor" strokeWidth="1.3" fill="none" />
        <line x1="50" y1="22" x2="70" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M42 68 Q60 62 78 68" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
        {/* Bubbles / atoms */}
        <circle cx="52" cy="58" r="2" fill="currentColor" />
        <circle cx="64" cy="62" r="3" fill="currentColor" />
        <circle cx="58" cy="72" r="2" fill="currentColor" />
        {/* Benzene ring top right */}
        <path d="M82 20 L94 27 V41 L82 48 L70 41 V27 Z" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.7" />
        <circle cx="82" cy="34" r="7" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.5" />
      </>
    );
  } else if (/биол|biology/.test(name)) {
    // Biology: Double-helix DNA strand intertwined with botanical leaf
    content = (
      <>
        <circle cx="60" cy="55" r="46" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />
        {/* DNA Helix waves */}
        <path d="M40 20 Q60 38 80 55 Q60 72 40 90" stroke="currentColor" strokeWidth="1.3" fill="none" />
        <path d="M80 20 Q60 38 40 55 Q60 72 80 90" stroke="currentColor" strokeWidth="1.3" fill="none" />
        {/* Base pair cross rungs */}
        <line x1="48" y1="28" x2="72" y2="28" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <line x1="56" y1="41" x2="64" y2="41" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <line x1="42" y1="55" x2="78" y2="55" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <line x1="56" y1="69" x2="64" y2="69" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <line x1="48" y1="82" x2="72" y2="82" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        {/* Botanical leaf flourish */}
        <path d="M60 92 C60 65 92 60 92 35 C70 40 60 65 60 92 Z" stroke="currentColor" strokeWidth="1.1" fill="color-mix(in srgb, currentColor 10%, transparent)" />
      </>
    );
  } else if (/истори|history|тарих|право|law|общество/.test(name)) {
    // History / Social Studies: Nomadic solar disc (Күн таңба), architectural archway of Yassawi mausoleum
    content = (
      <>
        <circle cx="60" cy="55" r="46" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />
        {/* Stele / Arch */}
        <path d="M34 86 V48 A26 26 0 0 1 86 48 V86" stroke="currentColor" strokeWidth="1.3" fill="none" />
        <path d="M44 86 V52 A16 16 0 0 1 76 52 V86" stroke="currentColor" strokeWidth="0.9" fill="none" strokeDasharray="3 2" />
        <line x1="26" y1="86" x2="94" y2="86" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="22" y1="91" x2="98" y2="91" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        {/* Nomadic Sun symbol / Solar emblem */}
        <circle cx="60" cy="30" r="10" stroke="currentColor" strokeWidth="1.1" fill="none" />
        <circle cx="60" cy="30" r="4" fill="currentColor" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <line
            key={deg}
            x1="60"
            y1="16"
            x2="60"
            y2="13"
            transform={`rotate(${deg} 60 30)`}
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        ))}
      </>
    );
  } else if (/каз|казах|қазақ|рус|russian|англ|english|литерат|әдебиет|literature|тіл|язык/.test(name)) {
    // Languages / Literature: Classical writing quill, open scroll with Kazakh ornamental corner
    content = (
      <>
        <circle cx="60" cy="55" r="46" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />
        {/* Open manuscript book */}
        <path d="M26 44 Q43 40 60 48 Q77 40 94 44 V80 Q77 76 60 84 Q43 76 26 80 Z" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <line x1="60" y1="48" x2="60" y2="84" stroke="currentColor" strokeWidth="1.2" />
        <path d="M34 54 Q44 52 54 55 M34 62 Q44 60 54 63 M34 70 Q44 68 54 71" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
        <path d="M66 55 Q76 52 86 54 M66 63 Q76 60 86 62 M66 71 Q76 68 86 70" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
        {/* Feather quill across */}
        <path d="M84 18 C65 24 55 42 46 64 C52 56 64 52 74 48 C78 40 82 28 84 18 Z" stroke="currentColor" strokeWidth="1.2" fill="color-mix(in srgb, currentColor 10%, transparent)" />
        <line x1="84" y1="18" x2="42" y2="70" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </>
    );
  } else if (/информ|comput|робот|it|програм|цифр/.test(name)) {
    // Informatics / Robotics: Microchip processor core, algorithmic node matrix, circuit traces
    content = (
      <>
        <circle cx="60" cy="55" r="46" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />
        {/* Central chip */}
        <rect x="44" y="39" width="32" height="32" rx="4" stroke="currentColor" strokeWidth="1.3" fill="none" />
        <rect x="50" y="45" width="20" height="20" rx="2" stroke="currentColor" strokeWidth="0.8" fill="color-mix(in srgb, currentColor 10%, transparent)" />
        {/* Circuit pins */}
        <path d="M50 39 V28 M60 39 V24 M70 39 V28" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <path d="M50 71 V82 M60 71 V86 M70 71 V82" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <path d="M44 47 H32 M44 55 H26 M44 63 H32" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <path d="M76 47 H88 M76 55 H94 M76 63 H88" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        {/* Node dots */}
        <circle cx="60" cy="24" r="2.5" fill="currentColor" />
        <circle cx="60" cy="86" r="2.5" fill="currentColor" />
        <circle cx="26" cy="55" r="2.5" fill="currentColor" />
        <circle cx="94" cy="55" r="2.5" fill="currentColor" />
      </>
    );
  } else if (/геогр|geography/.test(name)) {
    // Geography: Armillary celestial globe, latitude/longitude parallels, compass rose
    content = (
      <>
        <circle cx="60" cy="55" r="46" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />
        <circle cx="60" cy="55" r="34" stroke="currentColor" strokeWidth="1.3" fill="none" />
        <ellipse cx="60" cy="55" rx="34" ry="14" stroke="currentColor" strokeWidth="0.9" fill="none" />
        <ellipse cx="60" cy="55" rx="14" ry="34" stroke="currentColor" strokeWidth="0.9" fill="none" />
        <line x1="60" y1="15" x2="60" y2="95" stroke="currentColor" strokeWidth="1.1" />
        <line x1="20" y1="55" x2="100" y2="55" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />
        {/* Globe stand */}
        <path d="M22 55 A38 38 0 0 0 60 93 V101 H72 M48 101 H72" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      </>
    );
  } else {
    // Default academic seal: Open bound folio, radiating wisdom beacon, laurel arc
    content = (
      <>
        <circle cx="60" cy="55" r="46" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.5" />
        <circle cx="60" cy="55" r="40" stroke="currentColor" strokeWidth="0.9" fill="none" />
        <path d="M30 46 Q45 42 60 48 Q75 42 90 46 V78 Q75 74 60 80 Q45 74 30 78 Z" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <line x1="60" y1="48" x2="60" y2="80" stroke="currentColor" strokeWidth="1.2" />
        {/* Wisdom star */}
        <polygon points="60,20 63,28 72,28 65,34 67,42 60,37 53,42 55,34 48,28 57,28" stroke="currentColor" strokeWidth="0.9" fill="currentColor" />
        {/* Laurel wreath arcs */}
        <path d="M24 64 Q22 40 38 28" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" />
        <path d="M96 64 Q98 40 82 28" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" />
      </>
    );
  }

  return (
    <div className="subject-motif-frame" aria-hidden="true">
      <svg
        aria-hidden="true"
        focusable="false"
        className="subject-motif"
        viewBox="0 0 120 110"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {content}
      </svg>
    </div>
  );
}

