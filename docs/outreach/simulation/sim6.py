import random, statistics, json, sys
exec(open('sim5.py').read().split("TUNE=[1,2,3]")[0])
TUNE=[1,2,3,4,5]; VALID=[6,7,8,9,10]; TEST=list(range(11,21))
rng = random.Random(7)
Z=[0]*15
def mk(**kw):
    w=Z[:]
    for k,v in kw.items(): w[ACTIONS.index(k)]=v
    return w
STARTS = {
 'baseline':   [mk(email_mei=25,film_channel=20,diaspora=12,email_aida=10,email_mfa=8,find_investor=10,email_pm=5,symsy=5,linkedin_adviser=5),
                mk(email_mei=20,film_channel=18,diaspora=8,email_aida=4,email_mfa=4,find_investor=10,email_pm=6,symsy=5,travel_tirana=8,propose_delegation=10,pipeline=15),
                mk(email_mei=15,film_channel=15,diaspora=4,email_mfa=4,symsy=5,travel_tirana=10,propose_delegation=15,pipeline=25,consul_application=15)],
 'labour_first':[mk(email_mei=45,diaspora=15,wait=20,email_aida=8,symsy=4,travel_tirana=8),
                mk(email_mei=30,propose_delegation=20,film_channel=20,travel_tirana=10,wait=15,symsy=5),
                mk(film_channel=30,pipeline=20,consul_application=20,propose_delegation=15,wait=15)],
 'film_first': [mk(film_channel=45,diaspora=12,wait=20,email_mei=10,symsy=5,travel_tirana=8),
                mk(film_channel=25,email_mei=20,propose_delegation=15,travel_tirana=10,wait=15,consul_application=10,symsy=5),
                mk(film_channel=25,email_mei=20,propose_delegation=15,travel_tirana=10,wait=15,consul_application=10,symsy=5)],
 'in_person':  [mk(email_mei=25,film_channel=25,diaspora=10,wait=15,propose_delegation=10,pipeline=8,consul_application=4,symsy=3,travel_tirana=8),
                mk(email_mei=25,film_channel=25,diaspora=10,wait=15,propose_delegation=10,pipeline=8,consul_application=4,symsy=3,travel_tirana=8),
                mk(email_mei=25,film_channel=25,diaspora=10,wait=15,propose_delegation=10,pipeline=8,consul_application=4,symsy=3,travel_tirana=8)],
}
GENS=int(sys.argv[1]) if len(sys.argv)>1 else 40
overall=None
for name, W0 in STARTS.items():
    best=[w[:] for w in W0]; bobj,bst=evaluate(best,TUNE)
    print(f"\n--- restart from {name}: tune deal {bst['deal']:.1f} trips {bst['trips']:.1f}")
    stale=0
    for g in range(1,GENS+1):
        kids=[]
        for _ in range(6):
            W=[w[:] for w in best]
            for _ in range(rng.choice([1,2,3,4])):
                ph=rng.randrange(3); i=rng.randrange(15)
                mv=rng.random()
                if mv<0.15: W[ph][i]=0
                elif mv<0.3: W[ph][i]+=rng.choice([12,16,20])
                else: W[ph][i]=max(0,W[ph][i]+rng.choice([-8,-4,-2,2,4,8]))
            if min(sum(w) for w in W)==0: continue
            kids.append((evaluate(W,TUNE),W))
        kids.sort(key=lambda k:-k[0][0]); (obj,st),W=kids[0]
        if obj>bobj+0.3:
            best,bobj,bst=W,obj,st; stale=0
            vobj,vst=evaluate(best,VALID)
            print(f"gen {g:3d} tune deal {bst['deal']:5.1f} | valid deal {vst['deal']:5.1f} | trips {bst['trips']:.1f} spam {bst['spam']:.0f} labour {bst['labour']:.0f} tender {bst['tender']:.0f}")
        else:
            stale+=1
            if stale>=12: print(f"  (converged at gen {g})"); break
    vobj,vst=evaluate(best,VALID)
    if overall is None or vobj>overall[0]: overall=(vobj,name,best,bst,vst)
vobj,name,best,bst,vst=overall
print(f"\n=== WINNER (chosen by VALIDATION, not tuning): restart '{name}' ===")
tobj,tst=evaluate(best,TEST)
print(f"tune deal {bst['deal']:.1f} | valid deal {vst['deal']:.1f} | TEST deal {tst['deal']:.1f} (10 fresh seeds)")
for k in ['labour','tender','forum','contract','rama','spam','trips','ignored']: print(f"  {k:9s} {tst[k]:6.1f}")
print("\nbest weights (per phase, normalised %):")
for ph,nm in enumerate(['phase 1: nothing yet','phase 2: first hook exists','phase 3: a deal exists']):
    tot=sum(best[ph]); print(f"  {nm}: " + ", ".join(f"{a}={100*w/tot:.0f}" for a,w in sorted(zip(ACTIONS,best[ph]),key=lambda x:-x[1]) if w>0))
json.dump(dict(actions=ACTIONS,weights=best,start=name,tune=bst,valid=vst,test=tst),open('best_strategy.json','w'),indent=1)
