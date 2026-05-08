# ai-agent-kit v7 — proposal

Дата: 2026-05-08
Статус: предложение, не утверждено. Ветка: `wip/process-review-v6.1`.
Связанные документы: [docs/process-review-v6.1.md](docs/process-review-v6.1.md) — ранние заметки и P0-фикс `/kit-revert-step`.

---

## 0. TL;DR

v6.1 — это пайплайн «энтерпрайз-конвейер для каждой задачи». Ресёрч 2024–2026 говорит, что:

1. **Один-агент-многоход** на SWE-bench соревнуется по качеству с многоагентными системами при меньшей латентности и стоимости. Multi-agent ≠ автоматически лучше.
2. **LLM-код-ревью имеет потолок ~68% accuracy и ~25% false-negatives.** Несколько AI-ревьюеров делят слепые пятна и не складываются в качество.
3. **Test coverage слабо коррелирует с реальной баг-детекцией.** Mutation testing превосходит coverage на порядок (Meta ACH).
4. **Главные failure modes — operational hallucination и scope drift.** Лечатся не количеством gate'ов, а ground-truth-проверкой и узким контекстом.
5. **Anthropic engineering:** «найти минимальный набор high-signal токенов»; e2e-проверка через browser automation **критична**, юнит-тесты её не заменяют.

v7 = **trim, ground-truth, telemetry**:

- 9 агентов → 5 (Main, CodeAgent, Verifier, Architect, BugFixer)
- 1 пайплайн → 3 lane'а по риску (trivial / standard / critical)
- AI-only-проверки → AI + обязательный ground-truth artefact (screenshot для UI, command-output для CLI, mutation-sample для бэкенда)
- Без telemetry → defect_origin per task + gate_signal_ratio per gate; gate без сигнала за N задач удаляется
- Меньше церемонии для тривиального → больше внимания критическому

Цель: при том же или меньшем расходе токенов на задачу — снизить долю задач, которые «зелёные у AI, красные у PO».

---

## 1. Метод

Этот документ опирается на:

- **Разбор v6.1 в живой эксплуатации** — диалог PO про button-recolor (тяжёлый процесс → дефект), `/kit-revert-step` double-permission. Подробности в [docs/process-review-v6.1.md](docs/process-review-v6.1.md).
- **Чтение `kit/_shared/agents/Main.body.md.template`** (940 строк, текущий оркестратор) и инвентарь `kit/_shared/{agents,commands,skills}/`.
- **Внешний ресёрч 2024–2026** по теме AI-coding-agent pipelines, LLM-as-reviewer reliability, test generation, context engineering, failure modes. Источники в § 13.

Ничего из этого документа не предполагает «AI всё знает лучше». Все предложения проверяются telemetry в § 9 — gate, который не ловит дефекты, удаляется.

---

## 2. Что говорят исследования (сжато)

### 2.1 Single-agent vs multi-agent на SWE-bench

- На SWE-bench Verified топ-результаты разнообразны архитектурно: и monolith-LLM без agentic-обвязки, и сложные multi-agent системы. **Никакая архитектура не доминирует.**
- Warp занимает топ-5 SWE-bench Verified с **single-agent** дизайном (~71%). Single-attempt архитектуры конкурентны при значительно меньшей латентности, что критично для interactive-режима.
- AgentCoder (multi-agent с ролями programmer / test-design / execution) показывает плюс от ролевой специализации, но не дотягивает до топ-5.
- **Вывод:** v6.1's 9 агентов — не доказанно лучше 3–5 агентов. Это design choice, который не даёт ROI до тех пор, пока каждая роль не доказала уникального вклада через telemetry.

### 2.2 LLM как ревьюер кода — точность и калибровка

- Лучшая accuracy LLM-ревьюера на оценке code change «approve/reject» — **~68.5%**. До **24.8%** правильного кода получает неверные предложения исправлений.
- **Более сложный prompting усиливает misjudgment**, особенно с CoT-объяснениями. Adversarial-passes могут ухудшать, а не улучшать.
- **Confidence LLM плохо откалиброван** относительно correctness. «Reviewer CLEAN» не имеет надёжной связи с «код корректен».
- **Вывод:** v6.1's @Reviewer Pass A/B/C/D/E + adversarial A* + @DoDGate 7 checks + @TraceabilityChecker матрица — это переход за точку убывающей отдачи. Каждый additional pass добавляет токены, но не пропорционально качество.

### 2.3 Test coverage ≠ test effectiveness

- Литература признаёт: **coverage слабо коррелирует с эффективностью тестов в баг-детекции.**
- Meta Automated Compliance Hardening (ACH): mutation-guided test generation генерирует тесты против конкретных классов дефектов вместо «гонки за coverage». Деплой на FB/IG/WA дал **сотни actionable-тестов** против десятков тысяч мутантов — на порядки эффективнее coverage-driven подхода.
- MuTAP (research): mutation score 93.57% на synthetic; +28% багов в реальном коде против baseline.
- **Вывод:** v6.1's @TestKeeper GENERATE + DRAFT + EXECUTE + RECONCILE производит большой объём тестов из spec.md. Если эти тесты coverage-driven (а они такие — рендерятся из § Test plan), они слабо защищают от реальных багов. Mutation-sample на критическом коде даст больше сигнала за меньшую цену.

### 2.4 Failure modes AI-агентов в продакшне

Эмпирические исследования 2025 выделяют:

- **Operational hallucination** — агент рапортует success, чтобы закрыть loop, когда задача провалена. v6.1 частично закрывает: @CodeWriter "build green" → @TestKeeper EXECUTE — independent verification. **KEEP.**
- **Scope drift** — агент решает, что «Y и Z тоже полезно», и делает X+Y+Z. v6.1's Pass D scope-drift check + 5.4a unchanged-call-sites — правильное направление, но реализуется через AI-ревью, что unreliable. Лучше — bounded context + git-diff-stat hard cap (slice_caps).
- **Cascading errors** — агент действует на собственный неверный output. v6.1 mitigates: per-step commits + step_commits[] + revert-step. **KEEP.**
- **Safety drift** — постепенная эрозия декларированных constraints. v6.1 mitigates: pre-commit hook live, --no-verify forbidden, destructive gates (DEPLOY/DESTROY/SECRET_ROTATE) всегда manual. **KEEP.**

### 2.5 Anthropic context engineering и harness design

Прямая рекомендация Anthropic engineering:

- Цель: **минимальный набор high-signal токенов** на каждом шаге.
- Tool outputs должны быть token-efficient, не дампы.
- Sub-agents возвращают **condensed summaries (~1k–2k токенов)**, а не таблицы verdict'ов на 5–10k.
- **Не** хардкодить brittle if-else в промптах, **не** раздувать tool-set перекрывающимися функциями, **не** предзагружать данные «на всякий случай».
- Для long-horizon harness'а: разделять init phase от coding phase; одна фича за сессию; **e2e через browser automation критичен** — юнит-тесты пропускают real-world failures.
- Recovery: git history + progress files (✓ совпадает с v6.1's step_commits) + session-startup verification (✗ v6.1 не делает).

---

## 3. Сопоставление v6.1 ↔ ресёрч

| Решение v6.1 | Что говорит research | Verdict |
|---|---|---|
| 9 агентов, ролевая специализация | Multi-agent ≠ автоматически лучше; ролевая специализация даёт прирост, но не радикальный | **Trim до 5** (см. § 6) |
| @Reviewer Pass A/B/C/D/E + adversarial A* | LLM-review ceiling ~68%, complex prompting ↑ misjudgment | **Сократить до 2 passes** (correctness + scope), удалить adversarial |
| @DoDGate 7 checks | Дублирует Reviewer + Trace + diff-review; коverages > 1 | **Слить с Verifier** (см. § 6) |
| @TraceabilityChecker AC→TC→file matrix | Полезная гипотеза, но без telemetry — не понятно, ловит ли что-то | **Опт-ин flag**, мерить через § 9 |
| TDD-first by default | Coverage-driven; ≠ effectiveness-driven | **Сменить default на test-after для standard lane**, mutation-sample для critical lane |
| @TestKeeper GENERATE + DRAFT + EXECUTE + RECONCILE | 4 mode'а одного агента — сложность без сигнала | **Слить в Verifier**; убрать GENERATE (TC рождаются из mutation-sample, не из spec) |
| 5.10 mandatory diff-review (PO eye) | E2E PO-проверка работает; единственная reality-check точка | **KEEP** |
| spec.md FROZEN at CONFIRM, plan.md mutable | Хорошо стыкуется с Anthropic «init + coding» pattern | **KEEP** |
| Section-sliced dispatch (P5) | Совпадает с «smallest high-signal context» | **KEEP, расширить** |
| step_commits[] per step | Совпадает с Anthropic «git history + progress files» recovery | **KEEP** |
| Sleep mode | Anthropic guidance не противоречит, но требует e2e-точки контроля | **KEEP, добавить ground-truth artefact в MORNING_REPORT** |
| Slice caps (max_steps / files / lines) | Hard caps лучше soft AI-judgement-based scope checks | **KEEP, добавить третий cap: tokens_per_step** |
| /kit-revert-step через `git reset --hard` | Конфликтует с harness destructive-gate | **FIX в v6.2** (см. P0 в [docs/process-review-v6.1.md](docs/process-review-v6.1.md)) |
| Нет ground-truth artefact'а перед /kit-approve | E2E через browser automation **критичен** (Anthropic) | **ADD как mandatory для UI/API/CLI** |
| Нет defect-origin telemetry | Без данных нельзя оптимизировать gates | **ADD obligatory** |
| Per-step runbook (4 секции) | Совпадает с Anthropic «structured note-taking» | **KEEP** |
| Auto-approve с гранулярностью per-class | Совпадает с harness pattern «proceed autonomously when verifiable» | **KEEP** |

---

## 4. Архитектурные принципы v7

**П1. Ground truth перед AI-on-AI verification.**
До того как @Verifier подпишет «зелёное», в задаче должен быть как минимум один artefact, который **не** сгенерирован тем же классом моделей: PO-screenshot, browser MCP capture, command-output diff, mutation-sample test pass на critical-EC коде. Без artefact'а — `/kit-approve` блокируется.

**П2. Один пайплайн ≠ один путь.**
Trivial / standard / critical — 3 lane'а с разной плотностью gate'ов. Trivial для «перекрасить кнопку», critical для security/migration/external API. Текущая стоимость v6.1 одинакова для обеих, что и порождает «много работы → дефект».

**П3. Меньше агентов, чётче роли.**
9 → 5. Каждый агент должен иметь distinct, measurable вклад через § 9 telemetry. Если за 30 задач агент даёт <5% уникальных catches — кандидат на удаление или слияние.

**П4. Token-budget как первый класс.**
К `slice_caps.{max_steps, max_files_per_step, max_lines_per_step}` добавить `max_tokens_per_step`. Overflow → split. Это enforces «smallest high-signal context» от Anthropic на уровне манифеста, а не уговоров.

**П5. Гипотеза + тест перед добавлением gate'а.**
v6.1 добавил P1…P16 без exit-criteria. v7 формализует: новый gate приходит с (а) гипотезой, какой класс дефектов он ловит; (б) измерением через § 9 за 4 недели; (в) автоматическим удалением, если signal_ratio < 5%.

---

## 5. Триаж: 3 lane'а

В Step 0a CLASSIFY помимо `type ∈ {feature, bug, tech}` появляется `risk ∈ {trivial, standard, critical}`.

### 5.1 Определение risk

| Сигнал | trivial | standard | critical |
|---|---|---|---|
| Затрагивает security surface (auth/crypto/access) | нет | нет | **да** |
| Меняет публичный API / contract / migration / external integration | нет | возможно | **да** |
| Любой Critical EC в spec | нет | нет | **да** |
| Изменяет > 1 модуля | нет | да | да |
| Изменяет > 30 строк кода | нет | да | да |
| Создаёт новый файл | возможно | да | да |
| Только UI/styling/i18n/text без изменения логики | **да** | возможно | нет |
| **default fallback при сомнении** | — | **да** | — |

PO может вручную задать: `/kit-new-feature --risk critical "<...>"` или `/kit-new-feature --risk trivial "<...>"`. Auto-detect — initial v7.0.0 use heuristic выше; v7.1 — обучаемый классификатор по telemetry.

### 5.2 Trivial lane

```
Триаж detected: risk=trivial.
@Main → @CodeAgent (один шаг, без plan.md разбивки)
   - читает spec-skeleton (1 параграф) от PO напрямую
   - делает change
   - ground-truth artefact MANDATORY:
       UI    → screenshot до/после (Claude Preview MCP или upload от PO)
       CLI   → command-output до/после
       text  → diff
   - emits 1-section runbook (How to verify)
@Main → @Verifier (один pass: build + lint + targeted test, если есть)
@Main → 5.4b COMMIT → 5.6 CHECKPOINT с ground-truth artefact'ом
PO: /kit-approve | /kit-defect — без 3-way fork (нет /kit-revert-step;
    revert через git revert вручную, потому что lane слишком короткий
    для отдельной команды).
```

**Что пропускается:** @Architect (нет ANALYSIS), @Verifier-DoD-mode (нет 7 checks), Trace, 5.10 diff-review, RECONCILE, replan-on-discovery, runbook 4-секции (только How-to-verify), spec.md (нет — для trivial slug + 1-параграф commit message хватит).

**Cap:** trivial lane жёстко ограничен — 1 файл, ≤30 строк, 0 новых публичных символов. Overflow → автоматический re-classify в standard, перезапуск.

### 5.3 Standard lane

90% задач. Текущий v6.1 pipeline в упрощённом виде:

```
1. CLASSIFY (с risk=standard)
2. ANALYSIS  — @Architect пишет spec.md + plan.md skeleton.
               Test plan содержит явные mutation-targets (что должно сломаться, чтобы тест среагировал) — не только coverage-цели.
3. PLAN      — writing-plans → numbered steps в plan.md.
               Каждый step: Goal / Owned ACs/ECs / Files / Runnable / Test strategy.
4. CONFIRM   — слайс-кэп + runnable-slice gate + token-cap; spec.md FROZEN.
5. EXECUTE per step:
     5.1 READ + STEP_CONTEXT bundle (sliced)
     5.2 @CodeAgent writes code + minimum tests against mutation-targets
     5.3 @Verifier — единый pass:
           build + lint + tests + scope-drift (Pass D) + correctness review.
           Возвращает один verdict + condensed findings list (max 1k tokens).
     5.4 если CRITICAL_OR_HIGH → fix loop (max 3 cycle).
     5.4b COMMIT
     5.6 CHECKPOINT — runbook 4 секции +
                     **ground-truth artefact**:
                       UI → screenshot/preview
                       API → contract test pass с реальным payload
                       CLI/script → command-output capture
                       backend logic → mutation-sample (≥1 mutant killed)
                     3-way fork PO: /kit-approve | /kit-defect | /kit-revert-step
6. После всех шагов:
     RECONCILE (опт-ин если manifest.reconcile.enabled=true; default false до telemetry)
     5.10 diff-review (mandatory)
     CLOSE
```

**Что удалено vs v6.1:** @Reviewer adversarial 2nd pass (низкий ROI), @DoDGate отдельным агентом (слит в @Verifier), @TraceabilityChecker mandatory-pass (опт-ин), 5.4a unchanged-call-sites (заменено on-demand grep по запросу @Verifier), TestKeeper GENERATE/DRAFT/RECONCILE — обязательный остаётся только EXECUTE как часть @Verifier.

### 5.4 Critical lane

Security / migration / external API / Critical EC. Полный набор + дополнительные защитные слои:

```
+ pre-mortem skill mandatory (сейчас опт-ин)
+ @Verifier работает с adversarial 2nd-pass на этапе REVIEW
+ Trace mandatory
+ ground-truth: mutation-sample (≥3 mutants killed на critical surface) +
                e2e/integration test с реальной зависимостью (не mock)
+ DEPLOY / SECRET_ROTATE / MIGRATION гейты — manual по-прежнему
+ sleep mode FORBIDDEN для critical lane (отказ на старте)
```

### 5.5 Bug lane (упрощён vs v6.1)

```
0. INTAKE / SCAN
1. TRIAGE: severity → если CRITICAL/HIGH → routed в critical lane как новая задача
2. DEBUG (@BugFixer) → failing test that pins the bug
3. FIX (@BugFixer) → @Verifier (один pass)
4. RE-VERIFY (@Verifier RERUN)
5. mandatory ground-truth artefact: тест, который failed до fix и passes после
6. CHECKPOINT
7. bug-retro для CRIT/HIGH (mandatory) или mutation-sample (alternative)
```

---

## 6. Список агентов v7 (5 вместо 9)

| v7 агент | Заменяет в v6.1 | Роль |
|---|---|---|
| **@Main** | @Main | Оркестратор. Без изменений по идее, упрощается логика lanes. |
| **@Architect** | @Analyst + @Designer | Пишет spec.md (Why/AC/EC/How/Test plan, в т.ч. mutation-targets) + plan.md skeleton. UI-section добавляет сам, без отдельного агента (Designer-агент за всё время дал слабый ROI — один Markdown-агент с ui section'ом не нужен). |
| **@CodeAgent** | @CodeWriter | Пишет код + тесты + runbook. Без изменений в роли, более чёткая ответственность за runbook (mandatory). |
| **@Verifier** | @TestKeeper + @Reviewer + @DoDGate + @TraceabilityChecker | Единый verification-агент. Modes: `EXECUTE` (build+lint+tests), `REVIEW` (correctness + scope-drift + bypass-channels), `DOD` (gating before close), `TRACE` (опт-ин). Modes — это **prompts**, не отдельные агенты. Возвращает condensed verdict (≤1k tokens). |
| **@BugFixer** | @BugFixer | Без изменений; mode-структура (debug/fix). |

**Что произошло с Designer:**
В v6.1 он добавляет UI section в spec.md и таблицу цветов. Это 1 шаг ANALYSIS-фазы, не достойный отдельного агента. @Architect делает всё, экономит 1 dispatch + 1 системный промпт + 1 модель в манифесте. Если UI-комплексность реально требует отдельного агента — @Designer возвращается за telemetry-данными.

**Что произошло с TraceabilityChecker:**
Стал mode @Verifier (TRACE), опт-ин через `manifest.verifier.trace_enabled: false` (default). Telemetry за 4 недели покажет, ловит ли уникальные дефекты — если да, default переключается на true.

**Что произошло с DoDGate:**
Стал mode @Verifier (DOD). 7 checks остаются, но один dispatch вместо двух. Verdict идёт в plan.md § Definition of Done.

**Что произошло с TestKeeper:**
GENERATE и DRAFT удалены (тесты пишет @CodeAgent на mutation-targets из spec.md). EXECUTE и RECONCILE стали modes @Verifier.

**Migration cost:**
- 4 системных промпта удаляются (Designer, DoDGate, TraceabilityChecker, TestKeeper bodies)
- 1 промпт расширяется (Architect = Analyst+Designer)
- 1 промпт расширяется заметно (Verifier = TestKeeper+Reviewer+DoDGate+TraceabilityChecker mode'ами)
- В манифесте `models.designer` deprecated, `models.verifier` появляется (default = `models.reviewer`)

---

## 7. Ground-truth artefacts (новый класс)

Это **обязательная часть** 5.6 CHECKPOINT во всех 3 lane'ах (детали в § 5).

| Тип задачи | Артефакт | Источник |
|---|---|---|
| UI / styling / layout | screenshot или preview-snapshot до/после | Claude Preview MCP `preview_screenshot` или PO upload |
| CLI / script | command-output до/после в виде diff | @CodeAgent выполняет, capture в runbook |
| HTTP API | контракт-тест: реальный request → реальный response (mock запрещён для contract-теста) | @CodeAgent запускает локально |
| Backend logic / pure function | mutation-sample: ≥1 (standard) или ≥3 (critical) mutant'ов, убитых сгенерированным тестом | @Verifier генерирует mutant-ов, прогоняет |
| Migration / DB schema | dry-run output + откатной script + verify-after-rollback | manual gate, PO подтверждает |
| Refactor (TECH) без user-visible change | mutation-sample на изменённых символах + diff-stat | @Verifier |

**Где хранится:**
В `.planning/tasks/<slug>.md.step_commits[N].ground_truth: { type, path, summary }`. Артефакты-файлы (скриншоты) — в `.planning/artifacts/<slug>/step-<N>/`. Не коммитим в git автоматически (могут быть тяжёлые); в .gitignore через тшаблон.

**Если ground-truth не предоставлен:**
`/kit-approve` отвергается с сообщением: «Step <N> требует ground-truth artefact (тип: <X>). Прикрепи через /kit-attach <path> или подтверди исключение через /kit-approve --no-ground-truth (логируется как technical debt в Defects log)». Исключение возможно, но trackable.

---

## 8. Telemetry: defect_origin и gate_signal_ratio

Без данных предложение «слить @DoDGate с @Verifier» — это интуиция. С данными — это решение. v7 делает telemetry mandatory во всех lane'ах.

### 8.1 defect_origin

При каждом `/kit-defect <description>` (interactive) или при разборе `MORNING_REPORT.md` (sleep) PO отвечает на:

```
Какой gate должен был поймать этот дефект?
  spec      — недоописан AC/EC, сама задача поставлена неточно
  code      — реализация
  review    — @Verifier REVIEW pass пропустил
  test      — @Verifier EXECUTE прошёл, но тест не покрыл сценарий
  ui        — нет ground-truth artefact'а (или он был, но недостаточный)
  trace     — orphan AC, который не привязан к коду
  scope     — drift не пойман
  unknown   — пока неясно
```

Сохраняется в `evals/runs/<kit_version>/defects.csv` с колонками:
`task_slug, step, severity, defect_origin, found_by_po, ground_truth_attached, lane, repro_path`.

### 8.2 gate_signal_ratio

Каждый gate (verifier-execute, verifier-review, verifier-dod, verifier-trace, slice-cap, runnable-slice, ground-truth-check, diff-review) логирует в `evals/runs/<kit_version>/gates.csv`:
`task_slug, step, gate, verdict, blocked_close: bool, false_positive: bool`.

**Метрика:** `signal_ratio = blocked_close_count / total_runs` per gate.

**Exit criterion:** если за 4 недели (или 30 задач, что наступит позже) у gate signal_ratio < 5% **и** этот же класс дефектов ни разу не появился в defect_origin — gate помечается deprecated, в следующем minor-релизе удаляется.

Это самоочищающий механизм. Без него любая v6.x → v7 → v8 будет добавлять gates быстрее, чем удалять.

---

## 9. План миграции v6.1 → v7

**v6.2 (PATCH, ~1 неделя):**
- P0 fix `/kit-revert-step` — `git reset --hard` → `git revert` (см. [docs/process-review-v6.1.md](docs/process-review-v6.1.md) § 3 P0)
- documentation честность: «sleep mode требует Bash(git reset --hard *) в settings.json или запросы блокируются»
- никаких других изменений

**v6.3 (MINOR, ~2 недели):**
- defect_origin telemetry — обязательный prompt при `/kit-defect`
- gate_signal_ratio логирование (gates.csv)
- eval-collector skill расширяется
- агенты не меняются, lanes не вводятся
- цель: накопить данные на 30 задачах

**v7.0.0-alpha (MAJOR, ~4 недели после v6.3):**
- триаж lanes как **opt-in**: `manifest.lanes.enabled: false` (default). PO активирует руками для тестирования.
- 3 lane'а доступны через `/kit-new-feature --risk trivial|standard|critical`.
- агенты не сливаются ещё — старые 9 продолжают работать.
- ground-truth artefact — opt-in `manifest.ground_truth.required: false` (default).

**v7.0.0-beta (после 4 недель alpha):**
- mass-rebase данных из defect_origin: какие gates действительно ловят?
- слияние агентов 9→5 на основании данных:
  - если @TraceabilityChecker за 30 задач не дал уникального catch — мерджим в @Verifier mode TRACE и default off
  - если @DoDGate большая часть verdict'ов redundant с @Reviewer — мерджим
- ground-truth artefact становится mandatory для UI/critical lane

**v7.0.0 stable:**
- lanes mandatory (нет старого пайплайна-без-lane'а)
- ground-truth mandatory для UI и critical
- 5 агентов, не 9

**Откат:** на каждом step миграции `manifest.kit_version_pinned: 6.1.0` запрещает auto-update; пользователи переходят явным `/kit-update`. Любая v7.x совместима с v6.1 manifest (legacy fields игнорируются с warning'ом).

---

## 10. Что НЕ меняем (намеренно)

Анти-список — чтобы во время реализации не было соблазна.

- **per-step commits** ([Main.body.md.template:418-438](kit/_shared/agents/Main.body.md.template:418)) — работает, anchors для recovery, оставить.
- **spec/plan split, spec FROZEN at CONFIRM** — фундаментально правильно, совпадает с Anthropic init+coding pattern.
- **section-sliced dispatch (P5)** — совпадает с context engineering. Расширить до tokens_per_step cap.
- **slice_caps hard limits** — переход от soft AI judgement к hard cap правильный. Добавить tokens_per_step.
- **sleep mode opt-in** — autonomous run для PO, который согласен на trade-off; правильная фича.
- **destructive gates всегда manual** (DEPLOY/DESTROY/SECRET_ROTATE/MIGRATION/EXTERNAL_API) — keep.
- **pre-commit hook live, --no-verify forbidden** — keep.
- **bug-retro для CRIT/HIGH** — keep, расширяется до mutation-sample как альтернативы.
- **Auto-approve гранулярность per-class** — keep.
- **Multi-host (OpenCode + Claude Code) shared `_shared/`** — keep.

---

## 11. Открытые вопросы (нужны данные эксплуатации)

1. **Trivial lane auto-detect** — по эвристике в § 5.1 будут false positives и false negatives. Сколько задач PO вручную перекидывает между lane'ами за месяц? Если >30% — эвристика плохая, нужен классификатор.
2. **Mutation-sample стоимость** — генерация мутантов через @Verifier стоит токенов. Какова реальная стоимость на средней задаче? Если на trivial-задаче mutation-sample стоит больше, чем сама задача — нужен альтернативный артефакт.
3. **Ground-truth для refactor (TECH)** — refactor не имеет user-visible поверхности. Sufficient ли mutation-sample на изменённых символах? Возможно нужен contract-test «до/после» для public API.
4. **Trace опт-ин default** — если за месяц @Verifier TRACE mode ловит дефекты в 5%+ задач, default переключается на on. Кто определяет threshold — PO или telemetry автоматически?
5. **Slip между lanes** — если задача стартовала trivial и обнаружила, что она не trivial (overflow), пайплайн перезапускается из standard? Или останавливается с BLOCK? Текущее предложение: автомиграция, но это может скрыть недопонимание задачи PO.
6. **Cascade `/kit-revert-step` поверх `git revert`** — после P0 fix история станет «revert step3, revert step2, revert step1», некрасиво. Cascade-revert одним коммитом? Или жить с этим до squash на merge?
7. **Critical lane sleep-forbid** — слишком жёстко? Возможно «sleep + critical = требует двойной ground-truth + увеличенный delay перед каждым commit». Альтернатива.
8. **Migration legacy v6.1 specs** — `/kit-update` 6.1→7.0 трогает spec.md (frozen artefact для уже-DONE задач). Лучше — миграция применяется только к новым ANALYSIS-циклам, старые feature.md / spec.md / plan.md остаются как есть.

---

## 12. Acceptance criteria для v7.0.0

Чтобы релиз v7 не повторил историю «добавили P17» — заранее зафиксированные критерии успеха:

1. **Effort:** медианный токен-бюджет на standard-задачу ≤ 60% от v6.1 baseline (измеряется в evals/runs).
2. **Quality:** доля задач, помеченных PO как `/kit-defect` после CLEAN, ≤ 50% от v6.1 baseline.
3. **Trivial throughput:** медианная trivial-задача укладывается в ≤ 5 минут от `/kit-new-feature` до `/kit-approve` в interactive mode (без PO-ожидания).
4. **Telemetry coverage:** ≥ 95% задач имеют заполненный defect_origin (если был дефект) и заполненный ground_truth_attached.
5. **Agent count:** ровно 5 агентов в `_shared/agents/` (не 9, не 7, не 6).

Если хотя бы 2 из 5 критериев не выполняются на момент v7.0.0-stable — релиз откладывается, цикл alpha→beta повторяется.

---

## 13. Источники

Внешний ресёрч:

- [SWE-bench Pro: Long-horizon SE tasks (arXiv:2509.16941)](https://arxiv.org/abs/2509.16941)
- [Dissecting SWE-Bench Leaderboards: architectures of agent-based repair (arXiv:2506.17208)](https://arxiv.org/html/2506.17208v2)
- [Warp 71% on SWE-bench Verified — single-agent architecture](https://www.warp.dev/blog/swe-bench-verified)
- [Evaluating LLMs for Code Review (arXiv:2505.20206)](https://arxiv.org/html/2505.20206v1)
- [Benchmarking LLM-based Code Review (arXiv:2509.01494)](https://arxiv.org/html/2509.01494v1)
- [Calibration and Correctness of Language Models for Code (ICSE 2025)](https://www.software-lab.org/publications/icse2025_calibration.pdf)
- [Uncovering Systematic Failures of LLMs in Verifying Code (arXiv:2508.12358)](https://arxiv.org/html/2508.12358)
- [Meta: LLM-powered bug catchers (Engineering at Meta, 2025-02)](https://engineering.fb.com/2025/02/05/security/revolutionizing-software-testing-llm-powered-bug-catchers-meta-ach/)
- [Meta: LLMs for mutation testing and compliance (Engineering at Meta, 2025-09)](https://engineering.fb.com/2025/09/30/security/llms-are-the-key-to-mutation-testing-and-better-compliance/)
- [Meta ACH coverage InfoQ summary (2026-01)](https://www.infoq.com/news/2026/01/meta-llm-mutation-testing/)
- [LLM-Generated Ground Truth (Emergent Mind, 2025)](https://www.emergentmind.com/topics/llm-generated-ground-truth)
- [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [LLM-based Agents Suffer from Hallucinations: Survey (arXiv:2509.18970)](https://arxiv.org/html/2509.18970v1)
- [LangChain: Context Engineering for Agents](https://blog.langchain.com/context-engineering-for-agents/)
- [Operational Hallucination and Safety Drift in AI Agents (Clark Univ., 2025)](https://commons.clarku.edu/sops_fac/14/)
- [Why AI Agents Break: Field Analysis of Production Failures (Arize, 2025)](https://arize.com/blog/common-ai-agent-failures/)
- [12 Failure Patterns of Agentic AI Systems (Concentrix)](https://www.concentrix.com/insights/blog/12-failure-patterns-of-agentic-ai-systems/)

Внутренние:

- [docs/process-review-v6.1.md](docs/process-review-v6.1.md) — диагноз v6.1 + P0 fix /kit-revert-step
- [kit/_shared/agents/Main.body.md.template](kit/_shared/agents/Main.body.md.template) — текущий оркестратор v6.1
- [docs/migration/changelog.yaml](docs/migration/changelog.yaml) — история всех версий
- [README.md § Three workflows you get](README.md) — текущая публичная схема пайплайна

---

## 14. Следующее действие

После прочтения PO выбирает один из:

- **/kit-approve** — принять направление; стартую v6.2 с P0 fix (`/kit-revert-step` non-destructive). Дальше — v6.3 telemetry. Это коммитит на путь v7 без обязательства на конкретные слияния агентов.
- **/kit-rework <раздел>** — переделать конкретный раздел (например, «не сливать @TraceabilityChecker, я считаю он критичен») с обоснованием.
- **/kit-defer** — отложить, пока v6.1 не накопит больше defect-данных; начинаем только с v6.3 telemetry, агентскую структуру не трогаем.

Документ — *предложение*. Пока PO не выбрал, ничего в `kit/` не меняется.
