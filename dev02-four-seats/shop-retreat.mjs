// The inside intersections are destinations; the two outside aisles let a
// commander at the far edge round an outer pad instead of cutting through it.
const X=[-1.5,1.5], Z=[-6.45,-2.4,2.4,6.45];
const length=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);

export function shopRetreatPath(start,pads,r,expanded=false) {
  const Zs=expanded?[-6.85,-3.6,0,3.6,6.85]:Z;
  const inner=(x,z)=>Math.abs(x)===1.5&&(expanded?Math.abs(z)<=3.6:Math.abs(z)===2.4);
  const nodes=[start,...X.flatMap(x=>Zs.map(z=>[x,z])),
    ...X.map(x=>[x,start[1]]),...Zs.map(z=>[start[0],z])];
  const clear=(a,b,first)=>{
    const x=b[0]-a[0], z=b[1]-a[1], d=x*x+z*z;
    return pads.every(([px,pz])=>{
      px-=a[0];pz-=a[1];
      // We can leave the pad we are already standing on. Subsequent
      // segments must steer clear of every pad, including that one.
      if(first&&Math.hypot(px,pz)<=r)return true;
      const t=d?Math.max(0,Math.min(1,(px*x+pz*z)/d)):0;
      return Math.hypot(px-x*t,pz-z*t)>r+.01;
    });
  };
  const cost=nodes.map((_,i)=>i?Infinity:0),prev=nodes.map(()=>-1),seen=new Set();
  // Dijkstra over this tiny visibility graph. Preserve fixed order on ties.
  for(let n=0;n<nodes.length;n++){
    let at=-1;
    for(let i=0;i<nodes.length;i++)if(!seen.has(i)&&Number.isFinite(cost[i])&&(at<0||cost[i]<cost[at]))at=i;
    if(at<0)break;
    seen.add(at);
    if(inner(...nodes[at])){
      const route=[];
      for(let i=at;i>0;i=prev[i])route.unshift(nodes[i]);
      return route.length?route:[nodes[at]];
    }
    nodes.forEach((to,i)=>{
      const next=cost[at]+length(nodes[at],to);
      if(!seen.has(i)&&next<cost[i]&&clear(nodes[at],to,at===0)){cost[i]=next;prev[i]=at;}
    });
  }
  // Even an unsupported future pad arrangement must still cancel purchases
  // immediately; the engine suppresses purchases throughout this retreat.
  return [[start[0]<0?-1.5:1.5,expanded?0:start[1]<0?-2.4:2.4]];
}
