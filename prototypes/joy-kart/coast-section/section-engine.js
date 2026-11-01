/** Fixed-step practice section. Coordinates are metres; graphics never award progress. */
function createCoastSectionModule() {
 const STEP=1/120, LENGTH=260, ITEMS=['turbo','spring','shield','grip','impulse'];
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const smooth=(a,b,x)=>{const u=clamp((x-a)/(b-a),0,1);return u*u*(3-2*u);};
 const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
 function baseX(s){const u=clamp((s-18)/72,0,1);return 12*Math.sin(Math.PI*u)*Math.sin(Math.PI*2*u);}
 function offset(s){return s<120?3.2+4.8*smooth(100,120,s):8*(1-smooth(160,196,s));}
 function height(s){return 3+4*smooth(18,90,s)-4*smooth(160,210,s);}
 function xy(s,route='main'){return{x:baseX(s)+(route==='main'?0:offset(s)),z:50-s};}
 function frame(s,route='main'){
  const p=xy(s,route),a=xy(s-.05,route),b=xy(s+.05,route),dx=(b.x-a.x)/.1,len=Math.hypot(dx,1);
  return{...p,angle:Math.atan2(dx,-1),nx:1/len,nz:dx/len,scale:len};
 }
 function top(s,route='main'){
  if(route==='runout')return 1+(height(s)-1)*smooth(155,196,s);
  if(route==='ramp')return s>120&&s<139?null:height(s)+(s<=120?2.5*smooth(110,120,s):0);
  return height(s);
 }
 function point(s,lat=0,route='main',y=null){const f=frame(s,route);return{x:f.x+lat*f.nx,z:f.z+lat*f.nz,y:y??top(s,route)??1,angle:f.angle};}
 const course={length:LENGTH,frame,point,top,height,offset,halfWidth:4.5,rampStart:120,landingStart:139,landingEnd:160,merge:196,wet:[176,210],boxes:[38,88,213],obstacleS:68};
 class CoastSection {
  constructor(item='turbo'){this.reset(item);}
  reset(item=this.initialItem||'turbo'){
   this.initialItem=ITEMS.includes(item)?item:'turbo';this.phase='ready';this.previousPhase='running';this.time=0;this.countdown=3;this.accumulator=0;this.useQueued=false;this.events=[];this.boxesTaken=new Set();this.pickupIndex=0;
   this.k={s:0,lat:0,v:0,yaw:0,latV:0,turn:0,y:height(0),vy:0,grounded:true,airTime:0,jumpFrom:null,route:'main',entry:false,routeProof:null,shared:false,drifting:false,charge:0,driftDir:0,item:this.initialItem,boost:0,shield:0,grip:0,impulse:0,hitCooldown:0};
   this.stats={hits:0,blocked:0,landings:0,misses:0,drifts:0,itemUses:Object.fromEntries(ITEMS.map(i=>[i,0]))};
  }
  begin(item=this.initialItem){this.reset(item);this.phase='countdown';}
  pause(){if(!['countdown','running'].includes(this.phase))return;this.previousPhase=this.phase;this.phase='paused';this.accumulator=0;this.useQueued=false;this.cancelDrift();}
  resume(){if(this.phase==='paused'){this.phase=this.previousPhase;this.accumulator=0;}}
  cancelDrift(){this.k.drifting=false;this.k.charge=0;this.k.driftDir=0;}
  queueItem(){if(this.phase!=='running'||!this.k.item)return false;this.useQueued=true;return true;}
  emit(type,detail){this.events.push({type,detail,time:this.time});}
  takeEvents(){const e=this.events;this.events=[];return e;}
  bonus(source){const k=this.k;k.boost=Math.max(k.boost,source==='drift'?.65:.85);if(k.impulse>0){k.impulse=0;k.boost=Math.max(k.boost,1.1);this.emit('impulse-bonus',source);}this.emit('bonus',source);}
  useItem(){
   const k=this.k,item=k.item;if(!item)return false;
   if(item==='spring'&&(!k.grounded||k.v<4)){this.emit('item-rejected','Sprung braucht Bodenkontakt und Tempo');return false;}
   k.item=null;this.stats.itemUses[item]++;this.emit('item-used',item);
   if(item==='turbo')k.boost=Math.max(k.boost,1.35);
   if(item==='spring'){k.grounded=false;k.vy=6;k.airTime=0;k.jumpFrom='spring';this.cancelDrift();}
   if(item==='shield')k.shield=6;
   if(item==='grip')k.grip=3;
   if(item==='impulse')k.impulse=6;
   return true;
  }
  contact(source){const k=this.k;if(k.hitCooldown>0)return;k.hitCooldown=.85;if(k.shield>0){k.shield=0;this.stats.blocked++;this.emit('protected',source);return;}k.v*=.56;k.latV*=-.25;k.yaw*=.6;this.cancelDrift();this.stats.hits++;this.emit('hit',source);}
  advance(seconds,input={}){
   if(!['running','countdown'].includes(this.phase)||!Number.isFinite(seconds)||seconds<=0)return;
   const steer=Number.isFinite(input.steer)?clamp(input.steer,-1,1):0,drift=input.drift===true;
   this.accumulator+=Math.min(seconds,.25);
   while(this.accumulator+1e-10>=STEP){this.accumulator-=STEP;if(this.phase==='countdown'){this.countdown=Math.max(0,this.countdown-STEP);if(this.countdown<1e-8){this.countdown=0;this.phase='running';this.emit('go');}continue;}this.tick(steer,drift);if(this.phase!=='running'){this.accumulator=0;break;}}
  }
  tick(steer,hold){
   const k=this.k,dt=STEP,oldS=k.s,oldY=k.y,oldFrame=frame(k.s,k.route);this.time+=dt;
   for(const field of ['boost','shield','grip','impulse','hitCooldown'])k[field]=Math.max(0,k[field]-dt);
   if(this.useQueued){this.useQueued=false;this.useItem();}
   const wet=k.s>=176&&k.s<=210&&k.lat<1.3&&k.route!=='runout';
   const grip=k.grip>0?1.25:wet?.46:1;
   if(!hold&&k.drifting){if(k.charge>=.75&&k.grounded){this.stats.drifts++;this.bonus('drift');}this.cancelDrift();}
   if(hold&&!k.drifting&&k.grounded&&k.v>=8&&Math.abs(steer)>.18){k.drifting=true;k.driftDir=Math.sign(steer);}
   if(k.drifting&&k.grounded&&hold&&k.v>=8)k.charge=Math.min(1.8,k.charge+dt*(Math.abs(steer)>.1?1:.25));
   if(!k.grounded)this.cancelDrift();
   const runout=k.route==='runout',edge=k.grounded&&Math.abs(k.lat)>(k.route==='main'?4:2.2),vmax=runout?10:edge?15:k.boost>0?32:k.drifting?22:24;
   k.v+=(vmax-k.v)*(1-Math.exp(-dt*(k.boost>0?2.6:.9)));
   const steeringRate=(k.drifting?1.32:1.05)*(k.grounded?1:.36),turnTarget=steer*steeringRate*clamp(k.v/10,0,1);
   k.turn+=(turnTarget-k.turn)*(1-Math.exp(-dt*(k.grip>0?12:wet?4:8)));
   const ds=k.v*Math.max(.15,Math.cos(k.yaw))/oldFrame.scale*dt;k.s=Math.min(LENGTH+2,k.s+ds);
   const nextFrame=frame(k.s,k.route);k.yaw=clamp(k.yaw+wrap(nextFrame.angle-oldFrame.angle)+k.turn*dt,-1.05,1.05);
   const desiredLatV=Math.sin(k.yaw)*k.v;k.latV+=(desiredLatV-k.latV)*(1-Math.exp(-dt*(k.drifting?2.6:7)*grip));k.lat+=k.latV*dt;
   // The route switch preserves the lateral position and world heading at the fork.
   if(k.route==='main'&&oldS<100&&k.s>=100&&k.lat>2){const before=frame(k.s,'main');k.lat-=offset(k.s);k.route='ramp';k.yaw+=wrap(frame(k.s,'ramp').angle-before.angle);this.emit('route','ramp');}
   if(k.s>=90&&k.s<120&&k.grounded)k.entry=true;
   if(k.route==='ramp'&&oldS<=120&&k.s>120&&k.grounded){k.grounded=false;k.vy=6;k.airTime=0;k.jumpFrom='ramp';this.cancelDrift();this.emit('takeoff','ramp');}
   if(k.grounded){const floor=top(k.s,k.route);if(floor!==null)k.y=floor;else{k.grounded=false;k.vy=0;k.airTime=0;k.jumpFrom='edge';}}
   if(!k.grounded){
    k.airTime+=dt;k.vy-=18*dt;k.y+=k.vy*dt;
    let floor=top(k.s,k.route);if(k.route==='ramp'&&Math.abs(k.lat)>2.6)floor=null;
    const upperCrossing=floor!==null&&k.vy<=0&&oldY>=floor-.04&&k.y<=floor;
    if(!upperCrossing&&k.route==='ramp'&&k.s>=120&&k.s<196&&k.y<height(k.s)-.1&&k.vy<0){k.route='runout';floor=top(k.s,'runout');this.stats.misses++;this.emit('runout');}
    if(floor!==null&&k.vy<=0&&oldY>=floor-.04&&k.y<=floor){
     const clean=k.route!=='runout'&&k.airTime>=.25&&Math.abs(k.yaw)<.5&&Math.abs(k.lat)<(k.route==='main'?4:2.6);k.y=floor;k.vy=0;k.grounded=true;this.stats.landings++;this.emit('landed',clean?'clean':k.route);
     if(k.route==='ramp'&&['ramp','spring'].includes(k.jumpFrom)&&k.s>=139&&k.s<=160&&Math.abs(k.lat)<=2.6)k.routeProof='landing';
     if(clean&&k.impulse>0)this.bonus('landing');k.airTime=0;k.jumpFrom=null;
    }
   }
   // Stone rails delimit actual supported roads. Airborne steering remains independent.
   if(k.grounded){const bound=k.route==='main'?4.65:k.route==='runout'?5.7:2.7;if(Math.abs(k.lat)>bound){k.lat=clamp(k.lat,-bound,bound);this.contact('rail');}}
   if(k.entry&&k.grounded&&k.route==='main'&&k.s>=150&&k.s<=190)k.routeProof='main';
   if(k.entry&&k.grounded&&k.route==='runout'&&k.s>=180&&k.s<=196)k.routeProof='runout';
   if(k.route!=='main'&&k.s>=196&&k.grounded){k.route='main';this.emit('merge',k.routeProof);}
   if(k.entry&&k.routeProof&&k.grounded&&k.route==='main'&&k.s>=198)k.shared=true;
   // Swept longitudinal checks prevent high speed from tunnelling through a cart or box.
   const obstacleLat=Math.sin(this.time*.7)*2.4;
   if(oldS<=70.6&&k.s>=65.4&&Math.abs(k.lat-obstacleLat)<1.8&&k.y<height(68)+1.5)this.contact('harbor-cart');
   for(const [index,s]of course.boxes.entries())if(oldS<=s&&k.s>=s&&!this.boxesTaken.has(index)&&k.grounded&&k.route==='main'&&[-2.5,0,2.5].some(lat=>Math.abs(k.lat-lat)<.95)){this.boxesTaken.add(index);if(!k.item){k.item=ITEMS[this.pickupIndex++%ITEMS.length];this.emit('pickup',k.item);}}
   if(k.s>=LENGTH&&k.grounded){this.phase=k.shared?'finished':'invalid';this.emit(this.phase);}
  }
  snapshot(){const k=this.k;return{phase:this.phase,time:this.time,countdown:this.countdown,...k,position:point(k.s,k.lat,k.route,k.y),wet:k.s>=176&&k.s<=210&&k.lat<1.3&&k.route!=='runout',speedKmh:Math.round(k.v*3.6),progress:clamp(k.s/LENGTH,0,1),stats:{...this.stats,itemUses:{...this.stats.itemUses}}};}
 }
 return{CoastSection,course,ITEMS,STEP,clamp,wrap};
}
