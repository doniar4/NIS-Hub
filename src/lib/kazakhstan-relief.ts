import regions from "./data/kazakhstan-regions.json";

// Activity uses yaw 45°, elevation 34°. Moving both model axes by this
// amount extrudes an edge straight down on screen in that same camera.
const offset=16/(Math.SQRT2*Math.sin(34*Math.PI/180));
export const kazakhstanRelief=regions.map(region=>{
 const walls=["",""];
 for(const contour of region.path.split(/(?=M)/)){
  const numbers=contour.match(/-?\d+(?:\.\d+)?/g)?.map(Number)??[];
  const points=Array.from({length:numbers.length/2},(_,i)=>[numbers[i*2],numbers[i*2+1]]);
  for(let i=0;i<points.length;i++){
   const [x,y]=points[i],[nextX,nextY]=points[(i+1)%points.length];
   const side=nextX-x>nextY-y?0:1;
   walls[side]+=`M${x} ${y}L${nextX} ${nextY}L${(nextX+offset).toFixed(2)} ${(nextY+offset).toFixed(2)}L${(x+offset).toFixed(2)} ${(y+offset).toFixed(2)}Z`;
  }
 }
 return {pcode:region.pcode,light:walls[0],shade:walls[1]};
});
