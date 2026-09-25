# Strategy search on a FIXED world (sim3 world + ministry fatigue + a 'wait' action).
# Anti-overfitting: every strategy is scored on 10 seeds x 100 runs; tuned on seeds 1-5, validated on seeds 6-10.
import random, statistics, collections, sys
src = open('sim3.py').read().split("def refined(s, r):")[0]
exec(src)

# --- world realism fix: ministries tire of emails that carry nothing new ---
_act4 = act4
def act4(s, a, r):
    s.setdefault('fatigue', collections.Counter())
    if a in ('email_mei','film_channel','email_aida','email_mfa'):
        f = s['fatigue'][a]
        # each email without a new fact (positioning, partner, tender, trip) lowers reply odds; a real event resets
        s['fatigue'][a] += 1
        if f >= 3 and r.random() < min(0.15*(f-2), 0.8):
            s['step'] += 1; s.setdefault('log',[]).append(a+'_ignored'); return
    if a == 'wait':
        s['step'] += 1; s.setdefault('log',[]).append(a)
        for k in list(s['fatigue']): s['fatigue'][k] = max(0, s['fatigue'][k]-1)
        return
    if a in ('travel_tirana','position') or (a=='propose_delegation' and s['investor'] and s['mfa_warm']>=3):
        s['fatigue'] = collections.Counter()   # only a real event brings new substance
    _act4(s, a, r)

# --- strategies (only Lorenc's behaviour varies) ---
def S_baseline(s, r):                     # sim3 'refined'
    if not s['positioned']: return 'position'
    if s['step'] < 40:
        return r.choices(['email_mei','film_channel','diaspora','email_aida','email_mfa','find_investor','email_pm','symsy','linkedin_adviser'],[25,20,12,10,8,10,5,5,5])[0]
    if s['deal'] is None:
        return r.choices(['email_mei','film_channel','pipeline','travel_tirana','diaspora','email_pm','symsy','propose_delegation','find_investor'],[20,18,15,8,8,6,5,10,10])[0]
    return r.choices(['pipeline','film_channel','email_mei','consul_application','travel_tirana','symsy','propose_delegation'],[25,15,15,15,10,5,15])[0]

def S_labour_first(s, r):                 # ride the July 2026 labour MoU, film later
    if not s['positioned']: return 'position'
    if not s['labour_partner']:
        return r.choices(['email_mei','diaspora','wait','email_aida','symsy','travel_tirana'],[45,15,20,8,4,8])[0]
    if s['deal'] is None:
        return r.choices(['email_mei','propose_delegation','film_channel','travel_tirana','wait','symsy'],[30,20,20,10,15,5])[0]
    return r.choices(['film_channel','pipeline','consul_application','propose_delegation','wait'],[30,20,20,15,15])[0]

def S_film_first(s, r):                   # lead with the industry he's actually in
    if not s['positioned']: return 'position'
    if not s['tender']:
        return r.choices(['film_channel','diaspora','wait','email_mei','symsy','travel_tirana'],[45,12,20,10,5,8])[0]
    return r.choices(['film_channel','email_mei','propose_delegation','travel_tirana','wait','consul_application','symsy'],[25,20,15,10,15,10,5])[0]

def S_two_track_paced(s, r):              # both ministries, but rhythm: 2 emails then a pause; trips at ~15 and ~55
    if not s['positioned']: return 'position'
    if s['step'] in (15, 55): return 'travel_tirana'
    if s['step'] % 3 == 0: return r.choices(['wait','diaspora','find_investor'],[60,25,15])[0]
    pool = ['email_mei','film_channel','email_aida','symsy','propose_delegation','pipeline','consul_application']
    w    = [30,30,8,4,10,10,8] if s['deal'] is None else [20,25,5,4,15,15,16]
    return r.choices(pool, w)[0]

def S_introducer_first(s, r):             # spend the first stretch only on diaspora/introducers, then ministries with a name behind you
    if not s['positioned']: return 'position'
    if not s['introducer'] and s['step'] < 35:
        return r.choices(['diaspora','wait','linkedin_adviser','find_investor'],[60,20,10,10])[0]
    return S_two_track_paced(s, r)

def S_rama_heavy(s, r):                   # control: keep aiming at the top
    if not s['positioned']: return 'position'
    return r.choices(['email_pm','symsy','instagram_rama','linkedin_adviser','email_mei','film_channel','wait'],[25,20,15,10,12,10,8])[0]

def S_in_person(s, r):                    # fly to Tirana often (expensive), emails only to set meetings
    if not s['positioned']: return 'position'
    if s['step'] % 12 == 6: return 'travel_tirana'
    return r.choices(['email_mei','film_channel','diaspora','wait','propose_delegation','pipeline','consul_application','symsy'],[25,25,10,15,10,8,4,3])[0]

STRATS = {'baseline':S_baseline,'labour_first':S_labour_first,'film_first':S_film_first,'two_track_paced':S_two_track_paced,
          'introducer_first':S_introducer_first,'rama_heavy':S_rama_heavy,'in_person':S_in_person}

def score(policy, seed, runs=100, actions=100):
    r = random.Random(seed); R=[]
    for _ in range(runs):
        s = new_state(); refined_state(s)
        for _ in range(actions): act4(s, policy(s, r), r)
        R.append(s)
    f = lambda g: 100*sum(1 for s in R if g(s))/len(R)
    return dict(deal=f(lambda s: s['deal'] is not None), labour=f(lambda s: s['labour_partner']), tender=f(lambda s: s['tender']),
                contract=f(lambda s: s['tender_won']), forum=f(lambda s: s['forum_seat']), rama=f(lambda s: s['rama_reply']>0),
                spam=f(lambda s: s['pm_flagged']), trips=statistics.mean(s['travel_tirana'] for s in R),
                ignored=statistics.mean(sum(1 for a in s['log'] if a.endswith('_ignored')) for s in R))

def agg(policy, seeds):
    rows=[score(policy, sd) for sd in seeds]
    return {k:(statistics.mean(x[k] for x in rows), statistics.pstdev(x[k] for x in rows)) for k in rows[0]}

TUNE=[1,2,3,4,5]; VALID=[6,7,8,9,10]
print(f"{'strategy':18s} {'deal% tune':>11s} {'deal% valid':>12s} {'labour%':>8s} {'tender%':>8s} {'forum%':>7s} {'contract%':>10s} {'rama%':>6s} {'spam%':>6s} {'trips':>6s} {'ignored':>8s}")
res={}
for name,p in STRATS.items():
    t=agg(p,TUNE); v=agg(p,VALID); res[name]=(t,v)
    print(f"{name:18s} {t['deal'][0]:5.1f}±{t['deal'][1]:3.1f}  {v['deal'][0]:5.1f}±{v['deal'][1]:3.1f}  {v['labour'][0]:6.1f} {v['tender'][0]:8.1f} {v['forum'][0]:7.1f} {v['contract'][0]:10.1f} {v['rama'][0]:6.1f} {v['spam'][0]:6.1f} {v['trips'][0]:6.1f} {v['ignored'][0]:8.1f}")
