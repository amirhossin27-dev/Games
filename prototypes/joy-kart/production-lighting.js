/** Interpolate view-space position, then calculate distance per fragment, including coarse planes. */
function installCoastWaterFade(material){
 material.color.set(0x266c8b);material.roughness=.42;material.metalness=.04;material.clearcoat=.18;material.envMapIntensity=.65;material.transparent=true;material.depthWrite=false;
 material.onBeforeCompile=shader=>{shader.vertexShader='varying vec3 vCoastViewPosition;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvCoastViewPosition = mvPosition.xyz;');shader.fragmentShader='varying vec3 vCoastViewPosition;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','diffuseColor.a *= 1.0-smoothstep(130.0,460.0,length(vCoastViewPosition));\n#include <opaque_fragment>');};material.customProgramCacheKey=()=> 'joy-kart-coast-water-fade-v2';material.needsUpdate=true;
}
/** Separate direct panorama display from the filtered image-based material lighting. */
function createProductionLighting(THREE, context) {
 const {scene,renderer,skyImage,texture,textures,materials,geometries}=context;
 const panorama=new THREE.Texture(skyImage);panorama.colorSpace=THREE.SRGBColorSpace;panorama.wrapS=THREE.RepeatWrapping;panorama.wrapT=THREE.ClampToEdgeWrapping;panorama.generateMipmaps=false;panorama.minFilter=THREE.LinearFilter;panorama.magFilter=THREE.LinearFilter;panorama.needsUpdate=true;textures.add(panorama);
 const environment=texture(512,256,(c,w,h)=>c.drawImage(skyImage,0,0,w,h));environment.mapping=THREE.EquirectangularReflectionMapping;
 scene.background=null;scene.environment=environment;scene.environmentIntensity=.52;scene.fog=new THREE.FogExp2(0x8496b2,.0015);renderer.setClearColor(0x8eabc4,1);renderer.toneMappingExposure=1.04;
 const domeMaterial=new THREE.ShaderMaterial({name:'JoyKartDirectPanorama',side:THREE.BackSide,depthTest:false,depthWrite:false,fog:false,toneMapped:false,blending:THREE.NoBlending,uniforms:{panorama:{value:panorama}},vertexShader:'varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform sampler2D panorama;varying vec3 vDirection;void main(){vec3 d=normalize(vDirection);vec2 uv=vec2(atan(d.z,d.x)*0.159154943091895+0.5,asin(clamp(d.y,-1.0,1.0))*0.318309886183791+0.5);gl_FragColor=vec4(texture2D(panorama,uv).rgb,1.0);\n#include <colorspace_fragment>\n}'});materials.add(domeMaterial);
 const domeGeometry=new THREE.SphereGeometry(1,48,24);geometries.add(domeGeometry);const dome=new THREE.Mesh(domeGeometry,domeMaterial);dome.name='Distant painted coast';dome.scale.setScalar(460);dome.renderOrder=-10000;dome.frustumCulled=false;scene.add(dome);
 const hemisphere=new THREE.HemisphereLight(0xc7dcf4,0x6b5741,.68);scene.add(hemisphere);
 // Approximate the visible sun at u=.742, v=.569 of the original panorama.
 const sun=new THREE.DirectionalLight(0xffcf92,3.25);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-19;sun.shadow.camera.right=19;sun.shadow.camera.top=19;sun.shadow.camera.bottom=-19;sun.shadow.camera.near=1;sun.shadow.camera.far=180;sun.shadow.bias=-.00045;sun.shadow.normalBias=.03;scene.add(sun,sun.target);
 const fill=new THREE.DirectionalLight(0xb7d4ff,.38);scene.add(fill,fill.target);
 const modelLight=new THREE.DirectionalLight(0xe5efff,.45);modelLight.visible=false;scene.add(modelLight,modelLight.target);
 function update(camera,x,y,z,showroom=false){
  dome.position.copy(camera.position);sun.position.set(x+4,y+20,z+90);sun.target.position.set(x,y,z);fill.position.set(x-45,y+40,z-60);fill.target.position.set(x,y+1.0,z);modelLight.visible=showroom;
  if(showroom){modelLight.position.copy(camera.position).add(new THREE.Vector3(2,4,1));modelLight.target.position.set(x,y+1.6,z);}
 }
 function tuneWater(material){
  installCoastWaterFade(material);
 }
 return{sun,update,tuneWater,panoramaWidth:skyImage.width,panoramaHeight:skyImage.height,environmentWidth:512,environmentHeight:256};
}
