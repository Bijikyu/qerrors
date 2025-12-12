import fs from 'fs';import path from 'path';import{fileURLToPath}from 'url';
const cwd=process.cwd();
const is=c=>{try{return/runCLI/.test(c)&&/API Mode/.test(c)}catch{return false;}};
try{const t=path.join(cwd,'qtests-runner.mjs');if(!fs.existsSync(t)){
const cand=[path.join(cwd,'lib','templates','qtests-runner.mjs.template'),path.join(cwd,'templates','qtests-runner.mjs.template'),path.join(cwd,'node_modules','qtests','lib','templates','qtests-runner.mjs.template'),path.join(cwd,'node_modules','qtests','templates','qtests-runner.mjs.template')];
let c=null;for(const p of cand){try{if(fs.existsSync(p)){const x=fs.readFileSync(p,'utf8');if(is(x)){c=x;break;}}}catch{}}!c||fs.writeFileSync(t,c,'utf8');}}catch{}
