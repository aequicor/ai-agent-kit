# Process review v6.1 — заметки для продолжения

Дата: 2026-05-07
Контекст: разговор с PO про дефект-рейт пайплайна v6.1 + конкретный баг с double-permission на `/kit-revert-step`.

Это рабочий файл, а не документация. Не мержить в master в текущем виде. Когда план разнесём на PR'ы — этот файл удалить.

---

## 1. Диагноз

### 1.1 Один пайплайн на всё
В `kit/_shared/agents/Main.body.md.template` FEATURE-pipeline = 6 шагов × 10 подшагов (5.1→5.10). Тривиальное изменение («перекрасить кнопку») проходит через @Analyst → @TestKeeper GENERATE → @TestKeeper DRAFT → @CodeWriter → @TestKeeper EXECUTE → @Reviewer (4 паса) → 5.4a unchanged-call-sites → 5.4b commit → 5.7 RECONCILE → 5.8 TRACE → 5.9 DoDGate (7 проверок) → 5.10 diff-review. Никакого триажа по размеру. TECH почти идентичен FEATURE.

### 1.2 AI-проверяет-AI без точки заземления
@Reviewer / @DoDGate / @TraceabilityChecker валидируют артефакты, сгенерированные тем же классом моделей из того же PO-описания. Они делят слепые пятна с @CodeWriter. AC «кнопка красная» → тест проверяет color → Reviewer одобряет → в проде кнопка перекрыта overlay'ем. Все «зелёное», дефект едет в прод.

### 1.3 UI без обязательного ground-truth
Для UX-фич нет mandatory визуального артефакта перед `/kit-approve`. v6.1 добавил `Runnable:` (P13) и runbook (P14) — но это текст. Скриншот/preview не требуется. PO в `auto_approve.feature: true` вообще не смотрит результат глазами.

### 1.4 Каждая версия = +N gates
v5.0 → v5.1 hooks → v5.2 replan → v6 split spec/plan + diff-review + slice caps → v6.1 per-step commit + runbooks + sleep mode + REPO_MAP. P1…P16. Ни в одной версии нет ретроспективы «какой gate реально ловил дефекты». В `docs/migration/changelog.yaml` нет метрики defect_rate per version. Дефекты лечатся добавлением слоёв, а не разбором причин.

### 1.5 Дубль-проверки
@Reviewer (Pass A correctness + Pass D scope drift + adversarial 2nd) + @DoDGate (7 checks) + @TraceabilityChecker (AC→TC→file matrix) + 5.4a unchanged-call-sites grep + 5.10 diff-review — все читают один и тот же diff, разными глазами. Затраты складываются, сигнал — нет.

---

## 2. Конкретный баг — `/kit-revert-step` double-permission

**Симптом.** PO: `/kit-revert-step`. @Main: «PO подтвердил, применяю reset». Дальше harness Claude Code блокирует `git reset --hard <sha>` потому что system-prompt помечает его destructive. PO получает второй диалог. Иллюзия «одной команды» сломана.

**Корень.** Два разных уровня согласия не скоординированы:
- Логическое (kit): `/kit-approve` — in-band semantic flag в plan.md.
- Физическое (host): allow-list разрешения на `Bash(git reset --hard *)` в `.claude/settings.json` или явное user-confirm в диалоге.

Kit рассуждает, как будто он контролирует исполнение. Не контролирует.

**Где живёт `git reset --hard`** (нашёл в `kit/_shared/agents/Main.body.md.template`):
- строка 5 — write-narrow shell scope, упоминает `git reset --hard <step_commit_sha>` в BLOCKED-shutdown / `/kit-revert-step`
- строки 692–693 — sleep BLOCKED-shutdown процедура
- строка 772 — `/kit-revert-step` исполнение

---

## 3. План на завтра — приоритеты

### P0 — fix `/kit-revert-step` (сделать первым; маленький PR, большой effect)

**Решение:** заменить `git reset --hard <prev_sha>` на `git revert <step_commits[N].sha>` для interactive `/kit-revert-step`. Sleep BLOCKED-shutdown пока оставить как есть (для него позже отдельное решение, см. P2 ниже).

**Что меняется в семантике:**
- работающее дерево не теряет коммиты — появляется reverse-коммит
- `step_commits[N].sha` остаётся в истории, помечается `superseded: true` (в task file), как уже делает `/kit-defect`
- добавляется новый entry: `{step: N, sha: <revert_sha>, kind: revert, reverts: <step_commits[N].sha>}`
- `current_step_idx` → `N - 1`, `[x] Step N` → `[ ] Step N` в plan.md
- harness не блокирует, потому что `git revert` не в destructive-списке system-prompt'а
- цена: лишний reverse-коммит в истории. Для feature-веток это нормально; squash на merge всё равно почистит.

**Файлы к правке:**
- `kit/_shared/agents/Main.body.md.template` — строки 765–784 (раздел Per-step defect handling — `/kit-revert-step`)
- `kit/_shared/agents/Main.body.md.template` — строка 5 (write-narrow shell scope комментарий: добавить `git revert <sha>`)
- проверить, есть ли `kit/_shared/commands/kit-revert-step.md` — если да, синхронизировать
- `docs/migration/changelog.yaml` — новый entry, breaking: true (семантика step_commits расширяется новым типом entry)

**Версия:** MAJOR-bump (v7.0.0). Семантика step_commits меняется — старые task files без `kind`/`reverts` полей всё ещё парсятся (default `kind: step`), но новые entries добавляют схему. Migration: автоматическая, defaults безопасные.

**Команды для проверки перед PR:**
```bash
grep -rn "git reset --hard" kit/
grep -rn "kit-revert-step" kit/
ls kit/_shared/commands/ | grep -i revert
```

### P1 — trivial-lane triage

В Step 0a CLASSIFY добавить:
```
size ∈ {trivial, normal, large}
- trivial: ≤1 файл, ≤30 строк, без новых публичных API/типов/endpoints
- normal: всё остальное, что укладывается в slice_caps
- large: явно требует split
```

Trivial-lane: @CodeWriter → build → manual-verification-artifact (см. P2) → commit. **Без** @Analyst, @TestKeeper GENERATE/DRAFT, @DoDGate, @TraceabilityChecker, 5.10 diff-review. @Reviewer — оставить (один pass без adversarial).

Нужно подумать: где порог автоматического определения trivial vs ручное PO-задание `--size trivial`. Скорее всего сначала только ручное (PO знает), автодетект — позже на данных.

### P2 — UI ground-truth artefact

Если `manifest.ui.framework != null`:
- 5.6 CHECKPOINT требует один из артефактов:
  - preview_screenshot (если есть Claude_Preview MCP)
  - manual-uploaded image от PO
  - явный `Runnable: backend-only — <reason>` для шагов без UI surface
- без артефакта `/kit-approve` блокируется: «UI-фича без визуального подтверждения. Прикрепи скриншот или подтверди backend-only.»

Это закрывает «AC прошёл, UX сломан». Конкретно для разговора с button-recolor — этот артефакт ловит дефекты раньше, чем диалог с PO.

### P3 — defect-source telemetry

В `/kit-defect` handler (`Main.body.md.template:728`) при OPEN заводить запрос к PO:
```
defect_origin (которая стадия должна была поймать?):
  spec        — AC/EC недоописан
  code        — реализация
  review      — Reviewer пропустил
  test        — TC не покрыл сценарий
  ui          — нет визуальной проверки
  unknown
```

Сохранять в test-cases.md рядом с дефектом. Если есть `evals/runs/` — eval-collector пишет `evals/runs/<kit_version>/defects.csv` со столбцами `task_slug, step, severity, defect_origin, found_by_po_or_pipeline`.

Через 20 задач видно: какие gates генерируют сигнал, какие — церемонию. Это и есть основание для следующих P4–P5 (слияние gate'ов, удаление лишних), а не моя интуиция.

### P4 — заморозить добавление гарантий

v6.2 = bug-fix-only релиз. P0 (`/kit-revert-step`) считается bug-fix, попадает сюда. P1–P2 уходят в v7.0.0 после того, как накопится 4 недели defect-origin данных из P3.

В `CLAUDE.md` (этого репо) добавить раздел «Definition of done for adding a gate»:
- доказательство, что существующие gates НЕ ловят этот класс дефектов (ссылка на defects.csv)
- estimate стоимости в токенах per задача
- exit criteria: «после X задач если new gate ловит < N% уникальных дефектов — удаляем»

---

## 4. Открытые вопросы (на которые нет ответа сегодня)

1. **Sleep mode + `git reset --hard`.** Sleep BLOCKED-shutdown сейчас тоже ресетит. Варианты:
   - тоже `git revert`? — но в sleep идея в том, чтобы вернуть рабочее дерево к last-green перед уходом. Reverse-коммит этого не даёт.
   - требовать `Bash(git reset --hard *)` в settings.json как pre-condition включения sleep. Если allow-листа нет — `/kit-sleep` отказывает на старте: «add `Bash(git reset --hard *)` to `.claude/settings.json` permissions or sleep mode will be interrupted by harness prompts.»
   - оставить как есть, в документации честно сказать «sleep требует подтверждения git reset, что ломает идею sleep». Антирешение, но честное.
   - Скорее всего: вариант (b) с явным флагом включения.

2. **Слияние @DoDGate + @TraceabilityChecker + 5.10 diff-review.** Возможно слишком агрессивно. Сначала собрать defect_origin (P3), потом смотреть кто реально ловит. Если @TraceabilityChecker за 4 недели поймал 0% дефектов — кандидат на удаление. Решение **после данных**, не раньше.

3. **Cascade `/kit-revert-step`.** Сейчас (v6.1) можно ревертить шаг N, потом N-1, потом N-2. С `git revert` это всё ещё работает, но история становится «step1, step2, step3, revert step3, revert step2, revert step1» — некрасиво. Варианты:
   - cascade оставить, squash на merge почистит
   - cascade `/kit-revert-step` собирать в один revert-коммит с list of reverted shas в message
   - На завтра: оставить cascade как есть, не оптимизировать.

4. **Что делать с накопленными CRITICAL/HIGH в Defects log при `/kit-revert-step`.** Сейчас неясно: реверт убирает дефекты тоже, или оставляет открытыми? По текущему документу — оставляет (defects log — отдельный артефакт). При переходе на `git revert` это поведение надо явно документировать.

---

## 5. Где смотреть код (карта)

| Что | Файл | Строки |
|---|---|---|
| Оркестратор v6.1 | `kit/_shared/agents/Main.body.md.template` | весь |
| Write-narrow shell scope | то же | 4–5 |
| Step 0a CLASSIFY (где добавить size) | то же | 94–161 |
| 5.4b per-step COMMIT | то же | 418–438 |
| 5.6 CHECKPOINT 3-way fork | то же | 443–522 |
| 5.10 diff-review | то же | 555–595 |
| Replan-on-discovery skill | то же | 608–621 |
| Sleep BLOCKED-shutdown | то же | 677–707 |
| `/kit-defect` handler | то же | 728–761 |
| `/kit-revert-step` handler | то же | 763–784 |
| Anti-Loop таблица | то же | 52–72 |
| Slice caps schema | `kit/manifest.schema.json` | поиск `slice_caps` |
| Changelog | `docs/migration/changelog.yaml` | весь |
| Команды | `kit/_shared/commands/` | `kit-revert-step.md` если есть |

---

## 6. Команды для старта завтра

```powershell
# на этой ветке wip/process-review-v6.1
git log --oneline -5

# Шаг 1 — найти все места с git reset --hard в kit:
# (использовать Grep tool, не raw rg/grep по правилам этого харнеса)

# Шаг 2 — проверить, существует ли отдельная команда:
ls kit\_shared\commands\

# Шаг 3 — стартовать P0:
git checkout -b feat/kit-revert-step-non-destructive
# далее правки по P0 + changelog entry + manifest.example.yaml kit_version + _index.txt
```

---

## 7. Что НЕ делать завтра

- Не браться за P1 (trivial-lane) и P2 (UI artefact) до P0. P0 — 1–2 файла, можно вечером закрыть. P1/P2 — большие, требуют дизайна.
- Не сливать gates без P3 данных. Сегодняшняя интуиция «они дублируются» — гипотеза, не факт.
- Не добавлять P17 в ответ на «дефекты после CLEAN». P17 — это очередной слой. Сначала P3 telemetry, потом видно, что делать.
- Не пушить эту ветку в master. Это рабочие заметки.
