/** Private, expiring LAN test of a pinned coast-section build. No game files are modified. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net'),http=require('node:http'),crypto=require('node:crypto');
const privateAddress=a=>net.isIP(a)===4&&(/^(10\.|192\.168\.|127\.)/.test(a)||/^172\.(1[6-9]|2\d|3[01])\./.test(a));
function chooseHost(){const candidates=Object.entries(os.networkInterfaces()).flatMap(([name,items])=>items.filter(i=>i.family==='IPv4'&&!i.internal&&privateAddress(i.address)).map(i=>({name,address:i.address}))).filter(i=>!/vethernet|virtual|wsl|docker|vpn|tailscale/i.test(i.name));candidates.sort((a,b)=>Number(/wlan|wi-?fi/i.test(b.name))-Number(/wlan|wi-?fi/i.test(a.name)));return candidates[0]?.address||'127.0.0.1';}
const median=values=>{const a=[...values].sort((a,b)=>a-b),i=Math.floor(a.length/2);return a.length?a.length%2?a[i]:(a[i-1]+a[i])/2:null;};
function summarize(runs){const values=runs.flatMap(r=>r.samples).map(s=>(s.frames-1)*1000/(s.endMs-s.startMs)),samples=runs.flatMap(r=>r.samples),intervals=samples.reduce((a,s)=>a+s.frames-1,0),longFrames=samples.reduce((a,s)=>a+s.longFrames,0);return{runs:runs.length,count:values.length,medianFps:median(values),minFps:values.length?Math.min(...values):null,maxFps:values.length?Math.max(...values):null,frameIntervals:intervals,longFrames,slowFrameShare:intervals?longFrames/intervals:null};}
function validate(data,sha256,version='coast-section-v1'){
 if(data.sourceBuildHash!==sha256)return{status:409,error:'Diese Messung gehört zu einer anderen Spielversion. Bitte den aktuellen Testlink öffnen.'};
 if(data.schemaVersion!==1||data.version!==version||!Array.isArray(data.runs)||data.runs.length<1||data.runs.length>8)return{status:400,error:'Keine gültigen Abschnittsfahrten vorhanden.'};
 for(const run of data.runs){
  if(!(['coast-simple-v1','coast-simple-v2'].includes(version)?['turbo']:['turbo','spring','shield','grip','impulse']).includes(run.initialItem)||!Array.isArray(run.samples)||run.samples.length>40)return{status:400,error:'Ungültige Fahrt oder zu viele Messfenster.'};
  let lastEnd=-Infinity;
  for(const s of run.samples){const duration=s.endMs-s.startMs,fps=(s.frames-1)*1000/duration;if(!Number.isFinite(s.startMs)||!Number.isFinite(s.endMs)||duration<150||duration>5000||s.startMs<lastEnd-.2||!Number.isInteger(s.frames)||s.frames<3||s.frames>1500||!Number.isFinite(s.fps)||fps<0||fps>300||Math.abs(fps-s.fps)>1||!Number.isInteger(s.longFrames)||s.longFrames<0||s.longFrames>s.frames-1)return{status:400,error:'Ungültige oder überlappende Bildratenfenster.'};lastEnd=s.endMs;}
 }
 if(!summarize(data.runs).count)return{status:400,error:'Bitte zuerst mindestens einen kurzen Abschnitt fahren.'};
 if(data.feedback&&((data.feedback.note?.length||0)>500||!['unrated','smooth','slight-stutter','strong-stutter'].includes(data.feedback.smoothness)||!['unrated','good','sensitive','sluggish','gesture-problem'].includes(data.feedback.controls)))return{status:400,error:'Ungültige Rückmeldung.'};
 return null;
}
function createSectionPhoneServer(options={}){
 const host=options.host||chooseHost(),port=options.port??0,minutes=options.minutes??60;
 if(!privateAddress(host))throw Error('Use a private IPv4 address or loopback.');if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid port');if(!Number.isFinite(minutes)||minutes<1||minutes>120)throw Error('Lifetime must be 1–120 minutes');
 const qaRoot=options.qaRoot||path.join(__dirname,'qa'),artifactPath=options.artifactPath||path.join(__dirname,'../dist/coast-section.html'),html=fs.readFileSync(artifactPath,'utf8');
 const simple=html.match(/version:'(coast-simple-v[12])'/)?.[1],legacy=html.includes("version:'coast-section-v1'");if(!!simple===legacy)throw Error('Expected one known Joy-Kart coast build.');
 const version=simple||'coast-section-v1',config=simple?{rootId:'joy-kart-simple',apiKey:'__joyKartSimple',prefix:'js'}:{rootId:'joy-kart-coast-section',apiKey:'__joyKartSection',prefix:'cs'};
 const artifact={sha256:crypto.createHash('sha256').update(html).digest('hex'),bytes:Buffer.byteLength(html),version},token=crypto.randomBytes(18).toString('hex'),sessionId=new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex');
 const statePath=path.join(qaRoot,'phone-server.json'),sessionDir=path.join(qaRoot,'phone-sessions',sessionId),reportDir=path.join(qaRoot,options.automated?'automated-reports':'physical-iphone15',sessionId),latestPath=path.join(qaRoot,options.automated?'automated-reports':'physical-iphone15','latest.json');
 fs.mkdirSync(sessionDir,{recursive:true});fs.writeFileSync(path.join(sessionDir,'build.html'),html);
 const clientSource=fs.readFileSync(path.join(__dirname,'phone-test-client.html'),'utf8'),serverSource=fs.readFileSync(__filename,'utf8'),client=clientSource.replace('/*@@PHONE_META@@*/',JSON.stringify({...artifact,...config,token})),testHtml=html.replace('</body>',client+'\n</body>');
 fs.writeFileSync(path.join(sessionDir,'phone-test-client.html'),clientSource);fs.writeFileSync(path.join(sessionDir,'phone-test-server.cjs'),serverSource);
 fs.writeFileSync(path.join(sessionDir,'manifest.json'),JSON.stringify({artifact,runtime:{executable:process.execPath,version:process.version},sources:{clientSha256:crypto.createHash('sha256').update(clientSource).digest('hex'),serverSha256:crypto.createHash('sha256').update(serverSource).digest('hex')}},null,2)+'\n');
 let state=null,timer,closing=false;const persistState=()=>fs.writeFileSync(statePath,JSON.stringify(state,null,2)+'\n');
 const reply=(response,status,data,type='application/json; charset=utf-8')=>{response.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(typeof data==='string'?data:JSON.stringify(data));};
 const server=http.createServer((request,response)=>{
  request.setTimeout(15000,()=>request.destroy());
  if(request.method==='GET'&&request.url==='/favicon.ico'){response.writeHead(204);response.end();return;}
  if(request.method==='GET'&&['/','/game','/test'].includes(request.url)){reply(response,200,request.url==='/test'?testHtml:html,'text/html; charset=utf-8');return;}
  if(request.method!=='POST'||request.url!=='/report'){reply(response,404,{error:'Nicht gefunden.'});return;}
  if(request.headers.origin!==state?.origin||request.headers['x-joy-section-test']!==token||!/^application\/json(?:;|$)/i.test(request.headers['content-type']||'')){reply(response,403,{error:'Ungültige Testanfrage.'});return;}
  let size=0,body='',tooLarge=false;request.setEncoding('utf8');request.on('data',chunk=>{size+=Buffer.byteLength(chunk);if(size>131072){if(!tooLarge)reply(response,413,{error:'Messung ist zu groß.'});tooLarge=true;body='';return;}if(!tooLarge)body+=chunk;});
  request.on('end',()=>{if(tooLarge)return;try{const data=JSON.parse(body),problem=validate(data,artifact.sha256,artifact.version);if(problem){reply(response,problem.status,{error:problem.error});return;}
   const receivedAt=new Date().toISOString(),reportId=receivedAt.replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex'),reportPath=path.join(reportDir,'report-'+reportId+'.json'),summary=summarize(data.runs),record={source:options.automated?'automated browser QA; not a physical phone test':'user-initiated LAN coast-section test',physicalDevice:options.automated?false:'user-reported; not independently verified',sessionId,receivedAt,artifact:{...artifact,archivedBuild:path.join(sessionDir,'build.html')},summary,data};
   fs.mkdirSync(reportDir,{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(record,null,2)+'\n');fs.writeFileSync(latestPath,JSON.stringify({sessionId,receivedAt,reportPath,source:record.source,artifact,summary},null,2)+'\n');reply(response,200,{saved:true,reportId,receivedAt});
  }catch(error){reply(response,400,{error:'Messung konnte nicht gespeichert werden.'});}});
 });
 async function start(){await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.removeListener('error',reject);resolve();});});const startedAt=new Date(),expiresAt=new Date(startedAt.getTime()+minutes*60000),origin='http://'+host+':'+server.address().port;state={status:'running',kind:'coast-section-phone-test',automated:!!options.automated,pid:process.pid,host,port:server.address().port,origin,phoneTestUrl:origin+'/test',gameUrl:origin+'/game',startedAt:startedAt.toISOString(),expiresAt:expiresAt.toISOString(),lifetimeMinutes:minutes,sessionId,artifact,archivedBuild:path.join(sessionDir,'build.html'),latestReportPath:latestPath};persistState();timer=setTimeout(()=>stop('expired').catch(error=>console.error(error)),minutes*60000);return state;}
 async function stop(reason='stopped'){if(closing||!state)return;closing=true;clearTimeout(timer);state.status=reason;state.stoppedAt=new Date().toISOString();persistState();await new Promise(resolve=>{server.close(resolve);server.closeIdleConnections?.();});}
 return{start,stop,server,get state(){return state;},artifact,statePath};
}
module.exports={createSectionPhoneServer,chooseHost,privateAddress,validate,summarize};
if(require.main===module){const instance=createSectionPhoneServer({host:process.env.JOY_KART_SECTION_HOST||undefined,port:Number(process.env.JOY_KART_SECTION_PORT||0),minutes:Number(process.env.JOY_KART_SECTION_MINUTES||60),artifactPath:process.argv.includes('--simple')?path.join(__dirname,'../dist/coast-simple.html'):undefined});instance.start().then(state=>console.log(JSON.stringify(state))).catch(error=>{console.error(error);process.exitCode=1;});for(const signal of['SIGINT','SIGTERM'])process.on(signal,()=>instance.stop('stopped').catch(error=>{console.error(error);process.exitCode=1;}));}
