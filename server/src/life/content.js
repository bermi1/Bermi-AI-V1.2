import { storage } from '../storage/index.js'

// Curated learning & wellbeing content. Two rules shape everything here:
//
//  1. Only original writing or public-domain works. The concept notes below
//     are ORIGINAL explanations of the central ideas of public-domain books —
//     no quotations, no page or chapter numbers (so nothing can be misquoted
//     or mis-cited), and each links to the public-domain source for the
//     reader to check. Purchasing/owning a book never grants redistribution
//     rights, so copyrighted titles are added only with documented permission.
//  2. Everything is editable in Bermi Control (draft → review → published) and
//     only PUBLISHED items ever reach users. Seeds below ship as published but
//     should still get an editorial read — see docs/life-os.md.
//
// Admin edits live in one settings row ("content:library") layered over these
// seeds, so deploying new code never overwrites editorial changes.

const gut = (q) => `https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(q)}`

export const SEED_BOOKS = [
  {
    id: 'as-a-man-thinketh',
    title: 'As a Man Thinketh',
    author: 'James Allen',
    year: 1903,
    publisher: 'Public domain',
    blurb: 'A short classic on how habitual thinking shapes character and, over time, circumstances.',
    license: 'Public domain',
    sourceUrl: gut('As a Man Thinketh James Allen'),
    status: 'published',
  },
  {
    id: 'meditations',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    year: 180,
    publisher: 'Public domain (19th-century English translations)',
    blurb: "A Roman emperor's private notebook of Stoic practice: focus on what you can control and meet each day with clear judgement.",
    license: 'Public domain (original work and older translations; modern translations are copyrighted)',
    sourceUrl: gut('Meditations Marcus Aurelius'),
    status: 'published',
  },
  {
    id: 'art-of-war',
    title: 'The Art of War',
    author: 'Sun Tzu',
    year: -500,
    publisher: 'Public domain (Lionel Giles translation, 1910)',
    blurb: 'An ancient treatise on strategy — preparation, self-knowledge and choosing your battles — widely applied to modern planning.',
    license: 'Public domain (original work and the 1910 translation)',
    sourceUrl: gut('Art of War Sun Tzu'),
    status: 'published',
  },
  {
    id: 'self-help',
    title: 'Self-Help',
    author: 'Samuel Smiles',
    year: 1859,
    publisher: 'Public domain',
    blurb: 'A Victorian bestseller on perseverance, character and self-reliance, told through the lives of people who built their own progress.',
    license: 'Public domain',
    sourceUrl: gut('Self-Help Samuel Smiles'),
    status: 'published',
  },
  {
    id: 'franklin-autobiography',
    title: 'The Autobiography of Benjamin Franklin',
    author: 'Benjamin Franklin',
    year: 1791,
    publisher: 'Public domain',
    blurb: "Franklin's account of building himself deliberately — daily routines, a system for practising virtues, and a club for mutual improvement.",
    license: 'Public domain',
    sourceUrl: gut('Autobiography of Benjamin Franklin'),
    status: 'published',
  },
]

const c = (bookId, id, concept, explanation, example, takeaways, action, reflection) => ({
  id, bookId, concept, explanation, example, takeaways, action, reflection,
  source: 'Bermi editorial — original summary of a public-domain work',
  status: 'published',
})

export const SEED_CONCEPTS = [
  c('as-a-man-thinketh', 'thinketh-seeds', 'Thoughts are seeds',
    "Allen's central image is that the mind is a garden: whatever you plant in it by repeated thought grows, whether you planted it on purpose or let it arrive by accident. Over time, recurring thoughts harden into habits, and habits into the shape of a life.",
    "A student who keeps telling herself \"I'm just bad at maths\" avoids practice, gets fewer chances to improve, and then takes the poor result as proof. A different repeated thought — \"I haven't learned this yet\" — leads to different actions.",
    ['Repeated thoughts become habits; habits become character.', 'You cannot choose every thought, but you can choose which ones to keep feeding.', 'Change usually shows up slowly, then looks sudden.'],
    'Write down one thought you repeat that holds you back, and rewrite it as something true and useful.',
    'Which thought have I been watering lately without deciding to?'),
  c('as-a-man-thinketh', 'thinketh-purpose', 'A clear purpose steadies the mind',
    'The book argues that a person without a definite purpose drifts, and that worry and confusion fill the space a purpose would occupy. Choosing one worthwhile aim and organising effort around it gives thought a direction to run in.',
    'Someone preparing for a scholarship interview who commits to one clear goal — present three strong projects — stops spreading attention over twenty small anxieties.',
    ['Drifting is a decision to let other things steer.', 'One aim is easier to serve than many.', 'Purpose is practised daily, not declared once.'],
    "Choose one aim for this week and note the first action it demands tomorrow.",
    'What one purpose would make my other worries smaller?'),
  c('meditations', 'meditations-control', 'Separate what you control from what you do not',
    'A recurring Stoic practice in the Meditations is sorting every troubling situation into what is up to you (your judgements, effort and choices) and what is not (other people, outcomes, the past). Energy spent on the second group is energy taken from the first.',
    'You can prepare thoroughly for an exam, but you cannot control the questions or how the marker feels. Preparing is yours; the paper is not.',
    ['Judgements and effort are yours; outcomes mostly are not.', 'Anxiety often comes from treating the second kind as the first.', 'Do your part fully, then let the rest be.'],
    "List what's worrying you today in two columns — mine / not mine — and act only on the first.",
    'What am I trying to control that I never could?'),
  c('meditations', 'meditations-obstacle', 'The obstacle can become the path',
    "Marcus repeatedly reminds himself that an obstacle is also material to work with: a difficulty practises patience, a rude person practises restraint. The event is fixed; what it turns into depends on the response.",
    'A group member drops out the night before a presentation. It is a chance to practise calm planning and clear delegation.',
    ['The event is neutral until we respond.', 'Difficulty is where skills are actually built.', 'Ask "what does this let me practise?" before "why me?"'],
    'Pick one current frustration and name the specific skill it is asking of you.',
    'What is this obstacle giving me a chance to get better at?'),
  c('art-of-war', 'war-preparation', 'Prepare before the effort begins',
    'A major theme of the Art of War is that outcomes are largely decided before the contest: by preparation, by understanding the situation, and by knowing your own strengths and limits. Rushing in unprepared spends resources the plan should have saved.',
    'Before a major assignment, a student maps the deadline, the marking criteria and the time available, then schedules the hard part first — instead of starting blindly the night before.',
    ['Most of the work is in the preparation.', 'Know the terrain: requirements, time, resources.', 'Plan your effort the way you would plan a budget.'],
    "Before your next big task, spend ten minutes writing the finish line, the steps and the time each needs.",
    'Where am I acting before I have understood the situation?'),
  c('art-of-war', 'war-self-knowledge', 'Know yourself as well as the challenge',
    "The text pairs understanding the opponent with understanding yourself: someone who knows only the challenge, or only themselves, is at a disadvantage. Honest self-assessment tells you where to lean and where you need help.",
    'A learner who knows evenings are her focused time, and that she loses hours on her phone in the afternoon, schedules study accordingly rather than trusting willpower.',
    ['Honest self-knowledge is a practical tool.', 'Design around your weak spots instead of denying them.', 'Use strengths on purpose.'],
    "Note one time of day you work best and one reliable distraction, and plan around both this week.",
    'What do I know about how I work that I keep ignoring?'),
  c('self-help', 'smiles-perseverance', 'Perseverance beats talent that quits',
    "Smiles collects stories of people whose results came from sustained, patient effort more than from unusual gifts. The pattern he stresses is that ordinary ability applied steadily tends to outlast brilliance applied occasionally.",
    'A learner who practises code for thirty minutes every day for three months usually ends up ahead of someone who studies for ten hours on one weekend and then stops.',
    ['Consistency compounds.', 'Small daily effort is more reliable than bursts.', 'Setbacks are normal on the road, not signs to stop.'],
    'Choose a skill and commit to a small daily amount — then track it for seven days.',
    'What would I be good at in a year if I did a little each day?'),
  c('self-help', 'smiles-time', 'Treat time as the raw material of life',
    "The book treats time as something to be used deliberately, since wasted hours are not recovered and small neglected moments add up. Making a habit of purposeful use of spare minutes is presented as a mark of character.",
    "Using a daily bus ride for flashcards instead of scrolling adds up to dozens of hours of revision over a term.",
    ['Small gaps of time add up.', 'Spending time is a daily choice.', 'Order and punctuality make other things easier.'],
    'Identify one regular ten-minute gap in your day and decide what you will do with it.',
    'Where does my time go when I am not deciding?'),
  c('franklin-autobiography', 'franklin-virtues', 'Practise one virtue at a time',
    "Franklin describes choosing a short list of qualities he wanted to build and working on them one at a time, checking himself each day, rather than trying to change everything at once. The method turns a vague wish to \"be better\" into a trackable habit.",
    'Rather than \"get fit, read more, sleep earlier, save money\" all at once, choose one and track it daily for two weeks before adding the next.',
    ['Focus on one improvement at a time.', 'A daily check turns intention into evidence.', 'Review progress honestly and kindly.'],
    'Pick one habit to build for the next two weeks and add it to your daily check-in.',
    'What single habit would I most like to have in a month?'),
  c('franklin-autobiography', 'franklin-junto', 'Learn faster in a circle of mutual improvement',
    "Franklin organised a small club of friends who met regularly to discuss ideas, questions and projects, and to help each other improve. Learning with committed peers adds accountability, new perspectives and encouragement.",
    'A study group that meets weekly to explain topics to one another often learns more than the same people studying alone.',
    ['Teaching and discussing sharpen understanding.', 'Peers create accountability.', 'Keep the group small and the purpose clear.'],
    'Invite one or two friends to a weekly 30-minute study conversation.',
    'Who could I learn alongside this month?'),
]

export const SEED_VERSES = [
  { id: 'v-ps23-1', tradition: 'christian', reference: 'Psalm 23:1', text: 'The LORD is my shepherd; I shall not want.', prompt: 'What does it mean to feel provided for today?' },
  { id: 'v-pr3-5', tradition: 'christian', reference: 'Proverbs 3:5–6', text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.', prompt: 'Where am I relying only on my own understanding right now?' },
  { id: 'v-phil4-6', tradition: 'christian', reference: 'Philippians 4:6–7', text: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God. And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.', prompt: 'What would I like to hand over in prayer today?' },
  { id: 'v-josh1-9', tradition: 'christian', reference: 'Joshua 1:9', text: 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.', prompt: 'Where do I need courage this week?' },
  { id: 'v-isa40-31', tradition: 'christian', reference: 'Isaiah 40:31', text: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.', prompt: 'What would renewed strength look like for me?' },
  { id: 'v-mt11-28', tradition: 'christian', reference: 'Matthew 11:28', text: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.', prompt: 'What burden could I set down for a moment?' },
].map((v) => ({
  ...v,
  translation: 'King James Version',
  license: 'Public domain in the United States. Crown copyright applies in the United Kingdom — editorial to confirm before wider distribution.',
  status: 'published',
}))

// Guided sessions: original scripts. `steps` are shown in order, evenly
// spread across the chosen duration; nothing here makes health claims.
export const SEED_SESSIONS = [
  { id: 'calm-breath', type: 'meditation', title: 'Calm breathing', minutes: 3, blurb: 'Slow your breathing and settle your attention.', steps: ['Sit comfortably and let your shoulders drop.', 'Breathe in slowly through your nose.', 'Breathe out gently, a little longer than you breathed in.', 'If your mind wanders, that is normal. Notice it and return to your breath.', 'Keep a slow, easy rhythm.', 'Take one last deep breath, and when you are ready, open your eyes.'] },
  { id: 'body-scan', type: 'meditation', title: 'Body scan', minutes: 5, blurb: 'Move your attention slowly through the body, releasing tension.', steps: ['Settle in and take three slow breaths.', 'Bring attention to your feet. Notice them without changing anything.', 'Move up through your legs, letting them feel heavy and supported.', 'Notice your stomach and chest rising and falling.', 'Relax your hands, arms and shoulders.', 'Soften your jaw, your eyes and your forehead.', 'Rest in the whole body for a few breaths, then slowly return.'] },
  { id: 'before-exam', type: 'meditation', title: 'Before an exam', minutes: 4, blurb: 'Steady yourself when nerves are high.', steps: ['Put your feet flat on the floor and feel the ground hold you.', 'Breathe in for four, out for six. Repeat.', 'Remind yourself: you have prepared as well as you could.', 'Let the nerves be there without arguing with them.', 'Choose your first action for the paper, and keep it simple.', 'Take a last slow breath and begin.'] },
  { id: 'gratitude-pause', type: 'meditation', title: 'Gratitude pause', minutes: 3, blurb: 'A short pause to notice what is going well.', steps: ['Take a slow breath and let your attention settle.', 'Think of one thing from today you are glad of.', 'Think of one person who helped you recently.', 'Think of one small comfort you often overlook.', 'Rest in that feeling for a moment, then carry it with you.'] },
  { id: 'wind-down', type: 'sleep', title: 'Wind down for sleep', minutes: 6, blurb: 'A gentle routine to ease out of the day.', steps: ['Dim the lights and put your screen away if you can.', 'Let your breathing slow without forcing it.', 'Review the day kindly: one thing that went well.', 'Set down tomorrow\'s worries — they will still be there in the morning.', 'Relax your muscles from your feet up to your face.', 'Let your breathing carry you toward rest.'] },
].map((s) => ({ ...s, status: 'published', source: 'Bermi editorial — original script' }))

const KEY = 'content:library'

async function readOverrides() {
  try {
    const raw = await storage.getSetting(KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return { books: parsed.books ?? [], concepts: parsed.concepts ?? [], verses: parsed.verses ?? [], sessions: parsed.sessions ?? [], audio: parsed.audio ?? [] }
  } catch {
    return { books: [], concepts: [], verses: [], sessions: [], audio: [] }
  }
}

function layer(seed, overrides) {
  const byId = new Map(seed.map((x) => [x.id, x]))
  for (const o of overrides) byId.set(o.id, { ...(byId.get(o.id) ?? {}), ...o })
  return [...byId.values()].filter((x) => !x.deleted)
}

/** Everything, any status — for the content admin. */
export async function allContent() {
  const o = await readOverrides()
  return {
    books: layer(SEED_BOOKS, o.books),
    concepts: layer(SEED_CONCEPTS, o.concepts),
    verses: layer(SEED_VERSES, o.verses),
    sessions: layer(SEED_SESSIONS, o.sessions),
    audio: layer([], o.audio),
  }
}

const published = (xs) => xs.filter((x) => x.status === 'published')

/** What users may see: published items only. */
export async function publishedContent() {
  const a = await allContent()
  return { books: published(a.books), concepts: published(a.concepts), verses: published(a.verses), sessions: published(a.sessions), audio: published(a.audio) }
}

export async function saveOverride(collection, item) {
  const o = await readOverrides()
  if (!(collection in o)) throw new Error('Unknown collection')
  const i = o[collection].findIndex((x) => x.id === item.id)
  if (i >= 0) o[collection][i] = { ...o[collection][i], ...item }
  else o[collection].push(item)
  await storage.setSetting(KEY, JSON.stringify(o))
}

const daysSinceEpoch = (ymd) => Math.floor(new Date(`${ymd}T00:00:00Z`).getTime() / 86_400_000)

/** Same concept for every user on a given day: scheduled one wins, else a stable rotation. */
export function pickDaily(items, ymd) {
  if (!items.length) return null
  const scheduled = items.find((x) => x.scheduledFor === ymd)
  if (scheduled) return scheduled
  const pool = items.filter((x) => !x.scheduledFor)
  const list = pool.length ? pool : items
  return list[daysSinceEpoch(ymd) % list.length]
}
