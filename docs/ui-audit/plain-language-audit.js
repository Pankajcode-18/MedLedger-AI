// Plain-language audit: visits every page, scores its visible text, checks 375px width.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
const fs=require('fs');
// Usage: start the server (DEMO_ACCOUNTS=true) and the client, then: node docs/ui-audit/plain-language-audit.js
const B=process.env.CLIENT_URL||'http://localhost:5173', API=process.env.API_URL||'http://localhost:8080', OUT=process.env.OUT_DIR||require('path').join(__dirname,'out');
fs.mkdirSync(OUT,{recursive:true});
const JARGON=['blockchain','ledger','sha-256','sha256','hash','aes','gcm','cryptograph','consensus','node','smart contract','on-chain','onchain','sepolia','ethereum','eip-','digest','de-identif','deidentif','adjudicat','specimen','consortium','protocol','immutable','provenance','anchor','mined','gas fee','hl7','fhir','rbac','soc ','telemetry','governance','payer','attestation','decrypt','encrypt','ciphertext','keystore','private key','nonce','byzantine','quorum','tamper-proof','clinician','e-prescrib','emar','citizen safe','vault','console','station','sub-route','workstation','copilot','soap','jwt','token','api','ipfs','merkle','rpc','contract address','x12','edi '];
const ADMIN_OK=['blockchain','ledger','sha-256','hash','node','smart contract','sepolia','ethereum','rpc','contract address','consensus','anchor','token','jwt','api'];
const VAGUE=/^(submit|ok|click here|go|send|yes|no|continue|more|details|manage)$/i;
const pages={
 public:['/','/about','/login','/register/patient','/register/doctor','/forgot-password','/reset-password?token=x','/does-not-exist'],
 patient:['/patient/dashboard','/patient/records','/patient/analytics?tab=charts','/patient/analytics?tab=reports','/patient/analytics?tab=chat','/patient/analytics?tab=medications','/patient/permissions','/patient/activity','/patient/notifications','/patient/settings'],
 doctor:['/doctor/dashboard','/doctor/patients','/doctor/records','/doctor/requests','/doctor/ai','/doctor/medications','/doctor/activity','/doctor/settings'],
 hospital:['/hospital/dashboard','/hospital/patients','/hospital/staff','/hospital/admissions','/hospital/records','/hospital/prescriptions','/hospital/activity','/hospital/settings'],
 lab:['/lab/dashboard','/lab/samples','/lab/reports','/lab/upload','/lab/verify','/lab/activity','/lab/settings'],
 insurance:['/insurance/dashboard','/insurance/claims','/insurance/pending','/insurance/policyholders','/insurance/verify','/insurance/activity','/insurance/settings'],
 admin:['/admin/dashboard','/admin/users','/admin/orgs','/admin/permissions','/admin/blockchain','/admin/security','/admin/activity','/admin/settings']
};
const roleName={patient:'Patient',doctor:'Doctor',hospital:'Hospital',lab:'Laboratory',insurance:'Insurance',admin:'Administrator'};
const score=(text,buttons,role,path)=>{
  const low=text.toLowerCase().replace(/medledger/g,'').replace(/locked \(encrypted\)/g,''); const hits={};
  for(const j of JARGON){ if(role==='admin' && (path.includes('blockchain')||path.includes('settings')||path.includes('security')) && ADMIN_OK.includes(j)) continue;
    const re=new RegExp(j.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'); const n=(low.match(re)||[]).length; if(n) hits[j]=n; }
  const jargon=Object.values(hits).reduce((a,b)=>a+b,0);
  const caps=(text.match(/\b[A-Z]{3,}(?:\s+[A-Z&]{2,}){1,}\b/g)||[]).filter(s=>!/^(AI|MRI|CBC|HbA1c|TSH|ICU|NPR|INR|BP)$/.test(s));
  const sentences=text.split(/(?<=[.!?])\s+|\n/).map(s=>s.trim()).filter(Boolean);
  const long=sentences.filter(s=>s.split(/\s+/).length>28);
  const vague=buttons.filter(b=>VAGUE.test(b.trim()));
  const codes=(text.match(/(?<![\d,.])\b(403|500|401|404)\b(?![,.]\d)/g)||[]).length;
  const penalty=Math.min(10, jargon*0.35 + caps.length*0.25 + long.length*0.3 + vague.length*0.4 + codes*0.5);
  return {score:+(10-penalty).toFixed(1), hits, caps:caps.slice(0,6), long:long.slice(0,3).map(s=>s.slice(0,120)), vague, codes};
};
(async()=>{const b=await chromium.launch(); const report=[];
 for(const [role,paths] of Object.entries(pages)){
  const c=await b.newContext({viewport:{width:1366,height:900}}); const p=await c.newPage();
  if(role!=='public'){await p.goto(B+'/login',{waitUntil:'networkidle'}); await p.locator(`button:has-text("${roleName[role]}")`).first().click(); await p.waitForURL(/dashboard/,{timeout:15000});}
  for(const path of paths){
   await p.setViewportSize({width:1366,height:900});
   await p.goto(B+path,{waitUntil:'networkidle'}).catch(()=>{}); await p.waitForTimeout(1200);
   const text=await p.locator('body').innerText();
   const buttons=await p.$$eval('button:not([aria-label]), a[role=button]',els=>els.filter(e=>e.offsetParent).map(e=>e.innerText.trim()).filter(Boolean));
   const s=score(text,buttons,role,path);
   await p.setViewportSize({width:375,height:800}); await p.waitForTimeout(500);
   const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
   const smallTargets=await p.$$eval('main button, main a',els=>els.filter(e=>{const r=e.getBoundingClientRect();return e.offsetParent&&r.height>0&&r.height<44}).length).catch(()=>0);
   const name=(role+path).replace(/[\/?=&]/g,'_');
   await p.screenshot({path:`${OUT}/${name}_m.png`});
   report.push({role,path,...s,overflow,smallTargets});
  }
  await c.close();
 }
 await b.close();
 fs.writeFileSync(OUT+'/audit.json',JSON.stringify(report,null,1));
 const below=report.filter(r=>r.score<8);
 for(const r of report) console.log(`${r.score.toFixed(1).padStart(4)} ${r.overflow?'OVF':'   '} ${r.role}${r.path.startsWith('/'+r.role)?r.path.slice(r.role.length+1):r.path}  ${Object.entries(r.hits).map(([k,v])=>k+'×'+v).join(', ')} ${r.caps.length?'CAPS:'+r.caps.join('|'):''} ${r.long.length?'LONG:'+r.long.length:''} ${r.vague.length?'VAGUE:'+r.vague.join('|'):''}`);
 console.log(`\npages: ${report.length}, below 8: ${below.length}, avg ${(report.reduce((a,r)=>a+r.score,0)/report.length).toFixed(2)}, overflow at 375px: ${report.filter(r=>r.overflow).length}`);
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
