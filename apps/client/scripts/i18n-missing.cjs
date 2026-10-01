const fs=require('fs'),path=require('path');
// Lists English UI text in src/ that has no Nepali/Hindi translation yet.
// Usage (from apps/client): node scripts/i18n-missing.cjs > missing.json
// Translate those keys and add them to src/i18n/locales/ne.json and hi.json
// ("exact" for plain text, "templates" for text with {0}, {1} values).
const ts=require('typescript');
const root=path.join(__dirname,'..','src');
const files=[];(function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);if(f==='__tests__')continue;if(fs.statSync(p).isDirectory())walk(p);else if(/\.tsx?$/.test(f))files.push(p);}})(root);
const ATTRS=new Set(['placeholder','title','aria-label','alt','label','hint','empty','subtitle','tag','description','text','intent','message','heading','name','cta']);
const out=new Map();
const SKIPATTR=new Set(['className','class','key','id','type','href','to','src','role','variant','size','htmlFor','autoComplete','inputMode','pattern','target','rel','method','accept','d','viewBox','fill','stroke','strokeWidth','engine','enum','icon','tone','color','name','value','defaultValue','tab','view','mode','width','height','dir','lang','style','form','kind','as','audience']);
const add=(s,f)=>{s=s.replace(/\s+/g,' ').trim();if(!s||!/[A-Za-z]{2}/.test(s))return;
 if(/^(https?:|\/|\.|#|[a-z]+[-_][a-z])/i.test(s)&&!/ /.test(s))return;
 if(/^[a-z0-9_.:\/-]+$/.test(s)&&!/ /.test(s)&&s.length<3)return;
 if(/\b(bg|text|px|py|rounded|flex|grid|border|shadow|w|h|mt|mb|gap|items|justify)-/.test(s)&&!/[.!?]$/.test(s))return;
 if(/^[a-z][a-zA-Z0-9]*$/.test(s))return; // identifiers / lowercase keys
 if(/^[A-Z_0-9]+$/.test(s)&&s.length>1&&!/ /.test(s)&&!/^[A-Z]{3,}$/.test(s))return;
 if(!out.has(s))out.set(s,new Set());out.get(s).add(path.relative(root,f));};
for(const f of files){const src=fs.readFileSync(f,'utf8');const sf=ts.createSourceFile(f,src,ts.ScriptTarget.Latest,true,f.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const visit=n=>{
  if(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))return;
  if(ts.isJsxText(n))add(n.text,f);
  else if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)){
    const p=n.parent;
    if(ts.isJsxAttribute(p)){const nm=p.name.getText();if(ATTRS.has(nm))add(n.text,f);else if(!SKIPATTR.has(nm)&&!/^data-|^on[A-Z]/.test(nm)&&(/ /.test(n.text)||/^[A-Z][a-z]/.test(n.text)||/^[A-Z]{2,}$/.test(n.text)))add(n.text,f);}
    else if(ts.isCallExpression(p)&&/^(require|import|querySelector|getItem|setItem|removeItem|test|match|replace|includes|startsWith|endsWith|split|join|get|post|put|patch|delete|addEventListener|removeEventListener|createElement|setAttribute|getAttribute|toLocaleString|toLocaleDateString)$/.test((p.expression.name||p.expression).getText().split('.').pop())){}
    else if(ts.isElementAccessExpression(p)){}
    else if((ts.isBinaryExpression(p)&&/===|!==|==|!=/.test(p.operatorToken.getText()))||ts.isCaseClause(p)){}
    else if(ts.isPropertyAssignment(p)&&p.initializer!==n){}
    else if(ts.isLiteralTypeNode(p)){}
    else if(/ /.test(n.text)||/^[A-Z][a-z]/.test(n.text))add(n.text,f);
  } else if(ts.isTemplateExpression(n)){
    const parts=[n.head.text,...n.templateSpans.map(s=>s.literal.text)];
    const t=n.head.text+n.templateSpans.map((s,i)=>'{'+i+'}'+s.literal.text).join('');
    if(/[A-Za-z]{3}/.test(t.replace(/\{\d+\}/g,""))&&!/\b(bg|text|px|py|rounded|flex|border)-/.test(t)&&!/^\/|https?:/.test(t))add('TPL:'+t,f);
  }
  ts.forEachChild(n,visit);};
 visit(sf);}
const decode=t=>t.replace(/&amp;/g,'&').replace(/&bull;/g,'•').replace(/&rarr;/g,'→').replace(/&nbsp;/g,' ').replace(/&middot;/g,'·').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").trim();
const missing={};
for(const lang of ['ne','hi']){
  const loc=JSON.parse(fs.readFileSync(path.join(root,'i18n','locales',lang+'.json'),'utf8'));
  for(const [s,f] of out){const tpl=s.startsWith('TPL:');const k=decode(tpl?s.slice(4):s);
    const has=tpl?(k in loc.templates):(k in loc.exact);
    if(!has&&!(tpl?false:true&&/^[^A-Za-z]*$/.test(k))){(missing[(tpl?'TPL:':'')+k]=missing[(tpl?'TPL:':'')+k]||{files:[...f],langs:[]}).langs.push(lang);}}
}
console.log(JSON.stringify(missing,null,1));
console.error(Object.keys(missing).length+' strings without a translation (many are names, codes or already-correct English).');
