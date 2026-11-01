/** Browser QA: default inline/full; --standalone uses the independent page; --smoke skips the full race. */
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const standalone=process.argv.includes('--standalone'),smoke=process.argv.includes('--smoke');
const target=standalone?'standalone':'inline';
const runtime=process.env.JOY_KART_RUNTIME_DIR||path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies');
function dependency(name){try{return require(name);}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;return require(path.join(runtime,'node','node_modules',name));}}
const {chromium}=dependency('playwright');
const qaDir=path.resolve(process.env.JOY_KART_QA_OUTPUT||path.join(__dirname,'qa','latest',target))+path.sep;
fs.mkdirSync(qaDir,{recursive:true});
const records=[];
const artifactPath=standalone?path.join(__dirname,'dist','index.html'):path.resolve(__dirname,'../../docs/joy-kart-fahrtest.html');
const artifactBytes=fs.readFileSync(artifactPath),artifact={path:path.relative(path.resolve(__dirname,'../..'),artifactPath),bytes:artifactBytes.length,sha256:crypto.createHash('sha256').update(artifactBytes).digest('hex')};
const previousPath=path.join(qaDir,'report.json');if(fs.existsSync(previousPath)){const previous=JSON.parse(fs.readFileSync(previousPath,'utf8'));if(previous.status==='passed'&&previous.artifact?.sha256!==artifact.sha256){const version=previous.checks.find(item=>item.assetVersion)?.assetVersion||previous.artifact.sha256.slice(0,12),label=/^production-v\d+$/.test(version)?version:previous.artifact.sha256.slice(0,12),archive=path.join(__dirname,'qa','history',label,target);if(!fs.existsSync(archive)){fs.mkdirSync(archive,{recursive:true});for(const file of['report.json','fox-final.png','panda-final.png','portrait-final.png']){const original=path.join(qaDir,file);if(fs.existsSync(original))fs.copyFileSync(original,path.join(archive,file));}}}}
function record(value){records.push(value);const status=value.error?'failed':value.resultFlow?'passed':'running';fs.writeFileSync(path.join(qaDir,'report.json'),JSON.stringify({status,target,scope:smoke?'smoke':'full',artifact,testedAt:new Date().toISOString(),checks:records},null,2)+'\n');console.log(JSON.stringify(value));}
const python=process.env.JOY_KART_PYTHON||path.join(runtime,'python',process.platform==='win32'?'python.exe':'bin/python3');
const skill=process.env.JOY_KART_VISUALIZE_SKILL||path.join(os.homedir(),'.codex','plugins','cache','openai-bundled','visualize','1.0.66','skills','visualize');
const browserExecutable=process.env.JOY_KART_BROWSER||(process.platform==='win32'?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':undefined);
const {execFileSync}=require('node:child_process');
(async()=>{
 const base=path.resolve(__dirname,'../..').split(path.sep).join('/')+'/';
 const html=standalone?null:execFileSync(python,['-X','utf8',path.join(skill,'scripts','render.py'),base+'docs/joy-kart-fahrtest.html'],{encoding:'utf8',maxBuffer:4000000});
 const browser=await chromium.launch({executablePath:browserExecutable,headless:true,chromiumSandbox:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:standalone?844:1000},hasTouch:true,deviceScaleFactor:2});const errors=[],logs=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')logs.push(m.text());});
  if(standalone)await page.goto(pathToFileURL(artifactPath).href,{waitUntil:'networkidle'});else await page.setContent(html,{waitUntil:'networkidle'});const f=standalone?page:page.frames().find(x=>x!==page.mainFrame());await f.waitForFunction(()=>document.querySelector('#joy-kart-drive')?.__joyKart||(document.querySelector('.drive-error')&&!document.querySelector('.drive-error').hidden));
  record({browser:browser.version(),node:process.version,target,scope:smoke?'smoke':'full'});
  const initError=await f.locator('.drive-error').evaluate(e=>e.hidden?'':e.textContent);if(initError)throw Error(initError);
  const snap=()=>f.evaluate(()=>document.querySelector('#joy-kart-drive').__joyKart.snapshot());
  await f.locator('[data-action="showcase"]').click();if((await snap()).view!=='model')throw Error('Model view did not open');await page.screenshot({path:qaDir+'fox-final.png',fullPage:true});const beforeGallery=await snap();const galleryCdp=await page.context().newCDPSession(page);const stageBox=await f.locator('.drive-stage').boundingBox();const touch={x:Math.round(stageBox.x+stageBox.width*.45),y:Math.round(stageBox.y+stageBox.height*.34),id:7,radiusX:3,radiusY:3,force:1};await galleryCdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});const moved={...touch,x:touch.x+65};await galleryCdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[moved]});await galleryCdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[moved]});await f.waitForFunction(()=>Math.abs(document.querySelector('#joy-kart-drive').__joyKart.snapshot().modelAngle+.45)>.3);const afterGallery=await snap();if(afterGallery.elapsed!==0||afterGallery.progress!==beforeGallery.progress)throw Error('Model view changed the race');await f.locator('[data-action="showcase-swap"]').click();if((await snap()).model!=='Panda')throw Error('Panda view failed');await page.screenshot({path:qaDir+'panda-final.png',fullPage:true});await f.locator('[data-action="showcase-close"]').click();if((await snap()).view!=='race')throw Error('Model view did not close');record({modelView:'open + drag + Panda + close OK',houses:afterGallery.houses,palms:afterGallery.palms,assetVersion:afterGallery.assetVersion});await f.locator('[data-mode="solo"]').click();if((await snap()).mode!=='solo')throw Error('Mode not applied');
  await f.locator('[data-action="sound"]').click();if(await f.locator('[data-action="sound"]').getAttribute('aria-label')!=='Ton ausschalten')throw Error('Sound state incorrect');await f.locator('[data-action="sound"]').click();
  await f.locator('[data-action="start"]').first().click();await f.locator('[data-action="pause"]').click();const countdown=await snap();await page.waitForTimeout(500);if((await snap()).elapsed!==0)throw Error('Countdown pause leaked time');await f.locator('[data-action="resume"]').click();
  await f.waitForFunction(()=>document.querySelector('#joy-kart-drive').__joyKart.snapshot().phase==='racing',null,{timeout:10000});
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(350);if((await snap()).steer!==1)throw Error('Keyboard steering failed after start');await page.keyboard.up('ArrowRight');if((await snap()).steer!==0)throw Error('Keyboard steering stuck');
  const cdp=await page.context().newCDPSession(page);const lb=await f.locator('[data-action="left"]').boundingBox(),bb=await f.locator('[data-action="boost"]').boundingBox();const pt=(b,id)=>({x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2),id,radiusX:3,radiusY:3,force:1});const left=pt(lb,1),boost=pt(bb,2);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[left]});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[left,boost]});await page.waitForTimeout(200);
  if((await snap()).steer!==-1||(await snap()).boost<=0)throw Error('Simultaneous steering/boost failed');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[boost]});if((await snap()).steer!==-1)throw Error('Turbo release canceled steering');await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[left]});
  if((await snap()).steer!==0)throw Error('Touch steering stuck');
  await f.locator('[data-action="pause"]').click();const paused=await snap();await page.waitForTimeout(500);const still=await snap();if(still.elapsed!==paused.elapsed||still.progress!==paused.progress)throw Error('Pause did not freeze physics');
  const layouts=[];
  const viewports=standalone?[{width:320,height:740},{width:390,height:844},{width:430,height:932},{width:844,height:390}]:[320,390,430,736].map(width=>({width,height:1000}));
  for(const viewport of viewports){await page.setViewportSize(viewport);await f.waitForFunction(w=>innerWidth>=w-40&&innerWidth<=w,viewport.width);const layout=await f.evaluate(()=>{const r=document.querySelector('.drive-stage').getBoundingClientRect();return {viewport:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('.drive-controls button')].map(b=>{const x=b.getBoundingClientRect();return{action:b.dataset.action,width:x.width,height:x.height,inside:x.left>=r.left&&x.right<=r.right&&x.bottom<=r.bottom};})};});if(layout.scroll>layout.viewport||layout.buttons.some(b=>b.width<56||b.height<56||!b.inside))throw Error('Mobile layout failed');layouts.push(layout);}
  await f.locator('[data-setting="quality"]').selectOption('low');if((await snap()).quality!=='low')throw Error('Quality setting failed');await f.locator('[data-setting="quality"]').selectOption('auto');
  await f.locator('[data-action="recover"]').click();await page.waitForTimeout(1200);
  await page.screenshot({path:qaDir+'landscape-final.png',fullPage:true});
  await page.setViewportSize({width:390,height:standalone?844:1000});await f.waitForFunction(width=>innerWidth===width,standalone?390:358);await page.waitForTimeout(1800);
  const benchmark=await snap();await page.screenshot({path:qaDir+'portrait-final.png',fullPage:true});
  record({checks:['mode','sound','countdown pause','keyboard','two-finger steering + boost','independent release','pause freeze','quality','recovery'],layouts,benchmark});
  if(smoke){if(errors.length||logs.length)throw Error(JSON.stringify({errors,logs}));record({errors,logs,resultFlow:'model + controls + mobile layouts smoke OK'});return;}
  for(const fraction of[.30,.47,.65,.77,.92]){await f.waitForFunction(fraction=>{const s=document.querySelector('#joy-kart-drive').__joyKart.snapshot();return s.progress>=s.trackLength*fraction;},fraction,{timeout:30000});await page.screenshot({path:qaDir+'village-'+Math.round(fraction*100)+'-qa.png',fullPage:true});record({villageFraction:fraction,snapshot:await snap()});}
  await f.waitForFunction(()=>document.querySelector('#joy-kart-drive').__joyKart.snapshot().phase==='finished',null,{timeout:90000});
  const finish=await snap();if(finish.lap!==3||finish.progress<finish.trackLength*3)throw Error('Finish without three physical laps');
  if(!(await f.locator('.drive-result').isVisible()))throw Error('Result view not shown');await page.screenshot({path:qaDir+'finish-final.png',fullPage:true});
  await f.locator('.drive-result [data-action="home"]').click();if((await snap()).phase!=='ready')throw Error('Return to preparation failed');
  if(errors.length||logs.length)throw Error(JSON.stringify({errors,logs}));record({finish,errors,logs,resultFlow:'3 driven laps -> result -> preparation OK'});
 }finally{await browser.close();}
})().catch(e=>{record({error:e.stack});console.error(e.stack);process.exit(1);});

