import random, statistics, collections
exec(open('sim.py').read().split("# ---------- policies ----------")[0])   # reuse world model + act()

# ---------- 500-person network around Rama ----------
# tier: (size, base reply rate personalized, base reply rate generic blast, P(reply is useful), P(useful reply is an introducer))
TIERS = {
  'inner':  (15,  0.04, 0.01, 0.6, 0.7),   # ministers, chief of cabinet, advisers, party secretary
  'mid':    (110, 0.08, 0.03, 0.4, 0.4),   # MPs, deputy ministers, agency heads, mayors, ambassadors
  'outer':  (375, 0.14, 0.06, 0.25, 0.2),  # party staff, business allies, journalists, diaspora, academics
}

def net_state(s):
    s.update(sent=0, net_replies=0, useful=0, leads=0, blasted=False, batches=0,
             reputation='unknown', mocked=False, press=False, gossip=False)

def send_batch(s, r, n=10):        # personalized, 10 contacts per action
    s['batches'] += 1
    for _ in range(min(n, 500 - s['sent'])):
        tier = r.choices(list(TIERS), [t[0] for t in TIERS.values()])[0]
        size, p_pers, p_gen, p_use, p_intro = TIERS[tier]
        s['sent'] += 1
        p = p_pers * (1.4 if s['investor'] else 1.0) * (0.5 if s['reputation']=='spammer' else 1.0)
        if r.random() < p:
            _net_reply(s, r, tier, p_use, p_intro)
    _reputation(s, r)

def blast(s, r):                   # one generic email to all 500 in one action
    if s['blasted']: return
    s['blasted'] = True
    for tier,(size,p_pers,p_gen,p_use,p_intro) in TIERS.items():
        for _ in range(size):
            s['sent'] += 1
            if r.random() < p_gen * (1.3 if s['investor'] else 1.0):
                _net_reply(s, r, tier, p_use*0.6, p_intro)
    # a generic mass email to the whole political class gets noticed
    s['gossip'] = r.random() < 0.65
    if s['gossip']:
        s['reputation'] = 'spammer'; s['pm_flagged'] = True
        s['rama_seen'] += 1 if r.random() < 0.30 else 0      # "some guy in Vietnam emailed everyone"
        if r.random() < 0.06: s['mocked'] = True; s['rama_seen'] += 1   # public sarcastic post/story
        if r.random() < 0.08: s['press'] = True                        # Tirana media/portal item

def _net_reply(s, r, tier, p_use, p_intro):
    s['net_replies'] += 1; s['replies']['network_'+tier] += 1; _rep(s)
    if r.random() < p_use:
        s['useful'] += 1
        if r.random() < p_intro: s['introducer'] = True; s['cabinet_warm'] += 1
        else: s['leads'] += 1     # Albanian business wanting Vietnam sourcing / partner
        if tier == 'inner': s['cabinet_warm'] += 1
        if tier == 'mid': s['mfa_warm'] += 1; s['aida_warm'] += 1

def _reputation(s, r):
    # personalized batches are quieter, but 500 is still a lot of people who talk
    if s['sent'] >= 150 and not s['gossip'] and r.random() < 0.03:
        s['gossip'] = True
        s['reputation'] = 'the Vietnam guy'    # known, mildly amusing, not blocked
        if r.random() < 0.25: s['rama_seen'] += 1

def work_leads(s, r):              # convert Albanian business leads into a real Vietnam-Albania deal
    if s['leads'] > 0 and r.random() < 0.06 * min(s['leads'],5):
        if not s['investor']:
            s['investor'] = True; s['investor_quality'] = r.uniform(0.3, 0.8)   # a two-sided trade partner counts
        elif s['deal'] is None and r.random() < 0.15:
            s['deal'] = 'private trade deal (no gov)'; s['deal_step'] = s['step']

def act2(s, a, r):
    if a == 'send_batch': s['step'] += 1; s.setdefault('log',[]).append(a); send_batch(s, r)
    elif a == 'blast':    s['step'] += 1; s.setdefault('log',[]).append(a); blast(s, r)
    elif a == 'work_leads': s['step'] += 1; s.setdefault('log',[]).append(a); work_leads(s, r)
    else: act(s, a, r)

# ---------- policies ----------
def personalized(s, r):
    if s['sent'] < 500 and r.random() < 0.55: return 'send_batch'      # ~50 actions to cover 500
    return followup(s, r)

def blast_then_followup(s, r):
    if not s['blasted']: return 'blast'
    return followup(s, r)

def followup(s, r):
    if s['leads'] > 0 and r.random() < 0.25: return 'work_leads'
    if not s['investor']:
        return r.choices(['find_investor','seek_introducer','email_aida','email_mfa','email_pm','instagram_rama','linkedin_adviser'],[45,10,12,8,10,7,8])[0]
    if not s['aida_call']:
        return r.choices(['email_aida','email_pm','instagram_rama','email_mfa','find_investor'],[45,15,10,15,15])[0]
    if s['deal'] is None or s['deal'].startswith(('trade','private')):
        return r.choices(['pipeline','travel_tirana','email_mfa','propose_delegation','email_pm','find_investor','consul_application'],[45,8,12,12,8,10,5])[0]
    return r.choices(['pipeline','consul_application','email_mfa','find_investor'],[40,20,20,20])[0]

def baseline(s, r):   # last run's adaptive strategy, no network
    return followup(s, r)

def run2(policy, seed, runs=100, actions=100):
    r = random.Random(seed); out=[]
    for _ in range(runs):
        s = new_state(); net_state(s)
        for _ in range(actions): act2(s, policy(s, r), r)
        out.append(s)
    return out

def pct(xs, f): return round(100*sum(1 for x in xs if f(x))/len(xs))
def report2(name, R):
    print(f"\n=== {name} ===")
    rows = [
     ("Emails sent to the 500 (avg per run)", f"{statistics.mean(s['sent'] for s in R):.0f}"),
     ("Replies from the 500 (avg per run)", f"{statistics.mean(s['net_replies'] for s in R):.1f}"),
     ("Useful replies (avg per run)", f"{statistics.mean(s['useful'] for s in R):.1f}"),
     ("Found an introducer", f"{pct(R, lambda s: s['introducer'])}%"),
     ("Reply from an inner-circle person", f"{pct(R, lambda s: s['replies']['network_inner']>0)}%"),
     ("Reply from PM office or adviser", f"{pct(R, lambda s: s['replies']['pm_office']+s['replies']['adviser']>0)}%"),
     ("Reached chief of cabinet / adviser", f"{pct(R, lambda s: s['cabinet_seen']>0 or s['replies']['network_inner']>0)}%"),
     ("Rama personally saw something", f"{pct(R, lambda s: s['rama_seen']>0)}%"),
     ("Rama replied personally", f"{pct(R, lambda s: s['rama_reply']>0)}%"),
     ("Rama or media mocked the campaign publicly", f"{pct(R, lambda s: s['mocked'] or s['press'])}%"),
     ("Tirana gossip: 'the Vietnam guy'", f"{pct(R, lambda s: s['gossip'])}%"),
     ("Flagged as spam by PM office", f"{pct(R, lambda s: s['pm_flagged'])}%"),
     ("Secured a named investor/partner", f"{pct(R, lambda s: s['investor'] or s['deal'] is not None)}%"),
     ("AIDA call held", f"{pct(R, lambda s: s['aida_call'] or (s['deal'] or '').startswith('investment'))}%"),
     ("Ministry meeting held", f"{pct(R, lambda s: s['ministry_meeting'])}%"),
     ("Any deal or outcome", f"{pct(R, lambda s: s['deal'] is not None)}%"),
     ("  investment MoU / strategic investor", f"{pct(R, lambda s: s['deal']=='investment MoU / strategic investor')}%"),
     ("  trade delegation", f"{pct(R, lambda s: s['deal']=='trade delegation')}%"),
     ("  private Albania-Vietnam trade deal, no gov", f"{pct(R, lambda s: s['deal']=='private trade deal (no gov)')}%"),
     ("  honorary consul", f"{pct(R, lambda s: s['consul'])}%"),
    ]
    for k,v in rows: print(f"{k:46s} {v:>6}")
    fr=[s['first_reply_step'] for s in R if s['first_reply_step']]; ds=[s['deal_step'] for s in R if s['deal_step']]
    print(f"median action # of first reply: {statistics.median(fr) if fr else 'n/a'} | median action # of first deal: {statistics.median(ds) if ds else 'n/a'}")

report2("A. BASELINE: no network, adaptive (last run)", run2(baseline, 11))
report2("B. 500 contacts, ONE generic blast, then follow-up", run2(blast_then_followup, 11))
report2("C. 500 contacts, PERSONALIZED batches of 10 (~50 actions), then follow-up", run2(personalized, 11))

def personalized_fast(s, r):
    if s['sent'] < 500 and r.random() < 0.6:
        s['step'] += 1; s.setdefault('log',[]).append('send_batch25'); send_batch(s, r, n=25); return 'noop'
    return followup(s, r)
def act3(s,a,r):
    if a != 'noop': act2(s,a,r)
def run3(policy, seed, runs=100, actions=100):
    r = random.Random(seed); out=[]
    for _ in range(runs):
        s = new_state(); net_state(s); n=0
        while s['step'] < actions: act3(s, policy(s, r), r)
        out.append(s)
    return out
report2("D. 500 contacts, PERSONALIZED batches of 25 (~20 actions), then follow-up", run3(personalized_fast, 11))
