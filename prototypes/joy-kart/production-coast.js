/** Reference-led coast assets: physical bridges, cliffs, terraced town, castle and waterfalls. */
async function createProductionCoast(THREE, context) {
 const {scene,P,track,scale:S,at,models,artMaps,materials,texture}=context;
 const yieldTask=context.yieldTask||(()=>Promise.resolve()),archCache=new Map();
 const {geometry:geo,material:mat,add,rod,tube,mergeStatic}=models;
 const TAU=Math.PI*2,rand=P.seeded(60421),root=new THREE.Group();scene.add(root);
 const plasterGrain=texture(128,128,(c,w,h)=>{const noise=P.seeded(9124);c.fillStyle='#929292';c.fillRect(0,0,w,h);for(let i=0;i<4000;i++){const v=112+Math.floor(noise()*56);c.fillStyle='rgb('+v+','+v+','+v+')';c.fillRect(Math.floor(noise()*w),Math.floor(noise()*h),1,1);}});plasterGrain.colorSpace=THREE.NoColorSpace;plasterGrain.wrapS=plasterGrain.wrapT=THREE.RepeatWrapping;plasterGrain.repeat.set(3,4);
 const stone=mat(0xe0cfad,{map:artMaps.stone,bumpMap:artMaps.stone,bumpScale:.16,roughness:.89}),rock=mat(0xb8b39d,{vertexColors:true,map:artMaps.stone,bumpMap:artMaps.stone,bumpScale:.21,roughness:1}),terracotta=mat(0x9d4e31,{roughness:.88}),slate=mat(0x405c65,{metalness:.1,roughness:.6}),plasters=[0xd6bb87,0xc5a887,0xe0cd9f,0xd69a77].map(c=>mat(c,{bumpMap:plasterGrain,bumpScale:.018,roughness:.92})),trim=mat(0xe6d7b6),dark=mat(0x26352f),iron=mat(0x394344,{metalness:.78,roughness:.34}),brass=mat(0xba8940,{metalness:.78,roughness:.25}),window=mat(0x394c53,{metalness:.15,roughness:.28,emissive:0x6e3510,emissiveIntensity:.15}),green=mat(0x284833,{roughness:1}),red=mat(0xa63323),magenta=mat(0xa64672),pink=mat(0xdb89a2),goldFlower=mat(0xe7bb76);
 const cube=geo(new THREE.BoxGeometry(1,1,1)),sphere=geo(new THREE.IcosahedronGeometry(1,1));
 const box=(w,h,d,m,p,x=0,y=0,z=0)=>{const o=add(cube,m,p,x,y,z);o.scale.set(w,h,d);return o;};
 const ball=(m,p,x,y,z,rx,ry=rx,rz=rx)=>{const o=add(sphere,m,p,x,y,z);o.scale.set(rx,ry,rz);return o;};
 function archGeometry(width,height,depth){
  const key=[width,height,depth].join(':');if(archCache.has(key))return archCache.get(key);const outer=width/2,r=width*.37,center=height-r-.55,s=new THREE.Shape();s.moveTo(-outer,0);s.lineTo(-outer,height);s.lineTo(outer,height);s.lineTo(outer,0);s.lineTo(r,0);s.lineTo(r,center);s.absarc(0,center,r,0,Math.PI,false);s.lineTo(-r,0);s.closePath();const result=geo(new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.055,bevelThickness:.055,bevelSegments:1,curveSegments:16}));archCache.set(key,result);return result;
 }
 function bridge(x,z,angle,count,width,deckHeight){
  const g=new THREE.Group();g.position.set(x,-2.0,z);g.rotation.y=angle;root.add(g);const geometry=archGeometry(width,deckHeight,2.5);
  for(let i=0;i<count;i++){add(geometry,stone,g,(i-(count-1)/2)*width,0,-1.25);for(const side of[-1,1]){box(width,.30,.38,trim,g,(i-(count-1)/2)*width,deckHeight+.17,side*1.24);for(let j=0;j<3;j++)box(.16,.7,.20,stone,g,(i-(count-1)/2)*width+(j-1)*width*.28,deckHeight+.60,side*1.24);box(width,.18,.42,trim,g,(i-(count-1)/2)*width,deckHeight+1.02,side*1.24);}}
  box(count*width,.4,2.9,stone,g,0,deckHeight-.05,0);return g;
 }
 const cliffGeo=geo(new THREE.SphereGeometry(1,24,18)),positions=cliffGeo.getAttribute('position');
 const cliffColors=[],wetStone=new THREE.Color(0x536575),dryStone=new THREE.Color(0xd3c6ad),rimStone=new THREE.Color(0xf3dfbd),tone=new THREE.Color();
 for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),noise=1+Math.sin(x*15+z*12)*.065+Math.sin(y*24+x*8)*.045;positions.setXYZ(i,x*noise,y,z*noise);tone.copy(wetStone).lerp(dryStone,THREE.MathUtils.smoothstep(y,-.8,.25)).lerp(rimStone,THREE.MathUtils.smoothstep(y,.3,.9)*.55).multiplyScalar(.95+Math.sin(y*23+x*3)*.045);cliffColors.push(tone.r,tone.g,tone.b);}cliffGeo.setAttribute('color',new THREE.Float32BufferAttribute(cliffColors,3));cliffGeo.computeVertexNormals();
 const islands=[{x:0,z:-164,w:53,h:41,d:40},{x:-139,z:-90,w:29,h:23,d:30},{x:140,z:-75,w:25,h:25,d:29},{x:174,z:51,w:21,h:17,d:24},{x:-171,z:59,w:26,h:17,d:27}];
 for(const p of islands){const island=add(cliffGeo,rock,root,p.x,p.h*.34-3,p.z);island.scale.set(p.w,p.h*.63,p.d);for(let i=0;i<8;i++){const a=i/8*TAU,r=.71+rand()*.1;const outcrop=add(cliffGeo,rock,root,p.x+Math.cos(a)*p.w*r,-2+rand()*p.h*.28,p.z+Math.sin(a)*p.d*r);outcrop.scale.set(p.w*.27,p.h*.48,p.d*.24);}}
 // Bearings and approach ramps use the actual island coordinates.
 function linkIslands(a,b,deckHeight){
  const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
  const inset=p=>.48/Math.hypot(ux/p.w,uz/p.d);
  const left=inset(a),right=inset(b),span=length-left-right,count=Math.round(span/8);
  const angle=Math.atan2(-uz,ux),mid=(left+length-right)/2;
  bridge(a.x+ux*mid,a.z+uz*mid,angle,count,span/count,deckHeight);
  for(const [p,offset,sign] of [[a,left,1],[b,right,-1]]){
   const crown=p.h*.97-3,deck=deckHeight-2+.15;
   const g=new THREE.Group();root.add(g);g.position.set(p.x,0,p.z);g.rotation.y=angle;
   const shape=new THREE.Shape();shape.moveTo(0,-3);shape.lineTo(sign*(offset+.35),-3);
   shape.lineTo(sign*(offset+.35),deck);shape.lineTo(0,crown+.15);shape.closePath();
   add(geo(new THREE.ExtrudeGeometry(shape,{depth:3.15,bevelEnabled:false})),stone,g,0,0,-1.575);
  }
 }
 linkIslands(islands[1],islands[0],21);linkIslands(islands[0],islands[2],22);
 linkIslands(islands[4],islands[1],16);linkIslands(islands[2],islands[3],16);
 const roofGeo=geo(new THREE.ConeGeometry(1,1,4));roofGeo.rotateY(Math.PI/4);
 let houses=0;
 function house(x,y,z,w,h,d,angle=0){
  const group=new THREE.Group();group.position.set(x,y,z);group.rotation.y=angle;root.add(group);box(w,h,d,plasters[houses%plasters.length],group,0,h/2,0);box(w+.15,.24,d+.15,stone,group,0,.1,0);
  const roof=add(roofGeo,terracotta,group,0,h+.52,0);roof.scale.set(w*.76,1.15,d*.76);box(w+.25,.12,d+.25,trim,group,0,h,0);
  for(let floor=0;floor<Math.max(1,Math.floor(h/1.5));floor++)for(const side of[-1,1]){
   const xx=side*w*.25,yy=.85+floor*1.38;box(.48,.67,.035,trim,group,xx,yy,d/2+.025);box(.35,.54,.04,window,group,xx,yy,d/2+.05);box(.025,.54,.03,trim,group,xx,yy,d/2+.09);box(.35,.025,.03,trim,group,xx,yy,d/2+.09);box(.085,.63,.05,dark,group,xx-.29,yy,d/2+.06);box(.085,.63,.05,dark,group,xx+.29,yy,d/2+.06);
   if(floor===1){box(.62,.08,.34,stone,group,xx,yy-.39,d/2+.13);for(let k=0;k<4;k++)rod([xx-.27+k*.18,yy-.34,d/2+.26],[xx-.27+k*.18,yy-.04,d/2+.26],.012,iron,group,5);rod([xx-.3,yy-.02,d/2+.26],[xx+.3,yy-.02,d/2+.26],.015,iron,group,5);}
  }
  box(.42,.94,.045,dark,group,0,.49,d/2+.03);box(.35,.7,.42,plasters[houses%4],group,w*.25,h+.40,-d*.2);box(.43,.1,.50,stone,group,w*.25,h+.82,-d*.2);houses++;
 }
 // Terraces leave the central summit for the castle and keep the town beyond the drivable island.
 for(let ring=0;ring<4;ring++){const count=ring===0?9:15;for(let i=0;i<count;i++){const a=i/count*TAU+ring*.35,rx=14+ring*9,rz=9+ring*7;house(Math.cos(a)*rx,31-ring*4.1,-164+Math.sin(a)*rz,2.7+rand()*1.6,3.4+rand()*2.4,2.5+rand()*1.0,-a+Math.PI/2);}}
 for(const p of islands.slice(1))for(let i=0;i<11;i++){const a=i/11*TAU;house(p.x+Math.cos(a)*p.w*.52,p.h*.72-3+rand()*1.5,p.z+Math.sin(a)*p.d*.50,2.4+rand(),3+rand()*2.6,2.4+rand(),-a+Math.PI/2);}
 // Castle silhouette, crenellations, lancet windows and slate spires.
 const castle=new THREE.Group();castle.position.set(0,36,-169);root.add(castle);box(14,9,10,stone,castle,0,4.5,0);box(8,17,7,stone,castle,0,8.5,-1);
 function tower(x,z,height,radius){const g=new THREE.Group();g.position.set(x,0,z);castle.add(g);add(geo(new THREE.CylinderGeometry(radius,radius*1.10,height,16)),stone,g,0,height/2,0);add(geo(new THREE.ConeGeometry(radius*1.22,radius*2.7,16)),slate,g,0,height+radius*1.35,0);for(let i=0;i<8;i++){const a=i/8*TAU;box(.4,.7,.5,stone,g,Math.cos(a)*radius,height-.1,Math.sin(a)*radius);}for(let floor=0;floor<3;floor++)box(.35,.96,.05,dark,g,0,height*(.30+floor*.22),radius+.02);rod([0,height+radius*2.7,0],[0,height+radius*2.7+1.8,0],.025,iron,g);const flag=box(1.2,.68,.025,red,g,.6,height+radius*2.7+1.4,0);}
 tower(-7,-4,16,1.5);tower(7,-4,19,1.6);tower(-7,4,12,1.4);tower(7,4,14,1.4);tower(0,-1,25,1.8);
 for(let i=0;i<12;i++){box(.5,.72,.5,stone,castle,-6.6+i*1.2,9.2,5.0);box(.5,.72,.5,stone,castle,-6.6+i*1.2,9.2,-5.0);}for(const side of[-1,1])for(let i=0;i<5;i++)box(.55,1.4,.06,dark,castle,(i-2)*2.3,5.4,side*5.02);
 // Tall cypresses and bougainvillea replace a sparse coastal postcard with a layered settlement.
 const cypressGeo=geo(new THREE.SphereGeometry(1,12,10));
 for(let i=0;i<145;i++){const p=islands[i%islands.length],a=rand()*TAU,r=.3+rand()*.47,x=p.x+Math.cos(a)*p.w*r,z=p.z+Math.sin(a)*p.d*r,h=3+rand()*4;const g=new THREE.Group();g.position.set(x,p.h*.75-4,z);root.add(g);rod([0,0,0],[0,h*.85,0],.075,dark,g,6);for(let j=0;j<3;j++){const o=add(cypressGeo,green,g,Math.sin(j*3+i)*.10,h*(.34+j*.21),0);o.scale.set(.45-j*.065,h*(.30-j*.035),.42-j*.07);}}
 const city=new THREE.Group();while(root.children.length)city.add(root.children[0]);city.rotation.y=Math.PI;root.add(city);mergeStatic(city);city.traverse(o=>{if(o.isMesh)o.castShadow=false;});scene.attach(city);
 // Distant architecture cannot contribute to the local 38 m shadow map; keep it out of that pass.
 const tileMap=texture(256,256,(c,w,h)=>{c.fillStyle='#aa583b';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=32)for(let x=0;x<w;x+=32){const grad=c.createLinearGradient(x,0,x+32,0);grad.addColorStop(0,'#733f30');grad.addColorStop(.4,'#cb8257');grad.addColorStop(1,'#945036');c.fillStyle=grad;c.fillRect(x,y+1,31,30);c.strokeStyle='#603d30';c.lineWidth=2;c.beginPath();c.moveTo(x,y+30);c.quadraticCurveTo(x+16,y+22,x+31,y+30);c.stroke();}});tileMap.wrapS=tileMap.wrapT=THREE.RepeatWrapping;tileMap.repeat.set(4,3);const closeRoof=mat(0xe0ab87,{map:tileMap,bumpMap:tileMap,bumpScale:.045,roughness:.92});
 const closeStone=mat(0xe9ddc2,{map:artMaps.stone,bumpMap:artMaps.stone,bumpScale:.055,roughness:.9});
 const railGeometry=new THREE.LatheGeometry([new THREE.Vector2(.13,0),new THREE.Vector2(.13,.09),new THREE.Vector2(.08,.20),new THREE.Vector2(.13,.43),new THREE.Vector2(.058,.68),new THREE.Vector2(.075,.82),new THREE.Vector2(.12,.91)],8);geo(railGeometry);
 const railPositions=[];
 for(let s=0;s<track.len;s+=8)for(const side of[-1,1])railPositions.push(at(s,side*(P.WALL-3),.22));
 const balusters=new THREE.InstancedMesh(railGeometry,closeStone,railPositions.length),dummy=new THREE.Object3D();railPositions.forEach((p,i)=>{dummy.position.copy(p);dummy.updateMatrix();balusters.setMatrixAt(i,dummy.matrix);});balusters.castShadow=true;balusters.receiveShadow=true;balusters.instanceMatrix.needsUpdate=true;balusters.computeBoundingSphere();scene.add(balusters);
 const wallVertices=[],wallUv=[],wallIndices=[];
 for(let s=0;s<track.len;s+=20)for(const side of[-1,1]){
  const p=at(s,side*(P.WALL-3),0),q=at(Math.min(s+20,track.len),side*(P.WALL-3),0),dx=q.x-p.x,dz=q.z-p.z,len=Math.hypot(dx,dz),a=Math.atan2(dx,dz);
  for(const [height,thickness,width]of[[.15,.30,.52],[1.20,.16,.47]]){const o=box(width,thickness,len+.04,closeStone,root,(p.x+q.x)/2,(p.y+q.y)/2+height,(p.z+q.z)/2);o.rotation.y=a;}
  const pCenter=P.trackPoint(track,s),pOutside=P.trackPoint(track,s,side*(P.WALL+6));if(Math.hypot(pOutside.x-640,pOutside.y-640)>Math.hypot(pCenter.x-640,pCenter.y-640)){
   const j=wallVertices.length/3;wallVertices.push(p.x,p.y+.08,p.z,q.x,q.y+.08,q.z,p.x,-3.6,p.z,q.x,-3.6,q.z);wallUv.push(s*S/3,0,(s+20)*S/3,0,s*S/3,2.4,(s+20)*S/3,2.4);wallIndices.push(j,j+1,j+2,j+1,j+3,j+2);
  }
 }
 const walls=geo(new THREE.BufferGeometry());walls.setAttribute('position',new THREE.Float32BufferAttribute(wallVertices,3));walls.setAttribute('uv',new THREE.Float32BufferAttribute(wallUv,2));walls.setIndex(wallIndices);walls.computeVertexNormals();add(walls,mat(0xc9b897,{map:artMaps.stone,bumpMap:artMaps.stone,bumpScale:.10,side:THREE.DoubleSide}),root);
 let closeHouses=0;
 function closeHouse(s,side){
  const p=P.trackPoint(track,s,side*(P.WALL+22)),loc=P.locate(track,p.x,p.y);if(Math.abs(loc.lat)<P.WALL+15)return;const center=at(s),position=at(s,side*(P.WALL+22),-.08),g=new THREE.Group();g.position.copy(position);g.rotation.y=Math.atan2(center.x-position.x,center.z-position.z);root.add(g);
  const w=4.4,h=6.5+rand()*1.2,d=3.4;add(models.rounded(w,h,d,.05),plasters[closeHouses%4],g,0,h/2,0);box(w+.2,.34,d+.2,closeStone,g,0,.16,0);box(w+.24,.16,d+.24,trim,g,0,2.7,0);box(w+.24,.16,d+.24,trim,g,0,h-.1,0);
  const roofPositions=[-w*.56,0,-d*.59,-w*.56,0,d*.59,0,1.3,-d*.59,0,1.3,-d*.59,-w*.56,0,d*.59,0,1.3,d*.59,0,1.3,-d*.59,0,1.3,d*.59,w*.56,0,-d*.59,w*.56,0,-d*.59,0,1.3,d*.59,w*.56,0,d*.59];
  const roof=geo(new THREE.BufferGeometry());roof.setAttribute('position',new THREE.Float32BufferAttribute(roofPositions,3));roof.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,1,1,0,1,1,0,1,1,1,0,0,0,0,1,1,1,0],2));roof.computeVertexNormals();add(roof,closeRoof,g,0,h,0);box(.4,.9,.5,plasters[closeHouses%4],g,w*.24,h+.55,-.50);box(.53,.12,.63,closeStone,g,w*.24,h+1.05,-.50);
  const arch=archGeometry(1.45,2.45,.14);for(const x of[-1.40,0,1.40]){add(arch,closeStone,g,x,.02,d/2+.06);add(models.rounded(.93,1.91,.07,.30),dark,g,x,.98,d/2+.055);for(let j=0;j<6;j++)box(.012,1.50,.014,iron,g,x-.37+j*.15,1.0,d/2+.105);}
  for(const yy of[3.75,5.55])for(const x of[-1.12,1.12]){
   box(.90,1.2,.07,trim,g,x,yy,d/2+.05);box(.68,.99,.08,window,g,x,yy,d/2+.10);box(.025,.99,.02,trim,g,x,yy,d/2+.155);box(.68,.025,.02,trim,g,x,yy,d/2+.155);
   for(const side of[-1,1]){box(.28,1.15,.06,dark,g,x+side*.61,yy,d/2+.09);for(let k=0;k<7;k++)box(.27,.025,.075,plasters[1],g,x+side*.61,yy-.45+k*.15,d/2+.13);}
   box(1.05,.12,.53,closeStone,g,x,yy-.69,d/2+.25);for(let i=0;i<6;i++)rod([x-.46+i*.185,yy-.65,d/2+.47],[x-.46+i*.185,yy-.22,d/2+.47],.014,iron,g,5);rod([x-.52,yy-.20,d/2+.47],[x+.52,yy-.20,d/2+.47],.019,iron,g,5);
  }
  const canopy=new THREE.Group();canopy.position.set(0,2.8,d/2+.18);g.add(canopy);for(let stripe=0;stripe<10;stripe++){const x=-w*.47+stripe*w*.094,positions=[];for(let j=0;j<8;j++){const z=j/7*1.15,y=-Math.sin(j/7*Math.PI/2)*.38;positions.push(x,y,z,x+w*.094,y,z);}const indices=[];for(let j=0;j<7;j++){const k=j*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}const sg=geo(new THREE.BufferGeometry());sg.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));sg.setIndex(indices);sg.computeVertexNormals();add(sg,stripe%2?trim:red,canopy);}
  tube([[-w*.48,.3,d/2+.1],[-w*.53,2,d/2+.1],[-w*.47,4.2,d/2+.13],[-w*.2,5.3,d/2+.2]],.06,green,g,20,6);for(let i=0;i<72;i++){const y=.6+rand()*5.5,x=-w*.49+Math.sin(y)*.15+(rand()-.5)*.60,z=d/2+.16+rand()*.22;ball(green,g,x,y,z,.16,.11,.13);if(i%2===0){ball(i%3?magenta:pink,g,x+.06,y+.06,z+.12,.10,.075,.06);}}
  closeHouses++;houses++;
 }
 for(const fraction of[.97,.045,.16,.30,.47,.65,.77,.92]){const s=fraction*track.len,plus=P.trackPoint(track,s,150),minus=P.trackPoint(track,s,-150),side=Math.hypot(plus.x-640,plus.y-640)<Math.hypot(minus.x-640,minus.y-640)?1:-1;for(const offset of[-38,0,38])closeHouse(s+offset,side);await yieldTask();}
 const lanternGlow=mat(0xffd491,{emissive:0xffad42,emissiveIntensity:1.5,roughness:.3});
 for(let s=0;s<track.len;s+=160)for(const side of[-1,1]){
  const p=at(s,side*(P.WALL+4),0),next=at(s+1,side*(P.WALL+4),0),g=new THREE.Group();g.position.copy(p);g.rotation.y=Math.atan2(next.x-p.x,next.z-p.z);root.add(g);
  box(.38,.15,.38,stone,g,0,.08,0);rod([0,.1,0],[0,3.5,0],.047,iron,g);tube([[0,3.35,0],[0,3.68,0],[side*.36,3.82,0],[side*.52,3.58,0]],.035,iron,g,14,6);box(.32,.42,.32,lanternGlow,g,side*.52,3.37,0);for(const xx of[-.15,.15])for(const zz of[-.15,.15])rod([side*.52+xx,3.12,zz],[side*.52+xx,3.60,zz],.017,iron,g,5);const cap=add(roofGeo,iron,g,side*.52,3.65,0);cap.scale.set(.33,.20,.33);box(.40,.06,.40,brass,g,side*.52,3.12,0);
  if(Math.floor(s/160)%2===0){box(.026,1.0,.55,red,g,0,2.67,.32);rod([0,3.18,0],[0,3.18,.7],.019,brass,g,6);}
  // Planters sit beyond the physical wall; every blossom is actual geometry.
  const planter=at(s+28,side*(P.WALL+9),-.02);box(1.1,.42,.63,stone,root,planter.x,planter.y+.2,planter.z);for(let i=0;i<18;i++){const x=planter.x+(rand()-.5)*1.3,z=planter.z+(rand()-.5)*.75,y=planter.y+.45+rand()*.45;ball(green,root,x,y-.12,z,.25,.19,.22);ball(i%3===0?goldFlower:i%2?magenta:pink,root,x,y,z,.105,.09,.11);}
 }
 // Small sailing boats give scale to the bay.
 for(let i=0;i<14;i++){const a=i/14*TAU,r=103+rand()*84,g=new THREE.Group();g.position.set(Math.cos(a)*r,-1.88,Math.sin(a)*r);g.rotation.y=rand()*TAU;root.add(g);const hull=ball(dark,g,0,0,0,.26,.16,.9);rod([0,.1,0],[0,2.7,0],.018,iron,g,6);const sg=geo(new THREE.BufferGeometry());sg.setAttribute('position',new THREE.Float32BufferAttribute([.03,.30,0,.03,2.55,0,.03,.30,.88,-.03,.3,0,-.03,.3,-.68,-.03,2.1,0],3));sg.computeVertexNormals();const sail=add(sg,trim,g);sail.material=trim;}
 mergeStatic(root);
 const waterfallMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 vUv;uniform float time;void main(){float stripe=sin(vUv.x*150.0+sin(vUv.y*18.0-time*3.0)*2.0)*.5+.5;float spray=sin(vUv.y*65.0+time*13.0+vUv.x*12.0)*.5+.5;float edge=smoothstep(0.0,.16,vUv.x)*smoothstep(0.0,.16,1.0-vUv.x);gl_FragColor=vec4(mix(vec3(.57,.75,.76),vec3(.97,.97,.87),stripe*.65+spray*.22),edge*(.38+stripe*.48));\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});materials.add(waterfallMat);
 for(const [x,z,width,height,rotation]of[[-27,-130,5.8,31,0],[-16,-127,3.4,33,0],[29,-131,4.5,28,0],[-135,-66,3.0,17,.25]]){const g=geo(new THREE.PlaneGeometry(width,height,12,18)),v=g.getAttribute('position');for(let i=0;i<v.count;i++)v.setZ(i,Math.sin(v.getX(i)*3+v.getY(i)*.5)*.12);g.computeVertexNormals();const waterfall=add(g,waterfallMat,scene,-x,height/2-1.9,-z);waterfall.rotation.y=rotation+Math.PI;waterfall.castShadow=false;}
 return{houses,closeHouses,balusters:railPositions.length,bridges:4,waterfalls:4,update(time){waterfallMat.uniforms.time.value=time;}};
}
