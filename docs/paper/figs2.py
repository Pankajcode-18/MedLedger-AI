"""Evaluation charts for the 8-page version (reads docs/evaluation/results/*.json)."""
import json, os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap
plt.rcParams.update({'font.family':'serif','font.serif':['Liberation Serif','TeX Gyre Termes','Times New Roman'],'font.size':7,'axes.linewidth':0.6,'hatch.linewidth':0.5})
OUT='/tmp/claude-0/paper/fig/'
R='/home/claude/proj/docs/evaluation/results/'
INK='#0b1220'; MUTED='#475569'; BLUE='#2a78d6'; ORANGE='#eb6834'; AQUA='#1baf7a'; GRID='#e5e7eb'
def tidy(ax,grid='y'):
    ax.spines[['top','right']].set_visible(False); ax.tick_params(labelsize=6.2,length=2)
    if grid: ax.grid(axis=grid,color=GRID,lw=0.5); ax.set_axisbelow(True)

sec=json.load(open(R+'security_eval.json')); ai=json.load(open(R+'ai_eval.json')); acc=json.load(open(R+'access_eval.json'))

# ---------- tamper detection by layer (single column) ----------
order=['Ciphertext bit flip','Ciphertext truncation','IV modified','Auth tag modified','File swapped from other record','Record moved to other patient','Wrapped key modified','Key swapped from other record','Fingerprint in metadata edited','Blob edited, checksum not updated']
layers=[('checksum','Stored checksum',MUTED,'....'),('key-unwrap','Key unwrap (AAD)',ORANGE,'////'),('gcm-tag','GCM tag',BLUE,''),('fingerprint','SHA-256 fingerprint',AQUA,'\\\\\\\\')]
fig,ax=plt.subplots(figsize=(3.45,2.35)); fig.subplots_adjust(left=0.43,right=0.97,top=0.86,bottom=0.12)
y=np.arange(len(order))[::-1]
for yi,name in zip(y,order):
    row=sec['tamper'][name]; left=0
    for k,lab,c,h in layers:
        v=100*row['layers'].get(k,0)/row['trials']
        if v: ax.barh(yi,v,left=left,height=0.62,color=c,hatch=h,edgecolor='white',lw=0.4); left+=v
    ax.text(101,yi,f"{row['detected']}/{row['trials']}",va='center',fontsize=5.6,color=INK)
ax.set_yticks(y); ax.set_yticklabels(order,fontsize=6); ax.set_xlim(0,118); ax.set_xticks([0,25,50,75,100])
ax.set_xlabel('Tampered records rejected (%)',fontsize=6.6); tidy(ax,'x')
from matplotlib.patches import Patch
ax.legend(handles=[Patch(fc=c,hatch=h,ec='white',label=l) for k,l,c,h in layers],fontsize=5.6,ncol=2,frameon=False,loc='lower left',bbox_to_anchor=(-0.62,1.0))
fig.savefig(OUT+'fig_tamper.png',dpi=300); plt.close(fig)

# ---------- de-identification without the registered name: before / after Phase 9 (single column) ----------
aib=json.load(open(R+'ai_eval_before_phase9.json')); aih=json.load(open(R+'ai_eval_hard_888001.json')); aihb=json.load(open(R+'ai_eval_hard_888001_before_phase9.json'))
un=json.load(open(R+'names_unseen.json')); unb=json.load(open(R+'names_unseen_before_fixes.json'))
nr=lambda d: 100*d['deidentification']['withoutRegisteredName']['recall']
groups=[('Standard set\n(11,233 details)',nr(aib),nr(ai)),('Hard set: relatives,\nDevanagari (14,079)',nr(aihb),nr(aih)),('Unseen phrasings,\nnames only (38)',100*unb['setB_heldOut']['recall'],100*un['setB_heldOut']['recall'])]
fig,ax=plt.subplots(figsize=(3.45,1.75)); fig.subplots_adjust(left=0.15,right=0.99,top=0.84,bottom=0.22)
x=np.arange(len(groups)); w=0.36
ax.bar(x-w/2,[g[1] for g in groups],w*0.92,color=ORANGE,hatch='////',edgecolor='white',lw=0.4,label='Labels and patterns only')
ax.bar(x+w/2,[g[2] for g in groups],w*0.92,color=BLUE,edgecolor='white',lw=0.4,label='+ names from the document, cues, name list')
for xi,g in zip(x,groups):
    ax.text(xi-w/2,g[1]+2,f'{g[1]:.1f}',ha='center',fontsize=5.4); ax.text(xi+w/2,g[2]+2,f'{g[2]:.1f}',ha='center',fontsize=5.4)
ax.set_xticks(x); ax.set_xticklabels([g[0] for g in groups],fontsize=5.8); ax.set_ylim(0,112); ax.set_yticks([0,25,50,75,100])
ax.set_ylabel('Recall without\nregistered name (%)',fontsize=6.2); tidy(ax)
ax.legend(fontsize=5.5,ncol=2,frameon=False,loc='lower left',bbox_to_anchor=(-0.02,1.0),columnspacing=0.8,handlelength=1.2)
fig.savefig(OUT+'fig_deid.png',dpi=300); plt.close(fig)

# ---------- load test after Phase 8: throughput and p95 (single column) ----------
la=json.load(open(R+'load_after_phase8.json'))['results']; lb=json.load(open(R+'load_before_phase8.json'))['results']
ops=[(la,'list (doctor, page of 25)','Doctor list, page of 25',BLUE,'o','-'),(la,'record check','Record check',AQUA,'s','--'),(la,'upload 100 KB','Upload 100 KB',ORANGE,'^',':'),(lb,'list (doctor, page of 25)','Doctor list, before',MUTED,'x','-.')]
fig,axs=plt.subplots(1,2,figsize=(3.45,1.75)); fig.subplots_adjust(left=0.12,right=0.99,top=0.7,bottom=0.2,wspace=0.42)
for data,op,l,c,m,ls in ops:
    rows=[r for r in data if r['scenario']==op]; cx=[r['concurrency'] for r in rows]
    axs[0].plot(cx,[r['throughput'] for r in rows],color=c,marker=m,ms=3.2,lw=1.1,ls=ls,label=l)
    axs[1].plot(cx,[r['p95'] for r in rows],color=c,marker=m,ms=3.2,lw=1.1,ls=ls)
axs[0].set_ylabel('Requests / s',fontsize=6); axs[1].set_ylabel('p95 (ms, log)',fontsize=6); axs[1].set_yscale('log')
for ax,t in zip(axs,['(a) Throughput','(b) 95th-percentile latency']):
    ax.set_xscale('log'); ax.set_xticks([1,5,10,25,50,100]); ax.set_xticklabels(['1','5','10','25','50','100']); ax.minorticks_off()
    ax.set_xlabel('Concurrent clients',fontsize=6); ax.set_title(t,fontsize=6.3,loc='left'); tidy(ax,'both')
axs[1].set_yticks([1,10,100,1000]); axs[1].set_yticklabels(['1','10','100','1000'])
axs[0].legend(fontsize=5.4,ncol=2,frameon=False,loc='lower left',bbox_to_anchor=(-0.3,1.12))
fig.savefig(OUT+'fig_load.png',dpi=300); plt.close(fig)

# ---------- gas comparison (single column; Phase 10: before/after and batches) ----------
g=json.load(open(R+'gas_eval.json')); gb,ga=g['before'],g['after']
rows=[('registerRecordFor (relayer)',gb['registerRecordFor_median'],ga['registerRecordFor_median'],BLUE),
      ('registerRecord (patient wallet)',gb['registerRecord_ownWallet'],ga['registerRecord_ownWallet'],BLUE),
      ('Record in a batch of 10',None,ga['anchorBatch']['10']['perRecord'],BLUE),
      ('Record in a batch of 50',None,ga['anchorBatch']['50']['perRecord'],BLUE),
      ('grantAccessFor (relayer)',None,ga['grantAccessFor'],AQUA),
      ('revokeAccessFor (relayer)',None,ga['revokeAccessFor'],AQUA),
      ('Grant in Romel et al. [17]',None,78000,ORANGE)]
fig,ax=plt.subplots(figsize=(3.45,1.9)); fig.subplots_adjust(left=0.42,right=0.95,top=0.89,bottom=0.18)
y=np.arange(len(rows))[::-1]
for yi,(l,before,after,c) in zip(y,rows):
    if before:
        ax.barh(yi+0.17,before/1000,height=0.34,color='#cbd5e1',hatch='////',edgecolor='white',lw=0.4)
        ax.text(before/1000+2,yi+0.17,f'{before/1000:.1f}k',va='center',fontsize=5.4,color=MUTED)
        ax.barh(yi-0.17,after/1000,height=0.34,color=c,edgecolor='white',lw=0.4)
        ax.text(after/1000+2,yi-0.17,f'{after/1000:.1f}k',va='center',fontsize=5.4)
    else:
        ax.barh(yi,after/1000,height=0.55,color=c,hatch='....' if c==ORANGE else '',edgecolor='white',lw=0.4)
        ax.text(after/1000+2,yi,f'{after/1000:.1f}k',va='center',fontsize=5.4)
ax.set_yticks(y); ax.set_yticklabels([r[0] for r in rows],fontsize=6); ax.set_xlim(0,150)
from matplotlib.patches import Patch
ax.legend(handles=[Patch(facecolor='#cbd5e1',hatch='////',edgecolor='white',label='Before (per-patient array)'),Patch(facecolor=BLUE,label='After (one packed slot)')],fontsize=5.4,frameon=False,loc='lower left',bbox_to_anchor=(-0.02,0.99),ncol=2,handlelength=1.2,columnspacing=0.8)
ax.set_xlabel('Gas used (thousands)',fontsize=6.6); tidy(ax,'x')
fig.savefig(OUT+'fig_gas.png',dpi=300); plt.close(fig)

# ---------- access matrix heatmap (single column) ----------
actors=['Owner patient','Other patient','Doctor, no consent','Doctor, consent granted','Doctor, consent revoked','Laboratory','Insurance, no claim','Administrator','Not signed in']
acts=['See record in list','Download record','Verify record','Add record for patient','Grant access to a doctor','View audit log (all)','Manage user accounts','Read record history','Lab triage (AI)']
actlab=['See in list','Download','Verify','Add to record','Grant a doctor','Full audit log','Manage users','Record history','Lab triage (AI)']
M=np.array([[1 if acc['matrix'][a][c]['observed']=='A' else 0 for c in acts] for a in actors])
fig,ax=plt.subplots(figsize=(3.45,2.75)); fig.subplots_adjust(left=0.3,right=0.92,top=0.76,bottom=0.02)
ax.imshow(M,cmap=ListedColormap(['#f3f4f6','#2a78d6']),aspect='auto',vmin=0,vmax=1)
for i,a in enumerate(actors):
    for j,c in enumerate(acts):
        cell=acc['matrix'][a][c]; st=str(cell['status']); A=cell['observed']=='A'
        ax.text(j,i,'–' if st=='n/a' else st,ha='center',va='center',fontsize=5.6,color='white' if A else MUTED,fontweight='bold' if A else 'normal')
ax.set_xticks(range(len(acts))); ax.set_xticklabels(actlab,fontsize=5.8,rotation=50,ha='left',rotation_mode='anchor'); ax.xaxis.tick_top()
ax.set_yticks(range(len(actors))); ax.set_yticklabels(actors,fontsize=6)
ax.set_xticks(np.arange(-.5,len(acts),1),minor=True); ax.set_yticks(np.arange(-.5,len(actors),1),minor=True)
ax.grid(which='minor',color='white',lw=1.5); ax.tick_params(which='both',length=0)
for sp in ax.spines.values(): sp.set_visible(False)
fig.savefig(OUT+'fig_access.png',dpi=300); plt.close(fig)

# ---------- encryption throughput (single column) ----------
p=sec['perf']; xs=np.arange(len(p)); w=0.27
fig,ax=plt.subplots(figsize=(3.45,1.7)); fig.subplots_adjust(left=0.12,right=0.99,top=0.8,bottom=0.12)
for k,(key,l,c,h) in enumerate([('sealMs','Seal (key + AES-GCM + wrap)',BLUE,''),('openMs','Open (unwrap + verify + hash)',AQUA,'////'),('sha256Ms','SHA-256 only',MUTED,'....')]):
    v=[r[key] for r in p]; ax.bar(xs+(k-1)*w,v,w*0.92,color=c,hatch=h,edgecolor='white',lw=0.4,label=l)
    for xi,vv in zip(xs+(k-1)*w,v): ax.text(xi,vv*1.12,f'{vv:.1f}' if vv<10 else f'{vv:.0f}',ha='center',fontsize=5)
ax.set_yscale('log'); ax.set_ylim(0.1,300); ax.set_xticks(xs); ax.set_xticklabels([f"{r['sizeMB']:g} MB" for r in p])
ax.set_yticks([0.1,1,10,100]); ax.set_yticklabels(['0.1','1','10','100']); ax.minorticks_off()
ax.set_ylabel('Median time (ms, log)',fontsize=6.6); tidy(ax)
ax.legend(fontsize=5.6,ncol=2,frameon=False,loc='lower left',bbox_to_anchor=(0,1.0))
fig.savefig(OUT+'fig_crypto.png',dpi=300); plt.close(fig)

# ---------- AI accuracy: digital text vs scans and photos (single column) ----------
o=json.load(open(R+'set_737373/ocr_eval_after.json')); od={(r['set'],r['kind'],r['withRegisteredName']):r['recall'] for r in json.load(open(R+'ocr_deid_phase9.json'))}
e=ai['extraction']['original']; eh=aih['extraction']['original']
conds=[('Digital\n(N=1000)',e['valueRecall'],e['abnormal']['f1'],ai['deidentification']['withRegisteredName']['recall']),
       ('Digital, hard\n(N=1000)',eh['valueRecall'],eh['abnormal']['f1'],aih['deidentification']['withRegisteredName']['recall'])]
for k,l in [('clean','Clean scan'),('moderate','Phone photo'),('degraded','Degraded\nphoto')]:
    conds.append((l+'\n(N=60)' if k!='degraded' else l+' (N=60)',o[k]['valueRecall'],o[k]['abnormalF1'],od[('set_737373',k,True)]))
mets=[('Value recall',BLUE,''),('Abnormal-value F1',AQUA,'////'),('De-identification recall',ORANGE,'....')]
fig,ax=plt.subplots(figsize=(3.45,1.85)); fig.subplots_adjust(left=0.11,right=0.99,top=0.84,bottom=0.22)
xs=np.arange(len(conds)); w=0.26
for k,(l,c,h) in enumerate(mets):
    v=[100*cd[k+1] for cd in conds]; ax.bar(xs+(k-1)*w,v,w*0.92,color=c,hatch=h,edgecolor='white',lw=0.4,label=l)
    for xi,vv in zip(xs+(k-1)*w,v): ax.text(xi,vv+1.2,f'{vv:.0f}',ha='center',fontsize=4.6)
ax.set_xticks(xs); ax.set_xticklabels([c[0] for c in conds],fontsize=5.5); ax.set_ylim(0,112); ax.set_yticks([0,25,50,75,100])
ax.set_ylabel('Score (%)',fontsize=6.6); tidy(ax)
ax.legend(fontsize=5.5,ncol=3,frameon=False,loc='lower left',bbox_to_anchor=(-0.02,1.0),columnspacing=0.8,handlelength=1.2)
fig.savefig(OUT+'fig_ai_ocr.png',dpi=300); plt.close(fig)
print('ok')
