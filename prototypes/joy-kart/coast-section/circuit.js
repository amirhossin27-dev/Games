// Periodic, arc-length sampled centre lines. One unit of race progress is one road metre.
function createKartCircuit(second=false){
 const lapLength=second?1728:1664, laps=3, tau=2*Math.PI, samples=2048;
 const path=[], distances=[0];
 for(let i=0;i<=samples;i++){
  const t=tau*i/samples;
  const radius=second?1+.18*Math.cos(3*t)+.09*Math.cos(5*t):1+.12*Math.cos(2*t)-.08*Math.cos(3*t);
  const x=-Math.cos(t)*radius, z=-Math.sin(t)*radius*(second?.86:.75);
  if(i)distances.push(distances[i-1]+Math.hypot(x-path[i-1].x,z-path[i-1].z));
  path.push({x,z});
 }
 const scale=lapLength/distances[samples], frames=[];let edge=1;
 for(let m=0;m<lapLength;m++){
  const d=m/scale;while(distances[edge]<d)edge++;
  const a=path[edge-1],b=path[edge],u=(d-distances[edge-1])/(distances[edge]-distances[edge-1]);
  frames.push({x:(a.x+(b.x-a.x)*u)*scale,z:(a.z+(b.z-a.z)*u)*scale});
 }
 const wrap=s=>((s%lapLength)+lapLength)%lapLength;
 function frame(s){
  const m=wrap(s),i=Math.floor(m),f=m-i,a=frames[i],b=frames[(i+1)%lapLength],prev=frames[(i+lapLength-1)%lapLength],next=frames[(i+2)%lapLength];
  const dx=(1-f)*(b.x-prev.x)+f*(next.x-a.x),dz=(1-f)*(b.z-prev.z)+f*(next.z-a.z),len=Math.hypot(dx,dz);
  return {x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f,nx:-dz/len,nz:dx/len,angle:Math.atan2(dx,dz),scale:1};
 }
 const height=s=>6+(second?4:2.4)*Math.sin(tau*s/lapLength)**2+1.7*Math.sin(2*tau*s/lapLength);
 function point(s,lat=0){const f=frame(s);return{x:f.x+lat*f.nx,y:height(s),z:f.z+lat*f.nz,angle:f.angle};}
 const boxes=Array.from({length:10},(_,i)=>Math.round((i+.40)*lapLength/10));
 const lanes=i=>i%3===0?[-3.4,3.4]:i%3===1?[-2,1]:[0,3.4];
 const materials=['wave','shield','magnet','turbo'];
 return {cape:second,name:second?'Kap der Winde':'Sonnenbucht',lapLength,laps,length:laps*lapLength,frame,point,height,boxes,lanes,halfWidth:6,centreBound:4.5,wrap,
  pickupType:(row,lap)=>materials[(row+lap+(second?1:0))%materials.length]};
}
const KART_ITEMS={turbo:'Turbo',shield:'Schild',magnet:'Magnet',wave:'Welle'};
function resolveKartWaves(racers,previous){
 for(let i=0;i<2;i++){
  const source=racers[i],target=racers[1-i];
  if((source.stats.itemUses.wave||0)<=previous[i]||target.phase!=='running')continue;
  const length=source.courseLength;
  let gap=Math.abs(source.k.s-target.k.s)%length;gap=Math.min(gap,length-gap);
  if(gap>85)continue;
  if(target.k.shield>0){target.k.shield=0;target.k.blocked=1.2;}
  else target.k.slow=2.2;
 }
}
