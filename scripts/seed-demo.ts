/**
 * Fills a fresh Firebase project with a realistic demo centre for sales demos and testing:
 * a headmaster, two tutors, twelve students in two cohorts, a week's timetable, materials,
 * a quiz with results, attendance, fees and a community thread.
 *
 *   npm run seed-demo
 *
 * Every demo account uses the password printed at the end. Safe to re-run: it replaces the
 * "demo" centre's documents but leaves everything else alone.
 */
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { db, ensureUser, put } from "./_firebase";

const PASSWORD = process.env.DEMO_PASSWORD || "NeonDemo2026!";
const SUBDOMAIN = "demo";

const STUDENTS = [
  "Kagiso Molefe", "Naledi Dube", "Thabo Sebina", "Lesedi Kgosi", "Onalenna Tau", "Boitumelo Ndlovu",
  "Tumelo Phiri", "Masego Seretse", "Kefilwe Moyo", "Refilwe Mmusi", "Neo Sithole", "Amogelang Pule",
];

function stableId(...parts: string[]) {
  return createHash("sha1").update(parts.join(":")).digest("hex").slice(0, 20);
}

function hashQuizPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function daysAgo(n: number, hour = 15) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function wipeCentre(institutionId: string) {
  // Children first, found through their parents.
  for (const [parent, child, key] of [
    ["quizzes", "quiz_attempts", "quiz_id"],
    ["forum_posts", "forum_comments", "post_id"],
  ] as const) {
    const parents = await db.collection(parent).where("institution_id", "==", institutionId).get();
    for (const p of parents.docs) {
      const kids = await db.collection(child).where(key, "==", p.id).get();
      for (const k of kids.docs) await k.ref.delete();
    }
  }
  const collections = [
    "cohorts", "materials", "quizzes", "timetables", "attendance", "cash_payments",
    "forum_posts", "join_requests", "notifications",
  ];
  for (const c of collections) {
    const snap = await db.collection(c).where("institution_id", "==", institutionId).get();
    for (const doc of snap.docs) await doc.ref.delete();
  }
}

async function main() {
  const instId = stableId("institution", SUBDOMAIN);
  await wipeCentre(instId);

  await put(
    "institutions",
    {
      name: "Bright Minds Tuition",
      subdomain: SUBDOMAIN,
      subscription_tier: "growth",
      is_trial: true,
      trial_ends_at: daysAgo(-14).toISOString(),
      student_limit: 250,
      monthly_fee: 450,
    },
    instId
  );

  const person = async (email: string, name: string, role: string, extra: Record<string, unknown> = {}) => {
    const { uid } = await ensureUser(email, PASSWORD, name);
    await put("profiles", { email, full_name: name, role, institution_id: instId, ...extra }, uid);
    return uid;
  };

  const headmaster = await person("head@demo.neon.app", "Mrs Tshepo Kgari", "headmaster");
  const maths = await person("maths@demo.neon.app", "Mr Oratile Banda", "tutor");
  const science = await person("science@demo.neon.app", "Ms Palesa Mokoena", "tutor");

  const form4 = await put("cohorts", { institution_id: instId, name: "Form 4", description: "BGCSE prep, year one" }, stableId(instId, "form4"));
  const form5 = await put("cohorts", { institution_id: instId, name: "Form 5", description: "BGCSE exam year" }, stableId(instId, "form5"));

  const students: { id: string; cohort: string }[] = [];
  for (const [i, name] of STUDENTS.entries()) {
    const email = `student${i + 1}@demo.neon.app`;
    const cohort = i % 2 === 0 ? form5 : form4;
    // The last student is left without a cohort so the "needs a cohort" flow has something to show.
    const id = await person(email, name, "student", { cohort_id: i === STUDENTS.length - 1 ? null : cohort });
    students.push({ id, cohort });
  }

  const slots: [string, number, string, string, string, string][] = [
    [form5, 1, "15:00", "16:30", "Mathematics", maths],
    [form5, 3, "15:00", "16:30", "Physics", science],
    [form5, 6, "09:00", "11:00", "Mathematics", maths],
    [form4, 2, "15:00", "16:30", "Mathematics", maths],
    [form4, 4, "15:00", "16:30", "Biology", science],
    [form4, 6, "11:30", "13:00", "Chemistry", science],
  ];
  for (const [cohort_id, day_of_week, start_time, end_time, subject, tutor_id] of slots) {
    await put("timetables", { institution_id: instId, cohort_id, day_of_week, start_time, end_time, subject, tutor_id, room: "Room 2" });
  }

  const materials: [string, string, string | null, string][] = [
    ["Quadratic equations: worked examples", "Mathematics", form5, "https://www.khanacademy.org/math/algebra/x2f8bb11595b61c86:quadratic-functions-equations"],
    ["2023 Paper 2 with marking scheme", "Mathematics", form5, "https://example.com/past-paper.pdf"],
    ["Forces and motion summary", "Physics", form5, "https://example.com/forces.pdf"],
    ["Cell structure diagram", "Biology", form4, "https://example.com/cell.png"],
    ["Study timetable template", "General", null, "https://example.com/template.docx"],
  ];
  for (const [title, subject, cohort_id, content_url] of materials) {
    await put("materials", { institution_id: instId, title, subject, cohort_id, content_url, description: null });
  }

  const questions = [
    { type: "multiple_choice", question: "Solve x² − 5x + 6 = 0.", options: ["x = 2 or 3", "x = −2 or −3", "x = 1 or 6", "x = 5"], correctIndex: 0 },
    { type: "multiple_choice", question: "What is the discriminant of x² + 4x + 4?", options: ["0", "4", "8", "16"], correctIndex: 0 },
    { type: "multiple_choice", question: "The graph of y = x² − 1 crosses the y-axis at", options: ["(0, −1)", "(1, 0)", "(0, 1)", "(−1, 0)"], correctIndex: 0 },
    { type: "multiple_choice", question: "Factorise x² − 9.", options: ["(x − 3)(x + 3)", "(x − 9)(x + 1)", "(x − 3)²", "x(x − 9)"], correctIndex: 0 },
  ];
  const quizId = await put("quizzes", {
    institution_id: instId,
    cohort_id: form5,
    title: "Quadratics check-in",
    questions,
    time_limit_minutes: 15,
    access_password_hash: hashQuizPassword("maths123"),
    max_focus_violations: 2,
    due_at: daysAgo(-5).toISOString(),
  });

  const scores = [100, 75, 50, 75, 100, 25];
  for (const [i, s] of students.filter((x) => x.cohort === form5).entries()) {
    const score = scores[i % scores.length];
    const when = daysAgo(2 + (i % 3)).toISOString();
    await put("quiz_attempts", {
      quiz_id: quizId,
      student_id: s.id,
      score,
      status: "submitted",
      submitted_reason: i === 5 ? "timer_expired" : "manual",
      focus_violations: i === 3 ? 1 : 0,
      time_spent_seconds: 420 + i * 30,
      question_snapshot: questions,
      answers: questions.map((q, qi) => (qi < Math.round((score / 100) * questions.length) ? q.correctIndex : 1)),
      started_at: when,
      submitted_at: when,
      ended_at: when,
    });
  }

  for (let d = 1; d <= 10; d++) {
    const date = daysAgo(d).toISOString().slice(0, 10);
    const dow = daysAgo(d).getDay();
    if (dow === 0) continue;
    for (const [i, s] of students.entries()) {
      if (s.cohort !== form5 && s.cohort !== form4) continue;
      const roll = (i * 7 + d * 3) % 10;
      const status = roll === 0 ? "absent" : roll === 1 ? "late" : "present";
      await put("attendance", { institution_id: instId, cohort_id: s.cohort, student_id: s.id, date, status, remarks: null }, stableId(s.id, date));
    }
  }

  for (const [i, s] of students.entries()) {
    if (i % 3 === 2) continue; // a few students still owe this month
    await put("cash_payments", { institution_id: instId, student_id: s.id, amount: 450, paid_at: daysAgo(i % 5, 10).toISOString(), recorded_by: headmaster });
  }

  const post = await put("forum_posts", {
    institution_id: instId,
    author_id: students[0].id,
    subject: "Mathematics",
    title: "How do I know when to use the quadratic formula?",
    content: "Factorising works sometimes but not always. When should I just use the formula?",
    created_at: daysAgo(1, 18).toISOString(),
  });
  await put("forum_comments", {
    post_id: post,
    author_id: maths,
    content: "Try factorising first for 30 seconds. If the numbers don't work out nicely, use the formula. It always works.",
    created_at: daysAgo(1, 19).toISOString(),
  });

  await put("join_requests", {
    institution_id: instId,
    email: "new.student@example.com",
    full_name: "Goitse Ramotswa",
    message: "I'm in Form 4 at Maru-a-Pula and need help with maths.",
    status: "pending",
  });

  console.log("Demo centre ready: Bright Minds Tuition (/join/demo)");
  console.log(`Password for every account: ${PASSWORD}`);
  console.log("  Headmaster  head@demo.neon.app");
  console.log("  Tutors      maths@demo.neon.app, science@demo.neon.app");
  console.log("  Students    student1@demo.neon.app … student12@demo.neon.app");
  console.log('  Quiz password for "Quadratics check-in": maths123');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
