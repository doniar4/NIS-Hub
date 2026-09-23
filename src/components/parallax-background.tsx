/** Three diffuse light fields; ambient CSS drift only, never pointer parallax. */
export function ParallaxBackground() {
  return <div className="ambient-background" aria-hidden="true">
    <span className="ambient-blob ambient-blue"/>
    <span className="ambient-blob ambient-violet"/>
    <span className="ambient-blob ambient-cyan"/>
  </div>;
}
