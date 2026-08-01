import { Router } from 'express'
import { randomUUID, randomBytes } from 'node:crypto'
import { storage } from '../storage/index.js'
import { complete } from '../openrouter.js'
import { renderDocument } from '../doc-render.js'
import { requireAuth } from '../auth.js'

export const learnRouter = Router()

const slugify = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) ||
  'x' + randomBytes(3).toString('hex')

async function ownsInstitution(userId, institutionId) {
  const inst = await storage.getInstitution(institutionId)
  return inst && inst.owner_id === userId ? inst : null
}

// Every individual can build their own course/module — not just registered
// organizations. Each user gets one lightweight personal workspace
// ("<Name>'s Courses"), created lazily the first time they build something.
async function personalWorkspace(user) {
  const existing = (await storage.listInstitutionsByOwner(user.id)).find((i) => i.personal)
  if (existing) return existing
  const name = `${(user.name || 'My').split(' ')[0]}'s Courses`
  let slug = slugify(name)
  if (await storage.getInstitutionBySlug(slug)) slug = `${slug}-${randomBytes(2).toString('hex')}`
  return storage.createInstitution({
    id: randomUUID(),
    owner_id: user.id,
    name,
    slug,
    about: 'A personal collection of courses and modules.',
    logo_url: null,
    website: '',
    published: true,
    personal: true,
    created_at: new Date().toISOString(),
  })
}

// ---------------------------------------------------------------------------
// Public catalog (no auth required beyond the app's session gate)
// ---------------------------------------------------------------------------

learnRouter.get('/learn/catalog', async (_req, res, next) => {
  try {
    const [institutions, courses] = await Promise.all([
      storage.listPublishedInstitutions(),
      storage.listPublishedCourses(),
    ])
    const instById = new Map(institutions.map((i) => [i.id, i]))
    res.json({
      institutions,
      courses: courses.map((c) => ({
        ...c,
        institution: instById.get(c.institution_id)
          ? { name: instById.get(c.institution_id).name, slug: instById.get(c.institution_id).slug }
          : null,
      })),
    })
  } catch (err) {
    next(err)
  }
})

learnRouter.get('/learn/institutions/:slug', async (req, res, next) => {
  try {
    const inst = await storage.getInstitutionBySlug(req.params.slug)
    if (!inst || !inst.published) return res.status(404).json({ error: 'Institution not found' })
    const courses = (await storage.listCoursesByInstitution(inst.id)).filter((c) => c.published)
    res.json({ institution: inst, courses })
  } catch (err) {
    next(err)
  }
})

learnRouter.get('/learn/courses/:id', async (req, res, next) => {
  try {
    const course = await storage.getCourse(req.params.id)
    if (!course) return res.status(404).json({ error: 'Course not found' })
    const [inst, lessons, enrollment] = await Promise.all([
      storage.getInstitution(course.institution_id),
      storage.listLessons(course.id),
      storage.getEnrollment(course.id, req.user.id),
    ])
    // Public sees lesson titles; content unlocks on enrollment.
    const enrolled = Boolean(enrollment)
    res.json({
      course,
      institution: inst ? { name: inst.name, slug: inst.slug, about: inst.about } : null,
      lessons: lessons.map((l) => ({
        id: l.id,
        ordinal: l.ordinal,
        title: l.title,
        content: enrolled ? l.content : '',
        video_url: enrolled ? l.video_url || '' : '',
      })),
      enrollment,
    })
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// Institution management (owner only)
// ---------------------------------------------------------------------------

learnRouter.get('/learn/my/institutions', async (req, res, next) => {
  try {
    res.json(await storage.listInstitutionsByOwner(req.user.id))
  } catch (err) {
    next(err)
  }
})

learnRouter.post('/learn/institutions', async (req, res, next) => {
  try {
    const { name, about = '', website = '' } = req.body ?? {}
    if (!name?.trim()) return res.status(400).json({ error: 'Institution name is required' })
    let slug = slugify(name)
    if (await storage.getInstitutionBySlug(slug)) slug = `${slug}-${randomBytes(2).toString('hex')}`
    const inst = await storage.createInstitution({
      id: randomUUID(),
      owner_id: req.user.id,
      name: name.trim(),
      slug,
      about,
      website,
      logo_url: null,
      published: true,
      created_at: new Date().toISOString(),
    })
    res.status(201).json(inst)
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// Build-your-own: any individual (not just a registered organization) can
// create their own course/module. Lazily provisions a personal workspace and
// drafts the module structure with AI from a short brief.
// ---------------------------------------------------------------------------

// Only reads an EXISTING personal workspace — never creates one just because
// the dashboard asked to look. Individuals who haven't built anything yet
// simply get an empty list.
learnRouter.get('/learn/my/courses', async (req, res, next) => {
  try {
    const mine = (await storage.listInstitutionsByOwner(req.user.id)).find((i) => i.personal)
    if (!mine) return res.json({ institution: null, courses: [] })
    const courses = await storage.listCoursesByInstitution(mine.id)
    res.json({ institution: mine, courses })
  } catch (err) {
    next(err)
  }
})

// The guided intake: a short series of answers (what to teach, who it's for,
// what they should be able to do after, optional source material) becomes a
// FULL course — real drafted lesson content grounded in those answers, not
// empty stubs — in one step. This is what "build your own course" actually
// runs after asking its questions; no institutional setup required.
learnRouter.post('/learn/my/courses/quick', async (req, res, next) => {
  try {
    const {
      topic,
      audience = '',
      level = 'All levels',
      objectives = '',
      material = '',
      avoid = '',
      title: titleOverride,
    } = req.body ?? {}
    if (!topic?.trim()) return res.status(400).json({ error: 'Tell Bermi what this course should teach' })

    const brief =
      `Topic: ${topic}\n` +
      (audience ? `Who it's for / their current level: ${audience}\n` : '') +
      (objectives ? `What they should be able to do after finishing: ${objectives}\n` : '') +
      (avoid ? `Skip or avoid: ${avoid}\n` : '') +
      (material ? `\nSource material to ground the course in:\n${material.slice(0, 12000)}` : '')

    let plan = null
    try {
      const raw = await complete({
        model: 'bermi-core',
        maxTokens: 5500,
        messages: [
          {
            role: 'system',
            content:
              'You are a curriculum designer. Given a brief (topic, audience/level, objectives, optional source ' +
              'material), design a COMPLETE course and write it in full — not an outline. Respond with ONLY a ' +
              'JSON object shaped exactly as:\n' +
              '{"title":string,"cover_emoji":string,"summary":string,"description":string(markdown),' +
              '"objectives":string(one per line),"evaluation":string,"lessons":[{"title":string,"content":string(markdown)},...]}\n' +
              'Rules: cover_emoji is one relevant emoji. summary is one sentence. description is a short markdown ' +
              'overview (## headings ok). objectives lists 3-6 concrete, testable outcomes, one per line. ' +
              'evaluation states what to test and what mastery looks like. Produce 4-6 lessons that progress in ' +
              'order; each lesson\'s content is a FULLY WRITTEN lesson (several paragraphs, headings, a worked ' +
              'example, and a short "Key takeaways" list) — never a placeholder or a one-line stub. If source ' +
              'material was given, ground the lessons in it directly. Tailor depth and vocabulary to the stated ' +
              'audience/level. Output ONLY the JSON object.',
          },
          { role: 'user', content: brief },
        ],
      })
      plan = JSON.parse(String(raw).replace(/<\/?think>/gi, '').replace(/^```(?:json)?/i, '').replace(/```$/, ''))
    } catch (err) {
      return res.status(502).json({ error: `Could not draft the course: ${err.message}` })
    }
    if (!plan || !Array.isArray(plan.lessons) || plan.lessons.length === 0) {
      return res.status(502).json({ error: 'Could not draft a complete course from those answers — try adding more detail.' })
    }

    const workspace = await personalWorkspace(req.user)
    const now = new Date().toISOString()
    const finalTitle = (titleOverride || plan.title || topic).trim()
    const course = await storage.createCourse({
      id: randomUUID(),
      institution_id: workspace.id,
      title: finalTitle,
      slug: slugify(finalTitle),
      summary: String(plan.summary || '').slice(0, 300),
      description: String(plan.description || ''),
      cover_emoji: String(plan.cover_emoji || '📘').slice(0, 8),
      level,
      published: false,
      enrollment: 'open',
      objectives: String(plan.objectives || objectives || ''),
      evaluation: String(plan.evaluation || ''),
      tracking: '',
      created_at: now,
      updated_at: now,
    })

    const lessons = []
    for (let i = 0; i < plan.lessons.length; i++) {
      const l = plan.lessons[i]
      lessons.push(
        await storage.createLesson({
          id: randomUUID(),
          course_id: course.id,
          ordinal: i,
          title: String(l.title || `Lesson ${i + 1}`).slice(0, 120),
          content: String(l.content || ''),
          material: '',
          created_at: now,
        }),
      )
    }

    // Auto-enroll the creator in their own course so it shows up immediately
    // in "My learning" and can be studied right here in Bermi AI — no portal
    // visit, no separate enroll step required.
    const enrollment = await storage.createEnrollment({
      id: randomUUID(),
      course_id: course.id,
      user_id: req.user.id,
      status: 'enrolled',
      progress: {},
      score: null,
      enrolled_at: now,
    })

    res.status(201).json({ institution: workspace, course, lessons, enrollment })
  } catch (err) {
    next(err)
  }
})

learnRouter.put('/learn/institutions/:id', async (req, res, next) => {
  try {
    if (!(await ownsInstitution(req.user.id, req.params.id)))
      return res.status(404).json({ error: 'Institution not found' })
    const { name, about, website, published, logo_url } = req.body ?? {}
    res.json(await storage.updateInstitution(req.params.id, { name, about, website, published, logo_url }))
  } catch (err) {
    next(err)
  }
})

// ---- Courses ----

learnRouter.get('/learn/institutions/:id/courses', async (req, res, next) => {
  try {
    if (!(await ownsInstitution(req.user.id, req.params.id)))
      return res.status(404).json({ error: 'Institution not found' })
    res.json(await storage.listCoursesByInstitution(req.params.id))
  } catch (err) {
    next(err)
  }
})

learnRouter.post('/learn/institutions/:id/courses', async (req, res, next) => {
  try {
    if (!(await ownsInstitution(req.user.id, req.params.id)))
      return res.status(404).json({ error: 'Institution not found' })
    const {
      title,
      summary = '',
      description = '',
      cover_emoji = '📘',
      level = 'All levels',
      category = '',
      objectives = '',
      evaluation = '',
      tracking = '',
    } = req.body ?? {}
    if (!title?.trim()) return res.status(400).json({ error: 'Course title is required' })
    const now = new Date().toISOString()
    const course = await storage.createCourse({
      id: randomUUID(),
      institution_id: req.params.id,
      title: title.trim(),
      slug: slugify(title),
      summary,
      description,
      cover_emoji,
      level,
      category,
      published: false,
      enrollment: 'open',
      objectives,
      evaluation,
      tracking,
      created_at: now,
      updated_at: now,
    })
    res.status(201).json(course)
  } catch (err) {
    next(err)
  }
})

// AI-generated full course for an organization: staff just say what to teach
// and the objective, and Bermi drafts the whole thing — full lesson content,
// objectives, evaluation/teaching guidelines, and (via /learn/lessons/:id/quiz,
// generated on demand) a quiz per lesson — instead of building it lesson by
// lesson by hand. Mirrors POST /learn/my/courses/quick but is institution-owned
// and never auto-enrolls anyone.
learnRouter.post('/learn/institutions/:id/courses/quick', async (req, res, next) => {
  try {
    if (!(await ownsInstitution(req.user.id, req.params.id)))
      return res.status(404).json({ error: 'Institution not found' })
    const {
      topic,
      audience = '',
      level = 'All levels',
      category = '',
      objectives = '',
      material = '',
      avoid = '',
      title: titleOverride,
    } = req.body ?? {}
    if (!topic?.trim()) return res.status(400).json({ error: 'Tell Bermi what this course should teach' })

    const brief =
      `Topic: ${topic}\n` +
      (audience ? `Who it's for / their current level: ${audience}\n` : '') +
      (objectives ? `What they should be able to do after finishing: ${objectives}\n` : '') +
      (avoid ? `Skip or avoid: ${avoid}\n` : '') +
      (material ? `\nSource material to ground the course in:\n${material.slice(0, 12000)}` : '')

    let plan = null
    try {
      const raw = await complete({
        model: 'bermi-core',
        maxTokens: 5500,
        messages: [
          {
            role: 'system',
            content:
              'You are a curriculum designer building a course for an educational organization. Given a brief ' +
              '(topic, audience/level, objectives, optional source material), design a COMPLETE course and write ' +
              'it in full — not an outline. Respond with ONLY a JSON object shaped exactly as:\n' +
              '{"title":string,"cover_emoji":string,"summary":string,"description":string(markdown),' +
              '"objectives":string(one per line),"evaluation":string,"lessons":[{"title":string,"content":string(markdown)},...]}\n' +
              'Rules: cover_emoji is one relevant emoji. summary is one sentence. description is a short markdown ' +
              'overview (## headings ok). objectives lists 3-6 concrete, testable outcomes, one per line. ' +
              'evaluation is a guidelines block combining: what to test and what mastery looks like, prerequisites ' +
              'or assumed background, recommended pacing, and any tone/approach notes for the AI tutor teaching ' +
              'this course — the tutor reads this directly, so make it concrete and actionable, not vague advice. ' +
              'Produce 4-8 lessons that progress in order; each lesson\'s content is a FULLY WRITTEN lesson ' +
              '(several paragraphs, headings, a worked example, and a short "Key takeaways" list) — never a ' +
              'placeholder or a one-line stub. Each lesson is later paired with an auto-generated quiz, so make ' +
              'sure the content clearly states discrete, testable facts and steps. If source material was given, ' +
              'ground the lessons in it directly. Tailor depth and vocabulary to the stated audience/level. ' +
              'Output ONLY the JSON object.',
          },
          { role: 'user', content: brief },
        ],
      })
      plan = JSON.parse(String(raw).replace(/<\/?think>/gi, '').replace(/^```(?:json)?/i, '').replace(/```$/, ''))
    } catch (err) {
      return res.status(502).json({ error: `Could not draft the course: ${err.message}` })
    }
    if (!plan || !Array.isArray(plan.lessons) || plan.lessons.length === 0) {
      return res.status(502).json({ error: 'Could not draft a complete course from those answers — try adding more detail.' })
    }

    const now = new Date().toISOString()
    const finalTitle = (titleOverride || plan.title || topic).trim()
    const course = await storage.createCourse({
      id: randomUUID(),
      institution_id: req.params.id,
      title: finalTitle,
      slug: slugify(finalTitle),
      summary: String(plan.summary || '').slice(0, 300),
      description: String(plan.description || ''),
      cover_emoji: String(plan.cover_emoji || '📘').slice(0, 8),
      level,
      category,
      published: false,
      enrollment: 'open',
      objectives: String(plan.objectives || objectives || ''),
      evaluation: String(plan.evaluation || ''),
      tracking: '',
      created_at: now,
      updated_at: now,
    })

    const lessons = []
    for (let i = 0; i < plan.lessons.length; i++) {
      const l = plan.lessons[i]
      lessons.push(
        await storage.createLesson({
          id: randomUUID(),
          course_id: course.id,
          ordinal: i,
          title: String(l.title || `Lesson ${i + 1}`).slice(0, 120),
          content: String(l.content || ''),
          material: '',
          created_at: now,
        }),
      )
    }

    // Left unpublished — the organization reviews the AI draft (and can add
    // videos, edit lessons, etc.) before it appears in the public catalog.
    res.status(201).json({ course, lessons })
  } catch (err) {
    next(err)
  }
})

async function ownsCourse(userId, courseId) {
  const course = await storage.getCourse(courseId)
  if (!course) return null
  const inst = await storage.getInstitution(course.institution_id)
  return inst && inst.owner_id === userId ? course : null
}

learnRouter.put('/learn/courses/:id', async (req, res, next) => {
  try {
    if (!(await ownsCourse(req.user.id, req.params.id)))
      return res.status(404).json({ error: 'Course not found' })
    const { title, summary, description, cover_emoji, level, category, published, enrollment, objectives, evaluation, tracking } =
      req.body ?? {}
    res.json(
      await storage.updateCourse(req.params.id, {
        title,
        summary,
        description,
        cover_emoji,
        level,
        category,
        published,
        enrollment,
        objectives,
        evaluation,
        tracking,
      }),
    )
  } catch (err) {
    next(err)
  }
})

learnRouter.delete('/learn/courses/:id', async (req, res, next) => {
  try {
    if (!(await ownsCourse(req.user.id, req.params.id)))
      return res.status(404).json({ error: 'Course not found' })
    await storage.deleteCourse(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// ---- Lessons (owner) ----

learnRouter.get('/learn/courses/:id/lessons/manage', async (req, res, next) => {
  try {
    if (!(await ownsCourse(req.user.id, req.params.id)))
      return res.status(404).json({ error: 'Course not found' })
    res.json(await storage.listLessons(req.params.id))
  } catch (err) {
    next(err)
  }
})

learnRouter.post('/learn/courses/:id/lessons', async (req, res, next) => {
  try {
    if (!(await ownsCourse(req.user.id, req.params.id)))
      return res.status(404).json({ error: 'Course not found' })
    const { title, content = '', material = '', video_url = '' } = req.body ?? {}
    if (!title?.trim()) return res.status(400).json({ error: 'Lesson title is required' })
    const existing = await storage.listLessons(req.params.id)
    const lesson = await storage.createLesson({
      id: randomUUID(),
      course_id: req.params.id,
      ordinal: existing.length,
      title: title.trim(),
      content,
      material,
      video_url,
      created_at: new Date().toISOString(),
    })
    res.status(201).json(lesson)
  } catch (err) {
    next(err)
  }
})

learnRouter.put('/learn/lessons/:id', async (req, res, next) => {
  try {
    const lesson = await storage.getLesson(req.params.id)
    if (!lesson || !(await ownsCourse(req.user.id, lesson.course_id)))
      return res.status(404).json({ error: 'Lesson not found' })
    const { title, content, material, video_url, ordinal } = req.body ?? {}
    res.json(
      await storage.updateLesson(req.params.id, {
        title: title ?? lesson.title,
        content: content ?? lesson.content,
        material: material ?? lesson.material,
        video_url: video_url ?? lesson.video_url,
        ordinal: ordinal ?? lesson.ordinal,
      }),
    )
  } catch (err) {
    next(err)
  }
})

learnRouter.delete('/learn/lessons/:id', async (req, res, next) => {
  try {
    const lesson = await storage.getLesson(req.params.id)
    if (!lesson || !(await ownsCourse(req.user.id, lesson.course_id)))
      return res.status(404).json({ error: 'Lesson not found' })
    await storage.deleteLesson(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// AI co-author: turn a lesson's material into a structured lesson body.
learnRouter.post('/learn/lessons/:id/ai-draft', async (req, res, next) => {
  try {
    const lesson = await storage.getLesson(req.params.id)
    if (!lesson || !(await ownsCourse(req.user.id, lesson.course_id)))
      return res.status(404).json({ error: 'Lesson not found' })
    let content = ''
    try {
      content = await complete({
        model: 'bermi-core',
        maxTokens: 2000,
        messages: [
          {
            role: 'system',
            content:
              'You are a curriculum designer. Write a clear, engaging lesson in Markdown from the source material. ' +
              'Use ## sections, short paragraphs, examples, and a "Key takeaways" list. No preamble.',
          },
          {
            role: 'user',
            content: `Lesson title: ${lesson.title}\n\nSource material:\n${(lesson.material || req.body?.material || '').slice(0, 12000)}`,
          },
        ],
      })
    } catch (err) {
      return res.status(502).json({ error: err.message })
    }
    const updated = await storage.updateLesson(req.params.id, {
      ...lesson,
      content: (content || lesson.content).replace(/<\/?think>/gi, '').trim(),
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// Learner: enroll, learn, quiz, complete, certificate
// ---------------------------------------------------------------------------

learnRouter.get('/learn/my/enrollments', async (req, res, next) => {
  try {
    const enrollments = await storage.listEnrollmentsByUser(req.user.id)
    const out = []
    for (const e of enrollments) {
      const course = await storage.getCourse(e.course_id)
      if (course) out.push({ ...e, course })
    }
    res.json(out)
  } catch (err) {
    next(err)
  }
})

learnRouter.post('/learn/courses/:id/enroll', async (req, res, next) => {
  try {
    const course = await storage.getCourse(req.params.id)
    if (!course || !course.published) return res.status(404).json({ error: 'Course not available' })
    const existing = await storage.getEnrollment(course.id, req.user.id)
    if (existing) return res.json(existing)
    const enrollment = await storage.createEnrollment({
      id: randomUUID(),
      course_id: course.id,
      user_id: req.user.id,
      status: course.enrollment === 'approval' ? 'applied' : 'enrolled',
      progress: {},
      score: null,
      enrolled_at: new Date().toISOString(),
    })
    res.status(201).json(enrollment)
  } catch (err) {
    next(err)
  }
})

// Full lesson content for an enrolled learner + the material that grounds the tutor.
learnRouter.get('/learn/lessons/:id/study', async (req, res, next) => {
  try {
    const lesson = await storage.getLesson(req.params.id)
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' })
    const enrollment = await storage.getEnrollment(lesson.course_id, req.user.id)
    if (!enrollment) return res.status(403).json({ error: 'Enroll to access this lesson' })
    res.json({ lesson, enrollment })
  } catch (err) {
    next(err)
  }
})

// AI-generated quiz for a lesson.
learnRouter.get('/learn/lessons/:id/quiz', async (req, res, next) => {
  try {
    const lesson = await storage.getLesson(req.params.id)
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' })
    if (!(await storage.getEnrollment(lesson.course_id, req.user.id)))
      return res.status(403).json({ error: 'Enroll first' })

    const source = `${lesson.title}\n\n${lesson.content}\n\n${lesson.material}`.slice(0, 10000)
    let questions = []
    try {
      const raw = await complete({
        model: 'bermi-core',
        maxTokens: 1200,
        messages: [
          {
            role: 'system',
            content:
              'Create a 4-question multiple-choice quiz from the lesson. Respond with ONLY JSON: ' +
              '{"questions":[{"q":string,"options":[string,string,string,string],"answer":0}]} — answer is the correct option index. No prose.',
          },
          { role: 'user', content: source },
        ],
      })
      const parsed = JSON.parse(String(raw).replace(/<\/?think>/gi, '').replace(/^```(?:json)?/i, '').replace(/```$/, ''))
      questions = (parsed.questions || []).slice(0, 6)
    } catch {
      questions = []
    }
    if (!questions.length) {
      questions = [
        { q: `What is the main focus of "${lesson.title}"?`, options: ['The core topic of this lesson', 'An unrelated subject', 'None of these', 'Not covered'], answer: 0 },
      ]
    }
    // Strip answers before sending to the client; keep them server-side via index echo.
    res.json({ questions: questions.map((x) => ({ q: x.q, options: x.options })), key: questions.map((x) => x.answer) })
  } catch (err) {
    next(err)
  }
})

// Mark a lesson complete (optionally with a quiz score), and issue a certificate
// when every lesson is done.
learnRouter.post('/learn/lessons/:id/complete', async (req, res, next) => {
  try {
    const lesson = await storage.getLesson(req.params.id)
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' })
    const enrollment = await storage.getEnrollment(lesson.course_id, req.user.id)
    if (!enrollment) return res.status(403).json({ error: 'Enroll first' })

    const score = typeof req.body?.score === 'number' ? Math.round(req.body.score) : undefined
    const progress = { ...(enrollment.progress || {}) }
    progress[lesson.id] = { done: true, score }

    const lessons = await storage.listLessons(lesson.course_id)
    const allDone = lessons.length > 0 && lessons.every((l) => progress[l.id]?.done)
    const scores = lessons.map((l) => progress[l.id]?.score).filter((s) => typeof s === 'number')
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

    const patch = { status: allDone ? 'completed' : 'enrolled', progress, score: avg }
    if (allDone) patch.completed_at = new Date().toISOString()
    const updated = await storage.updateEnrollment(enrollment.id, patch)

    let certificate = null
    if (allDone) {
      const course = await storage.getCourse(lesson.course_id)
      const inst = await storage.getInstitution(course.institution_id)
      const code = 'BC-' + randomBytes(5).toString('hex').toUpperCase()
      certificate = await storage.createCertificate({
        code,
        course_id: course.id,
        user_id: req.user.id,
        learner_name: req.user.name,
        course_title: course.title,
        institution_name: inst?.name || 'Bermi',
        score: avg,
        issued_at: new Date().toISOString(),
      })
    }
    res.json({ enrollment: updated, certificate })
  } catch (err) {
    next(err)
  }
})

// ---- Certificates ----

learnRouter.get('/learn/certificates/:code', async (req, res, next) => {
  try {
    const cert = await storage.getCertificate(req.params.code)
    if (!cert) return res.status(404).json({ error: 'Certificate not found' })
    res.json(cert)
  } catch (err) {
    next(err)
  }
})

learnRouter.get('/learn/certificates/:code/pdf', async (req, res, next) => {
  try {
    const c = await storage.getCertificate(req.params.code)
    if (!c) return res.status(404).json({ error: 'Certificate not found' })
    const md =
      `# Certificate of Completion\n\n` +
      `This certifies that\n\n## ${c.learner_name}\n\n` +
      `has successfully completed the course\n\n**${c.course_title}**\n\n` +
      `issued by **${c.institution_name}**` +
      (c.score != null ? ` with a score of **${c.score}%**` : '') +
      `.\n\nIssued ${new Date(c.issued_at).toLocaleDateString()} · Verification code: ${c.code}`
    const { buffer, mime, ext } = await renderDocument('pdf', {
      title: 'Certificate of Completion',
      markdown: md,
    })
    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${c.code}.${ext}"`)
    res.send(Buffer.from(buffer))
  } catch (err) {
    next(err)
  }
})

// ---- Institution analytics ----

learnRouter.get('/learn/institutions/:id/analytics', async (req, res, next) => {
  try {
    if (!(await ownsInstitution(req.user.id, req.params.id)))
      return res.status(404).json({ error: 'Institution not found' })
    const courses = await storage.listCoursesByInstitution(req.params.id)
    let totalEnrollments = 0
    let totalCompletions = 0
    const perCourse = []
    const allScores = []
    const activity = []
    for (const c of courses) {
      const [enrollments, lessons] = await Promise.all([
        storage.listEnrollmentsByCourse(c.id),
        storage.listLessons(c.id),
      ])
      const completions = enrollments.filter((e) => e.status === 'completed')
      const scores = enrollments.map((e) => e.score).filter((s) => typeof s === 'number')
      totalEnrollments += enrollments.length
      totalCompletions += completions.length

      // Per-learner view: how far they've come and how well they understand.
      const learners = []
      for (const e of enrollments.slice(0, 200)) {
        const user = await storage.getUserById(e.user_id)
        const done = Object.values(e.progress || {}).filter((p) => p && p.done).length
        const name = user?.name || 'Learner'
        learners.push({
          name,
          status: e.status,
          lessons_done: done,
          lessons_total: lessons.length,
          understanding: typeof e.score === 'number' ? e.score : null,
          dependency: typeof e.dependency === 'number' ? e.dependency : null,
        })
        if (typeof e.score === 'number') allScores.push(e.score)
        if (e.enrolled_at) activity.push({ type: 'enrolled', learner: name, course: c.title, at: e.enrolled_at })
        if (e.status === 'completed' && e.completed_at) {
          activity.push({ type: 'completed', learner: name, course: c.title, at: e.completed_at })
        }
      }

      perCourse.push({
        id: c.id,
        title: c.title,
        published: c.published,
        enrollments: enrollments.length,
        completions: completions.length,
        avg_score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        learners,
      })
    }
    activity.sort((a, b) => new Date(b.at) - new Date(a.at))
    const topCourses = [...perCourse].sort((a, b) => b.enrollments - a.enrollments).slice(0, 5)
    res.json({
      courses: courses.length,
      enrollments: totalEnrollments,
      completions: totalCompletions,
      completion_rate: totalEnrollments ? Math.round((totalCompletions / totalEnrollments) * 100) : 0,
      avg_understanding: allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null,
      recent_activity: activity.slice(0, 15),
      top_courses: topCourses.map((c) => ({ id: c.id, title: c.title, enrollments: c.enrollments, completions: c.completions })),
      per_course: perCourse,
    })
  } catch (err) {
    next(err)
  }
})

// A single learner often takes several of an institution's courses. The
// per-course analytics table above can't answer "who is this person across
// everything they're enrolled in" — this does, with optional name/email search.
learnRouter.get('/learn/institutions/:id/learners', async (req, res, next) => {
  try {
    if (!(await ownsInstitution(req.user.id, req.params.id)))
      return res.status(404).json({ error: 'Institution not found' })
    const q = String(req.query.q || '').toLowerCase().trim()
    const courses = await storage.listCoursesByInstitution(req.params.id)
    const byUser = new Map()
    for (const c of courses) {
      const enrollments = await storage.listEnrollmentsByCourse(c.id)
      for (const e of enrollments) {
        if (!byUser.has(e.user_id)) {
          const user = await storage.getUserById(e.user_id)
          if (!user) continue
          byUser.set(e.user_id, { user_id: e.user_id, name: user.name, email: user.email, courses: [] })
        }
        byUser.get(e.user_id).courses.push({
          course_id: c.id,
          title: c.title,
          status: e.status,
          understanding: typeof e.score === 'number' ? e.score : null,
          dependency: typeof e.dependency === 'number' ? e.dependency : null,
        })
      }
    }
    let learners = [...byUser.values()].map((l) => {
      const understandings = l.courses.map((c) => c.understanding).filter((s) => typeof s === 'number')
      const dependencies = l.courses.map((c) => c.dependency).filter((s) => typeof s === 'number')
      return {
        ...l,
        total_courses: l.courses.length,
        completed: l.courses.filter((c) => c.status === 'completed').length,
        avg_understanding: understandings.length
          ? Math.round(understandings.reduce((a, b) => a + b, 0) / understandings.length)
          : null,
        avg_dependency: dependencies.length
          ? Math.round(dependencies.reduce((a, b) => a + b, 0) / dependencies.length)
          : null,
      }
    })
    if (q) {
      learners = learners.filter(
        (l) => l.name.toLowerCase().includes(q) || (l.email || '').toLowerCase().includes(q),
      )
    }
    learners.sort((a, b) => b.total_courses - a.total_courses)
    res.json(learners.slice(0, 300))
  } catch (err) {
    next(err)
  }
})

function csvCell(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// A CSV export of every enrollment across every course — institutions expect
// to pull this into a spreadsheet, not just view it on screen.
learnRouter.get('/learn/institutions/:id/analytics/export.csv', async (req, res, next) => {
  try {
    if (!(await ownsInstitution(req.user.id, req.params.id)))
      return res.status(404).json({ error: 'Institution not found' })
    const courses = await storage.listCoursesByInstitution(req.params.id)
    const rows = [
      ['Learner', 'Email', 'Course', 'Status', 'Lessons done', 'Lessons total', 'Understanding %', 'AI-dependency %', 'Enrolled at'],
    ]
    for (const c of courses) {
      const [enrollments, lessons] = await Promise.all([
        storage.listEnrollmentsByCourse(c.id),
        storage.listLessons(c.id),
      ])
      for (const e of enrollments) {
        const user = await storage.getUserById(e.user_id)
        const done = Object.values(e.progress || {}).filter((p) => p && p.done).length
        rows.push([
          user?.name || 'Learner',
          user?.email || '',
          c.title,
          e.status,
          done,
          lessons.length,
          typeof e.score === 'number' ? e.score : '',
          typeof e.dependency === 'number' ? e.dependency : '',
          e.enrolled_at || '',
        ])
      }
    }
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="bermi-learn-learners.csv"')
    res.send(csv)
  } catch (err) {
    next(err)
  }
})

export { requireAuth }
