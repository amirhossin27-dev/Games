/** Actual three-dimensional vehicle assets; generated images are used only as surface maps. */
function createProductionKarts(THREE, context) {
 const {scene,kit,artMaps,materials,texture}=context;
 const {geometry:geo,material:mat,add,rounded,rod,tube,mergeStatic}=kit;
 const TAU=Math.PI*2,unit=geo(new THREE.BoxGeometry(1,1,1)),sphere=geo(new THREE.SphereGeometry(1,32,24)),smallSphere=geo(new THREE.SphereGeometry(1,16,12)),tinySphere=geo(new THREE.SphereGeometry(1,8,6));
 const physical=(color,options={})=>{const m=new THREE.MeshPhysicalMaterial({color,metalness:.52,roughness:.24,clearcoat:1,clearcoatRoughness:.16,...options});materials.add(m);return m;};
 const weave=texture(128,128,(c,w,h)=>{c.fillStyle='#999999';c.fillRect(0,0,w,h);c.strokeStyle='#737373';c.lineWidth=.7;for(let i=0;i<w;i+=4){c.beginPath();c.moveTo(i,0);c.lineTo(i,h);c.stroke();c.beginPath();c.moveTo(0,i);c.lineTo(w,i);c.stroke();}});weave.colorSpace=THREE.NoColorSpace;weave.wrapS=weave.wrapT=THREE.RepeatWrapping;weave.repeat.set(4,4);
 const rubberGrain=texture(64,64,(c,w,h)=>{let s=1977;c.fillStyle='#888888';c.fillRect(0,0,w,h);for(let i=0;i<1600;i++){s=(s*1664525+1013904223)>>>0;const x=s%w;s=(s*1664525+1013904223)>>>0;const y=s%h;c.fillStyle=i%3?'#929292':'#777777';c.fillRect(x,y,1,1);}});rubberGrain.colorSpace=THREE.NoColorSpace;rubberGrain.wrapS=rubberGrain.wrapT=THREE.RepeatWrapping;rubberGrain.repeat.set(5,5);
 const paint=physical(0xc31f13,{metalness:.18,roughness:.27,clearcoat:.86,clearcoatRoughness:.20}),greenPaint=physical(0x236856,{metalness:.18,roughness:.27,clearcoat:.86,clearcoatRoughness:.20}),cream=mat(0xffe6bd,{roughness:.95,map:artMaps.furNeutral,bumpMap:artMaps.creamFur,bumpScale:.005}),orange=mat(0xde7929,{roughness:.94,map:artMaps.furNeutral,bumpMap:artMaps.orangeFur,bumpScale:.005});
 const charcoal=mat(0x111719,{roughness:.81}),rubber=mat(0x202326,{roughness:.88,bumpMap:rubberGrain,bumpScale:.002}),blackFur=mat(0x191b1a,{roughness:1,bumpMap:artMaps.creamFur,bumpScale:.014}),chrome=physical(0xc1c7c5,{metalness:.95,roughness:.19,clearcoat:.3}),steel=mat(0x4b5759,{metalness:.88,roughness:.35}),gold=physical(0xc19a4c,{metalness:.9,roughness:.25}),white=mat(0xfff5e0,{roughness:.38}),amber=physical(0xb85412,{metalness:0,roughness:.3}),pupil=physical(0x070a0a,{metalness:0,roughness:.12}),leather=mat(0x252927,{roughness:.75,bumpMap:weave,bumpScale:.003}),cloth=physical(0x9a221a,{metalness:0,roughness:.92,clearcoat:0,sheen:.38,sheenColor:0xd67e64,sheenRoughness:.8,bumpMap:weave,bumpScale:.0035}),greenCloth=physical(0x1e594b,{metalness:0,roughness:.92,clearcoat:0,sheen:.38,sheenColor:0x73a58c,sheenRoughness:.8,bumpMap:weave,bumpScale:.0035}),stitch=mat(0xc7aa7b),earDark=mat(0x57291d),glass=physical(0x527786,{transparent:true,opacity:.72,roughness:.1,metalness:.35});
 const fiber=mat(0xffffff,{vertexColors:true,side:THREE.DoubleSide,roughness:1});
 const numberMap=texture(256,256,(c,w,h)=>{c.fillStyle='#f3e7cb';c.beginPath();c.ellipse(w/2,h/2,112,112,0,0,TAU);c.fill();});
 const decal=mat(0xffffff,{map:numberMap,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,roughness:.5});
 const box=(w,h,d,m,p,x=0,y=0,z=0)=>{const o=add(unit,m,p,x,y,z);o.scale.set(w,h,d);return o;};
 const ball=(m,p,x,y,z,rx,ry=rx,rz=rx)=>{const radius=Math.max(rx,ry,rz),o=add(radius<=.045?tinySphere:radius<=.125?smallSphere:sphere,m,p,x,y,z);o.scale.set(rx,ry,rz);return o;};
 let seed=82061;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};

 // Tapered individual fibers provide a real silhouette rather than a photograph on a plane.
 function furSurface(parent,sample,count,colorA,colorB,length=.055) {
  const positions=[],colors=[],normals=[],a=new THREE.Color(colorA),b=new THREE.Color(colorB),side=new THREE.Vector3();
  for(let i=0;i<count;i++){
   const q=sample(rand(),rand());if(!q)continue;const n=q.normal,p=q.position,l=length*(.5+rand()*.85)*(q.length||1),tip=q.flow?p.clone().addScaledVector(n,l*.32).addScaledVector(q.flow,l):p.clone().addScaledVector(n,l*.65).add(new THREE.Vector3(n.x*.012,-l*.48,-l*.10));
   side.crossVectors(n,q.flow||(Math.abs(n.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0))).normalize().multiplyScalar(l*.07);
   const c=q.color?new THREE.Color(q.color):a.clone().lerp(b,rand()*.75);let root1=p.clone().add(side),root2=p.clone().sub(side);if(root2.clone().sub(root1).cross(tip.clone().sub(root1)).dot(n)<0){const swap=root1;root1=root2;root2=swap;}positions.push(root1.x,root1.y,root1.z,root2.x,root2.y,root2.z,tip.x,tip.y,tip.z);
   for(let k=0;k<3;k++){const v=k===2?1.04:.96;colors.push(c.r*v,c.g*v,c.b*v);normals.push(n.x,n.y,n.z);}
  }
  const g=geo(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeBoundingSphere();const o=add(g,fiber,parent);o.castShadow=false;return o;
 }
 function fuzzyBall(parent,center,radii,m,count,colors,length=.05,filter=null) {
  ball(m,parent,...center,...radii);
  furSurface(parent,(u,v)=>{const y=1-2*u,a=v*TAU,r=Math.sqrt(1-y*y),n=new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);if(filter&&!filter(n))return null;const p=new THREE.Vector3(n.x*radii[0],n.y*radii[1],n.z*radii[2]);return{position:p.add(new THREE.Vector3(...center)),normal:new THREE.Vector3(n.x/radii[0],n.y/radii[1],n.z/radii[2]).normalize()};},count,...colors,length);
 }
 function profileAt(sections,t) {
  const u=Math.max(0,Math.min(.999999,t))*(sections.length-1),i=Math.floor(u),f=u-i,a=sections[Math.max(0,i-1)],b=sections[i],c=sections[Math.min(sections.length-1,i+1)],d=sections[Math.min(sections.length-1,i+2)];
  return b.map((v,j)=>.5*(2*v+(-a[j]+c[j])*f+(2*a[j]-5*v+4*c[j]-d[j])*f*f+(-a[j]+3*v-3*c[j]+d[j])*f*f*f));
 }
 function shell(sections,m,parent) {
  const positions=[],uv=[],indices=[],sides=40,rings=40;
  for(let i=0;i<=rings;i++){const [z,w,y,h]=profileAt(sections,i/rings);for(let j=0;j<=sides;j++){const a=j/sides*TAU;positions.push(Math.cos(a)*w,y+Math.sin(a)*h,z);uv.push(j/sides,i/rings);if(i<rings&&j<sides){const k=i*(sides+1)+j;indices.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}}}
  const g=geo(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return add(g,m,parent);
 }
 function torus(radius,thickness,m,parent,x,y,z,axis='z',sides=40){const fine=thickness<.012,o=add(geo(new THREE.TorusGeometry(radius,thickness,fine?4:7,fine?Math.min(sides,32):sides)),m,parent,x,y,z);if(axis==='x')o.rotation.y=Math.PI/2;if(axis==='y')o.rotation.x=Math.PI/2;return o;}
 function makeWheel(parent,x,z) {
  const pivot=new THREE.Group();pivot.position.set(x,.47,z);parent.add(pivot);const spin=new THREE.Group();pivot.add(spin);const side=Math.sign(x),width=z<0?.58:.46;
  const profile=[[-width*.53,.275],[-width*.52,.36],[-width*.43,.435],[-width*.30,.461],[width*.30,.461],[width*.43,.435],[width*.52,.36],[width*.53,.275]].map(([x,r])=>new THREE.Vector2(r,x));
  const tire=geo(new THREE.LatheGeometry(profile,48));tire.rotateZ(Math.PI/2);add(tire,rubber,spin);
  for(const xOffset of[-.12,-.04,.04,.12])torus(.462,.0055,charcoal,spin,xOffset,0,0,'x');
  for(const sign of[-1,1]){torus(.365,.006,steel,spin,sign*width*.515,0,0,'x');torus(.29,.018,rubber,spin,sign*width*.54,0,0,'x');}
  for(let i=0;i<36;i++){const a=i/36*TAU;const mark=box(.11,.004,.025,charcoal,spin,side*width*.41,Math.cos(a)*.435,Math.sin(a)*.435);mark.rotation.x=a;}
  const rim=geo(new THREE.CylinderGeometry(.277,.277,.035,40));rim.rotateZ(Math.PI/2);add(rim,steel,spin,side*width*.52,0,0);torus(.268,.027,gold,spin,side*width*.56,0,0,'x');
  for(let i=0;i<8;i++){const a=i/8*TAU;rod([side*width*.57,Math.cos(a)*.065,Math.sin(a)*.065],[side*width*.56,Math.cos(a+.11)*.25,Math.sin(a+.11)*.25],.023,gold,spin,6);ball(chrome,spin,side*width*.60,Math.cos(a)*.115,Math.sin(a)*.115,.014,.016,.016);}
  const hub=geo(new THREE.CylinderGeometry(.073,.073,.05,12));hub.rotateZ(Math.PI/2);add(hub,chrome,spin,side*width*.61,0,0);torus(.20,.012,chrome,spin,side*width*.53,0,0,'x');
  mergeStatic(spin);return{pivot,spin,front:z>0,radius:.47};
 }
 const characterAssets=createDriverSculpts(THREE,{kit,materials,texture,artMaps,furSurface,ball,torus,palette:{cream,orange,blackFur,pupil,gold,chrome,earDark,glass}});
 const makeHead=characterAssets.makeHead;
 function makeTail(parent,panda) {
  const tail=new THREE.Group();tail.position.set(0,.89,-.49);parent.add(tail);
  if(panda){fuzzyBall(tail,[0,.0,-.14],[.16,.17,.17],cream,800,[0xc9c0a7,0xffefd5],.035);return tail;}
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(-.20,.04,-.28),new THREE.Vector3(-.49,.17,-.49),new THREE.Vector3(-.80,.27,-.59),new THREE.Vector3(-1.10,.53,-.56)]),frames=curve.computeFrenetFrames(48,false),positions=[],uv=[],indices=[],vertices=20;
  const radius=t=>.025+Math.sin(Math.PI*Math.pow(t,.8))*.29;
  for(let i=0;i<=48;i++){const t=i/48,c=curve.getPointAt(t);for(let j=0;j<=vertices;j++){const a=j/vertices*TAU,n=frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i],Math.sin(a)),p=c.clone().addScaledVector(n,radius(t));positions.push(p.x,p.y,p.z);uv.push(j/vertices,t);if(i<48&&j<vertices){const k=i*(vertices+1)+j;indices.push(k,k+vertices+1,k+1,k+1,k+vertices+1,k+vertices+2);}}}
  for(let i=0;i<indices.length;i+=3){const a=indices[i];indices[i]=indices[i+2];indices[i+2]=a;}
  const g=geo(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();const tmap=texture(128,256,(c,w,h)=>{c.fillStyle='#cf6a18';c.fillRect(0,0,w,h);c.fillStyle='#f4e4c1';c.fillRect(0,h*.75,w,h*.25);});add(g,mat(0xffffff,{map:tmap,roughness:1}),tail);
  for(const whitePart of[false,true])furSurface(tail,(u,v)=>{const t=whitePart?.76+u*.24:u*.76,a=v*TAU,i=Math.min(48,Math.round(t*48)),n=frames.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i],Math.sin(a));return{position:curve.getPointAt(t).addScaledVector(n,radius(t)),normal:n};},whitePart?3200:8500,whitePart?0xc9b994:0xa24713,whitePart?0xfff0d3:0xe99a39,.065);
  return tail;
 }
 const spring=geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({length:65},(_,i)=>new THREE.Vector3(Math.cos(i/64*TAU*6)*.061,i/64*.38,Math.sin(i/64*TAU*6)*.061))),96,.013,5,false));
 const shadowMap=texture(128,128,(c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,4,w/2,h/2,w/2);g.addColorStop(0,'#000000cc');g.addColorStop(1,'#00000000');c.fillStyle=g;c.fillRect(0,0,w,h);}),shadowMaterial=new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,opacity:.8});materials.add(shadowMaterial);
 const flameMaterial=new THREE.MeshBasicMaterial({color:0xffd37b,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending});materials.add(flameMaterial);
 function makeKart(panda=false) {
  const group=new THREE.Group();scene.add(group);const body=new THREE.Group();group.add(body);const parts=new THREE.Group();body.add(parts);const carPaint=panda?greenPaint:paint,suit=panda?greenCloth:cloth;
  const hoodProfile=[[.30,.48,.62,.18],[.48,.66,.67,.245],[.79,.68,.64,.30],[1.10,.60,.55,.245],[1.34,.51,.44,.18],[1.52,.45,.39,.14]];shell(hoodProfile,carPaint,parts);
  add(rounded(.85,.245,.035,.055),steel,parts,0,.43,1.484);add(rounded(.77,.17,.045,.04),charcoal,parts,0,.43,1.509);for(let i=0;i<13;i++)box(.010,.125,.012,steel,parts,(i-6)*.053,.43,1.574);for(const y of[.39,.43,.47])box(.70,.008,.008,steel,parts,0,y,1.581);
  // The stripe and badge follow the actual curved surface instead of floating tubes.
  const stripePositions=[],stripeIndices=[];for(let i=0;i<=36;i++){const [z,w,y,h]=profileAt(hoodProfile,.07+i/36*.84);for(const x of[-.060,.060])stripePositions.push(x,y+h*Math.sqrt(1-(x/w)**2)+.006,z);if(i<36){const k=i*2;stripeIndices.push(k,k+2,k+1,k+1,k+2,k+3);}}
  const stripeGeometry=geo(new THREE.BufferGeometry());stripeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(stripePositions,3));stripeGeometry.setIndex(stripeIndices);stripeGeometry.computeVertexNormals();add(stripeGeometry,white,parts);
  const badgeProfile=profileAt(hoodProfile,.60),previous=profileAt(hoodProfile,.59),next=profileAt(hoodProfile,.61),slope=((next[2]+next[3])-(previous[2]+previous[3]))/(next[0]-previous[0]);const badge=add(geo(new THREE.CircleGeometry(.225,40)),decal,parts,0,badgeProfile[2]+badgeProfile[3]+.010,badgeProfile[0]);badge.rotation.x=-Math.PI/2+Math.atan(-slope);badge.scale.y=1.22;
  for(const side of[-1,1]){const seam=[];for(let i=0;i<=18;i++){const [z,w,y,h]=profileAt(hoodProfile,.14+i/18*.78),x=side*w*.86;seam.push([x,y+h*Math.sqrt(1-(x/w)**2)+.003,z]);}tube(seam,.003,charcoal,parts,28,5);const [z,w,y,h]=profileAt(hoodProfile,.71),x=side*w*.68;ball(chrome,parts,x,y+h*Math.sqrt(1-(x/w)**2)+.012,z,.019,.008,.019);}
  for(const side of[-1,1]){add(rounded(.34,.17,.36,.035),carPaint,parts,side*.68,.33,1.26);for(const z of[1.18,1.34])ball(chrome,parts,side*.69,.425,z,.017,.011,.017);}
  for(const side of[-1,1]){
   const pod=shell([[-.93,.01,.36,.02],[-.75,.15,.39,.13],[.08,.16,.38,.14],[.57,.11,.35,.09],[.70,.01,.35,.01]],carPaint,parts);pod.position.x=side*.78;
   tube([[side*.89,.38,-.94],[side*1.01,.30,-.47],[side*1.02,.29,.44],[side*.86,.29,.89]],.040,chrome,parts,20,8);
   tube([[side*.48,.26,-1.18],[side*.64,.23,-.40],[side*.59,.24,.61],[side*.25,.26,1.23]],.043,charcoal,parts,20,8);
   rod([side*.38,.39,.39],[side*1.0,.45,.88],.028,chrome,parts);rod([side*.36,.31,.67],[side*1.0,.42,.88],.025,steel,parts);
   rod([side*.42,.36,-.74],[side*1.0,.44,-.82],.035,steel,parts);const coil=add(spring,gold,parts,side*.67,.35,-.81);coil.rotation.z=-side*.40;rod([side*.64,.31,-.81],[side*.80,.82,-.81],.025,chrome,parts);
   tube([[side*.39,.60,-.49],[side*.65,.51,-.75],[side*.60,.45,-1.22],[side*.47,.48,-1.42]],.080,steel,parts,20,12);torus(.083,.015,chrome,parts,side*.47,.48,-1.43);ball(charcoal,parts,side*.47,.48,-1.447,.067,.067,.012);
   for(const z of[-.66,.05,.54])ball(chrome,parts,side*.92,.40,z,.022,.024,.023);
  }
  rod([-1.01,.43,-.82],[1.01,.43,-.82],.062,chrome,parts);tube([[-.80,.29,1.05],[-.63,.24,1.43],[0,.23,1.50],[.63,.24,1.43],[.80,.29,1.05]],.05,charcoal,parts,28,10);
  const seat=add(rounded(.77,.77,.17,.15),leather,parts,0,.94,-.41);seat.rotation.x=-.17;add(rounded(.73,.17,.66,.12),leather,parts,0,.60,-.18);
  for(const side of[-1,1])tube([[side*.30,.68,-.30],[side*.33,1.05,-.41],[side*.27,1.23,-.45]],.009,stitch,parts,16,5);
  // Exposed rear engine: cooling fins, carburettors, hoses and twin exhausts.
  box(.65,.24,.46,steel,parts,0,.53,-.86);for(let i=0;i<9;i++)box(.57,.018,.43,chrome,parts,0,.54+i*.032,-.88);
  for(const side of[-1,1]){const cap=add(geo(new THREE.CylinderGeometry(.08,.09,.20,16)),steel,parts,side*.20,.92,-.87);torus(.075,.013,chrome,parts,side*.20,1.025,-.87,'y');tube([[side*.15,.89,-.80],[side*.28,1.02,-.63],[side*.45,.85,-.58]],.021,charcoal,parts,16,7);}
  shell([[-1.31,.33,.69,.13],[-1.15,.46,.74,.20],[-.93,.48,.74,.22],[-.72,.34,.68,.16]],carPaint,parts);add(rounded(.43,.15,.025,.055),charcoal,parts,0,.69,-1.327);for(let i=0;i<8;i++)box(.017,.11,.009,steel,parts,(i-3.5)*.046,.69,-1.377);tube([[-.71,.35,-1.04],[-.72,.25,-1.44],[0,.25,-1.52],[.72,.25,-1.44],[.71,.35,-1.04]],.045,chrome,parts,24,8);
  const steering=new THREE.Group();steering.position.set(0,1.08,.53);steering.rotation.x=-.50;body.add(steering);torus(.245,.025,charcoal,steering,0,0,0);for(let i=0;i<3;i++){const a=i/3*TAU;rod([0,0,0],[Math.cos(a)*.23,Math.sin(a)*.23,0],.013,chrome,steering);}ball(gold,steering,0,0,0,.05,.05,.022);mergeStatic(steering);
  const driver=new THREE.Group();body.add(driver);const torso=ball(suit,driver,0,1.13,-.10,.33,.38,.25);torso.rotation.x=.13;ball(suit,driver,0,.77,.12,.30,.19,.33);tube([[0,1.48,.08],[0,1.17,.15],[0,.93,.07]],.008,stitch,driver,14,5);
  for(const side of[-1,1]){const arm=tube([[side*.26,1.38,-.13],[side*.39,1.22,.13],[side*.245,1.13,.48]],.093,suit,driver,18,10);ball(leather,driver,side*.23,1.13,.51,.11,.102,.12);tube([[side*.30,1.40,-.10],[side*.43,1.24,.13],[side*.28,1.15,.39]],.013,white,driver,16,6);}
  const {head,eyes}=makeHead(driver,panda),tail=makeTail(body,panda);const scarf=new THREE.Group();scarf.position.set(.12,1.48,-.30);driver.add(scarf);tube([[0,0,0],[.09,-.04,-.23],[.25,-.01,-.40],[.34,-.07,-.53]],.045,suit,scarf,18,7);
  tube([[0,.823,-1.30],[0,.913,-1.18],[0,.948,-1.05],[0,.963,-.94]],.025,white,parts,20,6);
  const wheels=[];for(const x of[-1.0,1.0])for(const z of[-.83,.87])wheels.push(makeWheel(group,x,z));
  const flames=new THREE.Group();body.add(flames);for(const side of[-1,1])ball(flameMaterial,flames,side*.47,.48,-1.73,.075,.075,.31);flames.visible=false;mergeStatic(parts);
  const shadow=add(geo(new THREE.PlaneGeometry(3.4,4.2)),shadowMaterial,scene);shadow.rotation.x=-Math.PI/2;shadow.castShadow=false;
  return{group,body,wheels,driver,head,eyes,tail,shadow,steering,flames,animate(speed,steer,boost,time){head.rotation.y=-steer*.16;head.rotation.z=-steer*.035+Math.sin(time*2)*.008;tail.rotation.y=Math.sin(time*5)*.06*speed;scarf.rotation.y=Math.sin(time*10)*.12*speed;steering.rotation.z=steer*.3;flames.visible=boost;flames.scale.z=1+Math.sin(time*37)*.2;}};
 }
 return{...kit,makeKart};
}
