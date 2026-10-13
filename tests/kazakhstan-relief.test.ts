import test from "node:test";
import assert from "node:assert/strict";
import { createKazakhstanRelief, defaultMapCamera, mapProjection } from "../src/lib/kazakhstan-relief";

test("Map camera projects relief downward and keeps labels upright throughout a full rotation", () => {
  for (const yaw of [-180, 0, 45, 90, 135, 180, 270, 360, 405]) {
    for (const elevation of [20, 34, 75]) {
      const p = mapProjection({ yaw, elevation });
      const [a,b,c,d] = p.matrix.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!.map(Number);
      const [ia,ib,ic,id] = p.upright.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!.map(Number);
      assert.ok(Math.abs(a*p.offsetX+c*p.offsetY)<1e-10);
      assert.ok(Math.abs(b*p.offsetX+d*p.offsetY-16)<1e-10);
      assert.ok(Math.abs(a*ia+c*ib-1)<1e-10);
      assert.ok(Math.abs(b*ia+d*ib)<1e-10);
      assert.ok(Math.abs(a*ic+c*id)<1e-10);
      assert.ok(Math.abs(b*ic+d*id-1)<1e-10);
      const relief = createKazakhstanRelief({ yaw, elevation });
      assert.equal(relief.length,20);
      assert.ok(relief.every(r=>r.light && r.shade && !/NaN|Infinity/.test(r.light+r.shade)));
    }
  }
  assert.notEqual(createKazakhstanRelief(defaultMapCamera)[0].light,createKazakhstanRelief({yaw:90,elevation:34})[0].light);
});
