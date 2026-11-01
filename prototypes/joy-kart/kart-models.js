/** Hand-built 3D assets. Static parts are merged by material to keep mobile draw calls bounded. */
function createKartModels(THREE, context) {
 const { scene, geometries, materials, texture } = context;
 const geometry = g => { geometries.add(g); return g; };
 const shapeCache=new Map(),geometryCache={hits:0,misses:0};
 const sharedGeometry=(key,create)=>{if(shapeCache.has(key)){geometryCache.hits++;return shapeCache.get(key);}geometryCache.misses++;const g=geometry(create());shapeCache.set(key,g);return g;};
 const material = (color,options={}) => { const m=new THREE.MeshStandardMaterial({color,roughness:.75,...options});materials.add(m);return m; };
 const physical = (color,options={}) => {const m=new THREE.MeshPhysicalMaterial({color,roughness:.28,metalness:.25,clearcoat:.75,clearcoatRoughness:.16,...options});materials.add(m);return m;};
 const unitBox=geometry(new THREE.BoxGeometry(1,1,1));
 const softSphere=geometry(new THREE.SphereGeometry(1,20,14));
 const eyeSphere=geometry(new THREE.SphereGeometry(1,14,10));
 const tinySphere=geometry(new THREE.SphereGeometry(1,10,7));
 const furNoise=texture(128,128,(c,w,h)=>{c.fillStyle='#a8a8a8';c.fillRect(0,0,w,h);let seed=73;for(let i=0;i<2600;i++){seed=(seed*1664525+1013904223)>>>0;const x=(seed&65535)/65536*w;seed=(seed*1664525+1013904223)>>>0;const y=(seed&65535)/65536*h;c.strokeStyle=i%2?'#bdbdbd':'#939393';c.lineWidth=.6;c.beginPath();c.moveTo(x,y);c.lineTo(x+1.4,y+2.8);c.stroke();}});
 furNoise.colorSpace=THREE.NoColorSpace;
 const clothNoise=texture(64,64,(c,w,h)=>{c.fillStyle='#b5b5b5';c.fillRect(0,0,w,h);c.strokeStyle='#999999';c.lineWidth=.5;for(let i=0;i<w;i+=4){c.beginPath();c.moveTo(i,0);c.lineTo(i,h);c.stroke();c.beginPath();c.moveTo(0,i);c.lineTo(w,i);c.stroke();}});clothNoise.colorSpace=THREE.NoColorSpace;
 const cream=material(0xf1e2bf,{bumpMap:furNoise,bumpScale:.008}),fur=material(0xe58a3b,{bumpMap:furNoise,bumpScale:.013}),furShade=material(0xa44e25),pink=material(0xd4a48b),dark=material(0x253238),black=material(0x1d272d),white=material(0xfffae4),amber=material(0xb86b25),gold=material(0xc5a15f,{metalness:.76,roughness:.27}),steel=material(0xa6b6b7,{metalness:.83,roughness:.25}),engineMetal=material(0x4b5759,{metalness:.7,roughness:.5}),rubber=material(0x202b31,{roughness:.96}),tread=material(0x29373b,{roughness:.94}),leather=material(0x333d40,{bumpMap:clothNoise,bumpScale:.008}),stitch=material(0xb9b1a0),glass=physical(0x436d79,{roughness:.12,metalness:.35,transparent:true,opacity:.84});
 const heroPaint=physical(0xd34a32),rivalPaint=physical(0x388675),heroCloth=material(0xb94230,{bumpMap:clothNoise,bumpScale:.009}),rivalCloth=material(0x327867,{bumpMap:clothNoise,bumpScale:.009});
 function add(g,m,parent,x=0,y=0,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=!m.transparent;o.receiveShadow=true;parent.add(o);return o;}
 function cube(w,h,d,m,p,x=0,y=0,z=0){const o=add(unitBox,m,p,x,y,z);o.scale.set(w,h,d);return o;}
 function ball(m,p,x,y,z,rx,ry=rx,rz=rx,detail=softSphere){const o=add(detail,m,p,x,y,z);o.scale.set(rx,ry,rz);return o;}
 function tube(points,radius,m,p,segments=12,sides=8){const key='tube:'+JSON.stringify([points,radius,segments,sides]);return add(sharedGeometry(key,()=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v))),segments,radius,sides,false)),m,p);}
 function rod(a,b,r,m,p,sides=10){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av),length=delta.length();const o=add(sharedGeometry('rod:'+JSON.stringify([r,length,sides]),()=>new THREE.CylinderGeometry(r,r,length,sides)),m,p);o.position.copy(av.add(bv).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;}
 function rounded(w,h,d,r=.1){return sharedGeometry('rounded:'+JSON.stringify([w,h,d,r]),()=>{const s=new THREE.Shape();s.moveTo(r,0);s.lineTo(w-r,0);s.quadraticCurveTo(w,0,w,r);s.lineTo(w,h-r);s.quadraticCurveTo(w,h,w-r,h);s.lineTo(r,h);s.quadraticCurveTo(0,h,0,h-r);s.lineTo(0,r);s.quadraticCurveTo(0,0,r,0);const g=new THREE.ExtrudeGeometry(s,{depth:d,steps:1,bevelEnabled:true,bevelSegments:2,bevelSize:.025,bevelThickness:.025,curveSegments:4});g.translate(-w/2,-h/2,-d/2);return g;});}

 function mergeStatic(group) {
  const buckets=new Map();
  group.updateMatrixWorld(true);
  const inverse=group.matrixWorld.clone().invert(),children=[];
  group.traverse(child=>{if(child!==group&&child.isMesh)children.push(child);});
  for(const child of children) {
   if(!child.isMesh||Array.isArray(child.material))continue;
   const transform=inverse.clone().multiply(child.matrixWorld),source=child.geometry.clone();source.applyMatrix4(transform);
   const key=child.material.uuid;let b=buckets.get(key);if(!b){b={material:child.material,parts:[],cast:!child.material.transparent};buckets.set(key,b);}b.parts.push(source);child.removeFromParent();
  }
  for(const b of buckets.values()) {
   const data=batchIndexedGeometry(b.parts.map(g=>({positions:g.getAttribute('position').array,normals:g.getAttribute('normal')?.array,uvs:g.getAttribute('uv')?.array,colors:g.getAttribute('color')?.array,indices:g.index?.array})),b.material.vertexColors);
   for(const part of b.parts)part.dispose();
   const g=geometry(new THREE.BufferGeometry());g.setAttribute('position',new THREE.BufferAttribute(data.positions,3));g.setAttribute('normal',new THREE.BufferAttribute(data.normals,3));g.setAttribute('uv',new THREE.BufferAttribute(data.uvs,2));if(data.colors)g.setAttribute('color',new THREE.BufferAttribute(data.colors,3));g.setIndex(new THREE.BufferAttribute(data.indices,1));g.computeBoundingSphere();add(g,b.material,group);
  }
  return group;
 }

 const tireGeometry=geometry(new THREE.TorusGeometry(.325,.107,10,32));tireGeometry.scale(1,1,1.65);tireGeometry.rotateY(Math.PI/2);
 const rimRing=geometry(new THREE.TorusGeometry(.238,.028,8,24));rimRing.rotateY(Math.PI/2);
 const rimDisc=geometry(new THREE.CylinderGeometry(.226,.226,.05,24));rimDisc.rotateZ(Math.PI/2);
 const hubGeometry=geometry(new THREE.CylinderGeometry(.075,.075,.06,12));hubGeometry.rotateZ(Math.PI/2);
 const boltGeometry=geometry(new THREE.CylinderGeometry(.018,.018,.055,6));boltGeometry.rotateZ(Math.PI/2);
 const springGeometry=geometry(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({length:33},(_,i)=>new THREE.Vector3(Math.cos(i/32*Math.PI*8)*.06,i/32*.34,Math.sin(i/32*Math.PI*8)*.06))),48,.013,5,false));
 const bodyGeometry=rounded(1.52,.36,2.14,.18),podGeometry=rounded(.32,.38,1.10,.11),seatGeometry=rounded(.82,.67,.20,.13),spoilerGeometry=rounded(1.66,.10,.34,.04);
 const flameMaterial=new THREE.MeshBasicMaterial({color:0xffc463,transparent:true,opacity:.83,depthWrite:false,blending:THREE.AdditiveBlending});materials.add(flameMaterial);
 const flameCore=new THREE.MeshBasicMaterial({color:0xffefb7,transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending});materials.add(flameCore);
 const shadowTexture=texture(64,64,(c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,2,w/2,h/2,w/2);g.addColorStop(0,'rgba(0,0,0,.65)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,w,h);});
 const shadowMaterial=new THREE.MeshBasicMaterial({color:0x000000,map:shadowTexture,transparent:true,depthWrite:false,opacity:.8});materials.add(shadowMaterial);

 function makeWheel(parent,x,z) {
  const pivot=new THREE.Group();pivot.position.set(x,.45,z);parent.add(pivot);const spin=new THREE.Group();pivot.add(spin);
  add(tireGeometry,rubber,spin);
  for(let i=0;i<28;i++){const a=i/28*Math.PI*2;const bar=cube(.31,.035,.074,tread,spin,0,Math.cos(a)*.428,Math.sin(a)*.428);bar.rotation.x=a;bar.rotation.z=.12;}
  const side=Math.sign(x);add(rimDisc,engineMetal,spin,side*.197,0,0);add(rimRing,gold,spin,side*.225,0,0);add(hubGeometry,steel,spin,side*.243,0,0);
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;const spoke=cube(.054,.045,.21,gold,spin,side*.231,Math.cos(a)*.123,Math.sin(a)*.123);spoke.rotation.x=a-Math.PI/2;add(boltGeometry,steel,spin,side*.24,Math.cos(a)*.16,Math.sin(a)*.16);}
  mergeStatic(spin);return{pivot,spin,front:z>0};
 }
 function ear(parent,side) {
  const s=new THREE.Shape();s.moveTo(-.20,0);s.quadraticCurveTo(-.18,.38,-.06,.69);s.quadraticCurveTo(.02,.78,.07,.62);s.lineTo(.23,.02);s.quadraticCurveTo(.02,-.05,-.20,0);
  const g=geometry(new THREE.ExtrudeGeometry(s,{depth:.12,bevelEnabled:true,bevelSize:.035,bevelThickness:.04,bevelSegments:2,steps:1,curveSegments:5}));g.scale(1,.73,1);
  const o=add(g,fur,parent,side*.39,.30,-.06);o.rotation.z=-side*.18;
  const inner=add(g,furShade,parent,side*.39,.34,.09);inner.scale.set(.62,.70,.15);inner.rotation.z=-side*.18;
  const center=add(g,pink,parent,side*.39,.35,.115);center.scale.set(.33,.45,.08);center.rotation.z=-side*.18;
 }
 function face(head,panda) {
  const staticHead=new THREE.Group();head.add(staticHead);ball(panda?cream:fur,staticHead,0,0,0,.59,.57,.51);
  if(panda)for(const side of[-1,1])ball(black,staticHead,side*.43,.45,-.03,.21,.23,.15);
  else {ear(staticHead,-1);ear(staticHead,1);}
  if(panda)for(const side of[-1,1]){const patch=ball(black,staticHead,side*.235,.02,.455,.195,.235,.055);patch.rotation.z=-side*.18;}
  for(const side of[-1,1])ball(cream,staticHead,side*.18,-.20,.416,.255,.205,.215);
  ball(black,staticHead,0,-.145,.625,.095,.075,.075);
  tube([[-.14,-.29,.535],[0,-.325,.575],[.14,-.29,.535]],.012,furShade,staticHead,8,5);
  const eyes=new THREE.Group();head.add(eyes);
  for(const side of[-1,1]){
   ball(white,eyes,side*.235,.035,.475,panda?.104:.160,panda?.127:.197,.055,eyeSphere);
   ball(panda?black:amber,eyes,side*.235,.035,.528,panda?.062:.091,panda?.077:.115,.032,eyeSphere);
   ball(black,eyes,side*.235,.034,.554,panda?.041:.048,panda?.055:.076,.019,eyeSphere);
   ball(white,eyes,side*.235-.023,.076,.573,.024,.029,.012,tinySphere);
   if(!panda)tube([[side*.235-.14,.27,.43],[side*.235,.303,.47],[side*.235+.13,.26,.44]],.027,furShade,staticHead,8,6);
  }
  const strap=add(geometry(new THREE.TorusGeometry(.535,.028,6,32)),dark,staticHead,0,.31,-.01);strap.rotation.x=Math.PI/2;strap.scale.y=.92;
  for(const side of[-1,1]){
   const ring=add(geometry(new THREE.TorusGeometry(.185,.027,7,24)),gold,staticHead,side*.22,.345,.44);ring.scale.y=.79;
   ball(glass,staticHead,side*.22,.345,.455,.165,.125,.025,eyeSphere);
  }
  tube([[-.035,.34,.454],[0,.365,.47],[.035,.34,.454]],.025,gold,staticHead,5,6);
  mergeStatic(staticHead);mergeStatic(eyes);return eyes;
 }
 function makeTail(parent,panda) {
  const tail=new THREE.Group();tail.position.set(0,1.02,-.43);parent.add(tail);
  if(panda){ball(cream,tail,0,.08,-.18,.19,.19,.24);mergeStatic(tail);return tail;}
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(.15,.01,-.30),new THREE.Vector3(.37,.13,-.68),new THREE.Vector3(.49,.39,-.89),new THREE.Vector3(.48,.67,-.78)]),frames=curve.computeFrenetFrames(20,false),positions=[],normals=[],uv=[],colors=[],indices=[];
  for(let i=0;i<=20;i++){const u=i/20,p=curve.getPointAt(u),r=.09+Math.sin(Math.PI*u)*.21;for(let j=0;j<=12;j++){const a=j/12*Math.PI*2,n=frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i],Math.sin(a));const v=p.clone().addScaledVector(n,r*(1-u*.7));positions.push(v.x,v.y,v.z);normals.push(n.x,n.y,n.z);uv.push(j/12,u);const c=new THREE.Color(u>.73?0xf3e6c8:0xdf8239);colors.push(c.r,c.g,c.b);if(i<20&&j<12){const k=i*13+j;indices.push(k,k+13,k+1,k+1,k+13,k+14);}}}
  for(let i=0;i<indices.length;i+=3){const a=indices[i];indices[i]=indices[i+2];indices[i+2]=a;}
  const g=geometry(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);add(g,material(0xffffff,{vertexColors:true,bumpMap:furNoise,bumpScale:.01}),tail);return tail;
 }
 function makeDriver(parent,panda,cloth) {
  const driver=new THREE.Group();parent.add(driver);const suit=new THREE.Group();driver.add(suit);
  const torso=add(geometry(new THREE.CapsuleGeometry(.31,.35,6,12)),cloth,suit,0,1.29,-.07);torso.scale.set(1.12,1,.90);
  ball(cream,suit,0,1.30,.212,.24,.28,.03);
  for(const side of[-1,1]){
   tube([[side*.28,1.52,.01],[side*.42,1.36,.29],[side*.29,1.24,.66]],.125,cloth,suit,10,8);
   ball(cream,suit,side*.30,1.25,.595,.124,.09,.11);ball(dark,suit,side*.28,1.24,.69,.125,.13,.13);
   tube([[side*.27,1.54,.07],[side*.41,1.39,.29],[side*.31,1.28,.57]],.014,stitch,suit,8,5);
   ball(black,suit,side*.24,.68,.70,.16,.12,.25);
  }
  const collar=add(geometry(new THREE.TorusGeometry(.24,.045,6,20)),cream,suit,0,1.62,-.02);collar.rotation.x=Math.PI/2;
  const head=new THREE.Group();head.position.set(0,2.02,-.02);driver.add(head);const eyes=face(head,panda);
  const tail=makeTail(driver,panda);
  const scarf=new THREE.Group();scarf.position.set(-.04,1.65,-.18);driver.add(scarf);
  tube([[0,0,0],[-.16,-.03,-.32],[-.20,.04,-.62],[-.34,-.04,-.93]],.054,panda?cream:heroCloth,scarf,12,5);mergeStatic(scarf);
  mergeStatic(suit);return{driver,head,eyes,tail,scarf};
 }

 function makeKart(panda=false) {
  const group=new THREE.Group(),body=new THREE.Group(),parts=new THREE.Group();group.add(body);body.add(parts);scene.add(group);
  const paint=panda?rivalPaint:heroPaint,cloth=panda?rivalCloth:heroCloth;
  add(bodyGeometry,paint,parts,0,.64,-.02);
  cube(1.43,.15,2.62,engineMetal,parts,0,.40,.02);
  const nose=add(rounded(1.27,.34,.91,.15),paint,parts,0,.73,1.0);nose.rotation.x=.10;
  for(const side of[-1,1]){
   add(podGeometry,paint,parts,side*.79,.64,.0);cube(.31,.06,.91,cream,parts,side*.80,.82,.03);
   rod([side*.40,.41,-.86],[side*.97,.44,-.86],.043,steel,parts);rod([side*.40,.46,.82],[side*.97,.44,.92],.04,steel,parts);
   for(const z of[-.84,.92]){const spring=add(springGeometry,gold,parts,side*.66,.47,z);spring.rotation.z=-side*.25;}
   rod([side*.47,.73,-1.05],[side*.47,1.04,-1.22],.035,steel,parts);
   const pipe=add(geometry(new THREE.CylinderGeometry(.105,.105,.43,14)),steel,parts,side*.44,.55,-1.34);pipe.rotation.x=Math.PI/2;
   const opening=add(geometry(new THREE.CircleGeometry(.078,12)),black,parts,side*.44,.55,-1.562);opening.rotation.y=Math.PI;
  }
  add(seatGeometry,leather,parts,0,1.05,-.39);cube(.74,.13,.69,leather,parts,0,.78,-.07);
  for(const side of[-1,1]){const bolster=add(rounded(.14,.48,.62,.06),leather,parts,side*.44,.98,-.12);bolster.rotation.z=-side*.12;tube([[side*.32,.83,.23],[side*.38,1.03,.05],[side*.34,1.28,-.29]],.012,stitch,parts,9,5);}
  cube(.58,.37,.52,engineMetal,parts,0,.66,-1.03);for(let i=0;i<6;i++)cube(.66,.024,.51,steel,parts,0,.51+i*.057,-1.03);
  add(spoilerGeometry,paint,parts,0,1.06,-1.25);cube(1.41,.015,.11,cream,parts,0,1.132,-1.24);
  tube([[-.98,.43,1.12],[-.98,.43,1.46],[0,.43,1.57],[.98,.43,1.46],[.98,.43,1.12]],.065,rubber,parts,18,8);
  tube([[-.85,.43,-1.15],[-.79,.43,-1.44],[.79,.43,-1.44],[.85,.43,-1.15]],.048,steel,parts,12,8);
  cube(.79,.18,.065,black,parts,0,.65,1.494);for(let i=0;i<5;i++)cube(.025,.125,.079,gold,parts,(i-2)*.13,.65,1.51);
  const numberTexture=texture(256,256,(c,w,h)=>{c.clearRect(0,0,w,h);c.fillStyle='#f4e4bd';c.beginPath();c.arc(w/2,h/2,108,0,Math.PI*2);c.fill();c.strokeStyle='#ad8d51';c.lineWidth=4;c.stroke();c.fillStyle='#34434b';c.font='900 168px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(panda?'2':'1',w/2,h/2+8);});
  const decal=material(0xffffff,{map:numberTexture,transparent:true,roughness:.65,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});const badge=add(geometry(new THREE.PlaneGeometry(.64,.64)),decal,parts,0,.934,1.01);badge.rotation.x=-Math.PI/2+.1;
  const steering=new THREE.Group();steering.position.set(0,1.26,.67);steering.rotation.x=-.53;body.add(steering);
  add(geometry(new THREE.TorusGeometry(.265,.035,7,24)),dark,steering);for(let i=0;i<3;i++){const a=i/3*Math.PI*2;rod([0,0,0],[Math.cos(a)*.245,Math.sin(a)*.245,0],.021,steel,steering);}ball(gold,steering,0,0,0,.055,.055,.025);mergeStatic(steering);
  const driver=makeDriver(body,panda,cloth),wheels=[];for(const x of[-.98,.98])for(const z of[-.84,.92])wheels.push(makeWheel(group,x,z));
  const flames=new THREE.Group();body.add(flames);for(const side of[-1,1]){ball(flameMaterial,flames,side*.44,.55,-1.76,.10,.10,.34,eyeSphere);ball(flameCore,flames,side*.44,.55,-1.65,.055,.055,.22,eyeSphere);}flames.visible=false;
  const shadow=add(geometry(new THREE.PlaneGeometry(3.6,4.7)),shadowMaterial,scene);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;
  mergeStatic(parts);
  return {group,body,wheels,shadow,steering,flames,...driver,animate(speed,steer,boost,time){
   driver.head.rotation.y=-steer*.16;driver.head.rotation.z=-steer*.045+Math.sin(time*1.8)*.015;
   driver.eyes.rotation.y=-steer*.045;driver.tail.rotation.y=Math.sin(time*5)*.09*(.25+speed);driver.tail.rotation.x=Math.sin(time*7)*.035*speed;
   driver.scarf.rotation.y=Math.sin(time*(boost?15:8))*.15*speed;driver.scarf.rotation.x=-speed*.14;
   steering.rotation.z=steer*.30;flames.visible=boost;flames.scale.z=1+Math.sin(time*43)*.12;
  }};
 }
 return { makeKart, mergeStatic, geometry, material, add, rounded, rod, tube, geometryCache };
}
