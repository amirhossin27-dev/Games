const fs = require('node:fs');
const path = require('node:path');
const ts = require('../../node_modules/typescript');
const base = __dirname;

function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(base, file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, removeComments: false },
  }).outputText;
}

function loadRules() {
  const physics = {};
  new Function('exports', compile('physics.ts'))(physics);
  const engine = {};
  new Function('exports', 'require', compile('race-engine.ts'))(engine, id => {
    if (id === './physics') return physics;
    throw new Error('Unexpected dependency: ' + id);
  });
  return { physics, engine };
}

function build() {
  const source = fs.readFileSync(path.join(base, 'drive-view.html'), 'utf8');
  const atlas = 'data:image/webp;base64,' + fs.readFileSync(path.join(base, 'assets/material-atlas-v1.webp')).toString('base64');
  const sky = 'data:image/webp;base64,' + fs.readFileSync(path.join(base, 'assets/coast-panorama-v2.webp')).toString('base64');
  const output = source.replace('/*@@PHYSICS@@*/', compile('physics.ts')).replace('/*@@ENGINE@@*/', compile('race-engine.ts')).replace('/*@@BATCHING@@*/', fs.readFileSync(path.join(base, 'indexed-batching.js'), 'utf8')).replace('/*@@MODELS@@*/', fs.readFileSync(path.join(base, 'kart-models.js'), 'utf8')).replace('/*@@CHARACTERS@@*/', fs.readFileSync(path.join(base, 'character-sculpt.js'), 'utf8')).replace('/*@@SCENERY@@*/', fs.readFileSync(path.join(base, 'kart-scenery.js'), 'utf8')).replace('/*@@PRODUCTION_MODELS@@*/', fs.readFileSync(path.join(base, 'production-karts.js'), 'utf8')).replace('/*@@PRODUCTION_COAST@@*/', fs.readFileSync(path.join(base, 'production-coast.js'), 'utf8')).replace('/*@@LIGHTING@@*/', fs.readFileSync(path.join(base, 'production-lighting.js'), 'utf8')).replace('/*@@MATERIAL_ATLAS@@*/', JSON.stringify(atlas)).replace('/*@@SKY_TEXTURE@@*/', JSON.stringify(sky));
  if (output.includes('/*@@') || Buffer.byteLength(output) >= 1_000_000) throw new Error('Invalid preview output');
  const target = path.resolve(base, '../../docs/joy-kart-fahrtest.html');
  fs.writeFileSync(target, output, 'utf8');
  const distribution = path.join(base, 'dist');
  fs.mkdirSync(distribution, { recursive: true });
  const standalone = '<!doctype html>\n<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#0d1924"><title>Joy-Kart · Fahrtest</title><style>body{margin:0;background:#0d1924}#joy-kart-drive{min-height:100svh;align-items:center}#joy-kart-drive .drive-phone{box-shadow:none}@media(max-width:760px){#joy-kart-drive{padding:0}#joy-kart-drive .drive-phone{max-width:none;border:0;border-radius:0}#joy-kart-drive .drive-stage,#joy-kart-drive.is-playing .drive-stage{height:100svh;min-height:300px;aspect-ratio:auto}}#joy-kart-drive i[data-lucide]{font-style:normal;font-family:Arial,sans-serif;display:inline-flex;align-items:center;justify-content:center;font-size:24px}#joy-kart-drive .drive-button i[data-lucide]{font-size:34px}</style></head><body>\n' + output + '\n</body></html>\n';
  const fullScreen = '<style>#joy-kart-drive .drive-home-line{display:none}@media(max-width:760px),(orientation:landscape) and (max-width:1000px){#joy-kart-drive{padding:0;min-height:100svh}#joy-kart-drive .drive-phone,#joy-kart-drive.is-playing .drive-phone{width:100%;max-width:none;border:0;border-radius:0}#joy-kart-drive .drive-stage,#joy-kart-drive.is-playing .drive-stage{height:100svh;min-height:300px;aspect-ratio:auto}}</style>';
  const standaloneTarget = path.join(distribution, 'index.html');
  fs.writeFileSync(standaloneTarget, standalone.replace('</body>', fullScreen + '</body>'), 'utf8');
  console.log(JSON.stringify({ preview: target, standalone: standaloneTarget, bytes: Buffer.byteLength(output) }));
  return target;
}

module.exports = { compile, loadRules, build };
if (require.main === module) build();
