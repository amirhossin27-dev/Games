/** One continuous supported coastal road. No branching or elevated crossing decks. */
async function createSimpleCoastWorld(THREE,c){
 const {scene,course,kit,artMaps,materials,texture,lighting,yieldTask}=c,{geometry:geo,material:mat}=kit;
 const root=new THREE.Group();scene.add(root);
 const boxGeo=geo(new THREE.BoxGeometry(1,1,1)),box=(w,h,d,m,p,x=0,y=0,z=0)=>{const o=kit.add(boxGeo,m,p,x,y,z);o.scale.set(w,h,d);return o;};
 const at=(s,lat=0,extra=0)=>{const p=course.point(s,lat);return new THREE.Vector3(p.x,p.y+extra,p.z);};
 const stone=mat(0xd8c7a8,{map:artMaps.stone,bumpMap:artMaps.stone,bumpScale:.035}),road=mat(0x8c918c,{map:artMaps.asphalt,bumpMap:artMaps.asphalt,bumpScale:.012}),curb=mat(0xffffff,{vertexColors:true}),wall=mat(0xc4b293,{map:artMaps.stone,bumpMap:artMaps.stone,bumpScale:.04,side:THREE.DoubleSide}),wood=mat(0x75513a),dark=mat(0x263b3d),roofMat=mat(0x9b4b33),gold=mat(0xe6c584,{metalness:.5,roughness:.3});
 // Small headlands carry the seaward houses; between them the wall hugs the road.
 const shoreWidth=s=>11+8*Math.exp(-Math.pow(((s-52)-60*Math.round((s-52)/60))/11,2));
 const circuit=!!course.lapLength,start=circuit?0:-20,end=course.lapLength||320,step=circuit?2:1;
 const bridgeAt=s=>circuit&&s>end*.42&&s<end*.57;
 const width=(s,l)=>Math.abs(l)!==19?l:bridgeAt(s)?Math.sign(l)*8:l<0?-19:circuit?17+2*Math.cos(s/30):shoreWidth(s);
 function strip(inner,outer,material,extra=0,colored=false){
  const positions=[],uv=[],colors=[],indices=[];
  for(let s=start;s<end;s+=step){const j=positions.length/3;for(const [d,l]of[[s,inner],[s,outer],[s+step,inner],[s+step,outer]]){const p=at(d,width(d,l),extra);positions.push(p.x,p.y,p.z);uv.push((l-inner)/4,d/6);if(colored){const col=new THREE.Color(Math.floor(s/2)%2?0xe6dbc0:0xa84632);colors.push(col.r,col.g,col.b);}}indices.push(j,j+1,j+2,j+1,j+3,j+2);}
  const g=geo(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));if(colored)g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return kit.add(g,material,root);
 }
 strip(-19,19,stone);strip(-6,6,road,.025);strip(-6.4,-6,curb,.065,true);strip(6,6.4,curb,.065,true);
 // Retaining sides and end caps extend below water: the promenade cannot float.
 for(const side of[-1,1]){
  const pos=[],uv=[],idx=[];
  for(let s=start;s<end;s+=step){const p=at(s,width(s,side*19)),q=at(s+step,width(s+step,side*19)),i=pos.length/3,bottom=bridgeAt(s)?p.y-1:-3;pos.push(p.x,p.y,p.z,q.x,q.y,q.z,p.x,bottom,p.z,q.x,bottom,q.z);uv.push(s/5,0,(s+1)/5,0,s/5,2,(s+1)/5,2);idx.push(i,i+1,i+2,i+1,i+3,i+2);}
  const g=geo(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();kit.add(g,wall,root);
 }
 for(const s of(circuit?[]:[-20,320])){const w=shoreWidth(s),p=at(s,(w-19)/2);box(w+19,p.y+3,.35,wall,root,p.x,(p.y-3)/2,p.z);}
 if(circuit){
  for(let s=Math.ceil(end*.42);s<end*.57;s+=18){
   for(const sign of [-1,1]){const p=at(s,sign*5.8);box(1.15,p.y+3,2.1,wall,root,p.x,(p.y-3)/2,p.z).rotation.y=course.frame(s).angle;}
   const p=at(s);box(14,.85,2.2,stone,root,p.x,p.y-.8,p.z).rotation.y=course.frame(s).angle;
  }
 }
 const spacing=circuit?6.5:2.5;
 const railGeo=geo(new THREE.LatheGeometry([new THREE.Vector2(.14,0),new THREE.Vector2(.14,.1),new THREE.Vector2(.07,.2),new THREE.Vector2(.12,.5),new THREE.Vector2(.075,.9),new THREE.Vector2(.15,1)],8)),posts=new THREE.InstancedMesh(railGeo,stone,2*(Math.ceil((end-start)/spacing)+1)),dummy=new THREE.Object3D();let i=0;
 for(let s=start;s<=end;s+=spacing)for(const side of[-1,1]){dummy.position.copy(at(s,side*7.2));dummy.updateMatrix();posts.setMatrixAt(i++,dummy.matrix);}
 posts.count=i;posts.castShadow=true;posts.receiveShadow=true;posts.computeBoundingSphere();scene.add(posts);
 for(let s=start;s<end;s+=spacing)for(const side of[-1,1])kit.rod(at(s,side*7.2,1.05).toArray(),at(Math.min(s+spacing,end),side*7.2,1.05).toArray(),.10,stone,root,6);
 const plaster=[0xd8bf91,0xc99e7d,0xe0d0a9].map(c=>mat(c,{bumpMap:artMaps.stone,bumpScale:.018,roughness:.92})),windowMat=mat(0x293c42,{metalness:.2}),leaf=mat(0x345039),treeGeo=geo(new THREE.SphereGeometry(1,10,8)),roofGeo=geo(new THREE.ConeGeometry(1,1,4));roofGeo.rotateY(Math.PI/4);
 const shutters=[mat(0x426967),mat(0x496078),mat(0x64764d)],awning=mat(0xb84937),linen=mat(0xf1ddab);
 for(let n=0;n<28;n++){
  if(n%6===0||n%6===2)continue;
  const s=circuit?(n<14?end*.025+n*13:end*.69+(n-14)*12):12+n*10,side=n%2?-1:1,p=at(s,side*(12.5+1.3*Math.sin(n*2))),g=new THREE.Group();g.position.copy(p);g.rotation.y=course.frame(s).angle+side*Math.PI/2;root.add(g);const h=5+n%3;
  box(4,h,3,plaster[n%3],g,0,h/2,0);const roof=kit.add(roofGeo,roofMat,g,0,h+.6,0);roof.scale.set(3.1,1.3,2.5);box(4.2,.18,3.2,stone,g,0,h,0);
  for(const y of[1.5,3.5])for(const x of[-1,1]){box(.8,1,.05,stone,g,x,y,1.52);box(.6,.8,.06,windowMat,g,x,y,1.56);box(.8,.08,.3,stone,g,x,y-.55,1.63);}
  box(.8,1.8,.06,dark,g,0,.9,1.55);
  for(const x of [-1,1])for(const sign of [-1,1])box(.24,.88,.09,shutters[n%3],g,x+sign*.49,3.5,1.59);
  if(n%3){
   for(let stripe=0;stripe<9;stripe++){
    const shade=box(.32,.09,1.04,stripe%2?linen:awning,g,(stripe-4)*.32,2.6,1.97);
    shade.rotation.x=.17;box(.32,.19,.06,stripe%2?linen:awning,g,(stripe-4)*.32,2.44,2.46);
   }
  }else{
   box(3.6,.17,.86,stone,g,0,2.96,1.87);
   box(3.45,.08,.08,dark,g,0,3.63,2.25);
   for(let bar=-4;bar<=4;bar++)box(.045,.64,.045,dark,g,bar*.40,3.31,2.25);
  }
  box(.48,1.35,.52,plaster[n%3],g,1.08,h+.86,-.4);box(.64,.12,.68,roofMat,g,1.08,h+1.53,-.4);
 }
 for(let s=4;s<(circuit?end:310);s+=circuit?17:9)for(const side of[-1,1]){if(bridgeAt(s)||(side===1&&s%45<27))continue;const p=at(s,side*(9.4+Math.sin(s)*.6));box(.17,3,.17,wood,root,p.x,p.y+1.5,p.z);for(let tier=0;tier<3;tier++){
   const crown=kit.add(treeGeo,leaf,root,p.x+.11*Math.sin(s+tier),p.y+1.72+tier*1.12,p.z+.07*Math.cos(tier+s));
   crown.scale.set(.76-tier*.18,1.36-tier*.13,.68-tier*.14);
  }}
 // Low flower beds frame intermittent views over the water; the seaward cliffs
 // overlap the retaining wall and taper down beneath the waterline.
 const crag=geo(new THREE.IcosahedronGeometry(1,1)),lichen=mat(0xa99679,{map:artMaps.stone,roughness:1});
 const blooms=[0xba3656,0xb55782,0xebad52].map(color=>mat(color));
 for(let j=0;j<33;j++){
  const s=circuit?end*(j+.4)/33:j*10-10;if(bridgeAt(s))continue;const side=j%5===0?-1:1,p=at(s,side*((side===1?shoreWidth(s):19)+2*Math.sin(j)));
  const o=kit.add(crag,lichen,root,p.x,-1.5,p.z);
  o.scale.set(5+2*Math.sin(j*.6),4+.6*Math.sin(j),7);o.rotation.y=j*.71;
  if(j%3===0)continue;
  const bed=at(s,side*8.6);
  box(1.2,.38,3.3,stone,root,bed.x,bed.y+.18,bed.z);
  const foliage=kit.add(treeGeo,leaf,root,bed.x,bed.y+.47,bed.z);foliage.scale.set(.62,.38,1.65);
  for(let k=0;k<9;k++){const bloom=kit.add(crag,blooms[(j+k)%3],root,bed.x+.36*Math.sin(k*4),bed.y+.7+.09*Math.cos(k),bed.z+(k-4)*.30);bloom.scale.set(.16,.14,.19);}
 }
 // Lateen sails sit in the coves below the raceway.
 const sailShape=new THREE.Shape();sailShape.moveTo(0,.3);sailShape.lineTo(0,3.4);sailShape.lineTo(2,.3);sailShape.closePath();
 const sailGeo=geo(new THREE.ShapeGeometry(sailShape)),canvasMat=mat(0xffedc5,{side:THREE.DoubleSide});
 for(const distance of [37,118,202,262]){
  const shore=at(circuit?distance*end/300:distance,32+4*Math.sin(distance)),boat=new THREE.Group();root.add(boat);
  boat.position.set(shore.x,-1.88,shore.z);boat.rotation.y=distance*.63;
  kit.add(treeGeo,wood,boat,0,0,0).scale.set(2.2,.35,.65);
  box(.09,3.7,.09,wood,boat,0,1.81,0);kit.add(sailGeo,canvasMat,boat,0,.14,0);
 }
 if(circuit){
  for(const fraction of [.31,.81]){
   const s=end*fraction,sign=course.cape?-1:1,landmark=at(s,sign*28),g=new THREE.Group();
   g.position.set(landmark.x,-2.2,landmark.z);g.rotation.y=course.frame(s).angle;root.add(g);
   if(course.cape){
    const reef=kit.add(crag,lichen,g);reef.scale.set(9,4.5,8);
    for(let level=0;level<4;level++){
     const radius=2.3-level*.23;
     const tower=geo(new THREE.CylinderGeometry(radius-.23,radius,3.15,12));
     kit.add(tower,level%2?awning:linen,g,0,5.15+3.15*level,0);
    }
    kit.add(geo(new THREE.CylinderGeometry(2.0,2.0,.4,12)),dark,g,0,16.2,0);
    kit.add(geo(new THREE.CylinderGeometry(1.14,1.14,1.9,10)),gold,g,0,17.25,0);
    for(const x of [-.95,.95])for(const z of [-.7,.7])box(.12,2,.12,dark,g,x,17.25,z);
    kit.add(geo(new THREE.ConeGeometry(1.95,1.3,12)),roofMat,g,0,18.7,0);
   }else{
    box(3.6,.5,15,wood,g,0,1.6,0);
    for(const z of [-6,-2,2,6])for(const x of [-1.55,1.55])box(.3,3.4,.3,wood,g,x,1,z);
    for(const z of [-4,3]){
     kit.add(treeGeo,roofMat,g,3.6,.45,z).scale.set(.95,.48,2.8);
     box(.10,4.1,.10,wood,g,3.6,2.55,z);const sail=kit.add(sailGeo,canvasMat,g,3.6,.8,z);sail.rotation.y=Math.PI/2;
    }
   }
  }
 }
 // The finish is visible above the racers as well as painted on the road.
 const finish=at(circuit?0:299),flagGeo=geo(new THREE.PlaneGeometry(13,1,26,2)),flagPos=flagGeo.getAttribute('position');
 const flagMap=texture(256,32,(ctx,w,h)=>{for(let x=0;x<16;x++)for(let y=0;y<2;y++){ctx.fillStyle=(x+y)%2?'#293b40':'#ffefd1';ctx.fillRect(x*w/16,y*h/2,w/16,h/2);}});
 const flagMat=mat(0xffffff,{map:flagMap,side:THREE.DoubleSide});
 for(let i=0;i<flagPos.count;i++){const x=flagPos.getX(i);flagPos.setY(i,flagPos.getY(i)-.5*(1-(x/6.5)**2));flagPos.setZ(i,.12*Math.sin(x*1.5));}
 flagGeo.computeVertexNormals();kit.add(flagGeo,flagMat,root,finish.x,finish.y+5.4,finish.z);
 for(const sign of [-1,1])box(.18,6,.18,wood,root,finish.x+sign*6.5,finish.y+3,finish.z);
 // Transverse start/finish markings sit above asphalt rather than intersecting it.
 for(const s of(circuit?[0]:[1,299]))for(let x=-5.5;x<6;x++)for(let z=0;z<2;z++){const p=at(s+z*.5,x);box(1,.025,.5,(Math.round(x+.5)+z)%2?stone:dark,root,p.x,p.y+.05,p.z);}
 kit.mergeStatic(root);await yieldTask();
 // The reused city rotates internally by PI. Cancel that rotation before translating it.
 const backdrop=new THREE.Group();backdrop.rotation.y=Math.PI;backdrop.position.z=circuit?45:-210;if(circuit)backdrop.scale.setScalar(.59);scene.add(backdrop);
 const seeded=n=>()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};
 const coast=await createProductionCoast(THREE,{scene:backdrop,P:{seeded,WALL:8,trackPoint:()=>({x:640,y:640}),locate:()=>({lat:0})},track:{len:0},scale:1,at:()=>new THREE.Vector3(),models:kit,artMaps,materials,texture,yieldTask});
 // Explicit QA only: do not put the full transformed-triangle audit on the phone's startup path.
 function inspectGeometry(){
  scene.updateMatrixWorld(true);let backdropCorridorIntrusions=0,backdropTrianglesChecked=0;const v=new THREE.Vector3();
  const corridors=[];
  if(circuit){
   for(let s=0;s<end;s+=4){
    const box=new THREE.Box3();for(const d of [s,s+2,s+4])for(const side of [-7,7])box.expandByPoint(at(d,side));
    box.min.y-=.25;box.max.y+=4;corridors.push(box);
   }
  }else corridors.push(new THREE.Box3(new THREE.Vector3(-27,2.5,-265),new THREE.Vector3(27,10,75)));
  const bounds=new THREE.Box3(),triangle=new THREE.Box3();
  backdrop.traverse(obj=>{
   if(!obj.isMesh||obj.isInstancedMesh)return;
   const geo=obj.geometry,positions=geo.getAttribute('position'),indices=geo.index,count=indices?.count||positions.count;
   backdropTrianglesChecked+=count/3;
   geo.computeBoundingBox();bounds.copy(geo.boundingBox).applyMatrix4(obj.matrixWorld);
   const nearby=corridors.filter(box=>bounds.intersectsBox(box));if(!nearby.length)return;
   for(let i=0;i<count;i+=3){
    triangle.makeEmpty();for(let j=0;j<3;j++)triangle.expandByPoint(v.fromBufferAttribute(positions,indices?indices.getX(i+j):i+j).applyMatrix4(obj.matrixWorld));
    if(nearby.some(box=>triangle.intersectsBox(box)))backdropCorridorIntrusions++;
   }
  });
  return{backdropTrianglesChecked,backdropCorridorIntrusions,corridorSections:corridors.length};
 }
 const waterMat=new THREE.MeshPhysicalMaterial();materials.add(waterMat);lighting.tuneWater(waterMat);const water=kit.add(geo(new THREE.PlaneGeometry(circuit?1400:700,circuit?1400:700)),waterMat,scene,0,-2,-100);water.rotation.x=-Math.PI/2;water.castShadow=false;
 const pickupMat=mat(0xd6bd7d,{metalness:.65,roughness:.26,emissive:0x876423,emissiveIntensity:.3}),pickupGeo=geo(new THREE.OctahedronGeometry(.48));
 const colors={turbo:0xe9ae39,shield:0x3ec9ed,magnet:0xb379ef,wave:0xf07361};
 const itemMats=circuit?Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,mat(color,{metalness:.3,roughness:.26,emissive:color,emissiveIntensity:.35})])):{};
 const pickups=course.boxes.flatMap((s,row)=>(circuit?course.lanes(row):[-3.5,0,3.5]).map(lat=>{const object=kit.add(pickupGeo,pickupMat,scene);object.position.copy(at(s,lat,1));return{object,s,row};}));
 return{inspectGeometry,update(time,taken,lap=1){coast.update(time);for(const q of pickups){q.object.visible=!taken.has((lap-1)*course.boxes.length+q.row);q.object.rotation.y=time*1.7;if(circuit)q.object.material=itemMats[course.pickupType(q.row,lap-1)];}}, geometry:{roadStart:start,roadEnd:end,halfWidth:6,supportHalfWidth:19,supportBottom:-3,waterY:-2,backdropOffsetZ:backdrop.position.z,backdropRotationY:Math.PI}};
}
