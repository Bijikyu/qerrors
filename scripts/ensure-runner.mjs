import fs from 'fs/promises';import fsSync from 'fs';import path from 'path';
const cwd=process.cwd();
const is=c=>{try{return/runCLI/.test(c)&&/API Mode/.test(c)}catch{return false;}};
(async()=>{try{const t=path.join(cwd,'qtests-runner.mjs');if(!fsSync.existsSync(t)){
const cand=[path.join(cwd,'lib','templates','qtests-runner.mjs.template'),path.join(cwd,'templates','qtests-runner.mjs.template'),path.join(cwd,'node_modules','qtests','lib','templates','qtests-runner.mjs.template'),path.join(cwd,'node_modules','qtests','templates','qtests-runner.mjs.template')];
let c=null;for(const p of cand){try{if(fsSync.existsSync(p)){const x=await fs.readFile(p,'utf8');if(is(x)){c=x;break;}}}catch{}}!c||await fs.writeFile(t,c,'utf8');}}catch(error){
      console.error('Failed to ensure runner:', error);
    }})();
