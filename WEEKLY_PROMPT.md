# Weekly question prompt

Paste everything between the lines into a new chat, attach that week's notes, and fill in the two blanks. You get back a CSV to upload on **Import & data**.

---

I've attached my study notes for week **[WEEK NUMBER]**, case **"[CASE TITLE, e.g. Sundip Patel: MI & IHD]"**. Each numbered heading is a learning objective (a "section").

Write self-test questions covering every section, and give them to me as a downloadable CSV file. Follow these rules exactly.

**Coverage**
1. Cover **every** point in every section: bullet points, every row of every table, key-concept and callout boxes, definitions, numbers, thresholds, drug names, doses and mechanisms. Nothing in the notes should be untested.
2. Open every figure and diagram and test what it shows that the text doesn't (labels, values, sequences, which structure is which). Name the figure in the question, e.g. "Figure 4: …".
3. Questions are open recall: no multiple choice and no hints in the question. Combine closely related facts into one question where natural ("Give the mechanism, two uses and three side effects of …"), but every fact must still be checked by some question.
4. Add 1–3 short **application** questions (clinical scenarios applying that section) at the end of each section.

**Answers**
5. Use the notes' own facts, wording and numbers. Don't add facts that aren't in the notes, except a brief standard explanation of a figure label if the notes don't give one.
6. Put key terms and numbers in **double asterisks** for bold. Keep answers complete but tight.

**CSV format**
7. Columns, in this order, with this header row:
   `week,case,section,section_title,group,id,type,question,answer`
   - `week`: [WEEK NUMBER] on every row
   - `case`: the case title on every row
   - `section`: the section number (whole number)
   - `section_title`: the section heading without its number
   - `group`: a short sub-heading within the section that follows the notes' structure (e.g. "Conduction and action potentials"); use `Application` for application questions
   - `id`: `section.n`, numbering from 1 within each section in order (1.1, 1.2 … 2.1 …)
   - `type`: `recall`, or `application` for application questions
   - `question`, `answer`: the text
8. One row per question, in the order of the notes. Standard CSV quoting (wrap fields containing commas, quotes or line breaks in double quotes; double any quote inside). UTF-8.
9. Name the file `week[NN]_[short-topic].csv`.

**Before you give me the file**
10. Check that every number in the notes appears in at least one answer, and that every section has questions. Then tell me the question count per section and anything you couldn't cover.

---

## Tips

- Re-uploading a corrected file for the same week updates the wording and keeps your grades. Questions are matched by week + id, so keep ids stable when you fix things.
- If you renumber ids, the renumbered questions are treated as new ones. Delete the old week first (Import & data → Delete a week) if you want a clean slate.
- Fix small mistakes directly in the app with **Edit** (or the **E** key) while studying.
