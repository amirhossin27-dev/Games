/** Crafted scenery made from reusable geometry; decorative objects stay beyond the driving boundary. */
function createKartScenery(THREE, context) {
 const { scene, P, track, scale:S, roadY, at, texture, water, gate, models, textures, materials, groundHeight }=context;
 const {geometry:geo,material:mat,add,rounded,rod,tube,mergeStatic}=models;
 const rand=P.seeded(3108),staticProps=new THREE.Group();scene.add(staticProps);
 const plaster=mat(0xe6cb9e),palePlaster=mat(0xdcc5a5),stone=mat(0xb8ab8d),roofMat=mat(0xb76549,{roughness:.93}),trim=mat(0xf0dfb8),door=mat(0x41615c),windowMat=mat(0x344f58,{roughness:.25,metalness:.15}),iron=mat(0x354f51,{metalness:.5,roughness:.55}),wood=mat(0x856247),palmLeaf=mat(0x5b824f,{side:THREE.DoubleSide}),trunk=mat(0x8d7558),pink=mat(0xc88f8b),blossom=mat(0xd4ad8d);
 const cubeGeo=geo(new THREE.BoxGeometry(1,1,1)),sphereGeo=geo(new THREE.IcosahedronGeometry(1,1));
 function box(w,h,d,m,parent,x=0,y=0,z=0){const o=add(cubeGeo,m,parent,x,y,z);o.scale.set(w,h,d);return o;}
 function ball(m,parent,x,y,z,sx,sy=sx,sz=sx){const o=add(sphereGeo,m,parent,x,y,z);o.scale.set(sx,sy,sz);return o;}
 function groundY(x,z){if(groundHeight)return groundHeight(x,z);const r=Math.hypot(x*.97,z*1.02),loc=P.locate(track,x/S+640,z/S+640),p=P.trackPoint(track,loc.s),distance=Math.hypot(x-(p.x-640)*S,z-(p.y-640)*S),ripples=Math.sin(x*.11)*Math.cos(z*.09)*.65+Math.sin(x*.28+z*.12)*.25;const base=1.55+ripples-Math.max(0,r-76)*.43,b=Math.max(0,Math.min(1,(11-distance)/4));return base*(1-b)+(roadY(loc.s)-.08)*b;}
 const tileTexture=texture(128,128,(c,w,h)=>{c.fillStyle='#bf7654';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=16)for(let x=0;x<w;x+=16){c.fillStyle=(x/16+y/16)%2?'#ad6549':'#c98660';c.fillRect(x+1,y+1,14,14);c.strokeStyle='#9a5844';c.lineWidth=1;c.beginPath();c.moveTo(x+2,y+15);c.quadraticCurveTo(x+8,y+10,x+14,y+15);c.stroke();}});tileTexture.wrapS=tileTexture.wrapT=THREE.RepeatWrapping;tileTexture.repeat.set(2,2);roofMat.map=tileTexture;
 const roofGeo=geo(new THREE.BufferGeometry());
 const roofVertices=[-1,0,-1,1,0,-1,0,.65,-1,-1,0,1,0,.65,1,1,0,1,-1,0,-1,0,.65,-1,0,.65,1,-1,0,-1,0,.65,1,-1,0,1,0,.65,-1,1,0,-1,1,0,1,0,.65,-1,1,0,1,0,.65,1];
 for(let i=0;i<roofVertices.length;i+=9)for(let j=0;j<3;j++){const a=roofVertices[i+j];roofVertices[i+j]=roofVertices[i+6+j];roofVertices[i+6+j]=a;}
 roofGeo.setAttribute('position',new THREE.Float32BufferAttribute(roofVertices,3));roofGeo.setAttribute('uv',new THREE.Float32BufferAttribute(Array.from({length:roofVertices.length/3},(_,i)=>[i%3===1?1:0,i%3===2?1:0]).flat(),2));roofGeo.computeVertexNormals();
 let houses=0;
 for(const fraction of[.025,.075,.13,.20,.27,.36,.43,.52,.61,.70,.80,.88,.94]){
  const s=track.len*fraction,plus=P.trackPoint(track,s,160),minus=P.trackPoint(track,s,-160),side=Math.hypot(plus.x-640,plus.y-640)<Math.hypot(minus.x-640,minus.y-640)?1:-1;
  const p=P.trackPoint(track,s,side*(P.WALL+48+rand()*35)),loc=P.locate(track,p.x,p.y),x=(p.x-640)*S,z=(p.y-640)*S;
  if(Math.abs(loc.lat)<P.WALL+28||Math.hypot(x,z)<17||Math.hypot(x,z)>72)continue;
  const center=P.trackPoint(track,s),group=new THREE.Group();group.position.set(x,groundY(x,z)-.1,z);group.rotation.y=Math.atan2((center.x-p.x)*S,(center.y-p.y)*S);staticProps.add(group);
  const w=2.5+rand()*1.2,d=2.3+rand()*.8,h=2.8+rand()*1.7;
  add(rounded(w,h,d,.08),houses%2?plaster:palePlaster,group,0,h/2,0);box(w+.2,.32,d+.2,stone,group,0,.12,0);
  const r=add(roofGeo,roofMat,group,0,h-.02,0);r.scale.set(w*.58,1.6,d*.62);
  const eave=box(w+.24,.12,d+.24,trim,group,0,h-.02,0);
  const entry=add(rounded(.53,1.12,.06,.18),door,group,0,.64,d/2+.04);box(.7,.10,.48,stone,group,0,.06,d/2+.14);
  for(const xx of[-w*.31,w*.31]){
   box(.56,.78,.07,trim,group,xx,h*.65,d/2+.05);box(.41,.61,.08,windowMat,group,xx,h*.65,d/2+.09);box(.025,.61,.018,trim,group,xx,h*.65,d/2+.14);box(.41,.025,.018,trim,group,xx,h*.65,d/2+.14);
   box(.65,.13,.26,wood,group,xx,h*.65-.45,d/2+.12);
   for(let i=0;i<4;i++)ball(houses%2?pink:blossom,group,xx+(i-1.5)*.12,h*.65-.37,d/2+.20,.15,.13,.15);
  }
  box(.30,.74,.37,plaster,group,w*.26,h+.55,-d*.24);box(.40,.08,.46,stone,group,w*.26,h+.97,-d*.24);
  const pergola=houses%3===0;if(pergola){for(const px of[-w*.54,w*.54])rod([px,0,d*.95],[px,h*.62,d*.95],.07,wood,group);for(let i=0;i<5;i++)box(.09,.10,d*.65,wood,group,-w*.50+i*w*.25,h*.62,d*.75);for(let i=0;i<9;i++)ball(pink,group,(rand()-.5)*w,h*.66+rand()*.2,d*.78+rand()*.2,.25,.15,.24);}
  houses++;
 }
 const palmPositions=[];
 for(const f of[.01,.055,.12,.18,.24,.32,.44,.57,.68,.81,.91]){
  const s=f*track.len;for(const side of[-1,1]){const p=P.trackPoint(track,s,side*(P.WALL+25+rand()*55)),loc=P.locate(track,p.x,p.y),x=(p.x-640)*S,z=(p.y-640)*S;if(Math.abs(loc.lat)<P.WALL+15||Math.hypot(x,z)>78||Math.hypot(x,z)<16)continue;palmPositions.push({x,z,y:groundY(x,z)});}
 }
 for(const p of palmPositions){
  const h=4+rand()*2.5,bend=(rand()-.5)*.8,root=new THREE.Group();root.position.set(p.x,p.y,p.z);root.rotation.y=rand()*Math.PI*2;staticProps.add(root);
  tube([[0,0,0],[bend*.2,h*.36,0],[bend*.65,h*.73,.1],[bend,h,.14]],.13,trunk,root,12,8);
  for(let ring=0;ring<8;ring++){const y=h*ring/8;const r=add(geo(new THREE.TorusGeometry(.135,.014,4,8)),wood,root,bend*(y/h)**1.4,y,0);r.rotation.x=Math.PI/2;}
  for(let i=0;i<8;i++){
   const angle=i/8*Math.PI*2,length=1.8+rand()*.9,positions=[],uv=[],indices=[];
   for(let j=0;j<=10;j++){const u=j/10,r=u*length,y=h+.20*Math.sin(u*Math.PI)-u*u*.75,width=.29*Math.sin(u*Math.PI)+.014;for(const side of[-1,1]){const x=bend+Math.cos(angle)*r-Math.sin(angle)*width*side,z=.14+Math.sin(angle)*r+Math.cos(angle)*width*side;positions.push(x,y-Math.abs(side)*width*.18,z);uv.push((side+1)/2,u);}if(j<10){const k=j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
   const g=geo(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();add(g,palmLeaf,root);
  }
  for(let i=0;i<3;i++)ball(wood,root,bend+(i-1)*.12,h-.08,.15,.13,.15,.12);
 }
 mergeStatic(staticProps);

 const wave=texture(128,128,(c,w,h)=>{c.fillStyle='#888888';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=5){c.strokeStyle=y%2?'#a3a3a3':'#6f6f6f';c.lineWidth=1;c.beginPath();for(let x=0;x<=w;x+=4){const yy=y+Math.sin(x*.17+y*.11)*2.7;if(x===0)c.moveTo(x,yy);else c.lineTo(x,yy);}c.stroke();}});wave.colorSpace=THREE.NoColorSpace;wave.wrapS=wave.wrapT=THREE.RepeatWrapping;wave.repeat.set(80,80);
 const sea=new THREE.MeshPhysicalMaterial({color:0x1f6c91,metalness:.05,roughness:.34,bumpMap:wave,bumpScale:.08,clearcoat:.45,clearcoatRoughness:.3,envMapIntensity:.50,fog:false});materials.add(sea);water.material=sea;
 const foamMat=new THREE.MeshBasicMaterial({color:0xd6eee4,transparent:true,opacity:.27,depthWrite:false,side:THREE.DoubleSide});materials.add(foamMat);
 const foamGeo=geo(new THREE.BufferGeometry()),foamPositions=[],foamIndices=[];
 for(let i=0;i<=160;i++){const a=i/160*Math.PI*2,r=84+Math.sin(a*5)*.7+Math.sin(a*9)*.35;for(const d of[-.13,.13])foamPositions.push(Math.cos(a)*(r+d)/.97,-2.06,Math.sin(a)*(r+d)/1.02);if(i<160){const k=i*2;foamIndices.push(k,k+1,k+2,k+1,k+3,k+2);}}
 foamGeo.setAttribute('position',new THREE.Float32BufferAttribute(foamPositions,3));foamGeo.setIndex(foamIndices);foamGeo.computeVertexNormals();const foam=add(foamGeo,foamMat,scene);foam.castShadow=false;

 gate.clear();const gateProps=new THREE.Group();gate.add(gateProps);
 const gateStone=mat(0xc6b793),gateMetal=mat(0x3d6466,{metalness:.45,roughness:.34}),brass=mat(0xc9a464,{metalness:.65,roughness:.29});
 for(const side of[-1,1]){
  add(rounded(.75,.35,.75,.08),gateStone,gateProps,side*6,.16,0);
  add(geo(new THREE.CylinderGeometry(.27,.34,3.15,12)),gateStone,gateProps,side*6,1.85,0);
  add(rounded(.68,.18,.68,.04),trim,gateProps,side*6,3.47,0);
 }
 tube([[-6,3.45,0],[-5.5,4.6,0],[-3,5.9,0],[0,6.35,0],[3,5.9,0],[5.5,4.6,0],[6,3.45,0]],.13,brass,gateProps,32,10);
 add(rounded(5.4,.92,.42,.12),gateMetal,gateProps,0,5.82,0);
 const signTexture=texture(512,96,(c,w,h)=>{c.fillStyle='#37595a';c.fillRect(0,0,w,h);c.strokeStyle='#b9a779';c.lineWidth=3;c.strokeRect(7,7,w-14,h-14);c.font='900 58px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#f8e8bd';c.fillText('JOY-KART',w/2,h/2+3);});
 const signMat=mat(0xffffff,{map:signTexture,roughness:.65});for(const side of[-1,1]){const s=add(geo(new THREE.PlaneGeometry(5.18,.78)),signMat,gateProps,0,5.82,side*.225);if(side<0)s.rotation.y=Math.PI;}
 mergeStatic(gateProps);
 const flagTexture=texture(128,128,(c,w,h)=>{c.fillStyle='#e9dfc2';c.fillRect(0,0,w,h);for(let y=0;y<8;y++)for(let x=0;x<8;x++)if((x+y)%2===0){c.fillStyle='#344c4f';c.fillRect(x*16,y*16,16,16);}});
 const flagMat=mat(0xffffff,{map:flagTexture,side:THREE.DoubleSide,roughness:1}),flags=[];
 for(const x of[-4.6,-3.6,3.6,4.6]){const g=geo(new THREE.PlaneGeometry(.60,1.1,4,8));const o=add(g,flagMat,gate,x,4.80,0);o.castShadow=false;flags.push({o,base:Float32Array.from(g.getAttribute('position').array),phase:x});}
 return { houses, palms:palmPositions.length, update(time){wave.offset.set(time*.0016,-time*.0011);foam.material.opacity=.24+Math.sin(time*.9)*.04;for(const f of flags){const pos=f.o.geometry.getAttribute('position');for(let i=0;i<pos.count;i++){const j=i*3,weight=(.55-f.base[j+1])/1.1;pos.setZ(i,f.base[j+2]+Math.sin(time*2.5+f.phase+f.base[j]*3)*weight*.10);}pos.needsUpdate=true;f.o.geometry.computeVertexNormals();}} };
}
