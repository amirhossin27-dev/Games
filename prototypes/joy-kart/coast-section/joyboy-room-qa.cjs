const http=require('node:http'),assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const pw=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const code='abc123',at=Date.now(),doc=(uid)=>({name:uid,avatar:uid==='host'?'fuchs':'panda',color:'#baceda',at});
const room={info:{host:'host',allowed:{guest:1},known:{guest:true},robos:0,status:'lobby',game:'joykart',level:0,round:0,at},seats:{host:doc('host'),guest:doc('guest')}};
const db={rooms:{[code]:room}},streams=new Set();
const get=keys=>keys.reduce((o,k)=>o?.[k],db)??null;
function put(keys,data){let o=db;for(const k of keys.slice(0,-1))o=o[k]??={};if(data===null)delete o[keys.at(-1)];else o[keys.at(-1)]=data;}
function emit(s){s.res.write('event: put\ndata: '+JSON.stringify({path:'/',data:get(s.keys)})+'\n\n');}
const fixture=http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,PUT,POST,PATCH,DELETE,OPTIONS');
 if(req.method==='OPTIONS')return res.end();
 const keys=new URL(req.url,'http://localhost').pathname.replace(/\.json$/,'').split('/').filter(Boolean);
 if(req.headers.accept?.includes('text/event-stream')){
  res.writeHead(200,{'Content-Type':'text/event-stream'});const s={keys,res};streams.add(s);emit(s);res.on('close',()=>streams.delete(s));return;
 }
 let raw='';for await(const chunk of req)raw+=chunk;
 const body=raw?JSON.parse(raw,(k,v)=>v?.['.sv']==='timestamp'?Date.now():v):null;
 if(req.method==='PUT'||req.method==='DELETE')put(keys,body);
 if(req.method==='PATCH')for(const [k,v] of Object.entries(body))put([...keys,...k.split('/')],v);
 if(req.method!=='GET')for(const s of streams)if(s.keys.every((k,i)=>i>=keys.length||k===keys[i]))emit(s);
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.method==='GET'?get(keys):body));
});
(async()=>{
 await new Promise(r=>fixture.listen(0,'127.0.0.1',r));let browser;
 try{
 browser=await pw.chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
 const pages=await Promise.all(['host','guest'].map(async uid=>{
  const context=await browser.newContext({viewport:{width:770,height:385},serviceWorkers:'block'});
  await context.route(/https:\/\//,r=>r.abort());
  await context.addInitScript(({uid,endpoint,code})=>{
   if(top!==window){
    if(uid==='guest'){
     const real=HTMLCanvasElement.prototype.getContext;
     HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:real.call(this,type,...args);};
    }
    return;
   }
   const rewrite=u=>String(u).includes('firebasedatabase.app')?endpoint+new URL(u).pathname:String(u);
   const fetchReal=window.fetch;window.fetch=(u,options)=>fetchReal(rewrite(u),options);
   const Stream=window.EventSource;window.EventSource=class extends Stream{constructor(url){super(rewrite(url));}};
   localStorage.setItem('joyboy:data:v1',JSON.stringify({v:1,active:uid,profiles:[{id:uid,name:uid,avatar:'fuchs',age:2,color:'#baceda',stars:0}],settings:{online:true,arcadeAfter:0,sound:false}}));
   localStorage.setItem('joyboy:auth:v1',JSON.stringify({[uid]:{uid,token:uid,refresh:uid,exp:Date.now()+3600000}}));
   localStorage.setItem('joyboy:room:v1',JSON.stringify({code,profileId:uid}));
  },{uid,endpoint:'http://127.0.0.1:'+fixture.address().port,code});
  const p=await context.newPage();p.on('pageerror',e=>console.error(uid,e.message));await p.goto('http://127.0.0.1:60494/');
  return p;
 }));
 const [host,guest]=pages;
 await host.getByRole('button',{name:/Spielzimmer|Zusammen spielen/}).first().click({timeout:12000});
 await host.getByRole('button',{name:'Spiel starten',exact:true}).click({timeout:15000});
 const child=p=>p.frameLocator('iframe[title*="Joy-Kart"]');
 await Promise.all(pages.map(p=>child(p).locator('.js-controls:not([hidden])').waitFor({timeout:65000})));
 await child(guest).getByText('Sonnenküste · Kompakt',{exact:true}).waitFor();
 await child(guest).locator('[data-action="turbo"]').click();
 await child(guest).locator('canvas').click({position:{x:8,y:8}});await guest.keyboard.down('ArrowLeft');await guest.waitForTimeout(450);await guest.keyboard.up('ArrowLeft');
 await host.getByRole('button',{name:/Nochmal spielen/}).waitFor({timeout:300000});await guest.getByText(/Warte, bis/).waitFor();
 const grid=JSON.parse(room.state.st);assert.equal(grid[1].stats.turboUses,1);assert(grid[1].lat<1.95);assert.equal(grid[0].stats.turboUses,0);assert(grid.every(k=>k.s===k.lapLength*3 && k.lap===3));assert(grid[1].time<grid[0].time);
 await host.getByRole('button',{name:/Nochmal spielen/}).click();await Promise.all(pages.map(p=>child(p).locator('.js-count:not([hidden])').waitFor({timeout:65000})));assert.equal(room.state.round,1);
 console.log('Joyboy-Spielzimmer mit lokaler REST/SSE-Testdatenbank: zwei getrennte Apps, Raumstart, 3D gegen automatischen 2D-Rückfall, Gaststeuerung, beide Ergebnisse und Revanche bestanden.');
 }catch(e){console.error(JSON.stringify(room.info),room.state?.seq,room.seats.guest?.acts, (await Promise.all((browser?.contexts()??[]).flatMap(c=>c.pages()).map(p=>p.locator('body').innerText().then(x=>x.slice(-600))))));throw e;}
 finally{await browser?.close();fixture.closeAllConnections();fixture.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
