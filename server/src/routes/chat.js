import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { storage } from '../storage/index.js'
import { streamCompletion, complete } from '../openrouter.js'
import { STUDY_PROMPT, awardStudy, parseMasteredSteps, syncLessonProgress, titleSimilarity } from '../study.js'
import { BERMI_FEATURES_PROMPT } from '../features.js'
import { getMemory, remember, maybeDeepConsolidate } from '../memory.js'
import { summarizeVideo } from '../video.js'
import { webSearch } from '../websearch.js'
import { rateLimit, checkRateLimit, peekRateLimit } from '../rateLimit.js'
import { quickBuildPersonalOffering } from './learn.js'

export const chatRouter = Router()

const BASE_PROMPT =
  'You are Bermi AI: a productivity and educational AI first — built to help someone get real work done and ' +
  'genuinely learn, not just chat. Let that shape how you help by default: when relevant, favor the answer that ' +
  'moves their actual work or learning forward (a usable draft, a clear next step, a taught concept) over a purely ' +
  'conversational reply, and where it naturally fits, mention a concrete way Bermi itself can help further — ' +
  'Study Mode to learn a topic properly, Discover your niche to find a focus/audience/content plan, building a ' +
  'course or document, or teaching a knowledge base — without forcing it into unrelated answers or turning every ' +
  'reply into a pitch. ' +
  'Before you answer, silently refine the request: work out the true intent, fill obvious gaps, and plan the ' +
  'clearest, most complete response — then reply with that improved understanding (never show this planning). ' +
  'STAY ON TOPIC: answer exactly what the user asked, directly and fully; do not drift into unrelated tangents, ' +
  'filler, or unrequested topics. If the request is broad, cover it thoroughly and stay within its scope. ' +
  'MATCH LENGTH TO INTENT: a short, simple, or single-fact question gets a short, direct answer — one sentence or ' +
  'a tight paragraph, no headers, no padding, no unrequested caveats or follow-up questions tacked on. A broad, ' +
  'multi-part, or genuinely complex question gets a full, thorough, well-structured answer. Never inflate a quick ' +
  "question into an essay to seem thorough, and never compress a complex one to seem concise — read what the " +
  'user actually needs and size the reply to that, not to a fixed style. ' +
  'Be genuinely useful and expansive when depth helps, concise when it does not. ' +
  'BE GENUINELY HONEST, NEVER JUST AGREEABLE: never call an idea, plan, piece of writing, code, or reasoning good ' +
  'just to be pleasant, avoid conflict, or keep the mood upbeat — if it has real problems, weak logic, an error, or ' +
  "a gap, say so plainly and specifically, then help fix it. Do not pad criticism into mush, bury it under praise, " +
  'or manufacture enthusiasm you do not actually have; a compelling, encouraging tone is worthless if it is not ' +
  'true. When something is genuinely strong, say that plainly too — praise should be earned and specific ("this ' +
  'works because X"), never automatic or generic. If the user is wrong about a fact, or their plan has a real flaw, ' +
  'say so directly, including when they seem attached to it or when it would be easier to just agree — being ' +
  'genuinely helpful sometimes means telling someone something they do not want to hear. This is about honesty, ' +
  'not harshness: stay respectful and constructive, but never sacrifice truth for comfort. ' +
  'Format responses in Markdown. Use tables where they aid clarity. ' +
  'Your trained knowledge has a real cutoff and is not current — for anything time-sensitive (news, prices, ' +
  'schedules, scores, releases, "latest"/"current"/"today", or anything that could plausibly have changed), Bermi ' +
  'ALREADY automatically searches the live web for you before you answer, with no action needed from the user — ' +
  'when those results are present below, treat them as more current and reliable than your own trained knowledge ' +
  'and cite them naturally. If no web results are present for something clearly time-sensitive, that means this ' +
  "particular live search did not turn up enough — it does NOT mean search is off or needs enabling (there is no " +
  'such toggle to mention). In that case say plainly, in one line, that you could not find current information on ' +
  "this just now and the user should try again shortly or rephrase with more specific terms — never guess from " +
  "stale training data, never invent or state a specific training-cutoff year/date (you don't reliably know your " +
  'own), and never tell the user to "turn on search", "enable a feature", or go check an external source ' +
  'themselves — Bermi already tried, so offer to keep trying instead. ' +
  'IMPORTANT: only include code blocks when the user is actually asking about programming or explicitly wants ' +
  'code. For everyday, factual, or non-technical questions, answer in prose and DO NOT append example code, ' +
  'commands, or snippets. Match the format to the question. ' +
  'Write ALL mathematics in LaTeX: $...$ for inline and $$...$$ for display equations. ' +
  'For any math problem, show clear step-by-step working, then give the final answer on its own line as ' +
  '**Answer:** $...$. When a function, curve, inequality region or dataset would be clearer as a graph, add a ' +
  'fenced code block with the language `plot` containing one expression in x per line ' +
  '(for example a block with `y = x^2` then `y = sin(x)`); Bermi renders these as an interactive graph. ' +
  'Optionally set the range with a first line like `# x: -10..10`. ' +
  'To play a course video, add a fenced code block with the language `video` containing `url: <link>` and ' +
  'optionally `title: <text>` on their own lines — Bermi renders it as an inline player with captions when ' +
  'available. Only ever do this when a real video_url for the CURRENT lesson is explicitly given to you in ' +
  "context below; never fabricate one. Most lessons have no video at all — this is completely normal, especially " +
  "for a self-built/AI-generated course, which never has one. Do not mention, offer, or ask about a video unless " +
  "one is actually present in context for what's being discussed right now; a lesson with no video is a non-issue, " +
  'not something to bring up or apologize for.'

/**
 * System prompt = base + user personalization + enabled brains. The company
 * and personal brains are persistent knowledge stores the user curates; they
 * ride along on every request since the LLM API is stateless.
 */
async function buildSystemPrompt(userId, study = false) {
  const parts = [study ? STUDY_PROMPT : BASE_PROMPT]

  // Bermi's self-knowledge: current features & updates, so it can answer
  // "what's new?" / "what can you do?" accurately instead of guessing.
  parts.push(`# About Bermi (yourself)\n${BERMI_FEATURES_PROMPT}`)

  const [name, role, prefs, memory] = await Promise.all([
    storage.getSetting(`u:${userId}:profile_name`),
    storage.getSetting(`u:${userId}:profile_role`),
    storage.getSetting(`u:${userId}:profile_preferences`),
    getMemory(userId),
  ])
  const personal = []
  if (name) personal.push(`The user's name is ${name}.`)
  if (role) personal.push(`About their work: ${role}.`)
  if (prefs) personal.push(`Preferences for how you should respond: ${prefs}`)
  if (personal.length) parts.push(`# About the user\n${personal.join('\n')}`)

  // Cross-conversation memory: what Bermi remembers about this person from
  // EVERY past conversation, not just the current one — this is what makes
  // it feel continuous rather than starting fresh every time.
  if (memory) {
    parts.push(
      `# What you remember about this person (from past conversations)\n${memory}\n\n` +
        'Use this naturally where relevant — do not recite it verbatim or announce that you are "recalling" it.',
    )
  }

  const brains = await storage.listBrains(userId)
  for (const brain of brains) {
    if (brain.enabled && brain.content?.trim()) {
      // Cap each brain's contribution so an oversized knowledge base cannot
      // blow up the request; stored content can be much larger.
      const content = brain.content.trim().slice(0, 20_000)
      parts.push(
        `# ${brain.name} (persistent knowledge — treat as reliable context)\n${content}`,
      )
    }
  }
  return parts.join('\n\n')
}

const TITLE_PROMPT =
  'You write short conversation titles. Read the user message and assistant reply below and output ONLY a ' +
  'specific, concrete title (3 to 6 words) capturing what this conversation is actually about — no quotes, no ' +
  'trailing punctuation, no generic filler like "Chat" or "Conversation" or "Assistance". Output the title text ' +
  'and nothing else.'

function sanitizeTitle(raw) {
  const cleaned = raw
    .split('\n')[0]
    .trim()
    .replace(/^["'“‘]+|["'”’]+$/g, '')
    .replace(/[.!?]+$/, '')
    .trim()
  return cleaned.length >= 2 && cleaned.length <= 80 ? cleaned : null
}

/**
 * Replaces a brand-new conversation's placeholder title (the user's first
 * message, verbatim — all that's known at creation time) with a real,
 * specific title once the first exchange exists to summarize. Best-effort:
 * on any failure the caller just keeps the placeholder, which is always a
 * valid (if blunter) title on its own.
 */
async function generateConversationTitle(message, assistantText) {
  const text = await complete({
    model: 'bermi-fast',
    maxTokens: 20,
    messages: [
      { role: 'system', content: TITLE_PROMPT },
      { role: 'user', content: `User: ${message.slice(0, 500)}\n\nAssistant: ${assistantText.slice(0, 800)}` },
    ],
  })
  return text ? sanitizeTitle(text) : null
}

// Only touch the LMS when the message is actually about learning/engaging
// with something an organization published, so normal chats stay fast and
// lean. Bermi Learn isn't education-only: an organization here can be a
// school (courses), but just as easily a bank or NGO (programs), a company
// or government body (events), or anyone with public material to hand out
// (resources) — so the trigger words and verbs below cover all four.
const LEARN_RE =
  /\b(courses?|class(es)?|lessons?|enroll?|enrol|enrolled|apply|applying|study|studying|learn(ing)?|certificate|programs?|programme|initiative|curriculum|syllabus|tutor|progress|recommend\w*|continue|graduate|what.{0,12}next|events?|register|registration|rsvp|attend\w*|resources?|materials?|download|briefing|workshop|webinar|service|services|shareholders?|update|announcement|offering)\b/i
const ENROLL_RE =
  /\b(enroll?|enrol|apply|applying|sign me up|sign up for|register|registration|rsvp|join|subscribe|get (?:the|a|this) (?:resource|report|guide|material)|download|access (?:the|this))\b/i
const VIDEO_SUMMARY_RE = /\b(summar(y|ize|ise)|tl;?dr|recap)\b.{0,25}\bvideo\b|\bvideo\b.{0,25}\b(summar(y|ize|ise)|tl;?dr|recap)\b/i
const VIDEO_PLAY_RE = /\b(play|watch|show|open)\b.{0,25}\bvideo\b/i
// Building your own course/program was never meant to require the dashboard
// wizard — someone can just ask for it in plain conversation and Bermi drafts
// and creates it right here, the same way the guided form does.
const BUILD_RE = /\b(build|create|make|design|draft)\b.{0,25}\b(course|program|class|curriculum|training|lesson plan)\b/i

function guessOfferingKind(message) {
  const lower = message.toLowerCase()
  if (/\b(event|workshop|webinar|briefing|seminar|conference|meetup)\b/.test(lower)) return 'event'
  if (/\b(program|process|onboarding|walkthrough|initiative|application)\b/.test(lower)) return 'program'
  if (/\b(resource|guide|report|explainer|faq)\b/.test(lower)) return 'resource'
  return 'course'
}

const KIND_NOUN = { course: 'course', program: 'program', event: 'event', resource: 'resource' }
const KIND_VERB_PAST = { course: 'enrolled', program: 'enrolled', event: 'registered', resource: 'given access to' }
const KIND_STEP_NOUN = { course: 'lesson', program: 'step', event: 'agenda item', resource: 'section' }

function formatEventWhen(course) {
  if (!course.event_at) return ''
  try {
    return new Date(course.event_at).toLocaleString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch {
    return course.event_at
  }
}

/**
 * Lets Bermi access everything organizations have published — courses,
 * programs, events, resources — and act on it agentically from chat: discuss
 * or recommend any of it, and enroll/register/grant-access to the user
 * directly when they ask, regardless of what kind of organization published
 * it or whether it has any "curriculum" at all. Returns a context block (the
 * catalog) and an action note (what the system already did) to append to the
 * system prompt.
 */
async function learningContext(user, message, conversationTitle, study, conversationId) {
  const userId = user.id
  // Keep computing this every turn once a Study Mode session is under way
  // (not just when the user's own wording happens to mention "course" or
  // "lesson"), so the real curriculum below stays grounded throughout —
  // not just on the turn that kicked it off.
  if (!LEARN_RE.test(message) && !study) return { block: '', note: '', enrolled: null }
  let courses = []
  let instById = new Map()
  try {
    const [cs, insts] = await Promise.all([
      storage.listPublishedCourses(),
      storage.listPublishedInstitutions(),
    ])
    courses = cs || []
    instById = new Map((insts || []).map((i) => [i.id, i]))
  } catch {
    // The public catalog failed to load (network hiccup, storage error) —
    // proceed with an empty catalog rather than bailing out entirely. A
    // build-your-own request or the user's own enrollments below don't
    // depend on the catalog at all, so a catalog outage must not silently
    // break those too.
  }
  // NOTE: deliberately no early return when the institution catalog is
  // empty. A personal, self-built course/program (see quickBuildPersonalOffering
  // below) is created with published:false — it never appears in
  // listPublishedCourses — so an account with no institution ever publishing
  // anything would otherwise never reach the build-your-own logic further
  // down, nor the user's own enrollment/curriculum lookups just below, both
  // of which are keyed off this user's own data, not the catalog.

  // Grouped by kind so the model sees "Bank X's loan program" next to other
  // programs, not lumped in with unrelated school courses.
  const byKind = { course: [], program: [], event: [], resource: [] }
  for (const c of courses) (byKind[c.kind] || byKind.course).push(c)

  const describe = (c) => {
    const inst = instById.get(c.institution_id)
    const obj = (c.objectives || '').replace(/\s+/g, ' ').trim().slice(0, 200)
    const evalGuide = (c.evaluation || '').replace(/\s+/g, ' ').trim().slice(0, 200)
    const when = c.kind === 'event' ? formatEventWhen(c) : ''
    return (
      `- "${c.title}"${c.kind === 'course' ? ` (${c.level || 'All levels'})` : ''} by ${inst?.name || 'an organization'}${c.summary ? ` — ${c.summary}` : ''}` +
      (when ? `\n    When: ${when}` : '') +
      (c.kind === 'event' && c.event_location ? `\n    Where: ${c.event_location}` : '') +
      (obj ? `\n    Objectives: ${obj}` : '') +
      (evalGuide ? `\n    Evaluation/guidelines: ${evalGuide}` : '')
    )
  }

  const sections = [
    ['course', 'Courses (taught step by step, mastery-gated)'],
    ['program', 'Programs (structured processes — e.g. an application, onboarding, or initiative to walk through)'],
    ['event', 'Events (register/RSVP — has a date and/or location)'],
    ['resource', 'Resources (reports, guides, policy explainers — get and understand, no steps to teach)'],
  ]
  const list = sections
    .filter(([kind]) => byKind[kind].length)
    .map(([kind, label]) => `## ${label}\n${byKind[kind].slice(0, 25).map(describe).join('\n')}`)
    .join('\n\n')

  // The user's own progress/status across everything they've engaged with —
  // powers "show my progress" and "what next". Also collects any lesson
  // videos across their active enrollments, so a "play/summarize the video"
  // request can be resolved to an actual video_url, without naming it.
  let progressBlock = ''
  let curriculumBlock = ''
  // The real name of whatever this conversation is actually about, once
  // confidently known — used in place of the raw conversation title (which
  // is just the user's first message, verbatim) when recording study
  // progress, so "topics studied" shows "Introduction to Bookkeeping"
  // instead of "i'd like to enroll in the course introduction to...".
  let topicTitle = null
  const videoLessons = [] // { course, lesson, nextUp }
  try {
    const enrollments = await storage.listEnrollmentsByUser(userId)
    const rows = []
    // Which active enrollment THIS conversation is actually about, so the
    // assistant works from its real, authored steps instead of inventing a
    // parallel structure — the mismatch between an invented breakdown and
    // the stored step titles is exactly why progress used to silently fail
    // to record.
    //
    // Preferred signal: an explicit pin set the first time this conversation
    // was grounded in a course (see below) — stable across turns regardless
    // of wording. Fuzzy title matching against the conversation's own title
    // is only a fallback for conversations that predate the pin, because the
    // title itself is NOT stable: generateConversationTitle rewrites it from
    // the raw first message to an AI-written summary after turn one, and
    // that rewritten wording can drift far enough from the course title to
    // silently drop below the match threshold — which is exactly why a
    // course would ground correctly on the turn it was built, then "forget"
    // its real curriculum and start improvising from turn two onward.
    let curriculumEntry = null
    let curriculumSim = 0
    let pinnedCourseId = null
    if (conversationId) {
      try {
        pinnedCourseId = await storage.getSetting(`conv-course:${conversationId}`)
      } catch {
        /* pin optional */
      }
    }
    for (const e of (enrollments || []).slice(0, 15)) {
      const course = await storage.getCourse(e.course_id)
      if (!course) continue
      const kind = course.kind || 'course'
      const stepNoun = KIND_STEP_NOUN[kind] || 'step'
      const lessons = await storage.listLessons(course.id)
      const progress = e.progress || {}
      const done = Object.values(progress).filter((p) => p && p.done).length
      const withVideo = lessons.filter((l) => l.video_url?.trim())
      const nextUpId = lessons.find((l) => !progress[l.id]?.done)?.id
      for (const l of withVideo) videoLessons.push({ course, lesson: l, nextUp: l.id === nextUpId })
      const statusWord = kind === 'event' ? (e.status === 'applied' ? 'requested' : 'registered') : e.status
      rows.push(
        `- "${course.title}" (${KIND_NOUN[kind] || 'course'}): ${statusWord}` +
          (kind === 'event' && course.event_at ? `, on ${formatEventWhen(course)}` : '') +
          (lessons.length && kind !== 'event' ? `, ${done}/${lessons.length} ${stepNoun}s done` : '') +
          (e.score != null ? `, average score ${e.score}%` : '') +
          (withVideo.length ? `. Has video for: ${withVideo.map((l) => `"${l.title}"`).join(', ')}` : ''),
      )
      if (e.status !== 'completed' && lessons.length && kind !== 'event') {
        if (pinnedCourseId && course.id === pinnedCourseId) {
          // Pin always wins outright — never let a fuzzy match on some other
          // enrollment's title outscore the course this conversation is
          // explicitly, deliberately about.
          curriculumSim = 1
          curriculumEntry = { course, lessons, progress, kind, stepNoun }
        } else if (curriculumSim < 1) {
          const sim = titleSimilarity(conversationTitle || message, course.title)
          if (sim > curriculumSim) {
            curriculumSim = sim
            curriculumEntry = { course, lessons, progress, kind, stepNoun }
          }
        }
      }
    }
    if (rows.length) {
      progressBlock = `\n\n# This user's status across everything they've joined\n${rows.join('\n')}`
    }
    if (curriculumEntry && curriculumSim >= 0.4) {
      const { course, lessons, progress, kind, stepNoun } = curriculumEntry
      topicTitle = course.title
      // Pin (or re-confirm the pin) so every later turn in this conversation
      // resolves this exact course instantly, without re-deriving it from
      // wording that can and does drift.
      if (conversationId && pinnedCourseId !== course.id) {
        storage.setSetting(`conv-course:${conversationId}`, course.id).catch(() => {})
      }
      const ordered = [...lessons].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
      const nextLesson = ordered.find((l) => !progress[l.id]?.done)
      const checklist = ordered.map((l, i) => `${progress[l.id]?.done ? '[x]' : '[ ]'} ${i + 1}. ${l.title}`).join('\n')
      const marker = kind === 'course' ? 'Mastered' : 'Completed'
      const verb = kind === 'course' ? 'teach' : kind === 'resource' ? 'present' : 'guide them through'
      curriculumBlock =
        `\n\n# Real ${kind === 'course' ? 'curriculum' : 'structure'} for "${course.title}" (${KIND_NOUN[kind]}) — ${verb.toUpperCase()} FROM THIS, do not invent a different ${stepNoun} breakdown\n${checklist}\n` +
        (nextLesson
          ? `\nNext up: "${nextLesson.title}". Its actual content:\n---\n` +
            `${(nextLesson.content || nextLesson.material || '(no written content yet — work from the objectives/evaluation above)').slice(0, 6000)}\n---\n` +
            (nextLesson.attachment_url ? `Downloadable attachment for this ${stepNoun}: ${nextLesson.attachment_url}\n` : '') +
            (kind === 'course'
              ? `When the learner has demonstrated mastery of it, your "✅ **${marker}:**" line MUST use this EXACT title: ${nextLesson.title}\n` +
                `NO SKIPPING AHEAD: this is the ONLY ${stepNoun} you may teach or test right now. If the learner's ` +
                `message names or asks about a different, later ${stepNoun} (by title, number, e.g. "teach me lesson ` +
                `5" or "skip to..."), do NOT teach it — decline directly, tell them "${nextLesson.title}" comes next ` +
                `and earlier ${stepNoun}s must be cleared first, then teach THIS one instead. This applies even if ` +
                `the message that started this turn was generated by clicking that later ${stepNoun} in the app.`
              : `When the user has read/confirmed this ${stepNoun} (a plain acknowledgment is enough — this is not a school quiz), end your reply with the line "✅ **${marker}:**" using this EXACT title: ${nextLesson.title}`)
          : `\nEvery ${stepNoun} is already marked done — if there is more to cover, offer it as enrichment, not as a new required ${stepNoun}.`)
    }
  } catch {
    /* progress optional */
  }

  const block =
    (list
      ? `# Bermi Learn — everything organizations have published, live right now (you can discuss, recommend, and act on any of it)\n${list}`
      : '') +
    progressBlock +
    curriculumBlock +
    '\n\nGuidance: If the user asks to enroll/register/apply/subscribe/get access, the system already does it directly ' +
    '(see any Live action below), then continue right here in this chat immediately. ' +
    'For "show my progress" or "what have I joined", summarize their status above clearly. ' +
    'For "what should I do next" / "what should I learn next", recommend the best next step — finish something ' +
    'in-progress first, otherwise suggest a fitting item from the catalog above (name it and its kind). Recommend ' +
    'only items from this list, never invent one. ' +
    'Match your approach to what the thing actually is: a COURSE is taught step by step with a mastery test before ' +
    'advancing (work through its objectives in order, quiz the learner, note how well they understand). A PROGRAM ' +
    'is a structured process — guide the person through each step in order, confirming they understood or did it ' +
    '(no quiz needed, a plain confirmation is enough). An EVENT has no steps to teach — just confirm registration, ' +
    'state the date/location clearly, and answer questions about it. A RESOURCE is not stepped through — present ' +
    'its content directly and answer questions about it. Everything happens here in Bermi AI chat — never tell the ' +
    'user to go to a separate portal (the portal is for organizations managing their offerings, not the public). ' +
    'If nothing in the catalog above fits what the user wants, or they directly ask you to build/create/make them ' +
    'a course or program, you can draft and create a brand-new one for them right here in chat — no dashboard or ' +
    'form required (see any Live action below when this already happened). Feel free to offer this when relevant.'

  let note = ''
  let enrolled = null
  // Set ONLY when this exact turn's Live action is playing a specific
  // lesson's video — the one case a ```video block is legitimate. See the
  // streaming filter in the POST /chat handler that enforces this.
  let allowedVideoUrl = null
  // Building a brand-new course/program takes priority over enroll-style
  // wording. These used to be checked in the opposite order, which meant a
  // perfectly ordinary request like "build me a course on X and sign me up"
  // matched ENROLL_RE (on "sign me up") FIRST, never reached the build
  // branch at all, found no existing catalog item matching the raw message,
  // and replied with a confusing "which one do you mean?" instead of just
  // building it — the build request was silently dropped. Checking BUILD_RE
  // first fixes this: building already auto-enrolls the creator (see
  // quickBuildPersonalOffering), so there is nothing left for the enroll
  // branch to do afterward anyway.
  if (BUILD_RE.test(message)) {
    const kind = guessOfferingKind(message)
    const stepNoun = KIND_STEP_NOUN[kind]
    // Building blind from "build me a course" alone produces something
    // generic and unmoored — the learner should first say what it should be
    // about and what they actually want to achieve by it, the same way the
    // guided wizard asks for a topic and objectives before drafting anything.
    // Only skip that question when the request already carries real content
    // beyond the bare trigger phrase (a topic, and ideally a goal).
    const substance = message.replace(BUILD_RE, ' ').replace(/\b(a|an|the|me|please|for|to|i|want|would|like|and|sign|up|enroll)\b/gi, ' ').trim()
    if (substance.length < 15) {
      note =
        `Live action: the user wants you to build a ${kind} but hasn't said what it should be about or what they want ` +
        `to achieve from it. Do NOT build anything yet. Ask directly: what should it cover, and what's their aim — ` +
        `what do they want to be able to do or understand by the end? Build it only once they answer.`
    } else if (!checkRateLimit(`chat-build:${userId}`, { windowMs: 10 * 60_000, max: 6 })) {
      note = `Live action: the user wants to build a ${kind}, but they've hit the AI-generation limit for the next few minutes. Tell them plainly and ask them to try again shortly.`
    } else {
      try {
        const result = await quickBuildPersonalOffering(user, { topic: message, kind })
        const objectives = (result.course.objectives || '').trim()
        const firstLesson = [...result.lessons].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))[0]
        note =
          `Live action: you HAVE NOW built a brand-new ${kind} called "${result.course.title}" from the user's own request, written it out in full (${result.lessons.length} ${stepNoun}${result.lessons.length === 1 ? '' : 's'}), and enrolled them in it immediately — it is already saved in their "My Activity", no dashboard or portal step needed. ` +
          (objectives ? `Its drafted aim/objectives:\n${objectives}\n` : '') +
          (firstLesson
            ? `\nIts real first ${stepNoun}, "${firstLesson.title}", already fully written — TEACH FROM THIS EXACT CONTENT, do not invent different material:\n---\n${(firstLesson.content || firstLesson.material || '').slice(0, 6000)}\n---\n`
            : '') +
          `Confirm warmly, clearly state what it aims to help them achieve (from the objectives above), briefly ` +
          `describe what it covers, then immediately begin teaching the first ${stepNoun} right here in this chat ` +
          `using its real content above${firstLesson ? `, with this exact title: "${firstLesson.title}"` : ''}. State only what actually happened.`
        enrolled = { courseId: result.course.id, courseTitle: result.course.title, kind }
        // Pin immediately — the curriculum-matching block above already ran
        // for this turn and can't see an enrollment created just now, so
        // without this the pin would only take effect starting next turn.
        if (conversationId) storage.setSetting(`conv-course:${conversationId}`, result.course.id).catch(() => {})
      } catch (e) {
        note = `Live action: could not build that ${kind} right now (${e.message}). Apologize briefly, ask for a little more detail on what it should cover, and offer to try again right here in chat.`
      }
    }
  } else if (ENROLL_RE.test(message)) {
    const lower = message.toLowerCase()
    let best = courses.find((c) => lower.includes(c.title.toLowerCase()))
    if (!best) {
      let bestHits = 0
      for (const c of courses) {
        const words = c.title.toLowerCase().split(/\W+/).filter((w) => w.length > 3)
        const hits = words.filter((w) => lower.includes(w)).length
        if (hits > bestHits && hits >= Math.max(1, Math.ceil(words.length / 2))) {
          best = c
          bestHits = hits
        }
      }
    }
    if (best) {
      const kind = best.kind || 'course'
      const noun = KIND_NOUN[kind] || 'course'
      const verbPast = KIND_VERB_PAST[kind] || 'enrolled'
      topicTitle = best.title
      try {
        const existing = await storage.getEnrollment(best.id, userId)
        if (existing) {
          note = `Live action: the user is ALREADY ${verbPast} in the ${noun} "${best.title}". Confirm briefly, then continue right here in this chat from where they left off.`
          // Re-stating "enroll me" on something already joined should still
          // drop the learner straight into Study Mode (for courses) instead
          // of requiring them to notice nothing happened and toggle it
          // manually — same signal the client acts on for a fresh enrollment.
          enrolled = { courseId: best.id, courseTitle: best.title, kind }
        } else {
          await storage.createEnrollment({
            id: randomUUID(),
            course_id: best.id,
            user_id: userId,
            status: best.enrollment === 'approval' ? 'applied' : 'enrolled',
            progress: {},
            score: null,
            enrolled_at: new Date().toISOString(),
          })
          const inst = instById.get(best.institution_id)
          const byLine = inst ? ` by ${inst.name}` : ''
          if (kind === 'event') {
            note =
              `Live action: you HAVE NOW registered the user for the event "${best.title}"${byLine}` +
              (best.event_at ? ` on ${formatEventWhen(best)}` : '') +
              (best.event_location ? ` at/via ${best.event_location}` : '') +
              `. Confirm warmly with the date/location, briefly say what it covers, and offer to answer any questions about it. State only what actually happened.`
          } else if (kind === 'resource') {
            const lessons = await storage.listLessons(best.id)
            const first = lessons.sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))[0]
            note =
              `Live action: you HAVE NOW given the user access to the resource "${best.title}"${byLine}. Confirm briefly, ` +
              `then present its content right here in this chat immediately` +
              (first ? `, starting with:\n---\n${(first.content || first.material || '').slice(0, 4000)}\n---` : '.') +
              (first?.attachment_url ? `\nDownload link to mention: ${first.attachment_url}` : '')
          } else {
            const lessons = await storage.listLessons(best.id)
            const first = lessons.sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))[0]
            note =
              `Live action: you HAVE NOW ${verbPast} the user in the ${noun} "${best.title}"${byLine}. Confirm warmly, briefly say what it covers, then immediately begin teaching the first ${KIND_STEP_NOUN[kind]} right here in this chat. State only what actually happened.` +
              (first
                ? ` Its real first ${KIND_STEP_NOUN[kind]}, "${first.title}", already fully written — TEACH FROM THIS EXACT CONTENT, do not invent different material:\n---\n${(first.content || first.material || '').slice(0, 6000)}\n---`
                : '')
          }
          enrolled = { courseId: best.id, courseTitle: best.title, kind }
          // See the matching comment in the BUILD_RE branch above — pin now
          // so this exact course grounds every subsequent turn, not just
          // once the curriculum block happens to recompute next turn.
          if (conversationId) storage.setSetting(`conv-course:${conversationId}`, best.id).catch(() => {})
        }
      } catch (e) {
        note = `Live action: ${kind === 'event' ? 'registration' : 'enrollment'} failed (${e.message}). Apologize briefly and offer to try again right here in chat.`
      }
    } else {
      note =
        'Live action: the user wants to join/register/get something but did not name an item that matches the catalog. Ask which one, listing 2-3 relevant available items by name and kind.'
    }
  }

  // Playing/summarizing a lesson video — resolve to an actual video_url an
  // institution attached, never a guessed or fabricated link.
  if (videoLessons.length && (VIDEO_PLAY_RE.test(message) || VIDEO_SUMMARY_RE.test(message))) {
    const lower = message.toLowerCase()
    const target =
      videoLessons.find((v) => lower.includes(v.lesson.title.toLowerCase())) ||
      videoLessons.find((v) => lower.includes(v.course.title.toLowerCase())) ||
      videoLessons.find((v) => v.nextUp) ||
      videoLessons[0]

    if (VIDEO_SUMMARY_RE.test(message)) {
      const result = await summarizeVideo(target.lesson.video_url, { title: target.lesson.title })
      note = result.ok
        ? `Live action: you already reviewed the video for lesson "${target.lesson.title}" (course "${target.course.title}"). ` +
          `Present this summary to the user in your own words, well-formatted — do not say "transcript" or "captions", just summarize what the video covers:\n\n${result.summary}`
        : `Live action: could not summarize the video for lesson "${target.lesson.title}" — ${result.reason} Tell the user plainly and offer to keep teaching the lesson from its written content instead.`
    } else {
      note =
        `Live action: playing the video for lesson "${target.lesson.title}" (course "${target.course.title}"). ` +
        'In your reply, include exactly one fenced code block with language "video" containing only:\n' +
        `url: ${target.lesson.video_url}\ntitle: ${target.lesson.title}\n` +
        'Do not print the raw URL anywhere else. Add one short sentence introducing it, and mention captions play automatically if the source provides them.'
      // The model doesn't always honor "never fabricate a video" — the
      // caller strips any ```video block whose url isn't exactly this one,
      // as a hard backstop that doesn't depend on the model behaving.
      allowedVideoUrl = target.lesson.video_url
    }
  }

  return { block, note, enrolled, topicTitle, allowedVideoUrl }
}

function sse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

const VIDEO_FENCE = '```video'

/**
 * Streaming-safe filter that drops any ```video fenced block whose url
 * doesn't exactly match `allowedUrl` (or drops every such block when
 * `allowedUrl` is null/undefined) — a hard, code-level backstop against the
 * model fabricating a video player. The prompt already says never to invent
 * one, but smaller open-weight models don't reliably honor that, and a
 * fabricated player rendering in a lesson that has no real video is exactly
 * the kind of thing a prompt instruction alone can't be trusted to prevent.
 * Tokens arrive as arbitrary chunks that can split the fence marker across
 * calls, so this buffers just enough to disambiguate before forwarding.
 */
function createVideoBlockFilter(allowedUrl) {
  let holdback = ''
  let inBlock = false
  let blockBuffer = ''

  function push(token) {
    if (!inBlock) {
      const combined = holdback + token
      const idx = combined.indexOf(VIDEO_FENCE)
      if (idx !== -1) {
        const before = combined.slice(0, idx)
        inBlock = true
        blockBuffer = combined.slice(idx)
        holdback = ''
        return before + push('')
      }
      // Keep back a tail that could still be the start of the fence marker
      // split across this chunk and the next one.
      const safeLen = Math.max(0, combined.length - (VIDEO_FENCE.length - 1))
      holdback = combined.slice(safeLen)
      return combined.slice(0, safeLen)
    }

    blockBuffer += token
    const closeIdx = blockBuffer.indexOf('\n```', VIDEO_FENCE.length)
    if (closeIdx === -1) return ''

    const block = blockBuffer.slice(0, closeIdx + 4) // + '\n```'.length
    const rest = blockBuffer.slice(closeIdx + 4)
    inBlock = false
    blockBuffer = ''

    const urlMatch = block.match(/url\s*:\s*(\S+)/i)
    const url = urlMatch ? urlMatch[1].trim() : null
    const authorized = Boolean(allowedUrl) && url === allowedUrl
    return (authorized ? block : '') + push(rest)
  }

  // A stream that ends mid-block never resolved — drop it rather than leak
  // a possibly-fabricated, definitely-incomplete block to the client.
  function flush() {
    return inBlock ? '' : holdback
  }

  return { push, flush }
}

// Some free-tier providers (e.g. Groq's smaller instant models) cap the
// *entire* request at only a few thousand tokens per minute — well below what
// a long-running conversation plus Bermi's system prompt can reach. Rather
// than let that surface as a raw 413 from the provider, keep the payload sent
// upstream within a conservative character budget (~4 chars/token is a
// reasonable rough estimate for English text) by dropping the OLDEST turns
// first — the model still gets the full system prompt and as much recent
// context as fits, which is what actually matters for continuing a chat.
const MAX_HISTORY_CHARS = 16_000

function trimHistoryToBudget(historyMessages, budgetChars) {
  if (historyMessages.length <= 1) return historyMessages
  let total = 0
  let cut = historyMessages.length
  for (let i = historyMessages.length - 1; i >= 0; i--) {
    total += historyMessages[i].content.length
    if (total > budgetChars && i < historyMessages.length - 1) {
      cut = i + 1
      break
    }
    cut = i
  }
  return historyMessages.slice(cut)
}

// ---------------------------------------------------------------------------
// Per-user hourly AI quota: the shared free-tier provider pool (see
// providers.js) is finite, so without a per-user cap one heavy user can burn
// through it and leave everyone else hitting rate limits. Each signed-in user
// gets their own capped "chunk" per hour instead, on top of the existing
// short-window anti-burst limit above. Admin-configurable (Settings → Admin)
// so the cap can be raised as more provider keys are added, without a
// redeploy.
const DEFAULT_QUOTA_PER_HOUR = 40
const QUOTA_WINDOW_MS = 60 * 60_000

async function quotaLimit() {
  const fromEnv = Number(process.env.CHAT_QUOTA_PER_HOUR)
  if (fromEnv > 0) return fromEnv
  const stored = Number(await storage.getSetting('chat_quota_per_hour'))
  return stored > 0 ? stored : DEFAULT_QUOTA_PER_HOUR
}

function formatMinutes(seconds) {
  const mins = Math.ceil(seconds / 60)
  return mins <= 1 ? 'about a minute' : `about ${mins} minutes`
}

async function quotaGate(req, res, next) {
  try {
    const max = await quotaLimit()
    const key = `chat-quota:${req.user.id}`
    if (checkRateLimit(key, { windowMs: QUOTA_WINDOW_MS, max })) return next()
    const status = peekRateLimit(key, { windowMs: QUOTA_WINDOW_MS, max })
    const retryAfter = Math.max(1, Math.ceil((status.resetAt - Date.now()) / 1000))
    res.setHeader('Retry-After', String(retryAfter))
    res.status(429).json({
      error: `You've used your ${max} shared AI messages for this hour. It resets in ${formatMinutes(retryAfter)} — everyone draws from the same pool, so this keeps it fair.`,
      retryAfter,
      quota: { used: status.used, max, resetAt: status.resetAt },
    })
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// Hybrid RAG: the open-weight models behind Bermi have a real training
// cutoff and know nothing on their own about anything after it. Rather than
// require the user to notice that and manually flip on web search every
// time, detect questions that are plainly time-sensitive — current events,
// prices, schedules, "latest"/"today"/a near-future year — and route THOSE
// through live web-grounded retrieval automatically, even if the client
// didn't ask for it. Everything else still answers instantly from the
// model's own trained knowledge at no retrieval cost. That mix — fast
// parametric answers by default, automatic retrieval only when freshness
// actually matters — is the "hybrid" here, and it also protects the
// rate-limited web-search quota from being spent on questions that never
// needed it.
const FRESHNESS_RE =
  /\b(today|tonight|this (?:week|month|year|morning|afternoon|evening)|current(?:ly)?|latest|up[- ]to[- ]date|right now|as of (?:today|now)|breaking news|just (?:announced|released|happened)|recently|upcoming|next (?:week|month|year)|20(?:2[5-9]|[3-9]\d))\b/i
const NEWSY_RE =
  /\b(news|headlines?|stock price|share price|exchange rate|weather|forecast|election results?|who (?:is|won|leads) the|release date|when (?:is|does|will)|price of|cost of)\b/i
// Whole categories that are inherently about "what's happening in the world
// right now" even without an explicit freshness word — sports results, chart
// releases, industry updates, regional news. Rather than scraping and storing
// a copy of hundreds of named third-party sites ourselves (most of which
// explicitly prohibit that in their own terms of service, and none of which
// a serverless deployment can crawl continuously anyway), these categories
// route through the same live, legitimate web-search grounding — the actual
// outcome that matters (current real information, cited) without operating
// an unlicensed scraper.
const TOPIC_RE =
  /\b(sports?|football|soccer|basketball|match(es)?|fixture|score|league|tournament|olympics|premier league|afcon|nba|music|album|song|artist|chart|billboard|movies?|films?|box office|cinema|actor|actress|startup|gadget|health|wellness|outbreak|lifestyle|fashion trend|stock market|economy|africa|african|tanzania|tanzanian|dar es salaam|east africa|entrepreneur)\b/i

function needsFreshInfo(message) {
  return FRESHNESS_RE.test(message) || NEWSY_RE.test(message) || TOPIC_RE.test(message)
}

/**
 * POST /api/chat  { conversationId?, message, model }
 * Streams back SSE: `conversation`, then `token` events, then [DONE].
 */
chatRouter.post(
  '/chat',
  rateLimit({
    windowMs: 60_000,
    max: 20,
    message: "You're sending messages a bit fast — take a breath and try again in a few seconds.",
  }),
  quotaGate,
  async (req, res, next) => {
  try {
    const { conversationId, message, model, web: webRequested = false, study = false, attachments } = req.body ?? {}
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' })
    }
    // Hybrid RAG: honor an explicit toggle, but also auto-trigger live web
    // retrieval for (a) anything plainly time-sensitive (see needsFreshInfo),
    // and (b) anything learning-related — deliberately generous here, since
    // a course/topic being studied should be checked against current,
    // real-world material rather than taught purely from the trained
    // model's (dated) knowledge alone.
    const web = webRequested || needsFreshInfo(message) || study || LEARN_RE.test(message)

    // Attached documents are read INTERNALLY: their (OCR'd / parsed) text is
    // folded into this turn's context for the model, but never stored or shown
    // in the chat — the saved user message only carries the visible text.
    const docBlocks = Array.isArray(attachments)
      ? attachments
          .filter((a) => a && typeof a.text === 'string' && a.text.trim())
          .map(
            (a) =>
              `--- Attached document: ${a.name || 'file'} ---\n${a.text.slice(0, 24000)}\n--- End of document ---`,
          )
          .join('\n\n')
      : ''
    if (typeof model !== 'string' || !model) {
      return res.status(400).json({ error: 'model is required' })
    }

    const now = new Date().toISOString()
    const isNewConversation = !conversationId
    let conversation
    if (conversationId) {
      conversation = await storage.getConversation(conversationId)
      if (!conversation || conversation.user_id !== req.user.id) {
        return res.status(404).json({ error: 'Conversation not found' })
      }
      await storage.updateConversation(conversation.id, { model, updated_at: now })
    } else {
      // Placeholder until generateConversationTitle replaces it below with a
      // real summary of what the conversation is actually about — this raw
      // first-message text is only ever seen if that generation fails.
      const title = message.trim().slice(0, 60) + (message.trim().length > 60 ? '…' : '')
      conversation = await storage.createConversation({
        id: randomUUID(),
        user_id: req.user.id,
        title,
        model,
        created_at: now,
        updated_at: now,
      })
    }

    await storage.addMessage({
      id: randomUUID(),
      conversation_id: conversation.id,
      role: 'user',
      content: message,
      created_at: now,
    })

    const [systemPromptBase, history, learn] = await Promise.all([
      buildSystemPrompt(req.user.id, study),
      storage.listMessages(conversation.id),
      learningContext(req.user, message, conversation.title, study, conversation.id),
    ])
    let systemPrompt = systemPromptBase
    if (learn.block) systemPrompt += `\n\n${learn.block}`
    if (learn.note) systemPrompt += `\n\n# Live action (already performed by the system)\n${learn.note}`

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    sse(res, { type: 'conversation', conversation: { ...conversation, model } })
    // A fresh enrollment just happened — tell the client so it can switch the
    // learner straight into Study Mode and refresh "My learning" without a
    // separate manual step. Must fire AFTER the SSE headers above, or this
    // write would send its own (wrong) headers and corrupt the whole stream.
    if (learn.enrolled) sse(res, { type: 'enrolled', ...learn.enrolled })

    // Abort the upstream call if the client disconnects mid-stream. This must
    // watch the response: req 'close' fires as soon as the body is consumed.
    const abort = new AbortController()
    res.on('close', () => {
      if (!res.writableEnded) abort.abort()
    })

    // Real web-search grounding, fetched ourselves (see websearch.js for why
    // this replaced relying on OpenRouter's paid web plugin): searched BEFORE
    // the model runs, so results land in the system prompt as plain context
    // — grounding that works with every provider in the fallback chain, not
    // just whichever one happens to support a plugin.
    let webCitations = []
    if (web) {
      sse(res, { type: 'status', label: 'Searching the web' })
      try {
        const found = await webSearch(message)
        if (found?.results?.length) {
          webCitations = found.results.map((r) => ({ url: r.url, title: r.title }))
          const resultsBlock = found.results.map((r, i) => `${i + 1}. **${r.title}** — ${r.url}\n${r.content}`).join('\n\n')
          systemPrompt += `\n\n# Live web search results (just retrieved — current and reliable)\n${resultsBlock}\n\nCite these sources naturally in your answer.`
        }
      } catch {
        // Search unavailable/over budget right now — proceed without it.
        // The `web` flag passed to streamCompletion below is a last-resort
        // fallback to the provider-side plugin, for accounts that do have
        // OpenRouter credit funded.
      }
      sse(res, { type: 'status', label: 'Reading results' })
      sse(res, { type: 'status', label: 'Writing the answer' })
    } else if (study) {
      for (const label of ['Assessing what you know', 'Planning the lesson', 'Preparing your next step'])
        sse(res, { type: 'status', label })
    } else {
      for (const label of ['Understanding your request', 'Reasoning through it', 'Composing an answer'])
        sse(res, { type: 'status', label })
    }

    let assistantText = ''
    // Real, in-context web citations (the sources the grounded answer used) —
    // seeded from our own search above; the streaming loop below can still
    // add more if a provider-side plugin also contributes annotations.
    const citations = [...webCitations]
    // Hard backstop against a fabricated video player — see createVideoBlockFilter.
    const videoFilter = createVideoBlockFilter(learn.allowedVideoUrl)
    try {
      const trimmedHistory = trimHistoryToBudget(history, MAX_HISTORY_CHARS)
      const upstream = await streamCompletion({
        model,
        web: web && webCitations.length === 0,
        messages: [
          { role: 'system', content: systemPrompt },
          ...trimmedHistory.map(({ role, content }, i, arr) => {
            // Fold attached-document text into the final user turn only.
            if (docBlocks && role === 'user' && i === arr.length - 1) {
              return {
                role,
                content: `${content}\n\n${docBlocks}\n\nRead the attached document(s) above carefully and use them to answer. Do not paste the document back verbatim; work from your understanding of it.`,
              }
            }
            return { role, content }
          }),
        ],
        signal: abort.signal,
      })

      const reader = upstream.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let firstToken = true
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') continue
          try {
            const chunk = JSON.parse(payload)
            const delta = chunk.choices?.[0]?.delta
            const token = delta?.content
            // Capture the real sources the web-grounded answer actually cited.
            const anns = delta?.annotations || chunk.choices?.[0]?.message?.annotations
            if (Array.isArray(anns)) {
              for (const a of anns) {
                const u = a.url_citation || a
                if (u?.url && !citations.some((c) => c.url === u.url)) {
                  citations.push({ url: u.url, title: u.title || u.url })
                }
              }
            }
            if (token) {
              if (firstToken) {
                sse(res, { type: 'status', label: null }) // clear the loop
                firstToken = false
              }
              const safe = videoFilter.push(token)
              if (safe) {
                assistantText += safe
                sse(res, { type: 'token', token: safe })
              }
            }
          } catch {
            /* keep-alive comments / partial JSON */
          }
        }
      }
      // Release any tail the filter was still holding back (e.g. a few
      // characters that could have been the start of a fence but never
      // resolved into one before the stream ended).
      const tail = videoFilter.flush()
      if (tail) {
        assistantText += tail
        sse(res, { type: 'token', token: tail })
      }
      // Only surface sources that are real and tied to this answer's context.
      if (web && citations.length) sse(res, { type: 'citations', items: citations })
    } catch (err) {
      if (!abort.signal.aborted) {
        sse(res, { type: 'error', error: err.friendly || err.message, retryAfter: err.retryAfter ?? null })
        res.end()
        return
      }
    }

    if (assistantText) {
      // Persist real sources inline so they survive a reload.
      let toSave = assistantText
      if (web && citations.length) {
        toSave +=
          '\n\n---\n**Sources**\n' +
          citations.map((c, i) => `${i + 1}. [${c.title}](${c.url})`).join('\n')
      }
      const doneAt = new Date().toISOString()
      await storage.addMessage({
        id: randomUUID(),
        conversation_id: conversation.id,
        role: 'assistant',
        content: toSave,
        model,
        created_at: doneAt,
      })
      await storage.updateConversation(conversation.id, { updated_at: doneAt })

      // Replace the placeholder (raw first-message) title with a real one
      // now that there's an actual exchange to summarize. Only for brand-new
      // conversations — an ongoing conversation's title was already set once
      // and shouldn't keep changing underneath the user.
      if (isNewConversation) {
        try {
          const niceTitle = await generateConversationTitle(message, assistantText)
          if (niceTitle) {
            await storage.updateConversation(conversation.id, { title: niceTitle })
            conversation = { ...conversation, title: niceTitle }
            sse(res, { type: 'conversation', conversation: { ...conversation, model } })
          }
        } catch {
          /* keep the raw-message placeholder title — still a valid title */
        }
      }

      // Fire-and-forget: fold this exchange into the user's persistent,
      // cross-conversation memory so future chats (any of them) can draw on
      // it — never blocks or affects the response already sent.
      remember(req.user.id, message, assistantText)

      // Fire-and-forget: at most once every 24h, fold this person's broader
      // learning activity (courses, mastered topics, level/streak) into a
      // deeper memory consolidation than the lightweight per-message merge
      // above can see — never blocks or affects the response already sent.
      maybeDeepConsolidate(req.user.id)

      // Record real progress whenever the assistant's own reply just
      // confirmed a step done (its "✅ **Mastered/Completed/Done:** …"
      // marker) — never for the act of exchanging a message. This runs in
      // ANY chat, not just Study Mode: a bank's program or an NGO's
      // onboarding is guided in ordinary chat, not the course-teaching
      // "Study Mode" toggle, and its progress must still land in "My
      // Activity" and institution analytics. XP/streak gamification stays
      // Study-Mode-only — that's a course-teaching flourish, not something
      // that fits a program, event, or resource.
      try {
        const mastered = parseMasteredSteps(assistantText)
        if (mastered.length) {
          // Prefer the real course/program title (resolved above) over the
          // raw conversation title — the conversation title is just the
          // user's first message verbatim, which is exactly why "topics
          // studied" used to show a sentence instead of a real subject.
          const topic = learn.topicTitle || conversation.title
          if (study) {
            const result = await awardStudy(req.user.id, topic, mastered)
            if (result) sse(res, { type: 'study', ...result })
          }
          // Bridge the mastery/completion signal into the user's actual
          // enrollment/lesson records, so "My Activity" and institution
          // analytics reflect real, demonstrated progress — not just that
          // the conversation moved on.
          await syncLessonProgress(req.user, topic, mastered)
        }
      } catch {
        /* non-fatal */
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/chat/quota
 * The current user's slice of the shared hourly AI-message pool, so the
 * client can warn them before they hit it (and show when it resets) instead
 * of them only finding out from a 429.
 */
chatRouter.get('/chat/quota', async (req, res, next) => {
  try {
    const max = await quotaLimit()
    const status = peekRateLimit(`chat-quota:${req.user.id}`, { windowMs: QUOTA_WINDOW_MS, max })
    res.json({ used: status.used, max, remaining: status.remaining, resetAt: status.resetAt })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/chat/feedback { messageId, value }
 * Records a thumbs up/down on an answer so Bermi can learn what helps.
 * value: 'up' | 'down' | null (clears).
 */
chatRouter.post('/chat/feedback', async (req, res, next) => {
  try {
    const { messageId, value } = req.body ?? {}
    if (typeof messageId !== 'string' || !messageId) {
      return res.status(400).json({ error: 'messageId is required' })
    }
    const key = `fb:${req.user.id}:${messageId}`
    if (value === 'up' || value === 'down') {
      await storage.setSetting(key, value)
    } else {
      await storage.deleteSetting(key)
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
