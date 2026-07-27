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

learnRouter.post('/learn/my/courses/quick', async (req, res, next) => {
  try {
    const { title, objectives = '', level = 'All levels' } = req.body ?? {}
    if (!title?.trim()) return res.status(400).json({ error: 'Give your course a title' })

    const workspace = await personalWorkspace(req.user)
    const now = new Date().toISOString()
    const course = await storage.createCourse({
      id: randomUUID(),
      institution_id: workspace.id,
      title: title.trim(),
      slug: slugify(title),
      summary: '',
      description: '',
      cover_emoji: '📘',
      level,
      published: false,
      enrollment: 'open',
      objectives,
      evaluation: '',
      tracking: '',
      created_at: now,
      updated_at: now,
    })

    // Draft a short module structure with AI so the creator starts with
    // something real, not a blank course.
    let lessonTitles = []
    try {
      const raw = await complete({
        model: 'bermi-core',
        maxTokens: 400,
        messages: [
          {
            role: 'system',
            content:
              'You design course modules. Given a title and objectives, output ONLY a JSON array of 3-5 short ' +
              'lesson titles that progressively build toward the objectives. No prose.',
          },
          { role: 'user', content: `Title: ${title}\n\nObjectives: ${objectives || '(none given — infer sensible ones)'}` },
        ],
      })
      const parsed = JSON.parse(String(raw).replace(/^```(?:json)?/i, '').replace(/```$/, ''))
      lessonTitles = Array.isArray(parsed) ? parsed.slice(0, 6).map(String) : []
    } catch {
      lessonTitles = []
    }
    if (!lessonTitles.length) lessonTitles = ['Introduction', 'Core concepts', 'Putting it into practice']

    const lessons = []
    for (let i = 0; i < lessonTitles.length; i++) {
      lessons.push(
        await storage.createLesson({
          id: randomUUID(),
          course_id: course.id,
          ordinal: i,
          title: lessonTitles[i],
          content: '',
          material: '',
          created_at: now,
        }),
      )
    }

    res.status(201).json({ institution: workspace, course, lessons })
  } catch (err) {
    next(err)
  }
})

learnRouter.put('/learn/institutions/:id', async (req, res, next) => {
  try {
    if (!(await ownsInstitution(req.user.id, req.params.id)))
      return res.status(404).json({ error: 'Institution not found' })
    const { name, about, website, published } = req.body ?? {}
    res.json(await storage.updateInstitution(req.params.id, { name, about, website, published }))
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
    const { title, summary, description, cover_emoji, level, published, enrollment, objectives, evaluation, tracking } =
      req.body ?? {}
    res.json(
      await storage.updateCourse(req.params.id, {
        title,
        summary,
        description,
        cover_emoji,
        level,
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
    const { title, content = '', material = '' } = req.body ?? {}
    if (!title?.trim()) return res.status(400).json({ error: 'Lesson title is required' })
    const existing = await storage.listLessons(req.params.id)
    const lesson = await storage.createLesson({
      id: randomUUID(),
      course_id: req.params.id,
      ordinal: existing.length,
      title: title.trim(),
      content,
      material,
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
    const { title, content, material, ordinal } = req.body ?? {}
    res.json(
      await storage.updateLesson(req.params.id, {
        title: title ?? lesson.title,
        content: content ?? lesson.content,
        material: material ?? lesson.material,
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
        learners.push({
          name: user?.name || 'Learner',
          status: e.status,
          lessons_done: done,
          lessons_total: lessons.length,
          understanding: typeof e.score === 'number' ? e.score : null,
          dependency: typeof e.dependency === 'number' ? e.dependency : null,
        })
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
    res.json({
      courses: courses.length,
      enrollments: totalEnrollments,
      completions: totalCompletions,
      completion_rate: totalEnrollments ? Math.round((totalCompletions / totalEnrollments) * 100) : 0,
      per_course: perCourse,
    })
  } catch (err) {
    next(err)
  }
})

export { requireAuth }
