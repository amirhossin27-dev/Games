/** Isolated input proposal. No racing, drift physics or power-up effects are simulated here. */
function createJoyKartControlProbe(config={}) {
 const pointers=new Map();let itemReady=true,itemUses=0;
 const clamp=value=>Math.max(-1,Math.min(1,value));
 function snapshot(){let steer=0,driftHeld=false;for(const p of pointers.values()){if(p.role==='left')steer--;if(p.role==='right')steer++;if(p.role==='pad')steer+=p.steer;if(p.role==='drift')driftHeld=true;}steer=clamp(steer);return{steer,driftHeld,driftActive:driftHeld&&Math.abs(steer)>.12,itemReady,itemUses,heldPointers:pointers.size};}
 const emit=reason=>{const value=snapshot();config.onChange?.(value,reason);return value;};
 function analog(p,x){const raw=clamp((x-p.centerX)/p.halfWidth),deadzone=.1;p.steer=Math.abs(raw)<=deadzone?0:Math.sign(raw)*(Math.abs(raw)-deadzone)/(1-deadzone);}
 function useItem(){if(!itemReady)return false;itemReady=false;itemUses++;emit('item');return true;}
 return{
  snapshot,useItem,
  begin(id,role,point={}){if(pointers.has(id)||!['pad','left','right','drift'].includes(role)||[...pointers.values()].some(p=>p.role===role))return false;const p={role,x:point.x||0,y:point.y||0,centerX:point.centerX||0,halfWidth:Math.max(1,point.halfWidth||1),steer:0,swiped:false};if(role==='pad')analog(p,p.x);pointers.set(id,p);emit('begin');return true;},
  move(id,point){const p=pointers.get(id);if(!p)return false;if(p.role==='pad')analog(p,point.x);if(p.role==='drift'&&!p.swiped&&p.y-point.y>=(config.swipePx||44)&&Math.abs(point.x-p.x)<=56){p.swiped=true;useItem();}emit('move');return true;},
  end(id){if(!pointers.delete(id))return false;emit('end');return true;},
  clear(){pointers.clear();emit('clear');},
  reset(){pointers.clear();itemReady=true;itemUses=0;emit('reset');}
 };
}
