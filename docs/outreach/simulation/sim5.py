# Iterative optimisation of Lorenc's strategy on the fixed sim4 world.
# Strategy = action weights in 3 phases: (1) nothing yet, (2) a first hook exists (labour partner or tender invite), (3) a deal exists.
# Objective = deal% on TUNING seeds minus a trip cost penalty. Every accepted candidate is re-scored on HELD-OUT seeds.
import random, statistics, collections, json, sys
src = open("sim4.py").read().split("TUNE=[1,2,3,4,5]")[0]
exec(src)

ACTIONS = ['email_mei','film_channel','diaspora','email_aida','email_mfa','find_investor','email_pm','symsy',
           'linkedin_adviser','wait','travel_tirana','propose_delegation','pipeline','consul_application','instagram_rama']
def phase(s):
    if s['deal'] is not None: return 2
    if s['labour_partner'] or s['tender']: return 1
    return 0
def make_policy(W):
    def pol(s, r):
        if not s['positioned']: return 'position'
        return r.choices(ACTIONS, W[phase(s)])[0]
    return pol

def evaluate(W, seeds, runs=100):
    p = make_policy(W); out=[]
    for sd in seeds:
        sc = score(p, sd, runs=runs)
        out.append(sc)
    m = lambda k: statistics.mean(x[k] for x in out)
    deal, trips, spam = m('deal'), m('trips'), m('spam')
    obj = deal - 2.0*max(0.0, trips-4) - 0.05*spam       # each trip beyond 4/year costs ~2 pts; being blacklisted costs a little
    return obj, dict(deal=deal, trips=trips, spam=spam, labour=m('labour'), tender=m('tender'), forum=m('forum'),
                     contract=m('contract'), rama=m('rama'), ignored=m('ignored'))

TUNE=[1,2,3]; VALID=[6,7,8,9,10]; TEST=[11,12,13,14,15,16,17,18,19,20]
rng = random.Random(2026)
# start from the hand-written 'baseline' mix
W0 = [[25,20,12,10,8,10,5,5,5,0,0,0,0,0,0],[20,18,8,4,4,10,6,5,2,0,8,10,15,0,0],[15,15,4,2,4,4,4,5,2,0,10,15,25,15,0]]
best = [w[:] for w in W0]; best_obj, best_stats = evaluate(best, TUNE)
hist=[]
print(f"gen   0  tune obj {best_obj:5.1f}  deal {best_stats['deal']:5.1f}  trips {best_stats['trips']:.1f}")
GENS=int(sys.argv[1]) if len(sys.argv)>1 else 60
for g in range(1, GENS+1):
    kids=[]
    for _ in range(4):
        W=[w[:] for w in best]
        for _ in range(rng.choice([1,2,3])):
            ph=rng.randrange(3); i=rng.randrange(len(ACTIONS))
            W[ph][i]=max(0, W[ph][i]+rng.choice([-8,-4,-2,2,4,8]))
        if sum(W[0])==0 or sum(W[1])==0 or sum(W[2])==0: continue
        kids.append((evaluate(W, TUNE), W))
    kids.sort(key=lambda k:-k[0][0])
    (obj, st), W = kids[0]
    if obj > best_obj:
        best, best_obj, best_stats = W, obj, st
        vobj, vst = evaluate(best, VALID)
        hist.append((g, best_obj, best_stats['deal'], vst['deal'], best_stats['trips']))
        print(f"gen {g:3d}  tune obj {best_obj:5.1f}  deal {best_stats['deal']:5.1f} | valid deal {vst['deal']:5.1f}  trips {best_stats['trips']:.1f}  spam {best_stats['spam']:.0f}")
print("\n=== FINAL on fresh TEST seeds (never used) ===")
tobj, tst = evaluate(best, TEST)
for k,v in tst.items(): print(f"{k:10s} {v:6.1f}")
print("\nbest weights (per phase, normalised %):")
for ph,name in enumerate(['phase 1: nothing yet','phase 2: first hook exists','phase 3: a deal exists']):
    tot=sum(best[ph]); print(f"  {name}: " + ", ".join(f"{a}={100*w/tot:.0f}" for a,w in zip(ACTIONS,best[ph]) if w>0))
json.dump(dict(actions=ACTIONS, weights=best, test=tst, history=hist), open('best_strategy.json','w'), indent=1)
