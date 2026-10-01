# Phase 11 – real-world validation kit

This folder has everything needed to test MedLedger AI with real reports, real doctors and real users. It doesn't contain any results yet: those have to come from the study itself. Every script was dry-run on synthetic scans to check it works.

| What | Target (plan, Phase 11) | Tool |
|---|---|---|
| Value recall on real printed reports | ≥ 95% | `eval_real_reports.ts` |
| Clinician review of 30 AI summaries | no harmful errors | `make_review_pack.ts` → doctors → `score_study.ts` |
| User study, 10–15 patients + 5 clinicians | mean SUS ≥ 70 | `forms/study_forms.pdf` → `score_study.ts` |

## 0. Before you start (1–2 weeks of lead time)

1. **Approval.** Show your guide this README and `forms/study_forms.pdf`. If your institution has an ethics committee (IRB/IRC), ask whether you need approval. A usability study with test accounts is usually minimal risk, but collecting real lab reports usually needs permission. Also get written permission from each partner laboratory.
2. **Translations.** The Nepali and Hindi forms are drafts. Ask one native speaker per language to read them, or to translate them back into English so you can compare. Fix `forms/build_forms.py`, then run `python3 docs/study/forms/build_forms.py`.
3. **Test accounts.** Create one patient account per participant (P01, P02 …) and two clinician accounts. Put a demo patient with a shared record on each clinician account. Write each participant's sign-in details on a card.
4. **Pilot.** Run the whole session with one friend first and time it. Fix anything confusing before the real sessions.

## 1. Real reports (week 1)

- Collect **50–100 reports**: at least 30 printed (scanned or photographed flat), at least 20 phone photos, plus any digital PDFs. Include several laboratories and different test panels.
- Follow the checklist on the last page of the forms. The most important step: **anonymise before the files leave the laboratory**, by blacking out names, relatives, phone numbers, addresses, ID numbers, dates of birth, barcodes and signatures.
- Name the files `R001.jpg` … and put them in `data/reports/`.
- Copy `templates/labels.csv` to `data/labels.csv`. Enter every printed value exactly as it appears on the report, along with the lab's H/L flag. A second person checks every 10th row.
- Run it (from `apps/server`):

  ```
  node --import tsx ../../docs/study/eval_real_reports.ts
  ```

  It reports:
  - value recall with a 95% Wilson interval for each capture type (printed, photo, pdf);
  - how often the engine's low/normal/high agrees with the lab's flag;
  - spurious values and seconds per page;
  - any test names the engine doesn't know, which you can add to `labReference.ts` if needed;
  - any report that still looks like it contains personal details.

## 2. Clinician review (week 1–2)

```
node --import tsx ../../docs/study/make_review_pack.ts      # 30 summaries, fixed random choice
```

- This writes `results/review_pack.html`, where each summary sits beside its original report, and a blank `results/clinician_ratings_blank.csv`. Print the pack or send it to the doctors.
- Two doctors rate **independently**:
  - accuracy (1–5);
  - usefulness to the patient (1–5);
  - whether anything could harm a patient, and what.
- Enter their answers in `data/clinician_ratings.csv`.

## 3. User study (week 2)

- **Participants:** 10–15 patients (a mix of ages, and at least a third choosing Nepali or Hindi) and 5 clinicians. Twelve or more participants give a stable SUS mean (Tullis & Stetson, 2004).
- **Each session, about 30 minutes:**
  1. Consent.
  2. The tasks, with the observer filling in the task log.
  3. The SUS questionnaire in the participant's language.
  4. One open question: "What was hardest?"
- Enter the answers in `data/sus_responses.csv` and `data/task_log.csv`. Use the same task names as the log sheet: `sign_in`, `upload`, `read_summary`, `share`, `stop_sharing`, `find_activity`, and for clinicians `open_shared`, `request_access`, `verify_record`.

## 4. Score everything

```
node --import tsx ../../docs/study/score_study.ts
```

It writes `results/study_results.json`:
- SUS: the mean with a 95% CI, the adjective band, and a breakdown by role and by language;
- the rate of tasks completed without help, and the time per task;
- the doctors' mean ratings, how far they agree (quadratic-weighted kappa), and every harmful error they reported;
- a check against the three targets.

## 5. Paper

Send the `results/` files, and `chain_eval_sepolia.json` from Phase 10, back to Claude. The "Real-world validation" results and the threats-to-validity paragraph will be updated from them. Report the numbers as they come out. If a target is missed, say so and explain why; reviewers trust that more than a perfect score.

## Files

- `forms/study_forms.pdf` (built by `forms/build_forms.py`) contains:
  - consent, task sheets and the SUS questionnaire in English, Nepali and Hindi;
  - the clinician task sheet;
  - a fictional sample report;
  - the observer's log sheet;
  - the checklist for collecting reports.
- `templates/*.csv` are the headers and instructions for the four data files.
- `scoring.ts` holds the SUS, confidence-interval, kappa, Wilson and CSV functions (tested in `apps/server/tests/phase11.test.ts`).
- `data/` is private and ignored by git; see `data/README.md`.
