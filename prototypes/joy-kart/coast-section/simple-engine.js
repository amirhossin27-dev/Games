/** Assisted phone driving: the road supplies heading, the player chooses lateral position. */
function createCoastSimpleModule(circuit=null){
 const STEP=1/120,LENGTH=circuit?.length||300,BOUND=4.5,SPEED={cruise:24,turbo:36,turboSeconds:1.8,acceleration:2.2,turboAcceleration:7},clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const u=s=>clamp(s/LENGTH,0,1),baseX=s=>{const t=u(s);return 8*Math.sin(2*Math.PI*t)*Math.sin(Math.PI*t)**2;},height=s=>3.5+1.5*Math.sin(Math.PI*u(s))**2;
 function frame(s){const dx=(baseX(s+.05)-baseX(s-.05))/.1,len=Math.hypot(dx,1);return{x:baseX(s),z:55-s,angle:Math.atan2(dx,-1),nx:1/len,nz:dx/len,scale:len};}
 function point(s,lat=0){const f=frame(s);return{x:f.x+f.nx*lat,y:height(s),z:f.z+f.nz*lat,angle:f.angle};}
 const course=circuit||{length:LENGTH,halfWidth:6,centreBound:BOUND,frame,point,height,boxes:[60,145,235]};
 class SimpleRace{
  constructor(){this.courseLength=course.lapLength||LENGTH;this.reset();}
  reset(){this.phase='ready';this.previousPhase='running';this.time=0;this.countdown=3;this.accumulator=0;this.queued=false;this.events=[];this.taken=new Set();this.edge=false;this.k={s:0,lat:0,latV:0,v:0,y:course.height(0),steer:0,boost:0,shield:0,magnet:0,slow:0,blocked:0,waveFlash:0,item:'turbo',grounded:true,route:'main',routeProof:null};this.stats={turboUses:0,edgeTouches:0,boxes:0,itemUses:{turbo:0}};}
  begin(){this.reset();this.phase='countdown';}
  pause(){if(!['running','countdown'].includes(this.phase))return;this.previousPhase=this.phase;this.phase='paused';this.accumulator=0;this.queued=false;this.k.latV=0;this.k.steer=0;}
  resume(){if(this.phase==='paused'){this.phase=this.previousPhase;this.accumulator=0;}}
  queueTurbo(){if(this.phase!=='running'||!this.k.item)return false;this.queued=true;return true;}
  takeEvents(){const e=this.events;this.events=[];return e;}
  advance(seconds,steer=0){if(!['running','countdown'].includes(this.phase)||!Number.isFinite(seconds)||seconds<=0)return;const input=Number.isFinite(steer)?clamp(steer,-1,1):0;this.accumulator+=Math.min(seconds,.25);while(this.accumulator+1e-10>=STEP){this.accumulator-=STEP;if(this.phase==='countdown'){this.countdown=Math.max(0,this.countdown-STEP);if(this.countdown<1e-8){this.countdown=0;this.phase='running';this.events.push('go');}continue;}this.tick(input);if(this.phase==='finished'){this.accumulator=0;break;}}}
  tick(input){
   const k=this.k,dt=STEP,oldS=k.s;this.time+=dt;k.boost=Math.max(0,k.boost-dt);
   if(circuit){for(const key of ['shield','magnet','slow','blocked','waveFlash'])k[key]=Math.max(0,k[key]-dt);}
   if(this.queued){
    this.queued=false;const item=k.item;
    if(item){
     k.item=null;this.stats.itemUses[item]=(this.stats.itemUses[item]||0)+1;this.events.push(item);
     if(item==='turbo'){k.boost=SPEED.turboSeconds;this.stats.turboUses++;}
     if(item==='shield'){k.shield=12;k.slow=0;}
     if(item==='magnet')k.magnet=12;
     if(item==='wave')k.waveFlash=1;
    }
   }
   k.steer+=(input-k.steer)*(1-Math.exp(-dt/(input===0?.035:.06)));const outward=Math.sign(k.steer)===Math.sign(k.lat),remaining=BOUND-Math.abs(k.lat),taper=outward?clamp(remaining/.9,0,1):1;
   const targetLatV=k.steer*5.5*taper*clamp(k.v/6,0,1);k.latV+=(targetLatV-k.latV)*(1-Math.exp(-dt/(input===0?.035:.07)));k.lat=clamp(k.lat+k.latV*dt,-BOUND,BOUND);if(Math.abs(k.lat)>=BOUND-1e-6&&Math.sign(k.latV)===Math.sign(k.lat))k.latV=0;
   const atEdge=Math.abs(k.lat)>BOUND-.35&&outward&&Math.abs(input)>.15;if(atEdge&&!this.edge)this.stats.edgeTouches++;this.edge=atEdge;
   const vmax=(k.boost>0?SPEED.turbo:SPEED.cruise)*(k.slow>0?.65:1)*(atEdge?.92:1);k.v+=(vmax-k.v)*(1-Math.exp(-dt*(k.boost>0?SPEED.turboAcceleration:SPEED.acceleration)));k.s=Math.min(LENGTH,k.s+k.v/(circuit?1:course.frame(k.s).scale)*dt);k.y=course.height(k.s);
   const lap=Math.min((course.laps||1)-1,Math.floor(oldS/this.courseLength)),offset=lap*this.courseLength;
   for(const [row,mark] of course.boxes.entries()){
    const id=lap*course.boxes.length+row;
    if(oldS>offset+mark||k.s<offset+mark||this.taken.has(id))continue;
    const lanes=circuit?course.lanes(row):[-3.5,0,3.5];
    if(k.magnet<=0&&!lanes.some(l=>Math.abs(k.lat-l)<1.6))continue;
    this.taken.add(id);this.stats.boxes++;
    if(!k.item){k.item=circuit?course.pickupType(row,lap):'turbo';this.events.push('pickup');}
   }
   if(k.s>=LENGTH){k.routeProof='main';this.phase='finished';this.events.push('finished');}
  }
  snapshot(){const k=this.k;return{phase:this.phase,time:this.time,countdown:this.countdown,...k,progress:k.s/LENGTH,speedKmh:Math.round(k.v*3.6),lap:Math.min(course.laps||1,Math.floor(k.s/this.courseLength)+1),lapLength:this.courseLength,totalLaps:course.laps||1,position:course.point(k.s,k.lat),assistedSteering:true,stats:{...this.stats,itemUses:{...this.stats.itemUses}}};}
 }
 return{SimpleRace,course,STEP,SPEED,clamp};
}
