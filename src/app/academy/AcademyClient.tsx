'use client'

/**
 * /academy — Civic Academy
 *
 * Four structured courses that walk new users through civic engagement
 * on Lobby Market. Each course has 4 lessons: an explanation, a
 * practical challenge (link to a live platform feature), and a
 * knowledge check. Progress is persisted in localStorage so users
 * can resume at any point.
 *
 * Courses:
 *   1. Democracy 101         — How laws are made on the Lobby
 *   2. Debate Mastery        — Crafting and defending arguments
 *   3. Critical Thinking     — Evaluating claims and evidence
 *   4. Civic Power           — Building influence and coalitions
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Flame,
  Gavel,
  GraduationCap,
  Landmark,
  Lightbulb,
  MessageSquare,
  Scale,
  Shield,
  Sparkles,
  Users,
  Vote,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lesson {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  duration: string
  explanation: string
  keyPoints: string[]
  challenge: {
    label: string
    href: string
    description: string
  }
  quiz: {
    question: string
    options: string[]
    correctIndex: number
    explanation: string
  }
}

interface Course {
  id: string
  title: string
  subtitle: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  border: string
  badgeColor: string
  lessons: Lesson[]
}

// ─── Course data ──────────────────────────────────────────────────────────────

const COURSES: Course[] = [
  {
    id: 'democracy-101',
    title: 'Democracy 101',
    subtitle: 'How consensus becomes law',
    description:
      'Learn how Lobby Market turns collective votes into established laws — from a topic proposal all the way to the Law Codex.',
    icon: Landmark,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    badgeColor: 'bg-for-600/20 text-for-300 border-for-500/40',
    lessons: [
      {
        id: 'topic-lifecycle',
        title: 'The Topic Lifecycle',
        icon: Flame,
        duration: '3 min',
        explanation:
          'Every topic on Lobby Market goes through five stages: Proposed, Active, Voting, Law, and Failed. ' +
          'A topic starts as a user proposal. When it gains enough support it becomes Active — open for debate and voting. ' +
          'Once the voting window closes, a supermajority triggers the transition to Law. Topics that fail to reach ' +
          'consensus are archived in the Failed state. Understanding this pipeline is the foundation of civic literacy.',
        keyPoints: [
          'Topics begin as Proposed — anyone can submit one',
          'Active status means voting and debate are open',
          'A supermajority (usually >60%) in the Voting phase triggers Law status',
          'Laws are permanently inscribed in the Civic Codex',
        ],
        challenge: {
          label: 'Explore the topic lifecycle',
          href: '/topics',
          description: 'Browse all topics filtered by status — spot the full pipeline in action.',
        },
        quiz: {
          question: 'What happens to a topic that reaches a supermajority in the Voting phase?',
          options: [
            'It is deleted from the platform',
            'It becomes an established law in the Civic Codex',
            'It returns to Proposed status for revision',
            'It is sent to a committee for review',
          ],
          correctIndex: 1,
          explanation:
            'When a topic achieves supermajority consensus in the Voting phase it graduates to Law status and is permanently ' +
            'inscribed in the Civic Codex — the platform\'s constitutional record.',
        },
      },
      {
        id: 'casting-votes',
        title: 'Casting Your Vote',
        icon: Vote,
        duration: '2 min',
        explanation:
          'Voting on Lobby Market is binary — FOR or AGAINST. But how you vote matters as much as when you vote. ' +
          'Your vote carries more weight when you provide a reason (a "hot take"), when you have a higher reputation score, ' +
          'and when you vote early in a topic\'s life cycle. Votes on contested topics shift the needle most dramatically. ' +
          'Each vote you cast contributes to your civic streak and overall clout.',
        keyPoints: [
          'Votes are FOR or AGAINST — no abstentions',
          'Adding a reason ("hot take") increases argument visibility',
          'Voting early on contested topics earns more clout',
          'Your vote streak adds a daily engagement bonus',
        ],
        challenge: {
          label: 'Cast your first vote',
          href: '/',
          description: 'Head to the home feed and cast a vote on an active topic.',
        },
        quiz: {
          question: 'Which of the following gives your vote the most civic impact?',
          options: [
            'Voting on a topic that already has 95% consensus',
            'Voting on a topic in its final hour with a written reason',
            'Abstaining until you have more information',
            'Only voting on topics in your home category',
          ],
          correctIndex: 1,
          explanation:
            'Voting on contested topics late in their lifecycle — especially with a written reason — earns the most clout ' +
            'and has the most impact on the final outcome.',
        },
      },
      {
        id: 'reading-the-codex',
        title: 'The Civic Codex',
        icon: BookOpen,
        duration: '2 min',
        explanation:
          'The Civic Codex is Lobby Market\'s living constitution — every topic that achieved supermajority consensus is ' +
          'permanently recorded there. Laws are organised by category, date, and vote percentage. Each law has a dedicated ' +
          'wiki page, a full argument archive, and a chain of related topics. The Codex is the authoritative record of what ' +
          'the platform\'s citizens have collectively agreed upon.',
        keyPoints: [
          'The Codex contains every law ever established on the platform',
          'Laws are immutable — they cannot be deleted, only superseded',
          'Each law links to the arguments that shaped the consensus',
          'The Codex is publicly readable — no account required',
        ],
        challenge: {
          label: 'Read the Codex',
          href: '/law',
          description: 'Browse established laws by category and read the highest-voted ones.',
        },
        quiz: {
          question: 'What makes the Civic Codex different from a regular database of topics?',
          options: [
            'It only contains topics with more than 1,000 votes',
            'It is a permanent, immutable record of collective consensus',
            'It can be edited by Elder users to correct mistakes',
            'It resets every civic season',
          ],
          correctIndex: 1,
          explanation:
            'The Codex is immutable — once a law is inscribed, it cannot be deleted or changed. This permanence is what ' +
            'gives the platform\'s laws their constitutional character.',
        },
      },
      {
        id: 'platform-roles',
        title: 'Roles & Reputation',
        icon: Award,
        duration: '3 min',
        explanation:
          'Lobby Market uses a reputation system to distinguish engaged citizens from newcomers. You start as a Citizen ' +
          'and progress through Debator, Troll Catcher, and Elder. Each role unlocks new privileges — Elders can grant ' +
          'Royal Assent to laws, while Debators get featured argument slots. Your clout score and reputation are ' +
          'determined by the quality of your arguments, your vote accuracy, and your community impact.',
        keyPoints: [
          'Citizen → Debator → Troll Catcher → Elder progression',
          'Elders grant Royal Assent — the final seal on new laws',
          'Clout is earned through upvoted arguments and accurate predictions',
          'Reputation affects how much weight your votes carry',
        ],
        challenge: {
          label: 'Check your profile',
          href: '/profile/me',
          description: 'See your current role, clout score, and what it takes to level up.',
        },
        quiz: {
          question: 'What unique privilege do Elder users have?',
          options: [
            'They can delete topics they disagree with',
            'They can grant Royal Assent to newly established laws',
            'They can vote twice on contested topics',
            'They bypass the voting phase for topics they propose',
          ],
          correctIndex: 1,
          explanation:
            'Elders — the platform\'s most distinguished citizens — have the honour of granting Royal Assent to laws, ' +
            'formally proclaiming them into the Civic Codex with a gold seal.',
        },
      },
    ],
  },
  {
    id: 'debate-mastery',
    title: 'Debate Mastery',
    subtitle: 'Argue well, win minds',
    description:
      'Craft compelling arguments, understand rhetorical structure, and learn how to change minds rather than just win points.',
    icon: MessageSquare,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    badgeColor: 'bg-purple/20 text-purple border-purple/40',
    lessons: [
      {
        id: 'anatomy-of-argument',
        title: 'Anatomy of a Good Argument',
        icon: Brain,
        duration: '4 min',
        explanation:
          'A strong civic argument has three parts: a clear claim, supporting evidence, and a warrant connecting the two. ' +
          'Claim: what you believe. Evidence: facts, data, precedents, or examples that support it. Warrant: the logical ' +
          'bridge explaining why the evidence supports the claim. Arguments that omit the warrant are the most common failure ' +
          'mode — people state facts but don\'t explain why those facts matter to the debate.',
        keyPoints: [
          'Claim → Evidence → Warrant is the foundation of good argument',
          'Specificity beats generality — cite real examples when possible',
          'Acknowledge the strongest version of the opposing view (steelmanning)',
          'Keep arguments focused on a single point for maximum impact',
        ],
        challenge: {
          label: 'Read the top arguments',
          href: '/top-arguments',
          description: 'Study the platform\'s highest-rated arguments to see these principles in action.',
        },
        quiz: {
          question: 'A user says: "Unemployment is at 4.2% so the economy is healthy." What is missing?',
          options: [
            'The claim — they need to state what they believe',
            'The warrant — why does 4.2% unemployment mean the economy is healthy?',
            'The evidence — 4.2% is not a real statistic',
            'Nothing — this is a complete argument',
          ],
          correctIndex: 1,
          explanation:
            'The argument has a claim (economy is healthy) and evidence (4.2% unemployment) but lacks the warrant — ' +
            'an explanation of why that unemployment rate indicates economic health rather than, say, labour market dysfunction.',
        },
      },
      {
        id: 'logical-fallacies',
        title: 'Spotting Logical Fallacies',
        icon: Scale,
        duration: '5 min',
        explanation:
          'Logical fallacies are shortcuts that feel persuasive but are logically invalid. The most common ones in civic debate: ' +
          'Ad Hominem (attacking the person, not the argument), False Dilemma (presenting only two options when more exist), ' +
          'Slippery Slope (assuming one action inevitably leads to extreme consequences), Appeal to Authority (citing an expert ' +
          'without checking if they\'re relevant), and Straw Man (misrepresenting the opponent\'s position to attack it more easily).',
        keyPoints: [
          'Ad Hominem: attacking the speaker instead of the argument',
          'False Dilemma: "Either X or Y" when Z options exist',
          'Slippery Slope: assuming inevitable cascading consequences without evidence',
          'Straw Man: arguing against a distorted version of the opponent\'s position',
        ],
        challenge: {
          label: 'Practice fallacy spotting',
          href: '/training',
          description: 'Use the Training Centre\'s Fallacy Spotter drill to sharpen this skill.',
        },
        quiz: {
          question:
            'Someone argues: "We can\'t allow any gun control — first it\'s background checks, then confiscation, ' +
            'then a totalitarian state." This is an example of:',
          options: [
            'A well-reasoned slippery slope argument with evidence',
            'Ad Hominem fallacy',
            'Slippery Slope fallacy',
            'Appeal to Authority',
          ],
          correctIndex: 2,
          explanation:
            'This is a Slippery Slope fallacy — it assumes, without evidence, that one policy inevitably leads to ' +
            'increasingly extreme outcomes. The connection between each step requires its own argument.',
        },
      },
      {
        id: 'steelmanning',
        title: 'The Art of Steelmanning',
        icon: Shield,
        duration: '3 min',
        explanation:
          'Steelmanning is the opposite of strawmanning — instead of attacking the weakest version of your opponent\'s ' +
          'argument, you engage with the strongest version. This makes your own argument more robust (you must defeat the ' +
          'best case against you), signals intellectual honesty (which makes you more persuasive), and often reveals genuine ' +
          'common ground. The platform\'s most-upvoted arguments consistently steelman the opposition.',
        keyPoints: [
          'Find the charitable interpretation of the opposing view',
          'State it more clearly than your opponent might',
          'Then explain why you still disagree — or update your position',
          'Steelmanning is especially powerful in topics with genuine trade-offs',
        ],
        challenge: {
          label: 'Read AI steelmans',
          href: '/topics',
          description:
            'Open any active topic and look for the Steelman feature — AI-generated best-case versions of each side.',
        },
        quiz: {
          question: 'What is steelmanning?',
          options: [
            'Using the strongest possible language to win an argument',
            'Presenting the strongest possible version of the opposing argument before rebutting it',
            'Only arguing positions you are completely certain about',
            'Citing steel industry statistics to support your economic argument',
          ],
          correctIndex: 1,
          explanation:
            'Steelmanning means presenting the strongest, most charitable version of the opposing view — ' +
            'not the weakest strawman — before explaining why you still disagree. It demonstrates intellectual ' +
            'honesty and makes your eventual rebuttal far more persuasive.',
        },
      },
      {
        id: 'debate-arena',
        title: 'Live Debate Format',
        icon: Zap,
        duration: '3 min',
        explanation:
          'Lobby Market debates are structured head-to-head contests. Two participants argue opposing sides of a topic ' +
          'in real time while an audience votes on who is winning. Each participant gets multiple rounds. The audience ' +
          'can cast votes, submit questions, and award argument points. At the end, the platform records a winner based ' +
          'on audience vote shift — who moved the most votes from the baseline?',
        keyPoints: [
          'Debates are live, timed, and judged by the audience',
          'Victory is measured by vote shift — not just who sounds good',
          'Audience members can submit questions mid-debate',
          'Debate records appear on both participants\' profiles',
        ],
        challenge: {
          label: 'Watch a live debate',
          href: '/debate',
          description: 'Find an active or upcoming debate and observe how participants structure their arguments.',
        },
        quiz: {
          question: 'In a Lobby Market debate, how is the winner determined?',
          options: [
            'By who gets the most upvotes on their opening statement',
            'By a panel of Elder judges who score each round',
            'By the shift in audience votes — who changed the most minds',
            'By whoever speaks last in the debate',
          ],
          correctIndex: 2,
          explanation:
            'The winner is determined by vote shift — the participant who moved the most audience votes from the ' +
            'baseline (the vote split at debate start) to the final tally. This rewards actual persuasiveness, ' +
            'not just rhetorical flair.',
        },
      },
    ],
  },
  {
    id: 'critical-thinking',
    title: 'Critical Thinking',
    subtitle: 'See through noise and bias',
    description:
      'Learn to evaluate sources, identify bias, distinguish fact from opinion, and resist manipulation in civic debate.',
    icon: Brain,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    badgeColor: 'bg-emerald/20 text-emerald border-emerald/40',
    lessons: [
      {
        id: 'primary-sources',
        title: 'Primary vs Secondary Sources',
        icon: BookOpen,
        duration: '3 min',
        explanation:
          'In civic debate, source quality matters. Primary sources are original data: government statistics, peer-reviewed ' +
          'studies, court documents, official transcripts. Secondary sources interpret primary ones: newspaper articles, ' +
          'op-eds, academic literature reviews. Tertiary sources summarise secondaries: encyclopaedias, textbooks. ' +
          'The hierarchy matters because distortion compounds — by the time a statistic reaches a tweet, it may have been ' +
          'misrepresented multiple times. Always trace claims back to their primary source.',
        keyPoints: [
          'Primary sources: original data, studies, official records',
          'Secondary sources: interpretations of primaries (news, analysis)',
          'Tertiary sources: summaries of secondaries (encyclopaedias)',
          'Distortion compounds — trace every major claim to its origin',
        ],
        challenge: {
          label: 'Explore argument sources',
          href: '/sources',
          description: 'Browse topic sources to see how top arguments are evidenced.',
        },
        quiz: {
          question:
            'A tweet claims "Studies show X causes cancer." You want to evaluate this claim. What should you do first?',
          options: [
            'Retweet it if it supports your existing view',
            'Accept it — "studies show" is definitive scientific language',
            'Find the specific study cited and read its methodology section',
            'Ask an expert on social media to confirm',
          ],
          correctIndex: 2,
          explanation:
            '"Studies show" is often used loosely. To evaluate the claim you must find the specific study, read who ' +
            'conducted it, how large the sample was, whether it has been replicated, and whether the methodology is sound. ' +
            'No single study is definitive.',
        },
      },
      {
        id: 'confirmation-bias',
        title: 'Confirmation Bias',
        icon: Lightbulb,
        duration: '4 min',
        explanation:
          'Confirmation bias is the tendency to favour information that confirms our existing beliefs and discount ' +
          'information that challenges them. It operates unconsciously and affects even intelligent, well-intentioned people. ' +
          'On civic platforms, it manifests as upvoting arguments that agree with your vote, dismissing valid counterarguments, ' +
          'and engaging only with users who share your views. The antidote: actively seek out the strongest objections to ' +
          'your position before forming a final view.',
        keyPoints: [
          'We naturally seek evidence that confirms what we already believe',
          'Confirmation bias is unconscious and affects everyone equally',
          'Social media algorithms amplify it by showing us agreeable content',
          'Antidote: actively seek disconfirming evidence before concluding',
        ],
        challenge: {
          label: 'Check your bias profile',
          href: '/bias',
          description: 'See your personal bias analysis — where your votes consistently align with or against consensus.',
        },
        quiz: {
          question:
            'You voted FOR a topic and now see an argument pointing out a serious flaw in your position. ' +
            'What does confirmation bias predict you will do?',
          options: [
            'Immediately change your vote and thank the author',
            'Engage thoughtfully and update your view if the argument is sound',
            'Dismiss or downvote the argument without fully engaging with it',
            'Contact the platform to report the argument as misleading',
          ],
          correctIndex: 2,
          explanation:
            'Confirmation bias predicts we will dismiss or devalue arguments that challenge our existing position. ' +
            'Recognising this tendency is the first step to overcoming it — consciously engage with the argument ' +
            'on its merits before deciding whether it changes your view.',
        },
      },
      {
        id: 'evaluating-statistics',
        title: 'Evaluating Statistics',
        icon: Scale,
        duration: '4 min',
        explanation:
          'Statistics can be accurate yet misleading. Common manipulation tactics: cherry-picking time frames (choosing the ' +
          'period that shows the trend you want), absolute vs relative risk (saying something "doubles the risk" when the ' +
          'absolute risk change is tiny), misleading axes (truncating a y-axis to exaggerate change), and base rate neglect ' +
          '(ignoring how common something is before citing a percentage). When you see a statistic in a civic argument, ' +
          'ask: what is the source, what is the baseline, and what context is omitted?',
        keyPoints: [
          'Cherry-picking: selecting the data window that shows your preferred trend',
          'Relative vs absolute risk: "doubles" means nothing without knowing the base rate',
          'Truncated axes make small changes look dramatic',
          'Always ask: what context or data is being omitted?',
        ],
        challenge: {
          label: 'Read argument citations',
          href: '/topic-arguments',
          description:
            'Find a highly-cited argument on any topic and examine how statistics are used in the evidence.',
        },
        quiz: {
          question:
            'A politician says a new drug "reduces heart attack risk by 50%." You learn the base rate of heart attacks ' +
            'in the study group was 2 in 10,000 people. What is the actual reduction?',
          options: [
            '50 fewer heart attacks per 100 people',
            '1 fewer heart attack per 10,000 people',
            '5,000 heart attacks prevented',
            '50% of all heart attacks eliminated globally',
          ],
          correctIndex: 1,
          explanation:
            'A 50% relative risk reduction on a base rate of 2/10,000 means the drug reduces heart attacks from 2 to ' +
            '1 per 10,000 people — a very small absolute improvement. Understanding absolute vs relative risk is critical ' +
            'to evaluating medical and policy statistics honestly.',
        },
      },
      {
        id: 'misinformation',
        title: 'Recognising Misinformation',
        icon: Shield,
        duration: '3 min',
        explanation:
          'Misinformation spreads faster than corrections. Red flags: claims with no source, emotional language designed ' +
          'to provoke outrage, content that perfectly confirms your existing beliefs, accounts created recently making ' +
          'extraordinary claims, and statistics cited without methodology. On Lobby Market, every argument can be cited ' +
          'and the platform shows source credibility signals. Before sharing or upvoting an argument, ask: is this claim ' +
          'falsifiable, and has it been tested?',
        keyPoints: [
          'Emotional language is a misinformation red flag',
          'Claims that perfectly confirm your beliefs deserve extra scrutiny',
          'Every factual claim should be traceable to a verifiable source',
          'Ask: can this be falsified, and has anyone tried?',
        ],
        challenge: {
          label: 'Check fact-check integrations',
          href: '/fact-bank',
          description:
            'Explore the Civic Fact Bank to see how platform arguments are cross-referenced with verified sources.',
        },
        quiz: {
          question:
            'You see a post claiming "Scientists confirm X causes Y — shares exploding." What is the first red flag?',
          options: [
            'The word "scientists" — all scientists are biased',
            'The viral framing — misinformation spreads faster than truth, suggesting emotional, shareable content',
            'The use of "causes" — correlation never implies causation',
            'There are no red flags — viral scientific news is usually accurate',
          ],
          correctIndex: 1,
          explanation:
            'The "shares exploding" viral framing is itself a red flag. Misinformation is specifically designed to spread ' +
            'rapidly by triggering emotional responses. High virality without appearing in reliable outlets is reason for ' +
            'extra scrutiny, not less.',
        },
      },
    ],
  },
  {
    id: 'civic-power',
    title: 'Civic Power',
    subtitle: 'Build influence and coalitions',
    description:
      'Understand how to build reputation, form coalitions, make predictions, and turn civic engagement into real platform influence.',
    icon: Users,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    badgeColor: 'bg-gold/20 text-gold border-gold/40',
    lessons: [
      {
        id: 'building-reputation',
        title: 'Building Your Reputation',
        icon: Sparkles,
        duration: '3 min',
        explanation:
          'Reputation on Lobby Market compounds over time. The highest-impact actions: writing arguments that get heavily ' +
          'upvoted (quality beats quantity), making accurate predictions on contested topics, debating publicly and winning, ' +
          'and maintaining a long vote streak. Spam and bad-faith arguments destroy reputation. The platform\'s moderation ' +
          'system actively tracks argument quality — arguments flagged as trolling or off-topic reduce your reputation score ' +
          'significantly.',
        keyPoints: [
          'Upvoted arguments are the single biggest reputation driver',
          'Accurate predictions on contested topics earn bonus clout',
          'Vote streaks provide daily reputation bonuses',
          'Low-quality arguments cost more reputation than they gain',
        ],
        challenge: {
          label: 'Write your first argument',
          href: '/topics',
          description:
            'Find an active topic, pick a side, and write your first cited argument. Aim for evidence and a clear warrant.',
        },
        quiz: {
          question: 'Which action gives you the MOST reputation on Lobby Market?',
          options: [
            'Voting on as many topics as possible each day',
            'Writing one highly-cited, upvoted argument on a contested topic',
            'Following every Elder user on the platform',
            'Creating new topic proposals daily',
          ],
          correctIndex: 1,
          explanation:
            'A single well-crafted argument that gets heavily upvoted generates far more reputation than volume voting. ' +
            'Quality drives reputation; quantity alone does not.',
        },
      },
      {
        id: 'coalitions',
        title: 'Coalition Building',
        icon: Users,
        duration: '4 min',
        explanation:
          'Coalitions are organised groups of like-minded citizens who coordinate their civic engagement. A coalition can ' +
          'issue formal voting guidance (whips), take collective stances on topics, run fundraising drives, and challenge ' +
          'rival coalitions to formal debates. Coalition membership amplifies individual influence — a well-organised ' +
          'coalition can shift the outcome of a contested topic. Leaders can issue three-line whips for critical votes, ' +
          'requiring members to vote as directed.',
        keyPoints: [
          'Coalitions coordinate voting on contested topics',
          'Coalition whips issue binding voting guidance',
          'Rival coalitions compete in formal stance battles',
          'Coalition leaders can organise drives and fundraising',
        ],
        challenge: {
          label: 'Browse coalitions',
          href: '/coalitions',
          description: 'Find a coalition aligned with your civic values and explore their active stances.',
        },
        quiz: {
          question: 'What is a "three-line whip" in Lobby Market coalition politics?',
          options: [
            'A formal debate challenge requiring three exchanges',
            'A critical voting directive requiring all coalition members to vote as directed',
            'A three-day period during which coalition members must remain active',
            'A punishment for members who vote against coalition stances',
          ],
          correctIndex: 1,
          explanation:
            'A three-line whip is the strongest level of coalition voting guidance — it is critical, not advisory. ' +
            'Coalition members are expected to vote as the leadership directs. It signals that the topic is existential ' +
            'for the coalition\'s stance.',
        },
      },
      {
        id: 'predictions',
        title: 'Civic Predictions',
        icon: Zap,
        duration: '3 min',
        explanation:
          'The Lobby Market prediction system lets you bet clout on whether active topics will become law. Accurate ' +
          'predictions earn bonus clout and improve your reputation as a civic forecaster. The platform tracks your ' +
          'calibration — how often your confidence levels match your actual accuracy. A 70% confident prediction that ' +
          'is correct 70% of the time is perfectly calibrated. Overconfident predictors who are often wrong see their ' +
          'forecasting reputation fall rapidly.',
        keyPoints: [
          'Bet clout on whether a topic will become law',
          'Calibration (not just accuracy) determines forecasting reputation',
          'Correct predictions earn bonus clout proportional to your confidence',
          'The Civic Forecaster archetype requires sustained prediction accuracy',
        ],
        challenge: {
          label: 'Make a prediction',
          href: '/predictions',
          description: 'Find an active topic in the Voting phase and make your first prediction.',
        },
        quiz: {
          question:
            'You make a prediction with 90% confidence. It is correct 50% of the time. How are you calibrated?',
          options: [
            'Well calibrated — you are right more than wrong',
            'Overconfident — you should be expressing around 50% confidence',
            'Underconfident — you clearly know more than you think',
            'Perfectly calibrated — confidence levels do not matter, only outcomes',
          ],
          correctIndex: 1,
          explanation:
            'Good calibration means your expressed confidence matches your actual accuracy rate. If you express 90% ' +
            'confidence but are only right 50% of the time, you are significantly overconfident and your forecasting ' +
            'reputation will reflect this.',
        },
      },
      {
        id: 'civic-legacy',
        title: 'Your Civic Legacy',
        icon: GraduationCap,
        duration: '3 min',
        explanation:
          'Over time, your engagement on Lobby Market builds a permanent civic record: the topics you helped pass, the ' +
          'arguments that shaped debates, the debates you won, and the laws that bear your contribution. Your civic ' +
          'archetype — whether you\'re a Progressive Reformer, Pragmatic Centrist, or Liberty Hawk — is derived from ' +
          'your complete voting history. This record follows you permanently; your early votes on now-established laws ' +
          'show up as part of your civic heritage.',
        keyPoints: [
          'Your civic archetype is computed from your full voting history',
          'Early votes on topics that become laws are highlighted in your profile',
          'Your top arguments are permanently part of the Codex record',
          'Civic legacy is cumulative — every engagement contributes',
        ],
        challenge: {
          label: 'View your civic DNA',
          href: '/analytics',
          description: 'See your full civic analytics — archetype, vote DNA, and contribution history.',
        },
        quiz: {
          question: 'What determines your civic archetype on Lobby Market?',
          options: [
            'Your username and profile picture choices',
            'A personality quiz you complete at onboarding',
            'Your complete voting history across all topics and categories',
            'The coalitions you have joined',
          ],
          correctIndex: 2,
          explanation:
            'Your civic archetype is computed algorithmically from your real voting history — not a quiz or self-report. ' +
            'It reflects actual patterns in your positions across categories, making it a genuine mirror of your civic identity.',
        },
      },
    ],
  },
]

// ─── Local storage helpers ────────────────────────────────────────────────────

const PROGRESS_KEY = 'lm_academy_progress'

interface AcademyProgress {
  completedLessons: string[]
  quizAnswers: Record<string, number>
}

function loadProgress(): AcademyProgress {
  if (typeof window === 'undefined') return { completedLessons: [], quizAnswers: {} }
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    return raw ? JSON.parse(raw) : { completedLessons: [], quizAnswers: {} }
  } catch {
    return { completedLessons: [], quizAnswers: {} }
  }
}

function saveProgress(p: AcademyProgress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p))
  } catch {
    // localStorage unavailable
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressRing({ pct, size = 56, stroke = 4, color }: {
  pct: number; size?: number; stroke?: number; color: string
}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct / 100)
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor"
        strokeWidth={stroke} className="text-surface-300" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor"
        strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" className={color}
        style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
    </svg>
  )
}

function CourseCard({
  course,
  completedCount,
  totalCount,
  onClick,
}: {
  course: Course
  completedCount: number
  totalCount: number
  onClick: () => void
}) {
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const done = completedCount === totalCount
  const Icon = course.icon

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        'w-full text-left p-5 rounded-2xl border transition-all duration-200',
        'bg-surface-100 hover:bg-surface-200',
        done ? course.border.replace('/30', '/60') : course.border,
        done && 'shadow-lg'
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn('h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0', course.bg, course.border, 'border')}>
          <Icon className={cn('h-5 w-5', course.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-mono font-bold text-white truncate">{course.title}</p>
            {done && <CheckCircle2 className={cn('h-4 w-4 flex-shrink-0', course.color)} />}
          </div>
          <p className={cn('text-xs font-mono mb-1', course.color)}>{course.subtitle}</p>
          <p className="text-xs text-surface-500 line-clamp-2 mb-3">{course.description}</p>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full', course.bg.replace('/10', ''))}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <span className="text-xs font-mono text-surface-500 flex-shrink-0">
              {completedCount}/{totalCount}
            </span>
          </div>
        </div>

        <div className="flex-shrink-0">
          <ProgressRing pct={pct} color={course.color} />
        </div>
      </div>
    </motion.button>
  )
}

type LessonView = 'reading' | 'challenge' | 'quiz' | 'done'

function LessonModal({
  course,
  lesson,
  isCompleted,
  onClose,
  onComplete,
}: {
  course: Course
  lesson: Lesson
  isCompleted: boolean
  onClose: () => void
  onComplete: (lessonId: string) => void
}) {
  const [view, setView] = useState<LessonView>(isCompleted ? 'done' : 'reading')
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const LessonIcon = lesson.icon
  const isCorrect = selectedAnswer === lesson.quiz.correctIndex

  function handleSubmitQuiz() {
    if (selectedAnswer === null) return
    setSubmitted(true)
    if (isCorrect) {
      setTimeout(() => {
        setView('done')
        onComplete(lesson.id)
      }, 1200)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        className="w-full sm:max-w-2xl bg-surface-100 border border-surface-300 rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn('px-6 py-5 border-b border-surface-300 flex items-center gap-3', course.bg)}>
          <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center border', course.bg, course.border)}>
            <LessonIcon className={cn('h-5 w-5', course.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono text-surface-500">{course.title}</p>
            <p className="text-sm font-mono font-bold text-white truncate">{lesson.title}</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-surface-200 flex items-center justify-center text-surface-500 hover:text-white hover:bg-surface-300 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress tabs */}
        <div className="px-6 pt-4 pb-0 flex gap-1">
          {(['reading', 'challenge', 'quiz'] as LessonView[]).map((v) => {
            const isActive = view === v || (view === 'done' && v === 'quiz')
            const isPast =
              (v === 'reading' && (view === 'challenge' || view === 'quiz' || view === 'done')) ||
              (v === 'challenge' && (view === 'quiz' || view === 'done'))
            return (
              <div
                key={v}
                className={cn(
                  'flex-1 h-1 rounded-full transition-colors',
                  isActive || isPast ? course.color.replace('text-', 'bg-') : 'bg-surface-300'
                )}
              />
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            {view === 'reading' && (
              <motion.div key="reading" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="h-4 w-4 text-surface-500" />
                  <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">Explanation · {lesson.duration}</span>
                </div>
                <p className="text-sm text-surface-100 leading-relaxed mb-5">{lesson.explanation}</p>
                <div className={cn('rounded-xl border p-4 space-y-2', course.bg, course.border)}>
                  <p className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">Key Points</p>
                  {lesson.keyPoints.map((pt, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className={cn('h-3.5 w-3.5 mt-0.5 flex-shrink-0', course.color)} />
                      <p className="text-xs text-surface-200 leading-relaxed">{pt}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {view === 'challenge' && (
              <motion.div key="challenge" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="h-4 w-4 text-surface-500" />
                  <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">Practical Challenge</span>
                </div>
                <div className={cn('rounded-xl border p-5', course.bg, course.border)}>
                  <p className="text-base font-mono font-bold text-white mb-2">{lesson.challenge.label}</p>
                  <p className="text-sm text-surface-300 mb-5">{lesson.challenge.description}</p>
                  <Link
                    href={lesson.challenge.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-mono font-semibold',
                      'transition-all border',
                      course.bg, course.border,
                      course.color,
                      'hover:brightness-125'
                    )}
                  >
                    Open challenge
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <p className="text-xs text-surface-500 mt-4 text-center">
                  Complete the challenge on the platform, then continue to the knowledge check.
                </p>
              </motion.div>
            )}

            {view === 'quiz' && (
              <motion.div key="quiz" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="h-4 w-4 text-surface-500" />
                  <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">Knowledge Check</span>
                </div>
                <p className="text-sm font-mono font-semibold text-white mb-5">{lesson.quiz.question}</p>
                <div className="space-y-2 mb-5">
                  {lesson.quiz.options.map((opt, i) => {
                    const isSelected = selectedAnswer === i
                    const isCorrectOpt = i === lesson.quiz.correctIndex
                    let cls = 'bg-surface-200 border-surface-400 text-surface-200'
                    if (submitted) {
                      if (isCorrectOpt) cls = 'bg-emerald/15 border-emerald/50 text-emerald'
                      else if (isSelected && !isCorrectOpt) cls = 'bg-against-500/15 border-against-500/50 text-against-300'
                    } else if (isSelected) {
                      cls = cn(course.bg, course.border, course.color)
                    }
                    return (
                      <button
                        key={i}
                        onClick={() => { if (!submitted) setSelectedAnswer(i) }}
                        disabled={submitted}
                        className={cn(
                          'w-full text-left px-4 py-3 rounded-xl border text-sm font-mono transition-all',
                          cls
                        )}
                      >
                        <span className="text-surface-500 mr-2">{String.fromCharCode(65 + i)}.</span>
                        {opt}
                      </button>
                    )
                  })}
                </div>
                {submitted && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'rounded-xl border p-4 mb-4',
                      isCorrect ? 'bg-emerald/10 border-emerald/30' : 'bg-against-500/10 border-against-500/30'
                    )}
                  >
                    <p className={cn('text-xs font-mono font-semibold mb-1', isCorrect ? 'text-emerald' : 'text-against-300')}>
                      {isCorrect ? 'Correct!' : 'Not quite — try again'}
                    </p>
                    <p className="text-xs text-surface-300 leading-relaxed">{lesson.quiz.explanation}</p>
                  </motion.div>
                )}
                {!submitted && (
                  <button
                    onClick={handleSubmitQuiz}
                    disabled={selectedAnswer === null}
                    className={cn(
                      'w-full py-3 rounded-xl text-sm font-mono font-semibold transition-all',
                      selectedAnswer !== null
                        ? cn('border', course.bg, course.border, course.color, 'hover:brightness-125')
                        : 'bg-surface-200 border border-surface-300 text-surface-500 cursor-not-allowed'
                    )}
                  >
                    Submit answer
                  </button>
                )}
                {submitted && !isCorrect && (
                  <button
                    onClick={() => { setSelectedAnswer(null); setSubmitted(false) }}
                    className="w-full py-3 rounded-xl text-sm font-mono font-semibold bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors"
                  >
                    Try again
                  </button>
                )}
              </motion.div>
            )}

            {view === 'done' && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-8 text-center">
                <div className={cn('h-16 w-16 rounded-2xl mx-auto flex items-center justify-center mb-4', course.bg, course.border, 'border')}>
                  <CheckCircle2 className={cn('h-8 w-8', course.color)} />
                </div>
                <p className="text-lg font-mono font-bold text-white mb-1">Lesson complete</p>
                <p className="text-sm text-surface-400 mb-6">{lesson.title}</p>
                <button
                  onClick={onClose}
                  className={cn(
                    'px-6 py-3 rounded-xl text-sm font-mono font-semibold border transition-all',
                    course.bg, course.border, course.color, 'hover:brightness-125'
                  )}
                >
                  Back to course
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation footer */}
        {view !== 'done' && (
          <div className="px-6 py-4 border-t border-surface-300 flex items-center justify-between bg-surface-100">
            <button
              onClick={() => {
                if (view === 'quiz') setView('challenge')
                else if (view === 'challenge') setView('reading')
              }}
              disabled={view === 'reading'}
              className="flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              onClick={() => {
                if (view === 'reading') setView('challenge')
                else if (view === 'challenge') setView('quiz')
              }}
              disabled={view === 'quiz'}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono font-semibold border transition-all',
                view !== 'quiz'
                  ? cn(course.bg, course.border, course.color, 'hover:brightness-125')
                  : 'bg-surface-200 border-surface-300 text-surface-500 cursor-not-allowed opacity-40'
              )}
            >
              {view === 'reading' ? 'Practise' : 'Take quiz'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Course detail view ───────────────────────────────────────────────────────

function CourseDetail({
  course,
  progress,
  onBack,
  onComplete,
}: {
  course: Course
  progress: AcademyProgress
  onBack: () => void
  onComplete: (lessonId: string) => void
}) {
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null)
  const Icon = course.icon
  const completedInCourse = course.lessons.filter((l) => progress.completedLessons.includes(l.id)).length
  const pct = Math.round((completedInCourse / course.lessons.length) * 100)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="h-9 w-9 rounded-xl bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 flex items-center justify-center transition-colors flex-shrink-0"
          aria-label="Back to courses"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Icon className={cn('h-4 w-4', course.color)} />
            <span className={cn('text-xs font-mono font-semibold', course.color)}>{course.subtitle}</span>
          </div>
          <h2 className="text-xl font-mono font-bold text-white">{course.title}</h2>
        </div>
      </div>

      {/* Progress summary */}
      <div className={cn('rounded-2xl border p-5', course.bg, course.border)}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-mono text-surface-300">Course progress</span>
          <span className={cn('text-sm font-mono font-bold', course.color)}>{pct}%</span>
        </div>
        <div className="h-2 bg-surface-300/50 rounded-full overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', course.color.replace('text-', 'bg-'))}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </div>
        <p className="text-xs text-surface-500 mt-2">{completedInCourse} of {course.lessons.length} lessons completed</p>
      </div>

      {/* Lessons list */}
      <div className="space-y-3">
        {course.lessons.map((lesson, idx) => {
          const done = progress.completedLessons.includes(lesson.id)
          const LIcon = lesson.icon
          const prev = idx > 0 ? course.lessons[idx - 1] : null
          const prevDone = prev ? progress.completedLessons.includes(prev.id) : true
          const unlocked = idx === 0 || prevDone

          return (
            <motion.button
              key={lesson.id}
              onClick={() => unlocked && setActiveLesson(lesson)}
              disabled={!unlocked}
              whileHover={unlocked ? { scale: 1.01 } : {}}
              whileTap={unlocked ? { scale: 0.99 } : {}}
              className={cn(
                'w-full text-left p-4 rounded-2xl border transition-all',
                done
                  ? cn(course.bg, course.border.replace('/30', '/60'))
                  : unlocked
                  ? 'bg-surface-100 border-surface-300 hover:border-surface-400 hover:bg-surface-200'
                  : 'bg-surface-100/50 border-surface-200 opacity-50 cursor-not-allowed'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 border',
                  done ? cn(course.bg, course.border) : 'bg-surface-200 border-surface-300'
                )}>
                  {done
                    ? <CheckCircle2 className={cn('h-5 w-5', course.color)} />
                    : <LIcon className={cn('h-5 w-5', unlocked ? 'text-surface-400' : 'text-surface-500')} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-mono font-semibold', done ? 'text-white' : unlocked ? 'text-surface-100' : 'text-surface-500')}>
                    {idx + 1}. {lesson.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-surface-500">{lesson.duration}</span>
                    {done && <span className={cn('text-xs font-mono font-semibold', course.color)}>Complete</span>}
                    {!done && unlocked && <span className="text-xs text-surface-500">Ready</span>}
                    {!unlocked && <span className="text-xs text-surface-500">Locked</span>}
                  </div>
                </div>
                {unlocked && !done && <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0" />}
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* Lesson modal */}
      <AnimatePresence>
        {activeLesson && (
          <LessonModal
            course={course}
            lesson={activeLesson}
            isCompleted={progress.completedLessons.includes(activeLesson.id)}
            onClose={() => setActiveLesson(null)}
            onComplete={(id) => {
              onComplete(id)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AcademyClient() {
  const [progress, setProgress] = useState<AcademyProgress>({ completedLessons: [], quizAnswers: {} })
  const [activeCourse, setActiveCourse] = useState<Course | null>(null)

  useEffect(() => {
    setProgress(loadProgress())
  }, [])

  const handleComplete = useCallback((lessonId: string) => {
    setProgress((prev) => {
      if (prev.completedLessons.includes(lessonId)) return prev
      const next = { ...prev, completedLessons: [...prev.completedLessons, lessonId] }
      saveProgress(next)
      return next
    })
  }, [])

  const totalLessons = COURSES.reduce((s, c) => s + c.lessons.length, 0)
  const totalCompleted = progress.completedLessons.length
  const overallPct = Math.round((totalCompleted / totalLessons) * 100)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12">
        <AnimatePresence mode="wait">
          {activeCourse ? (
            <motion.div
              key={activeCourse.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
            >
              <CourseDetail
                course={activeCourse}
                progress={progress}
                onBack={() => setActiveCourse(null)}
                onComplete={handleComplete}
              />
            </motion.div>
          ) : (
            <motion.div
              key="home"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              {/* Hero */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-12 w-12 rounded-2xl bg-for-500/10 border border-for-500/30 flex items-center justify-center">
                    <GraduationCap className="h-6 w-6 text-for-400" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-mono font-bold text-white">Civic Academy</h1>
                    <p className="text-sm text-surface-500">Four courses · {totalLessons} lessons</p>
                  </div>
                </div>
                <p className="text-sm text-surface-400 leading-relaxed mb-4">
                  Learn how democracy works on Lobby Market, sharpen your debate skills, think critically about civic claims,
                  and build the influence to make your voice count.
                </p>

                {/* Overall progress */}
                <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-surface-500">Overall progress</span>
                    <span className="text-xs font-mono font-bold text-white">{totalCompleted}/{totalLessons} lessons</span>
                  </div>
                  <div className="h-2 bg-surface-300 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${overallPct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                  {totalCompleted === totalLessons && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 mt-2"
                    >
                      <Gavel className="h-3.5 w-3.5 text-gold" />
                      <span className="text-xs font-mono font-bold text-gold">Academy complete — full Civic credential earned</span>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Course grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {COURSES.map((course) => {
                  const completed = course.lessons.filter((l) =>
                    progress.completedLessons.includes(l.id)
                  ).length
                  return (
                    <CourseCard
                      key={course.id}
                      course={course}
                      completedCount={completed}
                      totalCount={course.lessons.length}
                      onClick={() => setActiveCourse(course)}
                    />
                  )
                })}
              </div>

              {/* Quick links */}
              <div>
                <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">Related tools</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { href: '/training', icon: Brain, label: 'Argument Training', color: 'text-purple' },
                    { href: '/calibration', icon: Scale, label: 'Prediction Calibration', color: 'text-gold' },
                    { href: '/fingerprint', icon: Sparkles, label: 'Civic Fingerprint', color: 'text-for-400' },
                    { href: '/flashcards', icon: BookOpen, label: 'Law Flashcards', color: 'text-emerald' },
                    { href: '/simulate', icon: Zap, label: 'Policy Simulator', color: 'text-against-400' },
                    { href: '/debate', icon: MessageSquare, label: 'Live Debates', color: 'text-for-300' },
                  ].map(({ href, icon: LIcon, label, color }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-all"
                    >
                      <LIcon className={cn('h-4 w-4 flex-shrink-0', color)} />
                      <span className="text-xs font-mono text-surface-300 truncate">{label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
