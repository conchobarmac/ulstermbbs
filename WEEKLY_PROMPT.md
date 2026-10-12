# Weekly question prompt

Paste everything between the lines into a new chat, attach that week's notes, and fill in the three blanks. You get back a CSV to upload on **Import & data**.

---

I've attached my study notes for week **[WEEK NUMBER]**, PBL case **"[CASE NAME, e.g. Sundip Patel]"**, topic **"[TOPIC LABEL, e.g. MI & IHD]"**. Each numbered heading is a learning objective (a "section").

Write self-test questions covering every section, and give them to me as a downloadable CSV file. Follow these rules exactly.

**Coverage**
1. Cover **every** point in every section: bullet points, every row of every table, key-concept and callout boxes, definitions, numbers, thresholds, drug names, doses and mechanisms. Nothing in the notes should be untested.
2. Open every figure and diagram and test what it shows that the text doesn't (labels, values, sequences, which structure is which). Name the figure in the question, e.g. "Figure 4: …".
3. Questions are open recall: no multiple choice and no hints in the question. Every fact must be checked by some question.
   **Keep questions small and even in size across all sections:** each tests one idea, or up to 3–4 closely linked facts. Split any list longer than about 4 items across several questions (e.g. eight contraindications → two questions of four). Answers should be 1–3 short sentences, roughly 150–250 characters. Don't let later sections get bigger, denser questions than earlier ones.
4. Add 1–3 short **application** questions (clinical scenarios applying that section) at the end of each section.

**Answers**
5. Use the notes' own facts, wording and numbers. Don't add facts that aren't in the notes, except a brief standard explanation of a figure label if the notes don't give one.
6. Put key terms and numbers in **double asterisks** for bold. Keep answers complete but tight.

**CSV format**
7. Columns, in this order, with this header row:
   `week,case,topic,section,section_title,group,id,type,question,answer`
   - `week`: [WEEK NUMBER] on every row
   - `case`: the case name on every row (e.g. Sundip Patel)
   - `topic`: the topic label on every row (e.g. MI & IHD)
   - `section`: the section number (whole number)
   - `section_title`: the section heading without its number
   - `group`: a short sub-heading within the section that follows the notes' structure (e.g. "Conduction and action potentials"); use `Application` for application questions
   - `id`: `section.n`, numbering from 1 within each section in order (1.1, 1.2 … 2.1 …)
   - `type`: `recall`, or `application` for application questions
   - `question`, `answer`: the text
8. One row per question, in the order of the notes. Standard CSV quoting (wrap fields containing commas, quotes or line breaks in double quotes; double any quote inside). UTF-8.
9. Name the file `week[NN]_[short-topic].csv`.

**Before you give me the file**
10. Check that every number in the notes appears in at least one answer, that every section has questions, and that question size is consistent across sections. Then tell me the question count per section and anything you couldn't cover.

---

## Updating mid-week after lectures

Start learning from the first CSV straight away. When lectures add or change content, ask the chat that has your guide and the slides for an **updated version of the same CSV**, not a new one:

---

I've attached my current question CSV for this week. Update it to reflect the lectures and give me the full updated file (all rows, not just changes).

Rules:
- Keep every existing row and its id exactly. Never renumber, and never reuse an id for a different question.
- If a lecture corrects, emphasises or adds detail to something an existing question covers, edit that row's question/answer in place and keep its id.
- For genuinely new content, add new rows with new ids: the next unused number in that section (if section 4 ends at 4.24, use 4.25, 4.26…). Place them in the logical position within the file, not at the end.
- Same columns, format and style rules as before: one idea or 3–4 linked facts per question, answers about 150–250 characters, **bold** key terms.
- Don't delete rows. If an existing question is now irrelevant, keep it and tell me its id.
- After the file, list: new ids; edited ids with one line on what changed; ids you think are now irrelevant.

---

Upload it as usual. New questions appear as not yet learned (Learn → Continue finds them in order). Any question you'd already learned whose wording changed becomes due for review immediately, and the import message lists them.

## Tips

- Re-uploading a corrected file for the same week updates the wording and keeps your grades. Questions are matched by week + id, so keep ids stable when you fix things.
- If you renumber ids, the renumbered questions are treated as new ones. Delete the old week first (Import & data → Delete a week) if you want a clean slate.
- Fix small mistakes directly in the app with **Edit** (or the **E** key) while studying.
