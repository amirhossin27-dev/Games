const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=new Function(fs.readFileSync(path.join(__dirname,'section-engine.js'),'utf8')+';return createCoastSectionModule();')();
const {CoastSection,course,clamp,wrap}=M;
function running(item='turbo'){const r=new CoastSection(item);r.begin();for(let i=0;i<360;i++)r.advance(1/120);assert.equal(r.phase,'running');return r;}
function drive(r,seconds,input={},fps=120){for(let i=0;i<Math.round(seconds*fps);i++)r.advance(1/fps,input);}
function pilot(r,branch=false,slow=false){
 const k=r.k,route=k.route,f=course.frame(k.s,route),next=course.frame(k.s+1,route),target=branch&&route==='main'&&k.s>82&&k.s<100?3.25:0;
 const steer=clamp(-k.yaw*2-(k.lat-target)*.22-wrap(next.angle-f.angle)*k.v/(1.05*f.scale),-1,1);
 if(slow&&route==='ramp'&&k.s<120)k.v=Math.min(k.v,11);
 return{steer,drift:false};
}
function complete(r,branch=false,slow=false){for(let i=0;i<120*60&&r.phase==='running';i++)r.advance(1/120,pilot(r,branch,slow));return r.snapshot();}
test('manual steering changes world position and does not run on a camera animation',()=>{
 const a=running(),b=running();drive(a,1.8,{steer:-.2});drive(b,1.8,{steer:.2});assert(a.k.lat<-.3);assert(b.k.lat>.3);assert(b.snapshot().position.x>a.snapshot().position.x+.6);
});
test('drift needs manual hold; a valid release awards one bonus',()=>{
 const r=running();drive(r,1.1);drive(r,.85,{steer:.2,drift:true});assert(r.k.drifting);assert(r.k.charge>=.75);drive(r,.02,{steer:0});assert.equal(r.stats.drifts,1);assert(r.k.boost>0);drive(r,.1);assert.equal(r.stats.drifts,1);
 const plain=running();drive(plain,1.95,{steer:.2});assert.equal(plain.stats.drifts,0);assert.equal(plain.k.boost,0);
});
test('all five extras consume once and have distinct simulation effects',()=>{
 for(const item of M.ITEMS){const r=running(item);drive(r,1);assert(r.queueItem());drive(r,.02);assert.equal(r.k.item,null);assert.equal(r.stats.itemUses[item],1);assert.equal(r.queueItem(),false);if(item==='turbo')assert(r.k.boost>1);if(item==='spring')assert(!r.k.grounded&&r.k.y>course.height(r.k.s));if(item==='shield')assert(r.k.shield>5);if(item==='grip')assert(r.k.grip>2);if(item==='impulse')assert(r.k.impulse>5);}
});
test('spring follows a real arc and an invalid airborne activation keeps the item',()=>{
 const r=running('spring');drive(r,1);r.queueItem();drive(r,.1);const y=r.k.y;assert(!r.k.grounded);assert(y>course.height(r.k.s)+.25);r.k.item='spring';r.queueItem();drive(r,.05);assert.equal(r.k.item,'spring');assert.equal(r.stats.itemUses.spring,1);drive(r,1);assert(r.k.grounded);assert.equal(r.stats.landings,1);
});
test('shield absorbs one contact and grip changes wet-surface sliding',()=>{
 const r=running('shield');drive(r,1);r.queueItem();drive(r,.02);const v=r.k.v;r.contact('test');assert.equal(r.k.shield,0);assert.equal(r.stats.blocked,1);assert.equal(r.stats.hits,0);assert.equal(r.k.v,v);drive(r,1);r.contact('second');assert.equal(r.stats.hits,1);
 const a=running('turbo'),b=running('grip');for(const q of[a,b])Object.assign(q.k,{s:180,y:course.height(180),v:24,lat:0,latV:4});b.queueItem();drive(a,.1);drive(b,.1);assert(b.k.latV<a.k.latV*.8);
});
test('impulse rewards a valid drift once and does not accumulate unlimited boost',()=>{
 const r=running('impulse');drive(r,1.1);r.queueItem();drive(r,.85,{steer:.2,drift:true});drive(r,.01);assert.equal(r.k.impulse,0);assert(r.k.boost<=1.1&&r.k.boost>1);assert.equal(r.takeEvents().filter(e=>e.type==='impulse-bonus').length,1);drive(r,.1);assert.equal(r.takeEvents().filter(e=>e.type==='impulse-bonus').length,0);
});
test('normal road, clean ramp landing and slow failed-jump runout all earn valid progress',()=>{
 for(const [branch,slow,proof]of[[false,false,'main'],[true,false,'landing'],[true,true,'runout']]){const r=running();const s=complete(r,branch,slow);assert.equal(s.phase,'finished',JSON.stringify({branch,slow,...s}));assert.equal(s.routeProof,proof);assert(s.shared);if(proof==='landing')assert(s.stats.landings>=1&&s.stats.misses===0);if(proof==='runout')assert(s.stats.misses===1);}
});
test('flying over an exit without the required route does not finish a valid section',()=>{
 const r=running();Object.assign(r.k,{s:220,y:course.height(220),v:24,entry:false,routeProof:null});const s=complete(r);assert.equal(s.phase,'invalid');assert.equal(s.shared,false);
});
test('a descending kart lands on the upper deck before the fallback ground is considered',()=>{
 const r=running();Object.assign(r.k,{s:140,route:'ramp',y:7.05,vy:-18,v:24,grounded:false,airTime:.7,jumpFrom:'ramp',entry:true});r.advance(1/120);assert(r.k.grounded);assert.equal(r.k.route,'ramp');assert.equal(r.k.routeProof,'landing');assert.equal(r.stats.misses,0);
});
test('a spring-assisted ramp landing also proves the valid route',()=>{
 const r=running('spring');Object.assign(r.k,{s:119,route:'ramp',v:24,y:course.top(119,'ramp'),entry:true});r.queueItem();const s=complete(r,true);assert.equal(s.phase,'finished');assert.equal(s.routeProof,'landing');assert.equal(s.stats.itemUses.spring,1);
});
test('pause freezes effects, flight, countdown and queued actions',()=>{
 const r=running('shield');drive(r,1);r.queueItem();drive(r,.02);r.pause();const before=r.snapshot();drive(r,8,{steer:1,drift:true});assert.deepEqual(r.snapshot(),before);r.resume();drive(r,.2);assert(r.k.shield<before.shield);assert.equal(r.stats.itemUses.shield,1);
 const c=new CoastSection();c.begin();drive(c,1);c.pause();const countdown=c.countdown;drive(c,10);assert.equal(c.countdown,countdown);
});
test('impulse rewards the valid landing and stays untriggered on a failed-jump runout',()=>{
 for(const route of['ramp','runout']){const r=running();const s=route==='ramp'?145:150;Object.assign(r.k,{s,route,v:20,y:course.top(s,route)+.02,vy:-10,airTime:.7,grounded:false,jumpFrom:'ramp',entry:true,impulse:5});r.advance(1/120);assert(r.k.grounded);if(route==='ramp'){assert.equal(r.k.impulse,0);assert(r.k.boost>1);}else{assert(r.k.impulse>4.9);assert.equal(r.k.boost,0);assert(!r.takeEvents().some(e=>e.type==='impulse-bonus'));}}
});
test('fixed simulation ticks agree at 30, 60 and 120 rendering FPS',()=>{
 const states=[30,60,120].map(fps=>{const r=running();drive(r,7,{steer:.08},fps);return r.snapshot();});for(const s of states.slice(1))for(const key of ['s','lat','v','yaw','y','time'])assert(Math.abs(s[key]-states[0][key])<1e-8,key);
});
module.exports={M,pilot,complete};
