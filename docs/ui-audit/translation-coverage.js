// Translation coverage: opens every page in Nepali or Hindi and lists any text still in English.
// Names, emails, IDs and report text are data and are expected to stay as they are.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
const fs=require('fs');
// Usage: start the server (DEMO_ACCOUNTS=true) and the client, then: node docs/ui-audit/translation-coverage.js ne   (or hi)
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
const LANG=process.argv[2]||'ne';
const ALLOW=/^(MedLedger( AI)?|MetaMask|AI|OK|PDF|ECG|HbA1c|SpO2|BP|ICU|NABL|NMC|NHPC|Rs|mmHg|mg\/dL|bpm|kg|cm|GPT-4o|Ethereum|Sepolia)$/;
(async()=>{const b=await chromium.launch(); const report=[]; const freq={};
 for(const [role,paths] of Object.entries(pages)){
  const c=await b.newContext({viewport:{width:1366,height:900}}); const p=await c.newPage();
  if(role!=='public'){await p.goto(B+'/login',{waitUntil:'networkidle'}); await p.locator(`button:has-text("${roleName[role]}")`).first().click(); await p.waitForURL(/dashboard/,{timeout:15000});}
  await c.addInitScript(l=>{try{localStorage.setItem('medledger_lang',l)}catch(e){}},LANG);
  for(const path of paths){
   await p.goto(B+path,{waitUntil:'networkidle'}).catch(()=>{}); await p.waitForTimeout(1500);
   const nodes=await p.evaluate(()=>{const out=[];const tw=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
     for(let n=tw.nextNode();n;n=tw.nextNode()){const e=n.parentElement;if(!e||!e.offsetParent&&getComputedStyle(e).position!=='fixed')continue;
       if(e.closest('script,style,textarea,[translate=no],.notranslate'))continue;const t=n.nodeValue.replace(/\s+/g,' ').trim();if(t)out.push(t);}
     document.querySelectorAll('[placeholder]').forEach(e=>{if(e.offsetParent)out.push(e.getAttribute('placeholder'))});return out;});
   let total=0,eng=0;const miss=[];
   for(const t of nodes){ if(!/[A-Za-zऀ-ॿ]{2}/.test(t))continue; total++;
     const latin=(t.match(/[A-Za-z]{3,}/g)||[]).filter(w=>!ALLOW.test(w));
     if(latin.length && !/[ऀ-ॿ]/.test(t)){eng++;miss.push(t);freq[t]=(freq[t]||0)+1;} }
   const name=(role+path).replace(/[\/?=&]/g,'_');
   if(['public','patient'].includes(role)) await p.screenshot({path:`${OUT}/${LANG}_${name}.png`});
   report.push({role,path,total,eng,pct:+(100*(1-eng/Math.max(1,total))).toFixed(1),miss:miss.slice(0,40)});
   console.log(`${(100*(1-eng/Math.max(1,total))).toFixed(0).padStart(4)}%  ${role}${path}  (${eng}/${total} left in English)`);
  }
  await c.close();
 }
 await b.close();
 fs.writeFileSync(OUT+`/${LANG}.json`,JSON.stringify({report,freq:Object.entries(freq).sort((a,b)=>b[1]-a[1])},null,1));
})();
