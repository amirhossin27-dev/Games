const labels=['Fuchs','Panda'];
let packet=null, received=0, token=sessionStorage.getItem(new URL('.',location.href).pathname)||'', pendingBoost=false, pendingReady=false, offline='', joined=false;
const startButton=find('[data-action="start"]');
const solo=typeof computerMode!=='undefined' && computerMode;
function requestBoost(){if(solo){race.queueTurbo();return;}if(packet?.me.phase==='running'&&packet.me.item)pendingBoost=true;}
function refreshLobby(){
 const phase=packet?.me.phase||'ready',finished=phase==='finished',overlay=!!offline||phase==='ready'||finished;
 find('.js-overlay').hidden=!overlay;
 find('.js-controls').hidden=overlay;find('.js-speed').hidden=overlay;
 find('.js-count').hidden=phase!=='countdown';find('.js-count').textContent=Math.max(1,Math.ceil(packet?.me.countdown||0));
 let title='Sonnenküsten-Duell',copy='Dasselbe Spiel auf beiden Geräten öffnen. Beide tippen auf Bereit.';
 if(packet){title=labels[packet.slot]+' · Startplatz '+(packet.slot+1);copy=packet.other?'Beide Fahrer sind da. Bereit für den Start?':'Öffnet diesen Link auch auf dem zweiten Gerät im selben WLAN.';}
 if(packet?.ready)copy='Du bist bereit. Warte auf den zweiten Fahrer …';
 if(finished){
  const other=packet.other;
  title='Im Ziel';
  copy='Deine Zeit '+packet.me.time.toFixed(2)+' s · Warte auf den Zieleinlauf.';
  if(other?.phase==='finished'){
   const delta=packet.me.time-other.time;
   title=Math.abs(delta)<.001?'Zeitgleich!':delta<0?'Du gewinnst!':labels[1-packet.slot]+' gewinnt!';
   copy=labels[packet.slot]+' '+packet.me.time.toFixed(2)+' s · '+labels[1-packet.slot]+' '+other.time.toFixed(2)+' s';
   if(packet.ready)copy+=' · Revanche angefragt';
  }
 }
 if(solo&&!finished){title=course.name+' · 3 Runden';copy='Pfeiltasten oder A/D zum Lenken. Mit E das gesammelte Item einsetzen.';}
 if(offline){title='Verbindung';copy=offline;}
 find('h2').textContent=title;find('p').textContent=copy;
 startButton.textContent=!joined?'Beitreten':finished?'Revanche':'Bereit';
 if(solo){startButton.textContent=finished?'Revanche':'Gegen Computer starten';startButton.disabled=finished&&packet.other.phase!=='finished';return;}
 startButton.disabled=joined&&(!packet||!!offline||packet.ready||(finished&&packet.other?.phase!=='finished'));
}
async function poll(){
 if(!joined||!root.isConnected)return;
 const turbo=pendingBoost;pendingBoost=false;
 try{
  const res=await fetch(new URL('state',location.href),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:token,ready:pendingReady,steer:input(),turbo}),signal:AbortSignal.timeout(4000)});
  const data=await res.json();
  if(!res.ok){
   if(res.status===410||res.status===409){joined=false;token='';packet=null;sessionStorage.removeItem(new URL('.',location.href).pathname);}
   throw Error(data.error||'Spielserver nicht erreichbar.');
  }
  if(!packet||packet.round!==data.round||packet.me.phase!==data.me.phase)clear();
  if(packet?.me.phase==='countdown'&&data.me.phase==='running')toast('LOS!');
  if(packet&&data.round===packet.round&&data.me.stats.turboUses>packet.me.stats.turboUses)toast('Turbo!');
  if(packet&&data.me.phase==='running'&&data.me.item&&!packet.me.item)toast(KART_ITEMS[data.me.item]+' bereit');
  packet=data;received=performance.now();token=data.key;sessionStorage.setItem(new URL('.',location.href).pathname,token);pendingReady=false;offline='';
 }catch(e){offline=e.message;clear();}
 refreshLobby();if(joined)setTimeout(poll,50);
}
function bindDuel(){
 refreshLobby();startButton.onclick=()=>{if(solo){startComputerRace();return;}if(!joined){joined=true;pendingReady=false;offline='';poll();}else pendingReady=true;};
 const pad=find('[data-control="pad"]');
 pad.onpointerdown=e=>{if(held.size)return;e.preventDefault();pad.setPointerCapture(e.pointerId);held.set(e.pointerId,{x:e.clientX,value:0});};
 pad.onpointermove=e=>{const p=held.get(e.pointerId);if(p)p.value=clamp((e.clientX-p.x)/(pad.clientWidth*.4),-1,1);};
 for(const type of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(type,e=>held.delete(e.pointerId));
 const turbo=find('[data-action="turbo"]');turbo.onpointerdown=e=>{e.preventDefault();requestBoost();};turbo.onclick=e=>{if(!e.detail)requestBoost();};
 window.addEventListener('keydown',e=>{if(packet?.me.phase!=='running')return;if(['ArrowRight','ArrowLeft','KeyA','KeyD','KeyE'].includes(e.code)){e.preventDefault();keys.add(e.code);if(e.code==='KeyE'&&!e.repeat)requestBoost();}});
 window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',clear);
}
function moveKart(model,k,time,dt){
 const p=course.point(k.s,k.lat),f=course.frame(k.s);
 model.group.position.set(p.x,p.y+.06,p.z);
 model.group.rotation.y=f.angle-Math.atan2(k.latV,Math.max(3,k.v));
 model.body.rotation.z=-k.steer*.055;
 model.shieldEffect.visible=k.shield>0;
 model.itemRing.visible=k.magnet>0||k.waveFlash>0;
 if(model.itemRing.visible)model.itemRing.scale.setScalar(k.waveFlash>0?1+6*(1-k.waveFlash):1.65+.15*Math.sin(time*7));
 model.animate(k.v/M.SPEED.turbo,k.steer,k.boost>0,time);
 for(const w of model.wheels){w.spin.rotation.x+=k.v*dt/.47;if(w.front)w.pivot.rotation.y=-k.steer*.25;}
 model.shadow.position.set(p.x,p.y+.04,p.z);model.shadow.rotation.z=-model.group.rotation.y;
}
function visualState(k,dt,previous){
 const age=k.phase==='running'?Math.min(.12,(performance.now()-received)/1000):0;
 const s=Math.min(course.length,k.s+k.v*age),lat=clamp(k.lat+k.latV*age,-course.centreBound,course.centreBound);
 const alpha=1-Math.exp(-dt*26),snap=!previous||k.phase!=='running'||Math.abs(previous.s-s)>8;
 return {...k,s:snap?s:previous.s+(s-previous.s)*alpha,lat:snap?lat:previous.lat+(lat-previous.lat)*alpha};
}
