import regions from "./data/kazakhstan-regions.json";

export const defaultMapCamera = { yaw: 45, elevation: 34 };
export type MapCamera = typeof defaultMapCamera;

const contours = regions.map(region => ({
  pcode: region.pcode,
  contours: region.path.split(/(?=M)/).map(contour => {
    const numbers = contour.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    return Array.from({ length: numbers.length / 2 }, (_, i) => [numbers[i * 2], numbers[i * 2 + 1]]);
  }),
}));

export function mapProjection({ yaw, elevation }: MapCamera) {
  const angle = yaw * Math.PI / 180, tilt = Math.sin(elevation * Math.PI / 180);
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  let halfWidth = 0, halfHeight = 0;
  for (const region of contours) for (const points of region.contours) for (const [x, y] of points) {
    const centeredX = x - 310, centeredY = y - 172;
    halfWidth = Math.max(halfWidth, Math.abs(centeredX * cosine - centeredY * sine));
    halfHeight = Math.max(halfHeight, Math.abs((centeredX * sine + centeredY * cosine) * tilt));
  }
  return {
    // Reserve space for upright labels, columns and the soft shadow.
    halfWidth: halfWidth + 40, halfHeight: halfHeight + 24,
    matrix: `matrix(${cosine},${sine * tilt},${-sine},${cosine * tilt},0,0)`,
    upright: `matrix(${cosine},${-sine},${sine / tilt},${cosine / tilt},0,0)`,
    // The inverse projection of a vertical 16px extrusion keeps the walls
    // and city columns aligned as the camera rotates.
    offsetX: 16 * sine / tilt,
    offsetY: 16 * cosine / tilt,
  };
}

export function createKazakhstanRelief(camera: MapCamera) {
  const { offsetX, offsetY } = mapProjection(camera);
  const angle = camera.yaw * Math.PI / 180;
  return contours.map(region => {
    const walls = ["", ""];
    for (const points of region.contours) {
      for (let i = 0; i < points.length; i++) {
        const [x, y] = points[i], [nextX, nextY] = points[(i + 1) % points.length];
        const side = (nextX - x) * Math.cos(angle) - (nextY - y) * Math.sin(angle) > 0 ? 0 : 1;
        walls[side] += `M${x} ${y}L${nextX} ${nextY}L${(nextX + offsetX).toFixed(2)} ${(nextY + offsetY).toFixed(2)}L${(x + offsetX).toFixed(2)} ${(y + offsetY).toFixed(2)}Z`;
      }
    }
    return { pcode: region.pcode, light: walls[0], shade: walls[1] };
  });
}
