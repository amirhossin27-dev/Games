const fs=require('node:fs'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,file),'utf8');
const moduleUrl=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
const imports={'kart-core':moduleUrl(read('three-r180/three.core.js')),'kart-engine':moduleUrl(read('three-r180/three.module.js').replaceAll('./three.core.js','kart-core'))};
const html=read('../dist/coast-duel.html').replace('<title>Joy-Kart · Einfache Küstenprobe</title>','<title>Joy-Kart · Gegen Computer</title>')
 .replace("new URLSearchParams(location.search).has('computer')","true")
 .replace("import('./three.module.js')","import('kart-engine')")
 .replace('<script>',()=>'<script type="importmap">'+JSON.stringify({imports})+'</script><script>');
fs.writeFileSync(path.join(__dirname,'../dist/Joy-Kart-PC.html'),html);
