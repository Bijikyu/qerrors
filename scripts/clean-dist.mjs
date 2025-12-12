import fs from 'fs';import path from 'path';
const rm=(p)=>{try{fs.rmSync(p,{recursive:true,force:true})}catch{}};
const cln=r=>{const d=path.join(r,'dist');try{if(!fs.existsSync(d))return}catch{return;}
const s=[d];while(s.length){const dr=s.pop();let e=[];try{e=fs.readdirSync(dr,{withFileTypes:true})}catch{continue;}
for(const x of e){const f=path.join(dr,x.name);
if(x.isDirectory()){if(x.name==='__mocks__'){rm(f);continue}s.push(f);continue;}
if(!x.isFile())continue;
if(/\.(test|spec)\.[cm]?jsx?$/.test(x.name)||/GeneratedTest/.test(x.name))try{fs.rmSync(f,{force:true})}catch{}}}};
cln(process.cwd());
