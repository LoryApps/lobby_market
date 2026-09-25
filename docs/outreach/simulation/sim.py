import random, statistics, collections

# ---------- world model ----------
# Each action is ~1 per 4 days; 100 actions ~ 13 months.

def new_state():
    return dict(
        step=0, investor=False, investor_quality=0.0, introducer=False,
        pm_emails=0, pm_flagged=False, pm_recent=[],      # spam fatigue
        aida_warm=0, mfa_warm=0, cabinet_warm=0, rama_attention=0,
        triage_reads=0, forwarded=0, cabinet_seen=0, rama_seen=0,
        replies=collections.Counter(), rama_reply=0,
        aida_call=False, ministry_meeting=False, due_diligence=False,
        deal=None, deal_step=None, first_reply_step=None,
        consul_track=0, consul=False, delegation=False,
        travel_tirana=0, wasted=0,
    )

def clamp(x, lo=0.0, hi=1.0): return max(lo, min(hi, x))

def act(s, a, r):
    s['step'] += 1
    s.setdefault('log',[]).append(a)
    # rolling spam window: >3 PM emails in last 10 actions => flagged
    s['pm_recent'] = [t for t in s['pm_recent'] if s['step'] - t <= 10]

    if a in ('email_pm', 'followup_pm'):
        s['pm_emails'] += 1; s['pm_recent'].append(s['step'])
        if len(s['pm_recent']) > 3: s['pm_flagged'] = True
        p_open = 0.45 if a == 'email_pm' else 0.55
        if s['pm_flagged']: p_open *= 0.3
        if s['introducer']: p_open = 0.85
        if r.random() < p_open:
            s['triage_reads'] += 1
            # substance matters: investor named?
            p_fwd = 0.12 + (0.30 if s['investor'] else 0) + (0.25 if s['introducer'] else 0)
            if r.random() < p_fwd:
                s['forwarded'] += 1; s['aida_warm'] += 1; s['mfa_warm'] += 1
                if r.random() < 0.35: s['replies']['pm_office'] += 1; _rep(s)
            p_cab = 0.03 + (0.10 if s['investor'] else 0) + (0.35 if s['introducer'] else 0)
            if r.random() < p_cab:
                s['cabinet_seen'] += 1; s['cabinet_warm'] += 1
                if r.random() < 0.4: s['replies']['adviser'] += 1; _rep(s)
                if r.random() < 0.08 + 0.12*s['investor']: s['rama_seen'] += 1; s['rama_attention'] += 1
        else:
            s['wasted'] += 1

    elif a == 'linkedin_adviser':
        if r.random() < 0.20 + 0.15*s['investor']:
            s['cabinet_warm'] += 1
            if r.random() < 0.25: s['replies']['adviser'] += 1; _rep(s)

    elif a == 'instagram_rama':
        p_see = 0.02 + 0.02*s['investor'] + 0.01*min(s['rama_attention'],3)
        if r.random() < p_see:
            s['rama_seen'] += 1; s['rama_attention'] += 1
            if r.random() < (0.25 if s['investor'] else 0.08):
                s['rama_reply'] += 1; s['replies']['rama'] += 1; _rep(s)
                s['aida_warm'] += 3; s['cabinet_warm'] += 1   # public nudge

    elif a == 'email_aida':
        p = 0.35 + 0.15*min(s['aida_warm'],3) + 0.30*s['investor']
        if r.random() < clamp(p):
            s['replies']['aida'] += 1; _rep(s); s['aida_warm'] += 1
            if s['investor'] and not s['aida_call'] and r.random() < 0.5: s['aida_call'] = True

    elif a == 'email_mfa':
        p = 0.25 + 0.10*min(s['mfa_warm'],3) + 0.15*s['investor']
        if r.random() < clamp(p):
            s['replies']['mfa'] += 1; _rep(s); s['mfa_warm'] += 1

    elif a == 'find_investor':          # pitch Vietnamese firms on Albania
        if not s['investor'] and r.random() < 0.025:
            s['investor'] = True; s['investor_quality'] = r.uniform(0.2, 0.9)
        elif s['investor'] and r.random() < 0.05:
            s['investor_quality'] = min(1.0, s['investor_quality'] + 0.15)

    elif a == 'seek_introducer':        # diaspora business, ambassador, lawyer
        if not s['introducer'] and r.random() < 0.04 + 0.03*s['investor']:
            s['introducer'] = True

    elif a == 'propose_delegation':
        if s['investor'] and s['mfa_warm'] >= 3 and not s['delegation'] and r.random() < 0.08:
            s['delegation'] = True; s['consul_track'] += 2
            if s['deal'] is None: s['deal'] = 'trade delegation'; s['deal_step'] = s['step']

    elif a == 'travel_tirana':          # in-person meetings, expensive
        s['travel_tirana'] += 1
        if s['aida_call']:
            s['ministry_meeting'] = s['ministry_meeting'] or r.random() < 0.35
        if s['cabinet_warm'] >= 2 and r.random() < 0.25: s['rama_seen'] += 1; s['rama_attention'] += 1
        s['consul_track'] += 1

    elif a == 'pipeline':               # push the investor file forward
        if s['aida_call'] and not s['ministry_meeting'] and r.random() < 0.10 + 0.05*min(s['aida_warm'],5)/5:
            s['ministry_meeting'] = True
        elif s['ministry_meeting'] and not s['due_diligence'] and r.random() < 0.10*s['investor_quality']:
            s['due_diligence'] = True
        elif s['due_diligence'] and r.random() < 0.08*s['investor_quality']:
            s['deal'] = 'investment MoU / strategic investor'; s['deal_step'] = s['step']
            s['consul_track'] += 3
        # investor fatigue
        if s['investor'] and s['deal'] is None and r.random() < 0.04:
            s['investor'] = False; s['aida_call'] = s['ministry_meeting'] = s['due_diligence'] = False

    elif a == 'consul_application':
        if s['consul_track'] >= 6 and s['mfa_warm'] >= 4 and not s['consul'] and r.random() < 0.05:
            s['consul'] = True
            if s['deal'] is None: s['deal'] = 'honorary consul'; s['deal_step'] = s['step']

def _rep(s):
    if s['first_reply_step'] is None: s['first_reply_step'] = s['step']

# ---------- policies ----------
def smart(s, r):
    if not s['investor']:
        return r.choices(['find_investor','seek_introducer','email_aida','email_mfa','email_pm','instagram_rama','linkedin_adviser'],
                         [45,15,12,8,8,7,5])[0]
    if not s['aida_call']:
        return r.choices(['email_aida','email_pm','seek_introducer','instagram_rama','email_mfa','find_investor'],[40,15,10,10,15,10])[0]
    if s['deal'] is None or s['deal'] == 'trade delegation':
        return r.choices(['pipeline','travel_tirana','email_mfa','propose_delegation','email_pm','find_investor','consul_application'],
                         [45,8,12,12,8,10,5])[0]
    return r.choices(['pipeline','consul_application','email_mfa','find_investor'],[40,20,20,20])[0]

def naive(s, r):   # keep writing to Rama
    return r.choices(['email_pm','followup_pm','instagram_rama','linkedin_adviser','email_aida'],[40,30,20,5,5])[0]

# ---------- run ----------
def run(policy, seed, runs=100, actions=100):
    r = random.Random(seed); out = []
    for _ in range(runs):
        s = new_state()
        for _ in range(actions):
            act(s, policy(s, r), r)
        out.append(s)
    return out

def pct(xs, f): return round(100*sum(1 for x in xs if f(x))/len(xs))

def report(name, R):
    print(f"\n=== {name} ({len(R)} runs x 100 actions) ===")
    rows = [
     ("PM-office email opened at least once", pct(R, lambda s: s['triage_reads']>0)),
     ("Email forwarded to AIDA/MFA at least once", pct(R, lambda s: s['forwarded']>0)),
     ("Reached chief of cabinet / adviser", pct(R, lambda s: s['cabinet_seen']>0)),
     ("Rama personally saw something from you", pct(R, lambda s: s['rama_seen']>0)),
     ("Rama replied personally", pct(R, lambda s: s['rama_reply']>0)),
     ("Any written reply from anyone", pct(R, lambda s: sum(s['replies'].values())>0)),
     ("Reply from PM office or adviser", pct(R, lambda s: s['replies']['pm_office']+s['replies']['adviser']>0)),
     ("Flagged as spam by PM office", pct(R, lambda s: s['pm_flagged'])),
     ("Secured a named Vietnamese investor", pct(R, lambda s: s['investor'] or s['deal'] is not None)),
     ("Found an introducer", pct(R, lambda s: s['introducer'])),
     ("AIDA call held", pct(R, lambda s: s['aida_call'] or s['deal'] is not None)),
     ("Ministry meeting held", pct(R, lambda s: s['ministry_meeting'])),
     ("Due diligence started", pct(R, lambda s: s['due_diligence'])),
     ("Some deal/outcome reached", pct(R, lambda s: s['deal'] is not None)),
     ("  investment MoU / strategic investor", pct(R, lambda s: s['deal']=='investment MoU / strategic investor')),
     ("  trade delegation", pct(R, lambda s: s['deal']=='trade delegation')),
     ("  honorary consul", pct(R, lambda s: s['deal']=='honorary consul' or s['consul'])),
    ]
    for k,v in rows: print(f"{k:48s} {v:3d}%")
    fr = [s['first_reply_step'] for s in R if s['first_reply_step']]
    ds = [s['deal_step'] for s in R if s['deal_step']]
    em = [s['pm_emails'] for s in R]
    print(f"median action # of first reply: {statistics.median(fr) if fr else 'n/a'}")
    print(f"median action # of first deal:  {statistics.median(ds) if ds else 'n/a'}")
    print(f"avg emails sent to PM office:   {statistics.mean(em):.1f}; avg unopened: {statistics.mean([s['wasted'] for s in R]):.1f}")
    print(f"avg trips to Tirana:            {statistics.mean([s['travel_tirana'] for s in R]):.1f}")


def stage(s):
    if s['deal']=='investment MoU / strategic investor': return 6
    if s['due_diligence']: return 5
    if s['ministry_meeting']: return 4
    if s['aida_call']: return 3
    if s['investor']: return 2
    if sum(s['replies'].values())>0: return 1
    return 0
NAMES=['nothing','a reply only','named investor','AIDA call','ministry meeting','due diligence','MoU signed']
def funnel(R):
    c=collections.Counter(stage(s) for s in R)
    print("How far each of the 100 runs got (furthest stage reached):")
    for i,n in enumerate(NAMES): print(f"  {n:18s} {c[i]:3d} runs")
def timeline(s, title):
    print(f"\n--- {title} ---")
    ev=[]
    for i,a in enumerate(s['log'],1): pass
    print("actions:", collections.Counter(s['log']).most_common())
    print("replies:", dict(s['replies']), "| investor:", s['investor'], "| aida_call:", s['aida_call'],
          "| ministry:", s['ministry_meeting'], "| DD:", s['due_diligence'], "| deal:", s['deal'], "at action", s['deal_step'],
          "| rama saw:", s['rama_seen'], "| flagged:", s['pm_flagged'])
RS = run(smart, 7)
report("ADAPTIVE strategy (investor first, AIDA channel, Rama last)", RS)
funnel(RS)
RS_sorted=sorted(RS,key=stage)
timeline(RS_sorted[50],"typical (median) run")
timeline(RS_sorted[-1],"best run")
timeline(RS_sorted[0],"worst run")
report("NAIVE strategy (keep writing to Rama)", run(naive, 7))
