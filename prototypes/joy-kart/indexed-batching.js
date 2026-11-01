/** Join material-compatible parts while retaining shared vertices and triangle order. */
function batchIndexedGeometry(parts, vertexColors=false) {
 let vertexCount=0,indexCount=0;
 for(const part of parts){vertexCount+=part.positions.length/3;indexCount+=part.indices?part.indices.length:part.positions.length/3;}
 const positions=new Float32Array(vertexCount*3),normals=new Float32Array(vertexCount*3),uvs=new Float32Array(vertexCount*2),colors=vertexColors?new Float32Array(vertexCount*3).fill(1):null;
 const indices=vertexCount<=65536?new Uint16Array(indexCount):new Uint32Array(indexCount);let vertexOffset=0,indexOffset=0;
 for(const part of parts){
  const count=part.positions.length/3;positions.set(part.positions,vertexOffset*3);if(part.normals)normals.set(part.normals,vertexOffset*3);if(part.uvs)uvs.set(part.uvs,vertexOffset*2);if(colors&&part.colors)colors.set(part.colors,vertexOffset*3);
  if(part.indices){for(const index of part.indices)indices[indexOffset++]=vertexOffset+index;}else{for(let i=0;i<count;i++)indices[indexOffset++]=vertexOffset+i;}
  vertexOffset+=count;
 }
 return{positions,normals,uvs,colors,indices};
}
