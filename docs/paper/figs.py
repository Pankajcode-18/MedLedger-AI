import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
plt.rcParams.update({'font.family':'serif','font.serif':['Liberation Serif','TeX Gyre Termes','Times New Roman'],'font.size':8,'axes.linewidth':0.6})
OUT='/tmp/claude-0/paper/fig/'
INK='#0b1220'; MUTED='#475569'; BLUE='#2a78d6'; ORANGE='#eb6834'; AQUA='#1baf7a'
FILL={'pres':'#e8f1fc','app':'#fdeee7','data':'#e6f6ef','chain':'#efedf9'}
EDGE={'pres':'#2a78d6','app':'#c4501f','data':'#15875e','chain':'#4a3aa7'}

def box(ax,x,y,w,h,text,kind='app',fs=7,bold=False,r=0.02,lw=0.8):
    ax.add_patch(FancyBboxPatch((x,y),w,h,boxstyle=f"round,pad=0,rounding_size={r}",fc=FILL.get(kind,'white'),ec=EDGE.get(kind,INK),lw=lw))
    ax.text(x+w/2,y+h/2,text,ha='center',va='center',fontsize=fs,color=INK,fontweight='bold' if bold else 'normal',linespacing=1.15)
def arrow(ax,x1,y1,x2,y2,text=None,both=False,color=INK,fs=6,off=(0,0),ls='-',ha='center'):
    a=FancyArrowPatch((x1,y1),(x2,y2),arrowstyle='<|-|>' if both else '-|>',mutation_scale=7,lw=0.7,color=color,linestyle=ls,shrinkA=1,shrinkB=1)
    ax.add_patch(a)
    if text: ax.text((x1+x2)/2+off[0],(y1+y2)/2+off[1],text,fontsize=fs,color=MUTED,ha=ha,va='center',style='italic')
def canvas(w,h):
    fig=plt.figure(figsize=(w,h)); ax=fig.add_axes([0,0,1,1]); ax.set_xlim(0,w); ax.set_ylim(0,h); ax.axis('off'); return fig,ax

# ---------- Fig 1: architecture (double column) ----------
W,H=7.1,3.55
fig,ax=canvas(W,H)
def layer(y,h,title,kind):
    ax.add_patch(FancyBboxPatch((0.05,y),W-0.1,h,boxstyle="round,pad=0,rounding_size=0.05",fc='white',ec=EDGE[kind],lw=0.9,ls=(0,(3,2))))
    ax.text(0.14,y+h-0.12,title,fontsize=7.5,fontweight='bold',color=EDGE[kind],va='top')
layer(2.62,0.88,'PRESENTATION LAYER  (React + TypeScript, Vite, Tailwind)','pres')
roles=['Patient','Doctor','Hospital','Laboratory','Insurance','Administrator']
for i,r in enumerate(roles): box(ax,0.2+i*0.93,2.7,0.83,0.42,r+'\nworkspace','pres',fs=6.5)
box(ax,5.8,2.7,1.0,0.42,'English · Nepali · Hindi\nMetaMask (EIP-1193)','pres',fs=5.8)
layer(1.28,1.24,'APPLICATION LAYER  (Node.js + Express REST API, TypeScript)','app')
apps=[('Authentication\nJWT · bcrypt · lockout\nSIWE (EIP-4361)',0.2),('RBAC middleware\n+ consent policy\n(per patient–doctor)',1.58),('Record vault\nAES-256-GCM\nSHA-256 fingerprint',2.96),('AI engine\nOCR · de-identify\nrules / GPT-4o',4.34),('Record history\nhash-linked ledger\n+ relayer queue',5.55)]
for t,x in apps: box(ax,x,1.36,1.18,0.8,t,'app',fs=6.3)
ax.add_patch(FancyBboxPatch((0.05,0.08),5.4,1.08,boxstyle="round,pad=0,rounding_size=0.05",fc='white',ec=EDGE['data'],lw=0.9,ls=(0,(3,2))))
ax.text(0.14,1.04,'DATA LAYER',fontsize=7.5,fontweight='bold',color=EDGE['data'],va='top')
box(ax,0.2,0.18,1.9,0.66,'Encrypted state store\n(users, consents, readings,\nclaims … sealed lists)','data',fs=6.2)
box(ax,2.3,0.18,1.9,0.66,'Encrypted files\nMongoDB GridFS or\nlocal store (per-file key)','data',fs=6.2)
box(ax,4.4,0.18,1.0,0.66,'Master key\n(wraps file\nkeys)','data',fs=6.2)
ax.add_patch(FancyBboxPatch((5.6,0.08),1.45,1.08,boxstyle="round,pad=0,rounding_size=0.05",fc=FILL['chain'],ec=EDGE['chain'],lw=0.9))
ax.text(6.325,0.62,'BLOCKCHAIN LAYER\nHealthRecords.sol\nEthereum Sepolia /\nHardhat (31337)',ha='center',va='center',fontsize=6.3,color=INK)
arrow(ax,3.55,2.7,3.55,2.18,'HTTPS · REST · JWT',both=True,off=(0.55,0))
arrow(ax,3.55,1.36,3.2,0.86,both=True); arrow(ax,1.0,1.36,1.0,0.86,both=True); arrow(ax,4.1,1.36,4.8,0.86)
arrow(ax,6.14,1.36,6.14,1.16,None,color=EDGE['chain'])
ax.text(6.2,1.26,'…For() tx',fontsize=5.5,color=MUTED,style='italic',va='center')
arrow(ax,6.95,2.7,6.95,1.16,color=EDGE['chain'],ls=(0,(2,1.5)))
ax.text(6.9,2.33,'patient-signed\ngrantAccess /\nrevokeAccess',fontsize=5.2,color=EDGE['chain'],style='italic',va='center',ha='right')
fig.savefig(OUT+'fig1_architecture.png',dpi=300); plt.close(fig)

# ---------- Fig 2: upload + download flow (single column) ----------
W,H=3.45,4.3
fig,ax=canvas(W,H)
ax.text(0.85,4.18,'Upload',ha='center',fontsize=7.5,fontweight='bold',color=INK)
ax.text(2.6,4.18,'Open / download',ha='center',fontsize=7.5,fontweight='bold',color=INK)
up=['File + title (PDF, DOCX,\nimage; type & size check)','h = SHA-256(plaintext)','Random 256-bit data key K\n+ 96-bit IV','C = AES-256-GCM(K, file)','Wrap K with master key\n(AES-256-GCM)','Store C (GridFS / local)\n+ metadata (h, wrapped K)','Append history entry\n(prev-hash link)','Queue registerRecordFor\n(patient, h) → Ethereum']
bh=0.4; gap=0.1
for i,t in enumerate(up):
    y=3.62-i*(bh+gap); box(ax,0.08,y,1.55,bh,t,'app' if i<5 else ('data' if i==5 else 'chain'),fs=5.9)
    if i: arrow(ax,0.855,y+bh+gap,0.855,y+bh)
dn=[('Role + consent check\n(RBAC, permission list)','app'),('Unwrap K; verify\nGCM auth tag','app'),('Decrypt → P','app'),("SHA-256(P) = h ?",'app')]
for i,(t,k) in enumerate(dn):
    y=3.62-i*(bh+gap); box(ax,1.85,y,1.5,bh,t,k,fs=5.9)
    if i: arrow(ax,2.6,y+bh+gap,2.6,y+bh)
y=3.62-4*(bh+gap)
box(ax,1.85,y-0.02,0.7,0.44,'Yes: release\nfile + log\nopen event','data',fs=5.4)
box(ax,2.65,y-0.02,0.7,0.44,'No: refuse\n(HTTP 409) +\ntamper alert','chain',fs=5.4)
arrow(ax,2.4,y+bh+gap,2.2,y+0.42); arrow(ax,2.8,y+bh+gap,3.0,y+0.42)
ax.text(2.6,y-0.12,'Denied role or no\npermission → HTTP 403\n(logged)',ha='center',fontsize=5.6,color=MUTED,style='italic',va='top')
fig.savefig(OUT+'fig2_record_flow.png',dpi=300); plt.close(fig)

# ---------- Fig 3: consent sequence (double column) ----------
W,H=7.1,3.2
fig,ax=canvas(W,H)
lanes=[('Doctor',0.55,'pres'),('Patient',1.75,'pres'),('MetaMask',2.95,'pres'),('MedLedger API\n(consent service)',4.2,'app'),('Record history',5.35,'data'),('HealthRecords\ncontract',6.5,'chain')]
for n,x,k in lanes:
    box(ax,x-0.5,2.8,1.0,0.34,n,k,fs=6.4,bold=True)
    ax.plot([x,x],[0.08,2.8],color='#94a3b8',lw=0.6,ls=(0,(3,2)))
X={n.split('\n')[0]:x for n,x,k in lanes}
def msg(y,a,b,t,color=INK,ls='-'):
    x1,x2=X[a],X[b]
    arrow(ax,x1,y,x2,y,color=color,ls=ls)
    ax.text((x1+x2)/2,y+0.07,t,ha='center',fontsize=5.8,color=INK)
msg(2.6,'Doctor','MedLedger API','1. POST /access/request (reason)')
msg(2.38,'MedLedger API','Patient','2. notification: pending request')
msg(2.12,'Patient','MedLedger API','3a. Share (session)')
msg(1.9,'MedLedger API','Record history','4. append "Shared with doctor"')
msg(1.68,'Record history','HealthRecords','5. grantAccessFor(p, d) via relayer',color=EDGE['chain'])
msg(1.46,'HealthRecords','Record history','6. receipt → confirmed + tx hash',color=EDGE['chain'],ls=(0,(2,1.5)))
msg(1.12,'Patient','MetaMask','3b. confirm in wallet',color=EDGE['pres'])
msg(0.92,'MetaMask','HealthRecords','grantAccess(d) signed by patient',color=EDGE['pres'])
msg(0.72,'MetaMask','MedLedger API','tx hash → receipt & event verified',color=EDGE['pres'],ls=(0,(2,1.5)))
msg(0.46,'Doctor','MedLedger API','7. GET /records/:id/download')
msg(0.22,'MedLedger API','Doctor','8. permission list → decrypt, verify, release (or 403)',ls=(0,(2,1.5)))
ax.text(0.2,1.25,'alt: patient confirms in MetaMask',fontsize=5.5,color=MUTED,style='italic',va='center')
ax.add_patch(FancyBboxPatch((0.12,0.62),6.92,0.72,boxstyle="round,pad=0,rounding_size=0.03",fc='none',ec='#94a3b8',lw=0.5,ls=(0,(1,1.5))))
fig.savefig(OUT+'fig3_consent_sequence.png',dpi=300); plt.close(fig)

# ---------- Fig 4: AI pipeline (single column) ----------
W,H=3.45,2.35
fig,ax=canvas(W,H)
box(ax,0.05,1.85,1.0,0.42,'Uploaded report\n(PDF / scan / photo)','data',fs=5.9)
box(ax,1.25,1.85,1.0,0.42,'Text extraction\nPDF layer + Tesseract','app',fs=5.9)
box(ax,2.42,1.85,0.98,0.42,'De-identification\n+ independent\nre-check','app',fs=5.6)
arrow(ax,1.05,2.06,1.25,2.06); arrow(ax,2.25,2.06,2.42,2.06)
box(ax,0.05,0.95,1.6,0.6,'Built-in clinical engine\nvalues vs reference ranges,\ncondition flags, drug-\ninteraction KB, trends','app',fs=5.6)
box(ax,1.8,0.95,1.6,0.6,'Optional GPT-4o\n(de-identified text only,\ntimeout → built-in\nfallback)','chain',fs=5.6)
arrow(ax,2.9,1.85,0.85,1.55); arrow(ax,2.91,1.85,2.6,1.55)
box(ax,0.35,0.12,2.75,0.5,'Validated result: summary, abnormal values, conditions,\ndrug alerts, trend charts, chat — in English, Nepali, Hindi\n"Not a diagnosis" notice','pres',fs=5.6)
arrow(ax,0.85,0.95,1.2,0.62); arrow(ax,2.6,0.95,2.3,0.62)
ax.text(1.72,0.8,'values re-checked\nagainst ranges',fontsize=5.2,color=MUTED,style='italic',ha='center',va='center')
fig.savefig(OUT+'fig4_ai_pipeline.png',dpi=300); plt.close(fig)

# ---------- Fig 7: response time (single column) ----------
import numpy as np
sizes=['100 KB','1 MB','5 MB']
data={'Upload (encrypt + store)':([9.1,18.8,56.5],[25.5,43.7,133.6]),'Record check':([7.8,15.7,115.7],[28.2,145.5,433.2]),'Download (decrypt + verify)':([4.8,19.6,118.6],[16.6,86.8,454.4])}
fig,ax=plt.subplots(figsize=(3.45,2.1)); fig.subplots_adjust(left=0.13,right=0.98,top=0.8,bottom=0.14)
x=np.arange(3); w=0.26; cols=[BLUE,ORANGE,AQUA]; hatches=['','////','....']
for i,(k,(med,p95)) in enumerate(data.items()):
    b=ax.bar(x+(i-1)*w,med,w*0.92,color=cols[i],hatch=hatches[i],edgecolor='white',lw=0.4,label=k)
    for xi,m in zip(x+(i-1)*w,med): ax.text(xi,m+3,f'{m:g}',ha='center',va='bottom',fontsize=5.4,color=INK)
    ax.scatter(x+(i-1)*w,p95,marker='_',s=40,color=INK,lw=1,zorder=3,label='95th percentile' if i==0 else None)
ax.set_xticks(x); ax.set_xticklabels(sizes); ax.set_ylabel('Time (ms)',fontsize=7)
ax.tick_params(labelsize=6.5,length=2); ax.spines[['top','right']].set_visible(False)
ax.grid(axis='y',color='#e5e7eb',lw=0.5); ax.set_axisbelow(True); ax.set_ylim(0,480)
ax.legend(fontsize=5.8,ncol=2,frameon=False,loc='lower left',bbox_to_anchor=(0,1.0),handlelength=1.4,columnspacing=0.8)
fig.savefig(OUT+'fig7_latency.png',dpi=300); plt.close(fig)

# ---------- Fig 8: plain-language audit (single column) ----------
import json
b=json.load(open('/home/claude/proj/docs/ui-audit/baseline-2026-09.json')); a=json.load(open('/home/claude/proj/docs/ui-audit/after-phase4.json'))
roles=['public','patient','doctor','hospital','lab','insurance','admin']
def avg(d,r):
    v=[x['score'] for x in d if x['role']==r]; return sum(v)/len(v)
bv=[avg(b,r) for r in roles]; av=[avg(a,r) for r in roles]
fig,ax=plt.subplots(figsize=(3.45,1.9)); fig.subplots_adjust(left=0.1,right=0.98,top=0.82,bottom=0.16)
x=np.arange(len(roles)); w=0.38
ax.bar(x-w/2,bv,w*0.92,color=ORANGE,hatch='////',edgecolor='white',lw=0.4,label='Before plain-language pass')
ax.bar(x+w/2,av,w*0.92,color=BLUE,edgecolor='white',lw=0.4,label='After')
for xi,v in zip(x-w/2,bv): ax.text(xi,v+0.15,f'{v:.1f}',ha='center',fontsize=5.2,color=INK)
for xi,v in zip(x+w/2,av): ax.text(xi,v+0.15,f'{v:.1f}',ha='center',fontsize=5.2,color=INK)
ax.axhline(8,color=INK,lw=0.6,ls=(0,(3,2))); ax.text(-0.62,8.15,'target 8',fontsize=5.3,ha='left',va='bottom',color=INK)
ax.set_xticks(x); ax.set_xticklabels(['Public','Patient','Doctor','Hospital','Lab','Insurance','Admin']); ax.set_ylim(0,11.2)
ax.set_ylabel('Mean score / 10',fontsize=7); ax.tick_params(labelsize=6.2,length=2); ax.spines[['top','right']].set_visible(False)
ax.grid(axis='y',color='#e5e7eb',lw=0.5); ax.set_axisbelow(True)
ax.legend(fontsize=5.8,ncol=2,frameon=False,loc='lower left',bbox_to_anchor=(0,1.0))
fig.savefig(OUT+'fig8_audit.png',dpi=300); plt.close(fig)
print([round(v,2) for v in bv],[round(v,2) for v in av])
