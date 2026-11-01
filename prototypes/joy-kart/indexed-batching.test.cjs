const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const batch=new Function(fs.readFileSync(path.join(__dirname,'indexed-batching.js'),'utf8')+';return batchIndexedGeometry;')();

test('an indexed quad stays four vertices and preserves both triangles and UV seams',()=>{
 const positions=new Float32Array([0,0,0,1,0,0,1,1,0,0,1,0]),normals=new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1]),uvs=new Float32Array([0,0,1,0,1,1,0,1]);
 const result=batch([{positions,normals,uvs,indices:new Uint16Array([0,1,2,0,2,3])}]);
 assert.equal(result.positions.length/3,4);assert.deepEqual(Array.from(result.indices),[0,1,2,0,2,3]);assert.deepEqual(result.positions,positions);assert.deepEqual(result.normals,normals);assert.deepEqual(result.uvs,uvs);
 assert.notEqual(result.positions,positions);assert.equal(result.colors,null);
});
test('mixed indexed/non-indexed parts offset correctly and retain colors and default attributes',()=>{
 const result=batch([{positions:new Float32Array([0,0,0,1,0,0,0,1,0]),colors:new Float32Array([1,0,0,0,1,0,0,0,1]),indices:new Uint16Array([2,0,1])},{positions:new Float32Array([3,0,0,4,0,0,3,1,0])}],true);
 assert.deepEqual(Array.from(result.indices),[2,0,1,3,4,5]);assert.deepEqual(Array.from(result.colors),[1,0,0,0,1,0,0,0,1,1,1,1,1,1,1,1,1,1]);assert.ok(result.normals.every(x=>x===0));assert.ok(result.uvs.every(x=>x===0));
 const expanded=Array.from(result.indices).flatMap(i=>Array.from(result.positions.subarray(i*3,i*3+3)));
 assert.deepEqual(expanded,[0,1,0,0,0,0,1,0,0,3,0,0,4,0,0,3,1,0]);
});
test('large batches retain indices above 65535 without wrapping',()=>{
 const result=batch([{positions:new Float32Array(65536*3),indices:new Uint16Array([65535,0,1])},{positions:new Float32Array([2,3,4,5,6,7,8,9,10])}]);
 assert.ok(result.indices instanceof Uint32Array);assert.deepEqual(Array.from(result.indices),[65535,0,1,65536,65537,65538]);
});
test('the largest 16-bit vertex index and empty batches remain valid',()=>{
 const large=batch([{positions:new Float32Array(65536*3),indices:new Uint16Array([65535,0,1])}]);assert.ok(large.indices instanceof Uint16Array);assert.equal(large.indices[0],65535);
 const empty=batch([],true);assert.equal(empty.positions.length,0);assert.equal(empty.indices.length,0);assert.equal(empty.colors.length,0);
});
