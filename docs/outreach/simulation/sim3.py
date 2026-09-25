# Refined model after research (Sept 2026). Lorenc = CEO Plan A Production (HCMC ad/film production house,
# 7 yrs, 100M-view campaigns, Vietcetera profile). Real government hooks found:
#  - Albania-Vietnam labour MoU signed 29/30 Jul 2026 by Econ+Innovation Minister Delina Ibrahimaj in Hanoi;
#    joint action plan + "Albania-Vietnam Economic and Employment Forum" planned.  -> live desk, needs on-the-ground partner
#  - Tax treaty initialled 4 Jun 2026 (Tirana).                                         -> ministry attention on Vietnam is real
#  - Draft cinema law w/ 35% cash rebate + new film agency (consultation May 2026).     -> Lorenc's actual industry
#  - National Tourism Agency issued briefs for 4 promo videos in 2026.                  -> a procurement he can bid on
#  - Diaspora: Summit (Apr 2026), Diaspora4Innovation (Sep 2026), National Diaspora Register, Rama in US now.
#  - Rama bandwidth: Flamingo Revolution protests since Jun 2026, Balluku indictment, reshuffle; art career (Société, Art Basel).
#  - Rama channel: "Sy m'sy" Instagram live Q&A; 645K followers; says he no longer reads comments; mocks self-promoters.
import random, statistics, collections
exec(open('sim.py').read().split("# ---------- policies ----------")[0])

def refined_state(s):
    s.update(mei_warm=0, film_warm=0, forum_seat=False, tender=False, tender_won=False,
             consul_track=0, positioned=False, symsy_asked=0, labour_partner=False)

def act4(s, a, r):
    if a == 'position':          # rewrite the pitch: "Albanian founder in HCMC, Vietnam labour MoU partner, film rebate"
        s['step'] += 1; s.setdefault('log',[]).append(a); s['positioned'] = True; return
    if a == 'email_mei':         # Ministry of Economy & Innovation / Ibrahimaj's Vietnam desk
        s['step'] += 1; s.setdefault('log',[]).append(a)
        p = 0.18 + 0.05*min(s['mei_warm'],3) + (0.12 if s['positioned'] else 0)
        if r.random() < clamp(p):
            s['replies']['mei'] += 1; _rep(s); s['mei_warm'] += 1; s['aida_warm'] += 1
            if s['mei_warm'] >= 3 and not s['labour_partner'] and r.random() < 0.06:
                s['labour_partner'] = True; s['investor'] = True; s['investor_quality'] = 0.6   # recruiting/vocational partner role
            if s['mei_warm'] >= 4 and not s['forum_seat'] and r.random() < 0.05:
                s['forum_seat'] = True
                if s['deal'] is None: s['deal'] = 'seat at Albania-Vietnam Economic Forum'; s['deal_step'] = s['step']
        return
    if a == 'film_channel':      # Ministry of Tourism/Culture, film agency, rebate consultation comment, NTA promo tender
        s['step'] += 1; s.setdefault('log',[]).append(a)
        p = 0.15 + 0.05*min(s['film_warm'],3) + (0.10 if s['positioned'] else 0)
        if r.random() < clamp(p):
            s['replies']['culture'] += 1; _rep(s); s['film_warm'] += 1
            if s['film_warm'] >= 3 and not s['tender'] and r.random() < 0.08: s['tender'] = True
            elif s['tender'] and not s['tender_won'] and r.random() < 0.05:
                s['tender_won'] = True
                if s['deal'] is None or s['deal'].startswith('seat'): s['deal'] = 'NTA / public promo-video contract'; s['deal_step'] = s['step']
        return
    if a == 'symsy':             # ask a question on Rama's Instagram live Q&A, in Albanian, concrete
        s['step'] += 1; s.setdefault('log',[]).append(a); s['symsy_asked'] += 1
        p_pick = 0.005 + (0.01 if s['positioned'] else 0) + (0.015 if s['deal'] or s['labour_partner'] else 0)
        if r.random() < p_pick:
            s['rama_seen'] += 1; s['rama_attention'] += 1; s['rama_reply'] += 1; s['replies']['rama'] += 1; _rep(s)
            s['mei_warm'] += 2; s['cabinet_warm'] += 1
        return
    if a == 'diaspora':          # Diaspora Register, Summit application, Diaspora4Innovation, diaspora business networks
        s['step'] += 1; s.setdefault('log',[]).append(a)
        if r.random() < 0.04 + (0.04 if s['positioned'] else 0):
            s['introducer'] = True; s['cabinet_warm'] += 1; s['consul_track'] += 1
        return
    act(s, a, r)

def refined(s, r):
    if not s['positioned']: return 'position'
    if s['step'] < 40:
        return r.choices(['email_mei','film_channel','diaspora','email_aida','email_mfa','find_investor','email_pm','symsy','linkedin_adviser'],
                         [25,20,12,10,8,10,5,5,5])[0]
    if s['deal'] is None:
        return r.choices(['email_mei','film_channel','pipeline','travel_tirana','diaspora','email_pm','symsy','propose_delegation','find_investor'],
                         [20,18,15,8,8,6,5,10,10])[0]
    return r.choices(['pipeline','film_channel','email_mei','consul_application','travel_tirana','symsy','propose_delegation'],[25,15,15,15,10,5,15])[0]

def run4(policy, seed, runs=100, actions=100):
    r = random.Random(seed); out=[]
    for _ in range(runs):
        s = new_state(); refined_state(s)
        for _ in range(actions): act4(s, policy(s, r), r)
        out.append(s)
    return out

def pct(xs, f): return round(100*sum(1 for x in xs if f(x))/len(xs))
R = run4(refined, 21)
print("=== REFINED: Albanian founder in HCMC pitching Vietnam labour MoU + film rebate + promo tenders (100 x 100) ===")
rows = [
 ("Reply from Economy & Innovation ministry (Vietnam desk)", pct(R, lambda s: s['replies']['mei']>0)),
 ("Reply from Tourism/Culture or film agency", pct(R, lambda s: s['replies']['culture']>0)),
 ("Reply from PM office or adviser", pct(R, lambda s: s['replies']['pm_office']+s['replies']['adviser']>0)),
 ("Found an introducer (diaspora/business)", pct(R, lambda s: s['introducer'])),
 ("Rama saw something from you", pct(R, lambda s: s['rama_seen']>0)),
 ("Rama answered you (Sy m'sy or otherwise)", pct(R, lambda s: s['rama_reply']>0)),
 ("Flagged as spam", pct(R, lambda s: s['pm_flagged'])),
 ("Became a labour-MoU implementation partner", pct(R, lambda s: s['labour_partner'])),
 ("Invited to promo-video tender", pct(R, lambda s: s['tender'])),
 ("Any deal or outcome", pct(R, lambda s: s['deal'] is not None)),
 ("  seat at Albania-Vietnam Economic Forum", pct(R, lambda s: s['forum_seat'])),
 ("  public promo-video contract", pct(R, lambda s: s['tender_won'])),
 ("  trade delegation", pct(R, lambda s: s['delegation'])),
 ("  investment MoU / strategic investor", pct(R, lambda s: s['deal']=='investment MoU / strategic investor')),
 ("  honorary consul", pct(R, lambda s: s['consul'])),
]
for k,v in rows: print(f"{k:56s} {v:3d}%")
fr=[s['first_reply_step'] for s in R if s['first_reply_step']]; ds=[s['deal_step'] for s in R if s['deal_step']]
print(f"median action # first reply: {statistics.median(fr)} | median action # first deal: {statistics.median(ds) if ds else 'n/a'}")
