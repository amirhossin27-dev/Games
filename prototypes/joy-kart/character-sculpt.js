/** Continuous implicit head surfaces, sampled and triangulated locally. No reference image is used as face geometry. */
function driverHeadField(panda=false) {
 const ell=(x,y,z,cx,cy,cz,rx,ry,rz)=>{x-=cx;y-=cy;z-=cz;const a=Math.hypot(x/rx,y/ry,z/rz),b=Math.hypot(x/(rx*rx),y/(ry*ry),z/(rz*rz));return b>1e-10?a*(a-1)/b:-Math.min(rx,ry,rz);};
 const blend=(a,b,k)=>{const h=Math.max(0,Math.min(1,.5+.5*(b-a)/k));return b*(1-h)+a*h-k*h*(1-h);};
 return(x,y,z)=>{
  let d=ell(x,y,z,0,.025,-.025,panda?.51:.525,.43,.425);
  if(panda){d=blend(d,ell(x,y,z,0,-.175,.325,.29,.145,.245),.11);}
  else{
   d=blend(d,ell(x,y,z,-.345,-.125,.155,.275,.15,.255),.105);d=blend(d,ell(x,y,z,.345,-.125,.155,.275,.15,.255),.105);
   d=blend(d,ell(x,y,z,0,-.205,.185,.33,.145,.29),.09);d=blend(d,ell(x,y,z,0,-.145,.41,.235,.117,.218),.075);d=blend(d,ell(x,y,z,0,-.117,.585,.088,.057,.082),.055);
  }
  for(const side of[-1,1]){const socket=ell(x,y,z,side*.222,.067,.421,panda?.145:.170,panda?.130:.110,.095);d=-blend(-d,socket,.022);}
  return d;
 };
}

function driverSurfaceData(panda=false) {
 const field=driverHeadField(panda),nx=55,ny=43,nz=53,bounds=[-.76,.76,-.50,.58,-.52,.74],dx=(bounds[1]-bounds[0])/(nx-1),dy=(bounds[3]-bounds[2])/(ny-1),dz=(bounds[5]-bounds[4])/(nz-1),count=nx*ny*nz,values=new Float32Array(count);
 const point=id=>{const x=id%nx,y=Math.floor(id/nx)%ny,z=Math.floor(id/(nx*ny));return[bounds[0]+x*dx,bounds[2]+y*dy,bounds[4]+z*dz];};
 for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const i=(z*ny+y)*nx+x;values[i]=field(bounds[0]+x*dx,bounds[2]+y*dy,bounds[4]+z*dz);}
 const positions=[],normals=[],uv=[],indices=[],cache=new Map(),welded=new Map(),epsilon=.0015;
 const gradient=(x,y,z)=>{const a=field(x+epsilon,y,z)-field(x-epsilon,y,z),b=field(x,y+epsilon,z)-field(x,y-epsilon,z),c=field(x,y,z+epsilon)-field(x,y,z-epsilon),length=Math.hypot(a,b,c)||1;return[a/length,b/length,c/length];};
 function vertex(a,b){
  const key=Math.min(a,b)*count+Math.max(a,b);if(cache.has(key))return cache.get(key);const pa=point(a),pb=point(b),t=values[a]/(values[a]-values[b]),x=pa[0]+(pb[0]-pa[0])*t,y=pa[1]+(pb[1]-pa[1])*t,z=pa[2]+(pb[2]-pa[2])*t,positionKey=Math.round(x*1e5)+':'+Math.round(y*1e5)+':'+Math.round(z*1e5);
  if(welded.has(positionKey)){const id=welded.get(positionKey);cache.set(key,id);return id;}const id=positions.length/3,n=gradient(x,y,z),r=Math.hypot(x,y,z)||1;
  positions.push(x,y,z);normals.push(...n);uv.push(.5+Math.atan2(z,x)/(Math.PI*2),.5+Math.asin(Math.max(-1,Math.min(1,y/r)))/Math.PI);cache.set(key,id);welded.set(positionKey,id);return id;
 }
 function triangle(a,b,c){
  const ia=a*3,ib=b*3,ic=c*3,ax=positions[ib]-positions[ia],ay=positions[ib+1]-positions[ia+1],az=positions[ib+2]-positions[ia+2],bx=positions[ic]-positions[ia],by=positions[ic+1]-positions[ia+1],bz=positions[ic+2]-positions[ia+2],x=ay*bz-az*by,y=az*bx-ax*bz,z=ax*by-ay*bx;
  if(a===b||b===c||a===c)return;const dot=x*(normals[ia]+normals[ib]+normals[ic])+y*(normals[ia+1]+normals[ib+1]+normals[ic+1])+z*(normals[ia+2]+normals[ib+2]+normals[ic+2]);if(dot<0)indices.push(a,c,b);else indices.push(a,b,c);
 }
 const tetrahedra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]],edges=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
 for(let z=0;z<nz-1;z++)for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
  const i=(z*ny+y)*nx+x,corners=[i,i+1,i+nx+1,i+nx,i+nx*ny,i+nx*ny+1,i+nx*ny+nx+1,i+nx*ny+nx];let inside=0;for(const id of corners)if(values[id]<0)inside++;if(inside===0||inside===8)continue;
  for(const tetra of tetrahedra){const ids=tetra.map(j=>corners[j]),cut=[];for(const [a,b]of edges)if((values[ids[a]]<0)!==(values[ids[b]]<0))cut.push(vertex(ids[a],ids[b]));
   if(cut.length===3)triangle(...cut);
   else if(cut.length===4){
    const center=[0,0,0],normal=[0,0,0];for(const id of cut)for(let k=0;k<3;k++){center[k]+=positions[id*3+k]*.25;normal[k]+=normals[id*3+k];}const length=Math.hypot(...normal)||1;for(let k=0;k<3;k++)normal[k]/=length;
    const tangent=Math.abs(normal[1])<.9?[-normal[2],0,normal[0]]:[0,normal[2],-normal[1]],tl=Math.hypot(...tangent)||1;for(let k=0;k<3;k++)tangent[k]/=tl;const bitangent=[normal[1]*tangent[2]-normal[2]*tangent[1],normal[2]*tangent[0]-normal[0]*tangent[2],normal[0]*tangent[1]-normal[1]*tangent[0]];
    const angle=id=>{const p=[positions[id*3]-center[0],positions[id*3+1]-center[1],positions[id*3+2]-center[2]];return Math.atan2(p[0]*bitangent[0]+p[1]*bitangent[1]+p[2]*bitangent[2],p[0]*tangent[0]+p[1]*tangent[1]+p[2]*tangent[2]);};cut.sort((a,b)=>angle(a)-angle(b));triangle(cut[0],cut[1],cut[2]);triangle(cut[0],cut[2],cut[3]);
   }
  }
 }
 return{positions:new Float32Array(positions),normals:new Float32Array(normals),uv:new Float32Array(uv),indices:new Uint32Array(indices),field,gradient};
}

function createDriverSculpts(THREE, context) {
 const {kit,materials,texture,artMaps,furSurface,ball,torus,palette}=context,{geometry:geo,material:mat,add,tube,rod,mergeStatic}=kit;
 const {cream,orange,blackFur,pupil,gold,chrome,earDark,glass}=palette,TAU=Math.PI*2;
 const skin=mat(0xffffff,{vertexColors:true,map:artMaps.furNeutral,bumpMap:artMaps.creamFur,bumpScale:.004,roughness:.96});
 const eyeWhite=new THREE.MeshPhysicalMaterial({color:0xf8ecd6,roughness:.23,metalness:0,clearcoat:.7,clearcoatRoughness:.05});materials.add(eyeWhite);
 const cornea=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.035,metalness:0,clearcoat:.9,clearcoatRoughness:.03,transparent:true,opacity:.10,depthWrite:false});materials.add(cornea);
 const irisMap=texture(256,256,(c,w,h)=>{c.clearRect(0,0,w,h);const g=c.createRadialGradient(w/2,h/2,20,w/2,h/2,120);g.addColorStop(0,'#44210d');g.addColorStop(.40,'#b36b26');g.addColorStop(.75,'#db9b42');g.addColorStop(1,'#3d2317');c.fillStyle=g;c.beginPath();c.arc(w/2,h/2,122,0,TAU);c.fill();for(let i=0;i<180;i++){const a=i/180*TAU,r=43+Math.sin(i*13.1)*9;c.strokeStyle=i%3?'#7c481e88':'#efbb6388';c.lineWidth=1.3;c.beginPath();c.moveTo(w/2+Math.cos(a)*r,h/2+Math.sin(a)*r);c.lineTo(w/2+Math.cos(a+.005)*116,h/2+Math.sin(a+.005)*116);c.stroke();}});
 const irisGold=mat(0xffffff,{map:irisMap,transparent:true,roughness:.32,depthWrite:false}),irisDark=mat(0x514137,{map:irisMap,transparent:true,roughness:.30,depthWrite:false}),strapMaterial=mat(0x372e25,{roughness:.82});
 const ginger=new THREE.Color(0xd97822),creamColor=new THREE.Color(0xfff1dc),darkGinger=new THREE.Color(0x994519),pandaColor=new THREE.Color(0xf2e4c9),pandaBlack=new THREE.Color(0x242725);
 function paint(x,y,z,panda){
  if(panda){let patch=0;for(const side of[-1,1]){const dx=x-side*.222,dy=y-.058,a=side*.24,px=dx*Math.cos(a)-dy*Math.sin(a),py=dx*Math.sin(a)+dy*Math.cos(a),r=Math.hypot(px/.158,py/.193);patch=Math.max(patch,1-THREE.MathUtils.smoothstep(r,.86,1.12));}return pandaColor.clone().lerp(pandaBlack,patch*THREE.MathUtils.smoothstep(z,.12,.28));}
  const border=-.12+.14*Math.min(1,Math.abs(x)/.59),white=THREE.MathUtils.smoothstep(border-y,-.02,.05)*THREE.MathUtils.smoothstep(z,.06,.23),back=THREE.MathUtils.smoothstep(-z,.01,.40)*.15;return ginger.clone().lerp(darkGinger,back).lerp(creamColor,white);
 }
 function ear(parent,side,panda){
  if(panda){ball(blackFur,parent,side*.40,.405,-.04,.177,.198,.128);furSurface(parent,(u,v)=>{const yy=1-2*u,a=v*TAU,r=Math.sqrt(1-yy*yy),n=new THREE.Vector3(Math.cos(a)*r,yy,Math.sin(a)*r);return{position:new THREE.Vector3(side*.40+n.x*.177,.405+n.y*.198,-.04+n.z*.128),normal:n};},1100,0x242725,0x41433d,.027);return;}
  const g=new THREE.Group();g.position.set(side*.34,.285,-.025);g.rotation.z=-side*.25;parent.add(g);const positions=[],uv=[],colors=[],indices=[],rows=18,cols=18;
  const sample=(u,v,back=false)=>{const width=.218*Math.pow(Math.max(0,1-u),.72)+.012*Math.sin(u*Math.PI),x=v*width,y=u*.56,z=back?-.045-.075*(1-v*v)*Math.sin(u*Math.PI):.048+.072*v*v*(1-u)-.030*Math.sin(u*Math.PI);return new THREE.Vector3(x,y,z);};
  for(const back of[false,true])for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){const u=i/rows,v=j/cols*2-1,p=sample(u,v,back),white=!back?THREE.MathUtils.smoothstep(u,.10,.25)*(1-THREE.MathUtils.smoothstep(Math.abs(v),.57,.82))*(1-THREE.MathUtils.smoothstep(u,.87,1)):0,c=ginger.clone().lerp(new THREE.Color(0x5d3825),!back?THREE.MathUtils.smoothstep(Math.abs(v),.8,1)*.55:.32+.55*THREE.MathUtils.smoothstep(u,.64,.98)).lerp(creamColor,white);positions.push(p.x,p.y,p.z);uv.push((v+1)/2,u);colors.push(c.r,c.g,c.b);if(i<rows&&j<cols){const k=(back?(rows+1)*(cols+1):0)+i*(cols+1)+j;if(back)indices.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2);else indices.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);}}
  const offset=(rows+1)*(cols+1);for(let i=0;i<rows;i++)for(const j of[0,cols]){const a=i*(cols+1)+j,b=(i+1)*(cols+1)+j;indices.push(a,b,a+offset,b,b+offset,a+offset);}const geometry=geo(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(positions.length,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();add(geometry,skin,g);
  furSurface(g,(u,v)=>{const vv=v*2-1,p=sample(u,vv),white=Math.abs(vv)<.65&&u>.17&&u<.88;return{position:p,normal:new THREE.Vector3(-vv*.15,.1,1).normalize(),color:white?creamColor:ginger,flow:new THREE.Vector3(vv*.15,.8,.05).normalize()};},2100,0xdf9a42,0xf5c16f,.023);
 }
 function eye(parent,side,panda,frontAt){
  const group=new THREE.Group();group.position.set(side*.222,.065,frontAt(side*.222,.065)+.004);group.rotation.y=side*.10;group.rotation.z=panda?-side*.045:side*.035;group.updateMatrix();parent.add(group);const positions=[],uv=[],indices=[],cols=28,rows=14,w=panda?.134:.150,upperHeight=panda?.120:.100,lowerHeight=panda?.090:.064,tilt=panda?.012:.018;
  const lidDepth=(x,y)=>{const p=new THREE.Vector3(x,y,0).applyMatrix4(group.matrix);return frontAt(p.x,p.y)-p.z;};
  for(let i=0;i<=cols;i++){const x=i/cols*2-1,edge=Math.sqrt(Math.max(0,1-x*x));for(let j=0;j<=rows;j++){const v=j/rows*2-1,y=v*(v>0?upperHeight:lowerHeight)*edge+side*x*tilt;positions.push(x*w,y,Math.max((panda?.100:.078)*edge*Math.sqrt(Math.max(0,1-v*v)),lidDepth(x*w,y)+.002));uv.push(i/cols,j/rows);if(i<cols&&j<rows){const k=i*(rows+1)+j;indices.push(k,k+rows+1,k+1,k+1,k+rows+1,k+rows+2);}}}
  const geometry=geo(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();add(geometry,eyeWhite,group);
  const eyeDepth=panda?.112:.092,iris=add(geo(new THREE.CircleGeometry(panda?.070:.066,40)),panda?irisDark:irisGold,group,-side*.010,.002,eyeDepth);iris.scale.y=panda?1.10:1.03;ball(pupil,group,-side*.010,.001,eyeDepth+.009,panda?.038:.032,panda?.054:.044,.008);ball(eyeWhite,group,-.027,.027,eyeDepth+.019,panda?.017:.011,panda?.021:.014,.005);ball(eyeWhite,group,.019,-.024,eyeDepth+.018,.006,.007,.004);add(geometry,cornea,group,0,0,panda?.029:.024);
  const upper=[],lower=[];for(let i=0;i<=18;i++){const x=i/18*2-1,e=Math.sqrt(Math.max(0,1-x*x)),top=upperHeight*e+side*x*tilt,bottom=-lowerHeight*e+side*x*tilt;upper.push([x*w,top,lidDepth(x*w,top)+.009]);lower.push([x*w,bottom,lidDepth(x*w,bottom)+.007]);}tube(upper,panda?.009:.012,panda?blackFur:earDark,group,28,6);tube(lower,.005,panda?blackFur:orange,group,28,5);
 }
 function makeHead(parent,panda=false){
  const head=new THREE.Group();head.position.set(0,1.77,.035);head.rotation.x=.035;parent.add(head);const surface=driverSurfaceData(panda),staticParts=new THREE.Group();head.add(staticParts);const geometry=geo(new THREE.BufferGeometry()),colors=[];
  for(let i=0;i<surface.positions.length;i+=3){const c=paint(surface.positions[i],surface.positions[i+1],surface.positions[i+2],panda);colors.push(c.r,c.g,c.b);}geometry.setAttribute('position',new THREE.BufferAttribute(surface.positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(surface.normals,3));geometry.setAttribute('uv',new THREE.BufferAttribute(surface.uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(new THREE.BufferAttribute(surface.indices,1));geometry.computeBoundingSphere();add(geometry,skin,staticParts);
  function frontAt(x,y){let high=.80,low=-.40;for(let z=high;z>=low;z-=.012)if(surface.field(x,y,z)<0){low=z;high=z+.012;break;}for(let i=0;i<8;i++){const z=(low+high)*.5;if(surface.field(x,y,z)<0)low=z;else high=z;}return(low+high)*.5;}
  ear(head,-1,panda);ear(head,1,panda);const eyes=new THREE.Group();head.add(eyes);for(const side of[-1,1]){eye(eyes,side,panda,frontAt);if(!panda){const points=[];for(let i=0;i<9;i++){const u=i/8,x=side*(.085+u*.285),y=.158+Math.sin(u*Math.PI)*.026+u*.035;points.push([x,y,frontAt(x,y)+.010]);}tube(points,.014,earDark,staticParts,24,6);}}
  const noseY=panda?-.135:-.105,noseZ=frontAt(0,noseY);if(panda)ball(pupil,staticParts,0,noseY,noseZ+.013,.073,.047,.039);else{const s=new THREE.Shape();s.moveTo(-.058,.022);s.quadraticCurveTo(0,.057,.058,.022);s.quadraticCurveTo(.072,.008,.025,-.030);s.quadraticCurveTo(0,-.051,-.025,-.030);s.quadraticCurveTo(-.072,.008,-.058,.022);const g=geo(new THREE.ExtrudeGeometry(s,{depth:.038,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:2,curveSegments:8}));g.translate(0,0,-.020);add(g,pupil,staticParts,0,noseY,noseZ+.026);}const smile=[];for(let i=0;i<=16;i++){const x=(i/16*2-1)*.22,y=-.220+Math.pow(Math.abs(x)/.22,1.55)*.065;smile.push([x,y,frontAt(x,y)+.007]);}tube(smile,.0055,earDark,staticParts,28,5);tube([[0,noseY-.033,noseZ+.012],[0,-.19,frontAt(0,-.19)+.009],[0,-.22,frontAt(0,-.22)+.008]],.005,earDark,staticParts,14,5);
  // Leave the front open: the leather strap connects to the outer frames and goes behind the head.
  const strap=[];for(let i=0;i<=40;i++){const a=2.49+i/40*(TAU+.65-2.49);strap.push([Math.cos(a)*.52,.235+Math.sin(a)*.10,Math.sin(a)*.415-.012]);}tube(strap,.030,strapMaterial,staticParts,64,7);
  for(const side of[-1,1]){const goggles=new THREE.Group();goggles.position.set(side*.203,.346,.315);goggles.rotation.x=-.30;staticParts.add(goggles);const ring=torus(.168,.022,gold,goggles,0,0,0);ring.scale.y=.72;ball(glass,goggles,0,0,.008,.145,.101,.025);torus(.141,.006,chrome,goggles,0,0,.028).scale.y=.72;rod([side*.38,.321,.229],[side*.43,.294,.19],.022,gold,staticParts);}
  rod([-.036,.346,.320],[.036,.346,.320],.019,gold,staticParts);mergeStatic(staticParts);
  furSurface(head,(u,v)=>{const yy=1-2*u,a=v*TAU,r=Math.sqrt(1-yy*yy),direction=new THREE.Vector3(Math.cos(a)*r,yy,Math.sin(a)*r);let low=0,high=.92;for(let i=0;i<10;i++){const radius=(low+high)*.5;if(surface.field(direction.x*radius,direction.y*radius,direction.z*radius)<0)low=radius;else high=radius;}const p=direction.multiplyScalar((low+high)*.5);if(p.z>.28&&p.y>-.24&&p.y<.27&&Math.abs(p.x)<.41)return null;const normal=new THREE.Vector3(...surface.gradient(p.x,p.y,p.z)),flow=new THREE.Vector3(Math.sign(p.x)*.24,-.45,-.55);flow.addScaledVector(normal,-flow.dot(normal));if(flow.lengthSq()<.001)flow.set(1,0,0);flow.normalize();const cheek=p.y<-.03&&Math.abs(p.x)>.35;return{position:p,normal,color:paint(p.x,p.y,p.z,panda),flow,length:cheek?1.65:1};},panda?13500:19500,0xd98a31,0xf1b95f,panda?.025:.029);
  head.userData.sculpt={kind:panda?'panda':'fox',vertices:surface.positions.length/3,triangles:surface.indices.length/3,continuous:true};return{head,eyes};
 }
 return{makeHead};
}
