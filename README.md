# Recall

A small personal study app. Each week you upload a CSV of questions from your notes, work through each section in order (**Learn**), and come back to them later on a schedule (**Review**). Grades are 0–3:

| Grade | Label | Means | Next review |
|---|---|---|---|
| 0 | Blank | Didn't know it | tomorrow |
| 1 | Partial | Some of it, with gaps | in 3 days |
| 2 | Mostly | Nearly all, small slips | previous gap × 1.5 (at least 5 days) |
| 3 | Solid | All of it, confidently | previous gap × 2.5 (at least 7 days) |

Gaps are capped at 180 days. Change the numbers in `src/lib/schedule.ts`.

**Learn** goes through one section in the order of your notes: question, then *Show answer*, then grade. It picks up at the first question you haven't graded. Use ← Back to revisit one, or "Start from question 1" to go through the section again.

**Review** only ever shows questions you've already learned. Nothing new is mixed in. Choose **Due** (review date has arrived), **Weak** (last graded Blank or Partial) or **Everything learned**, for all weeks, one week or one section, in note order or shuffled. You decide when to review; nothing forces reviews before new material.

While studying: <kbd>Space</kbd> show answer · <kbd>0</kbd>–<kbd>3</kbd> grade · <kbd>←</kbd>/<kbd>→</kbd> back/skip · <kbd>F</kbd> flag · <kbd>E</kbd> edit the question or answer.

Stack: React + Vite (hosted free on Vercel), Supabase (free Postgres database + login). Only you can sign in, and the database only lets you see your own rows.

---

## One-time setup (about 15 minutes)

You need free accounts on **GitHub**, **Supabase** and **Vercel**.

### 1. Put the code on GitHub

Either push this folder to your repository, or on github.com open your (empty) repository → **Add file → Upload files**, drag in everything from this folder (not the `node_modules` folder, if you have one), and commit.

### 2. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**. Pick any name, set a database password (save it somewhere; the app doesn't use it), choose region **London (eu-west-2)**, and create it. Wait a minute for it to finish.
2. In the left sidebar open **SQL Editor** → **New query**. Open `supabase/schema.sql` from this repo, copy all of it, paste it in, and click **Run**. You should see *Success. No rows returned*.
3. Create your login. Go to **Authentication → Users → Add user → Create new user**. Enter your email and a password, tick **Auto Confirm User**, and create.
4. Stop anyone else signing up. Go to **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up". Save. (The menu names move around occasionally; it's the user sign-ups setting under Authentication.)
5. Get your two keys. Click **Connect** at the top of the project page (or go to **Project Settings → API Keys** and **Data API**) and copy:
   - the **Project URL**, e.g. `https://abcdefgh.supabase.co`
   - the **publishable key** (`sb_publishable_…`) or, if that's not shown, the legacy **anon public** key (a long `eyJ…` string)

   These two are designed to be used in a browser. They don't give access to your data without your login. **Never** use the `service_role` / secret key in the app.

### 3. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub. Then **Add New… → Project**, and **Import** your repository.
2. Vercel detects **Vite**. Leave the build settings as they are.
3. Open **Environment Variables** and add:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your publishable / anon key
4. Click **Deploy**. After about a minute you get a link like `https://recall-yourname.vercel.app`. Bookmark it on your laptop and phone (on a phone, *Add to Home Screen* makes it feel like an app).

If you add or change the variables later, go to **Deployments → ⋯ → Redeploy**, because they're built into the app at deploy time.

### 4. First use

Open your link, sign in, go to **Import & data**, and upload your first week's CSV. The Home page then lists the week and its sections, each with a **Learn** button.

---

## Every week

1. Open a new chat with Claude (or any assistant), paste the prompt from **[WEEKLY_PROMPT.md](WEEKLY_PROMPT.md)**, attach your notes, and fill in the week number and case title.
2. Download the CSV it gives you, and upload it on **Import & data**. The preview tells you how many questions it found and lists any rows with problems before anything is saved.
3. Learn each section after you've read it. Review when you choose to.

### Import file format

CSV with this header row (see `examples/example.csv`):

```
week,case,section,section_title,group,id,type,question,answer
```

| Column | Required | Notes |
|---|---|---|
| week | yes | whole number |
| case | | case or topic title, shown on Home |
| section | yes | whole number, the learning objective |
| section_title | | the learning objective heading |
| group | | sub-heading within the section |
| id | yes | unique within the week, e.g. `4.12` |
| type | | `recall` (default) or `application` |
| question | yes | |
| answer | yes | `**text**` shows in bold |

Rows keep the order they're in. Uploading a file again for the same week updates the wording and order of matching questions (matched on week + id) and **keeps your grades**. Changing a question's id makes it count as a new question.

---

## Good to know

- **Fixing mistakes.** Press **Edit** (or <kbd>E</kbd>) on any question while studying. **Flag** (<kbd>F</kbd>) marks one to deal with later; flagged questions are listed on Import & data.
- **Backups.** Import & data → **Download CSVs** gives you every question with its current grade and next review date, plus every grade you've ever given. The questions file can be re-imported. Doing this once a week or so is a sensible habit.
- **Free-tier pausing.** Supabase pauses free projects after about a week with no activity. If the app suddenly can't load anything after a break, open the Supabase dashboard and click **Restore project**. Your data is kept.
- **Deleting a week.** Import & data → Delete a week (type DELETE to confirm). This removes that week's questions and their grades.
- **Changing the schedule.** Edit `src/lib/schedule.ts` on GitHub (pencil icon) and commit. Vercel redeploys automatically. Changes apply to future grades.
- **Try it without Supabase.** Set the environment variable `VITE_DEMO=1` (and leave the Supabase ones out) to run a version that stores everything in the browser only.

## Running locally (optional)

Needs Node 20+.

```
npm install
cp .env.example .env.local   # then fill in the two values
npm run dev                  # http://localhost:5173
npm test                     # unit tests
```

## Files

- `supabase/schema.sql`: database tables, security rules and the grading function
- `src/lib/schedule.ts`: the review schedule
- `src/lib/csv.ts`: import format and checks
- `src/lib/db.ts`: all database calls (Supabase, plus a browser-only demo mode)
- `src/components/Study.tsx`: the question / answer / grade screen used by both modes
- `src/pages/`: Home, Learn, Review, Import & data
- `WEEKLY_PROMPT.md`: the prompt for making each week's CSV
