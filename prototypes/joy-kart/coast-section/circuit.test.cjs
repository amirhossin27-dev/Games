const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const build=new Function('second',source('circuit.js')+source('simple-engine.js')+';return {...createCoastSimpleModule(createKartCircuit(second)),resolveKartWaves};');
for(const second of [false,true]){
 const {SimpleRace,course}=build(second);
 test(course.name+' closes at the line and takes 3–4 minutes for three laps',()=>{
  const first=course.point(0,2),last=course.point(course.lapLength,2);
  assert(Math.hypot(first.x-last.x,first.y-last.y,first.z-last.z)<1e-8);assert.equal(first.angle,last.angle);
  let total=0;for(let s=0;s<course.lapLength;s++){const a=course.point(s),b=course.point(s+1);total+=Math.hypot(a.x-b.x,a.z-b.z);}
  assert(Math.abs(total-course.lapLength)<1);
  const times=[];
  for(const useItems of [false,true]){
   const race=new SimpleRace();race.begin();const laps=[1];
   while(race.phase!=='finished'&&race.time<250){
    if(useItems)race.queueTurbo();race.advance(1/30);
    const k=race.snapshot();if(laps.at(-1)!==k.lap)laps.push(k.lap);
    race.takeEvents();
   }
   assert.equal(race.phase,'finished');assert.deepEqual(laps,[1,2,3]);assert.equal(race.k.s,course.lapLength*3);
   assert(race.time>=180&&race.time<=240);times.push(race.time);
  }
  assert(times[1]<times[0]);console.log(course.name+' – ohne/mit Items: '+times.map(t=>t.toFixed(2)).join(' / ')+' Sekunden');
 });
}
test('wave hits across the timing line, respects range and consumes a shield',()=>{
 const {SimpleRace,course,resolveKartWaves}=build(false);
 const racers=[new SimpleRace(),new SimpleRace()];
 for(const r of racers){r.begin();for(let j=0;j<14;j++)r.advance(.25);}
 const [a,b]=racers;a.k.s=course.lapLength-10;b.k.s=course.lapLength+5;
 function fire(){a.k.item='wave';const prev=racers.map(r=>r.stats.itemUses.wave||0);a.queueTurbo();a.advance(.02);resolveKartWaves(racers,prev);}
 b.k.item='shield';b.queueTurbo();b.advance(.02);fire();assert.equal(b.k.slow,0);assert.equal(b.k.shield,0);assert(b.k.blocked>0);
 fire();assert(b.k.slow>2);b.advance(.25);assert(b.k.v<24);
 b.k.slow=0;b.k.s+=150;fire();assert.equal(b.k.slow,0);
});
test('magnet collects from the opposite side and boxes refill on the next lap',()=>{
 const {SimpleRace,course}=build(false);
 const r=new SimpleRace();r.phase='running';r.k.v=24;r.k.lat=-4.5;
 const row=2,mark=course.boxes[row];
 r.k.s=mark-1;r.k.item=null;r.advance(.1);assert.equal(r.k.item,null);
 r.k.s=mark-1;r.k.item='magnet';r.queueTurbo();r.advance(.1);assert.equal(r.k.item,course.pickupType(row,0));
 r.k.s=mark+course.lapLength-1;r.k.item=null;r.advance(.1);
 assert.equal(r.k.item,course.pickupType(row,1));assert.equal(r.stats.boxes,2);
});
