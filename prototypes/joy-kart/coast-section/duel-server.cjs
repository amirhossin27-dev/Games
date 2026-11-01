const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { networkInterfaces } = require('node:os');
const physics = fs.readFileSync(path.join(__dirname, 'simple-engine.js'), 'utf8');
const circuit = fs.readFileSync(path.join(__dirname,'circuit.js'),'utf8');
const {SimpleRace,resolveWaves}=new Function(circuit+physics+';return {...createCoastSimpleModule(createKartCircuit()),resolveWaves:resolveKartWaves}')();
const html = fs.readFileSync(path.join(__dirname, '../dist/coast-duel.html'));
const lite = fs.readFileSync(path.join(__dirname,'duel-lite.html'),'utf8').replace('/*@@CIRCUIT@@*/',()=>circuit).replace('/*@@DUEL_CLIENT@@*/',()=>fs.readFileSync(path.join(__dirname,'duel-client.js'),'utf8')).replace('/*@@COMPACT_ROAD@@*/',()=>fs.readFileSync(path.join(__dirname,'compact-road.js'),'utf8'));
const room = '/' + (process.env.JOY_DUEL_ROOM || randomBytes(8).toString('hex')) + '/';
const players = new Map();
let previous = performance.now(), round = 0;
function restart() {
  round++;
  let index = 0;
  for (const player of players.values()) {
    player.race.begin();
    player.race.k.lat = index++ ? 2 : -2;
    player.ready = false;
    player.steer = 0;
  }
}
function tick() {
  const now = performance.now(), dt = (now - previous) / 1000;
  previous = now;
  for (const [key, p] of players) {
    if (now - p.seen > 10000) {
      players.delete(key);
      for (const other of players.values()) { other.race.reset(); other.ready = false; }
    }
  }
  const racers=[...players.values()].map(p=>p.race),waves=racers.map(r=>r.stats.itemUses.wave||0);
  for (const p of players.values()) { p.race.advance(dt, now-p.seen<500?p.steer:0); p.race.takeEvents(); }
  if(racers.length===2)resolveWaves(racers,waves);
}
const timer = setInterval(tick, 1000 / 60);
function reply(res, code, data) {
  res.writeHead(code, {'Content-Type':'application/json', 'Cache-Control':'no-store'});
  res.end(JSON.stringify(data));
}
const server = http.createServer(async (req, res) => {
  for(const file of ['three.module.js','three.core.js']){
    if(req.method==='GET' && req.url===room+file){
      res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'private, max-age=86400'});
      return fs.createReadStream(path.join(__dirname,'three-r180',file)).pipe(res);
    }
  }
  if ((req.url === room || req.url === room+'3d') && req.method === 'GET') {
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
    return res.end(req.url===room?lite:html);
  }
  if (req.method !== 'POST' || req.url !== room+'state' || req.headers['content-type'] !== 'application/json') return reply(res,404,{});
  try {
    let body = '';
    for await (const part of req) { body += part; if(body.length>1000)return reply(res,413,{}); }
    const msg = JSON.parse(body);
    if (!msg || typeof msg !== 'object') return reply(res,400,{});
    tick();
    let key = msg.key;
    if (!key) {
      if(players.size===2)return reply(res,409,{error:'Beide Startplätze sind besetzt.'});
      key=randomBytes(16).toString('hex');
      const slot=[...players.values()].some(p=>p.slot===0)?1:0;
      players.set(key,{slot,race:new SimpleRace(),ready:false,steer:0,seen:performance.now()});
    }
    const p=players.get(key);
    if(!p)return reply(res,410,{error:'Platz abgelaufen. Bitte neu beitreten.'});
    const other=[...players.values()].find(q=>q!==p);
    p.seen=performance.now();p.steer=Number.isFinite(msg.steer)?Math.max(-1,Math.min(1,msg.steer)):0;
    if(msg.turbo)p.race.queueTurbo();
    if(msg.ready && (p.race.phase==='ready'||(p.race.phase==='finished'&&other?.race.phase==='finished')))p.ready=true;
    if(p.ready&&other?.ready)restart();
    reply(res,200,{key,slot:p.slot,round,ready:p.ready,me:{...p.race.snapshot(),taken:[...p.race.taken]},other:other?.race.snapshot()||null});
  } catch { reply(res,400,{}); }
});
const local=process.argv.includes('--local'), port=Number(process.env.JOY_DUEL_PORT||60491);
const host=local?'127.0.0.1':process.env.JOY_DUEL_HOST||'0.0.0.0';
server.listen(port, host,()=>{
  const addresses=host!=='0.0.0.0'?[host]:Object.values(networkInterfaces()).flat().filter(x=>x.family==='IPv4'&&!x.internal).map(x=>x.address);
  for(const ip of addresses)console.log('http://'+ip+':'+server.address().port+room);
});
if (!local) setTimeout(()=>{ clearInterval(timer); server.close();server.closeAllConnections(); }, Math.min(3600000,Number(process.env.JOY_DUEL_TTL||3600000))).unref();

