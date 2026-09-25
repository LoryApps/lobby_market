# 200 live runs in 4 blocks of 50; after every block, optimise the strategy (accept only if held-out validation improves).
import random, statistics, json
exec(open('sim6.py').read().split("GENS=int(")[0])
VALID=[6,7,8,9,10]; TEST=list(range(11,21))

def play_block(W, seed, n=50):
    r=random.Random(seed); R=[]
    p=make_policy(W)
    for _ in range(n):
        s=new_state(); refined_state(s)
        for _ in range(100): act4(s, p(s,r), r)
        R.append(s)
    f=lambda g: 100*sum(1 for s in R if g(s))/len(R)
    return dict(deal=f(lambda s:s['deal'] is not None), labour=f(lambda s:s['labour_partner']), forum=f(lambda s:s['forum_seat']),
                tender=f(lambda s:s['tender']), rama=f(lambda s:s['rama_reply']>0), spam=f(lambda s:s['pm_flagged']),
                trips=statistics.mean(s['travel_tirana'] for s in R))

def optimise(W, tune_seeds, gens=20, rng=None):
    best=[w[:] for w in W]; bobj,_=evaluate(best,tune_seeds); vbest,_=evaluate(best,VALID); changes=0
    for g in range(gens):
        kids=[]
        for _ in range(6):
            C=[w[:] for w in best]
            for _ in range(rng.choice([1,2,3,4])):
                ph=rng.randrange(3); i=rng.randrange(15); mv=rng.random()
                if mv<0.15: C[ph][i]=0
                elif mv<0.3: C[ph][i]+=rng.choice([12,16,20])
                else: C[ph][i]=max(0,C[ph][i]+rng.choice([-8,-4,-2,2,4,8]))
            if min(sum(w) for w in C)==0: continue
            kids.append((evaluate(C,tune_seeds)[0],C))
        kids.sort(key=lambda k:-k[0]); obj,C=kids[0]
        if obj>bobj+0.3:
            vobj,_=evaluate(C,VALID)
            if vobj>vbest:                       # anti-overfit gate: must also improve on held-out seeds
                best,bobj,vbest=C,obj,vobj; changes+=1
    return best, changes

def describe(W):
    out=[]
    for ph,nm in enumerate(['P1','P2','P3']):
        tot=sum(W[ph]); top=sorted(zip(ACTIONS,W[ph]),key=lambda x:-x[1])[:4]
        out.append(nm+": "+", ".join(f"{a} {100*w/tot:.0f}%" for a,w in top if w>0))
    return " | ".join(out)

rng=random.Random(99)
W=[w[:] for w in STARTS['baseline']]
print(f"start: {describe(W)}")
log=[]
for b in range(4):
    live=play_block(W, seed=500+b)
    _,test=evaluate(W,TEST)
    print(f"\nBLOCK {b+1} (runs {50*b+1}-{50*b+50}) with strategy v{b}:")
    print(f"  live 50 runs: deals {live['deal']:.0f}%  labour {live['labour']:.0f}%  forum {live['forum']:.0f}%  rama {live['rama']:.0f}%  spam {live['spam']:.0f}%  trips {live['trips']:.1f}")
    print(f"  same strategy on 1000 held-out runs: deals {test['deal']:.1f}%")
    log.append(dict(block=b+1, live=live, test=test['deal'], strategy=describe(W)))
    if b<3:
        W,ch=optimise(W, tune_seeds=[1000+10*b+k for k in range(5)], gens=20, rng=rng)
        print(f"  -> optimised after block {b+1}: {ch} accepted changes")
        print(f"     v{b+1}: {describe(W)}")
_,final=evaluate(W,TEST)
print(f"\nFINAL strategy v3 on 1000 held-out runs: deals {final['deal']:.1f}%  labour {final['labour']:.0f}%  forum {final['forum']:.0f}%  tender {final['tender']:.0f}%  rama {final['rama']:.0f}%  trips {final['trips']:.1f}")
json.dump(dict(log=log, final_weights=W, final_test=final, actions=ACTIONS), open('online_200.json','w'), indent=1)
