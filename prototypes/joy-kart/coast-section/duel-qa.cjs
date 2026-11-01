const {spawn}=require('node:child_process'),path=require('node:path'),os=require('node:os'),fs=require('node:fs'),assert=require('node:assert/strict');
const pw=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{
 const server=spawn(process.execPath,[path.join(__dirname,'duel-server.cjs'),'--local'],{env:{...process.env,JOY_DUEL_PORT:'0'}});
 const folder=path.join(__dirname,'qa/coast-duel-v1');fs.mkdirSync(folder,{recursive:true});
 let browser;
 try {
 const url=await new Promise((r,j)=>{server.stdout.once('data',x=>r(String(x).trim()));server.once('exit',j);});
 browser=await pw.chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',chromiumSandbox:true});
 const pages=await Promise.all([0,1].map(()=>browser.newPage({viewport:{width:852,height:393},hasTouch:true})));
 const errors=[];for(const p of pages)p.on('pageerror',e=>errors.push(e.message));
 const snap=p=>p.evaluate(()=>document.querySelector('#joy-kart-simple').__duelSnapshot());
 const phase=(p,v)=>p.waitForFunction(v=>document.querySelector('#joy-kart-simple').__duelSnapshot()?.me.phase===v,v,{timeout:300000});
 await Promise.all(pages.map(async p=>{await p.goto(p===pages[0]?url+'3d':url);await p.getByText('Beitreten',{exact:true}).tap({timeout:90000});await phase(p,'ready');}));
 const geometry=await pages[0].evaluate(()=>document.querySelector('#joy-kart-simple').__duelGeometry());
 assert.equal(geometry.backdropCorridorIntrusions,0);
 const slots=await Promise.all(pages.map(snap));assert.notEqual(slots[0].slot,slots[1].slot);
 await Promise.all(pages.map(p=>p.getByText('Bereit',{exact:true}).first().tap()));
 await Promise.all(pages.map(p=>phase(p,'running')));
 await pages[0].locator('[data-action="turbo"]').tap();
 await pages[1].keyboard.down('ArrowRight');await pages[1].waitForTimeout(500);await pages[1].keyboard.up('ArrowRight');
 
 await pages[0].screenshot({path:path.join(folder,'race.png')});
 await Promise.all(pages.map(p=>phase(p,'finished')));
 await pages[1].waitForFunction(()=>document.querySelector('#joy-kart-simple').__duelSnapshot().other.phase==='finished');
 const result=await Promise.all(pages.map(snap));assert.equal(result[0].me.stats.turboUses,1);assert.equal(result[1].me.stats.turboUses,0);
 assert(result[0].me.time<result[1].me.time);assert(result[1].me.lat>(result[1].slot?2:-2)+.1);
 await Promise.all(pages.map(p=>p.getByText('Revanche',{exact:true}).tap()));await Promise.all(pages.map(p=>phase(p,'countdown')));
 assert.equal((await snap(pages[0])).round,2);assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify({status:'passed',geometry,result,errors},null,2));console.log('Zwei Spieler, Steuerung, Turbo, Ziel und Revanche bestanden.');
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});

