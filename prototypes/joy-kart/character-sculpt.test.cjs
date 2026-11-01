const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'character-sculpt.js'),'utf8');
const build=new Function(source+';return driverSurfaceData;')();

for(const panda of[false,true])test(`${panda?'panda':'fox'} head is a closed connected surface with finite unit normals`,()=>{
 const data=build(panda),count=data.positions.length/3,edges=new Map(),neighbors=Array.from({length:count},()=>[]);
 assert.ok(count>1000,'the sculpt must contain a surface');assert.equal(data.normals.length,data.positions.length);assert.equal(data.uv.length,count*2);
 for(const value of data.positions)assert.ok(Number.isFinite(value));for(let i=0;i<data.normals.length;i+=3)assert.ok(Math.abs(Math.hypot(data.normals[i],data.normals[i+1],data.normals[i+2])-1)<1e-5,'unit surface normal');
 for(let i=0;i<data.indices.length;i+=3){const triangle=Array.from(data.indices.subarray(i,i+3));assert.equal(new Set(triangle).size,3,'no collapsed triangle');for(let j=0;j<3;j++){const a=triangle[j],b=triangle[(j+1)%3];assert.ok(a<count&&b<count);const key=Math.min(a,b)+':'+Math.max(a,b);edges.set(key,(edges.get(key)||0)+1);neighbors[a].push(b);neighbors[b].push(a);}}
 for(const incidence of edges.values())assert.equal(incidence,2,'every surface edge must join exactly two faces');
 const reached=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const next of neighbors[queue[i]])if(!reached.has(next)){reached.add(next);queue.push(next);}assert.equal(reached.size,count,'cheeks and muzzle must belong to the same connected head');
 assert.equal(count-edges.size+data.indices.length/3,2,'the head must have the topology of one closed shell');
});
