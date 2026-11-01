const path=require('node:path'),os=require('node:os'),fs=require('node:fs'),assert=require('node:assert/strict');
const pw=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{
 const browser=await pw.chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',chromiumSandbox:true});
 try{
 const page=await browser.newPage({viewport:{width:1100,height:690}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{if(window.top===window&&!localStorage.getItem('joyboy:data:v1'))localStorage.setItem('joyboy:data:v1',JSON.stringify({v:1,active:'qa',profiles:[{id:'qa',age:2,avatar:'fuchs',name:'Testfuchs',color:'#fea',stars:0,createdAt:Date.now()}],settings:{sound:false,arcadeAfter:0}}));});
 await page.goto('http://127.0.0.1:60494/');await page.getByRole('button',{name:/Joy-Kart/}).first().click();
 await page.getByRole('button',{name:'Kap der Winde',exact:true}).click();
 await page.getByRole('button',{name:/Gegen Robo/}).click();
 const child=page.frameLocator('iframe[title*="Joy-Kart"]');
 await child.locator('.js-controls:not([hidden])').waitFor({timeout:60000});
 await child.locator('canvas').click({position:{x:10,y:10}});
 await page.keyboard.press('KeyE');await page.keyboard.down('ArrowLeft');await page.waitForTimeout(350);await page.keyboard.up('ArrowLeft');
 const folder=path.join(__dirname,'qa/joyboy');fs.mkdirSync(folder,{recursive:true});
 await child.locator('[data-action="turbo"]').filter({hasText:/Schild/i}).waitFor({timeout:25000});
 await page.keyboard.press('KeyE');
 await page.waitForTimeout(350);
 await page.screenshot({path:path.join(folder,'kap-der-winde.png')});
 const snapshot=await child.locator('#joy-kart-simple').evaluate(el=>el.__duelSnapshot());
 assert.equal(snapshot.me.stats.turboUses,1);assert.equal(snapshot.me.stats.itemUses.shield,1);assert.equal(snapshot.me.lapLength,1728);assert(snapshot.me.lat < -2);
 await page.getByRole('button',{name:/Nochmal spielen/}).waitFor({timeout:300000});
 const stats=await page.evaluate(()=>JSON.parse(localStorage.getItem('joyboy:data:v1')).profiles[0].games.joykart);
 assert(stats);await page.getByRole('button',{name:/Nochmal spielen/}).click();
 await child.locator('.js-count:not([hidden])').waitFor({timeout:60000});assert.deepEqual(errors,[]);
 console.log('App-Katalog → Robo → Turbo und Lenkung → Ergebnis und Profil → Revanche bestanden.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
