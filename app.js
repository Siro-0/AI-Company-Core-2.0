// =====================================================
// AI Company Core 2.0
// Company Engine 2.0
// 外部AI APIなし
// =====================================================

const STORAGE_KEYS = {
  tasks: "ai_company_tasks_v2",
  founder: "ai_company_founder_v2",
  companyState: "ai_company_state_v2",
  engineLog: "ai_company_engine_log_v2",
  companyMemory: "ai_company_memory_v2",
  strategy: "ai_company_strategy_v2"
};

const BASE_DEPARTMENTS = [
  "企画",
  "技術",
  "財務",
  "リスク管理"
];

// =====================================================
// Utility
// =====================================================

function nowISO() {
  return new Date().toISOString();
}

function formatDate(value) {
  if (!value) {
    return "まだありません";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "不明";
  }

  return date.toLocaleString("ja-JP");
}

function makeId(prefix) {
  return (
    prefix +
    "_" +
    Date.now() +
    "_" +
    Math.random()
      .toString(36)
      .slice(2, 8)
  );
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function load(key, fallback) {
  try {
    const value = localStorage.getItem(key);

    if (!value) {
      return fallback;
    }

    return JSON.parse(value);

  } catch (error) {

    console.error(
      "Storage load error:",
      key,
      error
    );

    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(
    key,
    JSON.stringify(value)
  );
}

// =====================================================
// DOM
// =====================================================

const systemStatus =
  document.getElementById("systemStatus");

const ceoStatus =
  document.getElementById("ceoStatus");

const engineStatus =
  document.getElementById("engineStatus");

const executorStatus =
  document.getElementById("executorStatus");

const apiStatus =
  document.getElementById("apiStatus");

const paceStatus =
  document.getElementById("paceStatus");

const companyGoalInput =
  document.getElementById("companyGoal");

const companyModeSelect =
  document.getElementById("companyMode");

const runCycleButton =
  document.getElementById("runCycleButton");

const startEngineButton =
  document.getElementById("startEngineButton");

const stopEngineButton =
  document.getElementById("stopEngineButton");

const engineDecision =
  document.getElementById("engineDecision");

const engineSummary =
  document.getElementById("engineSummary");

const engineLog =
  document.getElementById("engineLog");

const companyMemoryEl =
  document.getElementById("companyMemory");

const activeDepartmentList =
  document.getElementById(
    "activeDepartmentList"
  );

const testInput =
  document.getElementById("testInput");

const testButton =
  document.getElementById("testButton");

const testResult =
  document.getElementById("testResult");

const taskInput =
  document.getElementById("taskInput");

const taskPriority =
  document.getElementById("taskPriority");

const addTaskButton =
  document.getElementById("addTaskButton");

const taskCount =
  document.getElementById("taskCount");

const taskList =
  document.getElementById("taskList");

const founderInput =
  document.getElementById("founderInput");

const submitFounderButton =
  document.getElementById(
    "submitFounderButton"
  );

const founderRecords =
  document.getElementById(
    "founderRecords"
  );

const councilCases =
  document.getElementById(
    "councilCases"
  );

// =====================================================
// State
// =====================================================

let tasks = load(
  STORAGE_KEYS.tasks,
  []
);

let founderCases = load(
  STORAGE_KEYS.founder,
  []
);

let engineLogs = load(
  STORAGE_KEYS.engineLog,
  []
);

let companyMemory = load(
  STORAGE_KEYS.companyMemory,
  []
);

let strategyHistory = load(
  STORAGE_KEYS.strategy,
  []
);

let companyState = load(
  STORAGE_KEYS.companyState,
  {
    goal:
      "事業を継続的に改善し、収益化できる機会を見つける",

    mode: "normal",

    running: false,

    cycleCount: 0,

    lastCycleAt: null,

    currentFocus: "観測中",

    currentPlan:
      "まだ戦略計画はありません。",

    nextAction:
      "会社状態を分析して次の仕事を決定する",

    activeDepartments: [
      ...BASE_DEPARTMENTS
    ],

    lastEvaluation: null
  }
);

let cycleBusy = false;

let engineInterval = null;

// =====================================================
// Normalization
// =====================================================

function normalizeTask(task) {

  return {
    id:
      task.id ||
      makeId("task"),

    title:
      task.title ||
      "名称未設定タスク",

    priority:
      task.priority ||
      "normal",

    status:
      task.status ||
      "pending",

    runCount:
      Number(task.runCount || 0),

    lastRunAt:
      task.lastRunAt ||
      null,

    result:
      task.result ||
      null,

    executor:
      task.executor ||
      "Local Executor",

    source:
      task.source ||
      "Task Core",

    createdAt:
      task.createdAt ||
      nowISO(),

    updatedAt:
      task.updatedAt ||
      task.createdAt ||
      nowISO(),

    evaluation:
      task.evaluation ||
      null,

    strategy:
      task.strategy ||
      null
  };
}

tasks =
  tasks.map(normalizeTask);

function normalizeFounderCase(item) {

  return {

    id:
      item.id ||
      makeId("founder"),

    proposal:
      item.proposal ||
      "",

    status:
      item.status ||
      "CEO協議待ち",

    createdAt:
      item.createdAt ||
      nowISO(),

    departments:
      Array.isArray(
        item.departments
      )
        ? item.departments
        : [],

    reviews:
      Array.isArray(
        item.reviews
      )
        ? item.reviews.map(
            (review) => ({
              department:
                review.department ||
                "不明",

              summary:
                review.summary ||
                "",

              recommendation:
                review.recommendation ||
                "",

              source:
                review.source ||
                "内部ルール",

              createdAt:
                review.createdAt ||
                nowISO()
            })
          )
        : [],

    decision:
      item.decision ||
      null,

    nextAction:
      item.nextAction ||
      null,

    taskCreated:
      Boolean(
        item.taskCreated
      )
  };
}

founderCases =
  founderCases.map(
    normalizeFounderCase
  );

save(
  STORAGE_KEYS.tasks,
  tasks
);

save(
  STORAGE_KEYS.founder,
  founderCases
);

// =====================================================
// Priority
// =====================================================

const PRIORITY_ORDER = {
  high: 1,
  normal: 2,
  low: 3
};

function priorityLabel(priority) {

  if (priority === "high") {
    return "高";
  }

  if (priority === "low") {
    return "低";
  }

  return "通常";
}

function statusLabel(status) {

  if (status === "running") {
    return "実行中";
  }

  if (status === "completed") {
    return "完了";
  }

  return "未完了";
}

// =====================================================
// Task Core
// =====================================================

function saveTasks() {
  save(
    STORAGE_KEYS.tasks,
    tasks
  );
}

function sortTasks() {

  tasks.sort(
    (a, b) => {

      const priorityDiff =
        (PRIORITY_ORDER[
          a.priority
        ] || 2) -
        (PRIORITY_ORDER[
          b.priority
        ] || 2);

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      const statusRank = {
        pending: 1,
        running: 2,
        completed: 3
      };

      const statusDiff =
        (statusRank[
          a.status
        ] || 1) -
        (statusRank[
          b.status
        ] || 1);

      if (statusDiff !== 0) {
        return statusDiff;
      }

      return (
        new Date(b.updatedAt) -
        new Date(a.updatedAt)
      );
    }
  );
}

function renderTasks() {

  sortTasks();

  taskCount.textContent =
    `登録数：${tasks.length}件`;

  if (tasks.length === 0) {

    taskList.innerHTML =
      `<div class="empty">
        タスクはありません。
      </div>`;

    return;
  }

  taskList.innerHTML =
    tasks
      .map(
        (task) => {

          const evaluationHTML =
            task.evaluation
              ? `
                <div class="evaluation-box">

                  <strong>
                    CEO評価：
                    ${escapeHTML(
                      task.evaluation.level
                    )}
                  </strong>

                  <div>
                    ${escapeHTML(
                      task.evaluation.summary
                    )}
                  </div>

                  <div>
                    <strong>学習：</strong>
                    ${escapeHTML(
                      task.evaluation.lesson
                    )}
                  </div>

                  <div>
                    <strong>次の行動：</strong>
                    ${escapeHTML(
                      task.evaluation.nextAction
                    )}
                  </div>

                  <div class="task-meta">
                    評価日時：
                    ${escapeHTML(
                      formatDate(
                        task.evaluation.evaluatedAt
                      )
                    )}
                  </div>
                </div>
              `
              : "";

          return `
            <div class="task-card">

              <h4>
                ${escapeHTML(task.title)}
              </h4>

              <div class="task-meta">
                優先度：
                ${escapeHTML(
                  priorityLabel(
                    task.priority
                  )
                )}
              </div>

              <div class="task-meta">

                状態：

                <span class="status-tag">
                  ${escapeHTML(
                    statusLabel(
                      task.status
                    )
                  )}
                </span>

              </div>

              <div class="task-meta">
                実行回数：
                ${task.runCount}回
              </div>

              <div class="task-meta">
                最終実行：
                ${escapeHTML(
                  formatDate(
                    task.lastRunAt
                  )
                )}
              </div>

              <div class="task-meta">
                実行結果：
                ${escapeHTML(
                  task.result ||
                  "まだありません"
                )}
              </div>

              <div class="task-meta">
                実行方式：
                ${escapeHTML(
                  task.executor
                )}
              </div>

              <div class="task-meta">
                起点：
                ${escapeHTML(
                  task.source
                )}
              </div>

              ${evaluationHTML}

              <div class="task-buttons">

                <button
                  onclick="editTask('${task.id}')">
                  編集
                </button>

                ${
                  task.status === "completed"

                    ? `
                      <button
                        onclick="returnTask('${task.id}')">
                        未完了に戻す
                      </button>
                    `

                    : `
                      <button
                        onclick="runSingleTask('${task.id}')">
                        実行
                      </button>
                    `
                }

                <button
                  onclick="deleteTask('${task.id}')">
                  削除
                </button>

              </div>

            </div>
          `;
        }
      )
      .join("");
}

function addTask(
  title,
  priority = "normal",
  source = "Task Core",
  strategy = null
) {

  const cleanTitle =
    title.trim();

  if (!cleanTitle) {
    return null;
  }

  const task = {

    id:
      makeId("task"),

    title:
      cleanTitle,

    priority,

    status:
      "pending",

    runCount:
      0,

    lastRunAt:
      null,

    result:
      null,

    executor:
      "Local Executor",

    source,

    createdAt:
      nowISO(),

    updatedAt:
      nowISO(),

    evaluation:
      null,

    strategy
  };

  tasks.push(task);

  saveTasks();

  renderTasks();

  return task;
}

function findTask(taskId) {

  return tasks.find(
    (task) =>
      task.id === taskId
  );
}

function editTask(taskId) {

  const task =
    findTask(taskId);

  if (!task) {
    return;
  }

  const value =
    window.prompt(
      "タスク名を編集",
      task.title
    );

  if (value === null) {
    return;
  }

  const cleanValue =
    value.trim();

  if (!cleanValue) {
    return;
  }

  task.title =
    cleanValue;

  task.updatedAt =
    nowISO();

  saveTasks();

  renderTasks();
}

function deleteTask(taskId) {

  const task =
    findTask(taskId);

  if (!task) {
    return;
  }

  if (
    !window.confirm(
      `このタスクを削除しますか？\n\n${task.title}`
    )
  ) {
    return;
  }

  tasks =
    tasks.filter(
      (item) =>
        item.id !== taskId
    );

  saveTasks();

  renderTasks();
}

function returnTask(taskId) {

  const task =
    findTask(taskId);

  if (!task) {
    return;
  }

  task.status =
    "pending";

  task.evaluation =
    null;

  task.updatedAt =
    nowISO();

  saveTasks();

  renderTasks();
}

async function runSingleTask(taskId) {

  const task =
    findTask(taskId);

  if (!task) {
    return;
  }

  await executeTask(task);

  evaluateTask(task);

  recordMemoryFromTask(
    task
  );

  renderTasks();

  renderCompanyMemory();
}

// =====================================================
// Local Executor
// =====================================================

function executeTask(task) {

  return new Promise(
    (resolve) => {

      task.status =
        "running";

      task.updatedAt =
        nowISO();

      saveTasks();

      renderTasks();

      setTimeout(
        () => {

          task.status =
            "completed";

          task.runCount += 1;

          task.lastRunAt =
            nowISO();

          task.result =
            `ローカル実行を受け付けました：${task.title}`;

          task.executor =
            "Local Executor";

          task.updatedAt =
            nowISO();

          saveTasks();

          renderTasks();

          testResult.textContent =
            task.result;

          resolve(task);

        },
        300
      );
    }
  );
}

// =====================================================
// Company Memory
// =====================================================

function renderCompanyMemory() {

  if (
    companyMemory.length === 0
  ) {

    companyMemoryEl.innerHTML =
      `<div class="empty">
        まだ学習記録はありません。
      </div>`;

    return;
  }

  companyMemoryEl.innerHTML =
    companyMemory
      .slice(0, 15)
      .map(
        (memory) => `
          <div class="memory-entry">

            <div class="memory-title">
              ${escapeHTML(
                memory.type
              )}：
              ${escapeHTML(
                memory.taskTitle
              )}
            </div>

            <div class="memory-meta">
              ${escapeHTML(
                formatDate(
                  memory.createdAt
                )
              )}
            </div>

            <div>
              ${escapeHTML(
                memory.summary
              )}
            </div>

            <div>
              <strong>
                学習：
              </strong>

              ${escapeHTML(
                memory.lesson
              )}
            </div>

            <div>
              <strong>
                次の行動：
              </strong>

              ${escapeHTML(
                memory.nextAction
              )}
            </div>

          </div>
        `
      )
      .join("");
}

function recordMemoryFromTask(task) {

  if (
    !task ||
    !task.evaluation
  ) {
    return null;
  }

  const exists =
    companyMemory.find(
      (item) =>
        item.sourceTaskId ===
        task.id
    );

  if (exists) {
    return exists;
  }

  const memory = {

    id:
      makeId("memory"),

    type:
      task.evaluation.level,

    sourceTaskId:
      task.id,

    taskTitle:
      task.title,

    summary:
      task.evaluation.summary,

    lesson:
      task.evaluation.lesson,

    nextAction:
      task.evaluation.nextAction,

    createdAt:
      nowISO()
  };

  companyMemory.unshift(
    memory
  );

  companyMemory =
    companyMemory.slice(
      0,
      50
    );

  save(
    STORAGE_KEYS.companyMemory,
    companyMemory
  );

  companyState.lastEvaluation =
    memory.summary;

  saveCompanyState();

  return memory;
}

// =====================================================
// CEO Evaluation
// =====================================================

function evaluateTask(task) {

  if (
    !task ||
    task.status !==
      "completed"
  ) {
    return;
  }

  const simulated =
    task.executor ===
    "Local Executor";

  task.evaluation = {

    level:
      simulated
        ? "暫定成功"
        : "成功",

    summary:
      simulated
        ? "タスク処理自体は完了しました。ただし現時点のExecutorはシミュレーション実行のため、現実世界の成果までは確認していません。"
        : "実行結果を確認しました。",

    lesson:
      `「${task.title}」を実行単位として処理できることを確認した。`,

    nextAction:
      simulated
        ? "実際の成果を取得できる実行基盤へ拡張し、成果ベースで再評価する。"
        : "得られた成果を継続観測し、改善機会を探す。",

    evaluatedAt:
      nowISO()
  };

  task.updatedAt =
    nowISO();

  saveTasks();
}

// =====================================================
// Company State
// =====================================================

function saveCompanyState() {

  save(
    STORAGE_KEYS.companyState,
    companyState
  );
}

function getModeLabel(mode) {

  if (mode === "offense") {
    return "攻め";
  }

  if (mode === "defense") {
    return "守り";
  }

  return "通常";
}

// =====================================================
// Operational Pace
// =====================================================

function getOperationalPace() {

  const hour =
    new Date().getHours();

  const pendingCount =
    tasks.filter(
      (task) =>
        task.status ===
        "pending"
    ).length;

  let seconds = 60;

  if (
    companyState.mode ===
    "offense"
  ) {
    seconds = 45;
  }

  if (
    companyState.mode ===
    "defense"
  ) {
    seconds = 90;
  }

  if (
    hour >= 23 ||
    hour < 7
  ) {
    seconds *= 2;
  }

  if (
    pendingCount >= 3
  ) {
    seconds *= 2;
  }

  return {
    seconds,
    label:
      seconds <= 45
        ? "高速"
        : seconds <= 60
        ? "通常"
        : seconds <= 120
        ? "低速"
        : "抑制"
  };
}

function updatePaceDisplay() {

  const pace =
    getOperationalPace();

  paceStatus.textContent =
    pace.label;
}

// =====================================================
// Dynamic Department Selection
// =====================================================

function determineDepartmentsForStrategy(
  strategy
) {

  const text =
    `${strategy.title} ${strategy.reason}`
      .toLowerCase();

  const departments =
    new Set();

  if (
    /事業|市場|顧客|サービス|商品|企画|候補|検証/.test(
      text
    )
  ) {
    departments.add(
      "企画"
    );
  }

  if (
    /実装|技術|システム|開発|自動化|効率化|改善/.test(
      text
    )
  ) {
    departments.add(
      "技術"
    );
  }

  if (
    /収益|コスト|価格|資金|利益|事業/.test(
      text
    )
  ) {
    departments.add(
      "財務"
    );
  }

  if (
    /リスク|安全|法務|規約|契約|個人情報|問題/.test(
      text
    )
  ) {
    departments.add(
      "リスク管理"
    );
  }

  if (
    departments.size === 0
  ) {
    departments.add(
      "企画"
    );

    departments.add(
      "技術"
    );
  }

  return [
    ...departments
  ];
}

function renderActiveDepartments() {

  const departments =
    companyState.activeDepartments ||
    BASE_DEPARTMENTS;

  activeDepartmentList.textContent =
    departments.join("・");
}

// =====================================================
// Company Situation Analysis
// =====================================================

function analyzeCompanyState() {

  const pendingTasks =
    tasks.filter(
      (task) =>
        task.status ===
        "pending"
    );

  const runningTasks =
    tasks.filter(
      (task) =>
        task.status ===
        "running"
    );

  const completedTasks =
    tasks.filter(
      (task) =>
        task.status ===
        "completed"
    );

  const evaluatedTasks =
    completedTasks.filter(
      (task) =>
        task.evaluation
    );

  const recentMemories =
    companyMemory.slice(
      0,
      5
    );

  return {

    pendingCount:
      pendingTasks.length,

    runningCount:
      runningTasks.length,

    completedCount:
      completedTasks.length,

    evaluatedCount:
      evaluatedTasks.length,

    memoryCount:
      companyMemory.length,

    recentMemories,

    goal:
      companyState.goal,

    mode:
      companyState.mode
  };
}

// =====================================================
// Strategic Planning
// =====================================================

function buildStrategy() {

  const analysis =
    analyzeCompanyState();

  const latestMemory =
    analysis.recentMemories[0];

  let title = "";

  let reason = "";

  let objective = "";

  if (
    companyState.mode ===
    "offense"
  ) {

    if (latestMemory) {

      title =
        "前回の学習を踏まえ、新規事業の検証候補を具体化する";

      reason =
        "これまでの実行結果を利用し、次の事業機会を具体的な検証対象へ進める必要があります.";

      objective =
        "新規事業探索と検証";
    }

    else {

      title =
        "新規事業候補を整理し、検証優先順位を決める";

      reason =
        "会社目標に対して、新しい事業機会を探索する必要があります。";

      objective =
        "新規事業探索";
    }
  }

  else if (
    companyState.mode ===
    "defense"
  ) {

    if (latestMemory) {

      title =
        "前回の学習を踏まえ、最優先リスクの対策案を作る";

      reason =
        "現在の会社運営に潜む問題を減らし、安定性を高める必要があります。";

      objective =
        "リスク低減";
    }

    else {

      title =
        "会社運営上のリスク候補を整理し、優先順位を決める";

      reason =
        "会社が成長する前に、運営上の問題候補を把握する必要があります。";

      objective =
        "リスク確認";
    }
  }

  else {

    if (latestMemory) {

      title =
        "前回の学習を踏まえ、改善候補を1つ具体化する";

      reason =
        "実行から得られた学習を次の改善行動へつなげる必要があります。";

      objective =
        "継続改善";
    }

    else {

      title =
        "既存業務の改善候補を整理し、優先順位を決める";

      reason =
        "会社目標を効率的に進めるため、現在の業務改善余地を確認する必要があります。";

      objective =
        "業務改善";
    }
  }

  return {

    id:
      makeId("strategy"),

    title,

    reason,

    objective,

    companyGoal:
      companyState.goal,

    mode:
      companyState.mode,

    createdAt:
      nowISO()
  };
}

// =====================================================
// Strategic Department Council
// =====================================================

function runStrategyCouncil(
  strategy
) {

  const departments =
    determineDepartmentsForStrategy(
      strategy
    );

  const reviews =
    departments.map(
      (department) => {

        if (
          department ===
          "企画"
        ) {

          return {
            department,
            opinion:
              "顧客価値・事業性・検証方法を確認します。",
            recommendation:
              "大きく投資せず、小さく検証できる形へ分解します。",
            source:
              "内部企画部"
          };
        }

        if (
          department ===
          "技術"
        ) {

          return {
            department,
            opinion:
              "実装規模と自動化可能性を確認します。",
            recommendation:
              "まず最小構成で実行可能な単位へ分解します。",
            source:
              "内部技術部"
          };
        }

        if (
          department ===
          "財務"
        ) {

          return {
            department,
            opinion:
              "収益性・コスト・継続可能性を確認します。",
            recommendation:
              "大きな固定費を避け、低コストで検証します。",
            source:
              "内部財務部"
          };
        }

        return {

          department:
            "リスク管理",

          opinion:
            "安全・法務・規約・運営上の問題を確認します。",

          recommendation:
            "取り返しのつかない操作を避け、可逆的な検証から始めます。",

          source:
            "内部リスク管理部"
        };
      }
    );

  return {
    departments,
    reviews
  };
}

// =====================================================
// CEO Strategic Decision
// =====================================================

function createCeoStrategyDecision(
  strategy,
  council
) {

  const hasRisk =
    council.departments.includes(
      "リスク管理"
    );

  const decision =
    hasRisk
      ? "安全条件を守りながら小規模に実行"
      : "小規模に実行して結果を取得";

  return {

    strategyId:
      strategy.id,

    title:
      strategy.title,

    decision,

    reason:
      strategy.reason,

    departments:
      council.departments,

    reviews:
      council.reviews,

    nextAction:
      strategy.title,

    decidedAt:
      nowISO()
  };
}

// =====================================================
// Strategic Task
// =====================================================

function createTaskFromStrategy(
  strategy,
  decision
) {

  const duplicate =
    tasks.find(
      (task) =>
        task.title ===
          strategy.title &&
        task.status ===
          "pending"
    );

  if (duplicate) {
    return duplicate;
  }

  const task =
    addTask(
      strategy.title,
      "normal",
      "CEO Strategy",
      strategy
    );

  if (!task) {
    return null;
  }

  task.strategy = {
    strategyId:
      strategy.id,

    decision:
      decision.decision,

    departments:
      decision.departments
  };

  saveTasks();

  return task;
}

// =====================================================
// Strategy History
// =====================================================

function saveStrategy(
  strategy,
  decision
) {

  strategyHistory.unshift(
    {
      strategy,
      decision,
      createdAt:
        nowISO()
    }
  );

  strategyHistory =
    strategyHistory.slice(
      0,
      50
    );

  save(
    STORAGE_KEYS.strategy,
    strategyHistory
  );
}

// =====================================================
// CEO Decision Display
// =====================================================

function setCurrentDecision(
  decision
) {

  companyState.currentPlan =
    decision.title;

  companyState.nextAction =
    decision.nextAction;

  companyState.activeDepartments =
    decision.departments;

  engineDecision.innerHTML = `
    <div>
      <strong>
        ${escapeHTML(
          decision.decision
        )}
      </strong>
    </div>

    <div>
      ${escapeHTML(
        decision.title
      )}
    </div>

    <div class="task-meta">
      理由：
      ${escapeHTML(
        decision.reason
      )}
    </div>

    <div class="task-meta">
      協議部署：
      ${escapeHTML(
        decision.departments.join(
          "・"
        )
      )}
    </div>
  `;

  saveCompanyState();

  renderActiveDepartments();
}

// =====================================================
// Founder Room
// =====================================================

function determineDepartmentsForFounder(
  proposal
) {

  const departments =
    new Set();

  if (
    /ゲーム|事業|商品|サービス|企画|市場|顧客|収益|アイデア/.test(
      proposal
    )
  ) {

    departments.add(
      "企画"
    );

    departments.add(
      "技術"
    );

    departments.add(
      "財務"
    );
  }

  if (
    /危険|リスク|法務|規約|安全|契約|個人情報/.test(
      proposal
    )
  ) {

    departments.add(
      "リスク管理"
    );
  }

  if (
    departments.size === 0
  ) {

    departments.add(
      "企画"
    );

    departments.add(
      "技術"
    );
  }

  return [
    ...departments
  ];
}

function generateFounderReview(
  department,
  proposal
) {

  const data = {

    "企画": {
      summary:
        "顧客価値・事業性・差別化を確認します。",
      recommendation:
        "小さく検証して市場反応を確認します。"
    },

    "技術": {
      summary:
        "実装規模・技術課題・現在のCoreでの実現可能性を確認します。",
      recommendation:
        "最小構成で試作できる形にします。"
    },

    "財務": {
      summary:
        "収益源・コスト・継続可能性を確認します。",
      recommendation:
        "大きな投資を避け、低コストで検証します。"
    },

    "リスク管理": {
      summary:
        "安全・法務・規約・運営リスクを確認します。",
      recommendation:
        "可逆的な小規模検証から始めます。"
    }

  };

  const item =
    data[department] ||
    data["企画"];

  return {

    department,

    summary:
      item.summary,

    recommendation:
      item.recommendation,

    source:
      "内部ルール",

    createdAt:
      nowISO()
  };
}

function generateFounderDecision(
  founderCase
) {

  if (
    founderCase.reviews.some(
      (review) =>
        review.department ===
        "リスク管理"
    )
  ) {

    founderCase.decision =
      "リスク確認後に小規模検証";

  } else {

    founderCase.decision =
      "検討継続";
  }

  founderCase.nextAction =
    "市場検証と小規模実装を開始する";

  founderCase.status =
    "CEO判断済み";
}

function createFounderTask(
  founderCase
) {

  if (
    founderCase.taskCreated
  ) {
    return;
  }

  const exists =
    tasks.find(
      (task) =>
        task.title ===
          founderCase.nextAction &&
        task.source ===
          "Founder Room"
    );

  if (!exists) {

    addTask(
      founderCase.nextAction,
      "normal",
      "Founder Room"
    );
  }

  founderCase.taskCreated =
    true;

  founderCase.status =
    "判断からタスク作成済み";

  save(
    STORAGE_KEYS.founder,
    founderCases
  );
}

function renderFounderRoom() {

  if (
    founderCases.length ===
    0
  ) {

    founderRecords.innerHTML =
      `<div class="empty">
        まだ協議記録はありません。
      </div>`;

    return;
  }

  founderRecords.innerHTML =
    founderCases
      .slice()
      .reverse()
      .map(
        (item) => `

          <div class="record-card">

            <h4>
              Founder：
              ${escapeHTML(
                item.proposal
              )}
            </h4>

            <div>
              状態：
              ${escapeHTML(
                item.status
              )}
            </div>

            <div class="task-meta">
              提出日時：
              ${escapeHTML(
                formatDate(
                  item.createdAt
                )
              )}
            </div>

            ${
              item.decision
                ? `
                  <div>
                    <strong>
                      CEO判断：
                    </strong>
                    ${escapeHTML(
                      item.decision
                    )}
                  </div>
                `
                : ""
            }

          </div>

        `
      )
      .join("");
}

function renderCouncil() {

  if (
    founderCases.length ===
    0
  ) {

    councilCases.innerHTML =
      `<div class="empty">
        まだ協議案件はありません。
      </div>`;

    return;
  }

  councilCases.innerHTML =
    founderCases
      .slice()
      .reverse()
      .map(
        (item) => {

          const reviewsHTML =
            item.reviews
              .map(
                (review) => `

                  <div class="review-box">

                    <h4>
                      ${escapeHTML(
                        review.department
                      )}
                    </h4>

                    <div>
                      ${escapeHTML(
                        review.summary
                      )}
                    </div>

                    <p>
                      <strong>
                        提案：
                      </strong>

                      ${escapeHTML(
                        review.recommendation
                      )}
                    </p>

                    <div class="task-meta">
                      情報源：
                      ${escapeHTML(
                        review.source ||
                        "内部ルール"
                      )}
                    </div>

                  </div>
                `
              )
              .join("");

          const decisionHTML =
            item.decision
              ? `
                <div class="decision-box">

                  <strong>
                    CEO判断：
                    ${escapeHTML(
                      item.decision
                    )}
                  </strong>

                  <p>
                    次の行動：
                    ${escapeHTML(
                      item.nextAction ||
                      ""
                    )}
                  </p>

                </div>
              `
              : "";

          return `
            <div class="council-card">

              <h3>
                ${escapeHTML(
                  item.proposal
                )}
              </h3>

              <div class="task-meta">
                CEO状態：
                ${escapeHTML(
                  item.status
                )}
              </div>

              ${reviewsHTML}

              ${decisionHTML}

            </div>
          `;
        }
      )
      .join("");
}

// =====================================================
// Founder Pipeline
// =====================================================

function processFounderPipeline() {

  const waiting =
    founderCases.find(
      (item) =>
        item.status ===
        "CEO協議待ち"
    );

  if (waiting) {

    const departments =
      determineDepartmentsForFounder(
        waiting.proposal
      );

    waiting.departments =
      departments;

    waiting.status =
      "CEOが各部署へ協議中";

    save(
      STORAGE_KEYS.founder,
      founderCases
    );

    addEngineLog(
      "Founder協議",
      `CEOがFounder案件を${departments.join("・")}へ回しました。`
    );

    renderFounderRoom();
    renderCouncil();

    return true;
  }

  const reviewing =
    founderCases.find(
      (item) =>
        item.status ===
          "CEOが各部署へ協議中" &&
        item.reviews.length <
          item.departments.length
    );

  if (reviewing) {

    const department =
      reviewing.departments[
        reviewing.reviews.length
      ];

    reviewing.reviews.push(
      generateFounderReview(
        department,
        reviewing.proposal
      )
    );

    if (
      reviewing.reviews.length >=
      reviewing.departments.length
    ) {

      reviewing.status =
        "部署協議完了";
    }

    save(
      STORAGE_KEYS.founder,
      founderCases
    );

    addEngineLog(
      "部署協議",
      `${department}がFounder案件を確認しました。`
    );

    renderFounderRoom();
    renderCouncil();

    return true;
  }

  const decisionReady =
    founderCases.find(
      (item) =>
        item.status ===
          "部署協議完了" &&
        !item.decision
    );

  if (decisionReady) {

    generateFounderDecision(
      decisionReady
    );

    save(
      STORAGE_KEYS.founder,
      founderCases
    );

    addEngineLog(
      "CEO判断",
      `CEOがFounder案件を「${decisionReady.decision}」と判断しました。`
    );

    renderFounderRoom();
    renderCouncil();

    return true;
  }

  const taskReady =
    founderCases.find(
      (item) =>
        item.decision &&
        !item.taskCreated
    );

  if (taskReady) {

    createFounderTask(
      taskReady
    );

    addEngineLog(
      "タスク化",
      `Founder案件の次の行動をTask Coreへ登録しました。`
    );

    renderFounderRoom();
    renderCouncil();
    renderTasks();

    return true;
  }

  return false;
}

// =====================================================
// Engine Logs
// =====================================================

function addEngineLog(
  type,
  message
) {

  engineLogs.unshift({

    id:
      makeId("log"),

    cycle:
      companyState.cycleCount,

    type,

    message,

    createdAt:
      nowISO()
  });

  engineLogs =
    engineLogs.slice(
      0,
      100
    );

  save(
    STORAGE_KEYS.engineLog,
    engineLogs
  );

  renderEngineLog();
}

function renderEngineLog() {

  if (
    engineLogs.length ===
    0
  ) {

    engineLog.innerHTML =
      "まだサイクルは実行されていません。";

    return;
  }

  engineLog.innerHTML =
    engineLogs
      .slice(0, 40)
      .map(
        (entry) => `

          <div class="log-entry">

            <div class="log-time">
              サイクル${entry.cycle}
              /
              ${escapeHTML(
                formatDate(
                  entry.createdAt
                )
              )}
              /
              ${escapeHTML(
                entry.type
              )}
            </div>

            <div class="log-title">
              ${escapeHTML(
                entry.message
              )}
            </div>

          </div>

        `
      )
      .join("");
}

// =====================================================
// Company Engine Rendering
// =====================================================

function renderCompanyState() {

  companyGoalInput.value =
    companyState.goal ||
    "";

  companyModeSelect.value =
    companyState.mode ||
    "normal";

  engineStatus.textContent =
    companyState.running
      ? "自律運転中"
      : "待機中";

  ceoStatus.textContent =
    companyState.currentFocus ||
    "観測中";

  engineSummary.textContent =
    `目標：${companyState.goal || "未設定"} / ` +
    `モード：${getModeLabel(
      companyState.mode
    )} / ` +
    `サイクル：${companyState.cycleCount}回 / ` +
    `次の行動：${companyState.nextAction || "未定"}`;

  updatePaceDisplay();

  renderActiveDepartments();
}

// =====================================================
// Execute + Evaluate
// =====================================================

async function executeAndEvaluate(
  task
) {

  await executeTask(task);

  evaluateTask(task);

  recordMemoryFromTask(
    task
  );

  addEngineLog(
    "実行完了",
    `タスクを実行しました：${task.title}`
  );

  addEngineLog(
    "結果評価",
    `CEO評価：${task.evaluation.level} / ${task.evaluation.lesson}`
  );

  addEngineLog(
    "会社記憶",
    "実行結果をCompany Memoryへ保存しました。"
  );

  renderTasks();
  renderCompanyMemory();
}

// =====================================================
// Main Company Cycle
// =====================================================

async function runCompanyCycle() {

  if (cycleBusy) {
    return;
  }

  cycleBusy =
    true;

  companyState.cycleCount += 1;

  companyState.lastCycleAt =
    nowISO();

  companyState.currentFocus =
    "会社状態を分析中";

  saveCompanyState();

  renderCompanyState();

  addEngineLog(
    "サイクル開始",
    "CEOが会社状態を確認しています。"
  );

  // ---------------------------------------------
  // Phase 1
  // Founder
  // ---------------------------------------------

  const founderHandled =
    processFounderPipeline();

  if (founderHandled) {

    companyState.currentFocus =
      "Founder案件を処理中";

    saveCompanyState();

    engineSummary.textContent =
      "Founder案件を会社の意思決定系へ取り込みました。";

    cycleBusy =
      false;

    renderCompanyState();

    return;
  }

  // ---------------------------------------------
  // Phase 2
  // Completed but unevaluated
  // ---------------------------------------------

  const unevaluated =
    tasks
      .filter(
        (task) =>
          task.status ===
            "completed" &&
          !task.evaluation
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt) -
          new Date(a.updatedAt)
      )[0];

  if (unevaluated) {

    companyState.currentFocus =
      "実行結果を評価中";

    saveCompanyState();

    renderCompanyState();

    evaluateTask(
      unevaluated
    );

    recordMemoryFromTask(
      unevaluated
    );

    addEngineLog(
      "結果評価",
      `過去の実行結果を評価しました：${unevaluated.title}`
    );

    renderTasks();
    renderCompanyMemory();

    companyState.currentFocus =
      "観測中";

    saveCompanyState();

    engineSummary.textContent =
      "実行結果を評価し、会社記憶を更新しました。";

    cycleBusy =
      false;

    renderCompanyState();

    return;
  }

  // ---------------------------------------------
  // Phase 3
  // Pending Task
  // ---------------------------------------------

  const pending =
    tasks
      .filter(
        (task) =>
          task.status ===
          "pending"
      )
      .sort(
        (a, b) =>
          (PRIORITY_ORDER[
            a.priority
          ] || 2) -
          (PRIORITY_ORDER[
            b.priority
          ] || 2)
      )[0];

  if (pending) {

    companyState.currentFocus =
      "タスク実行中";

    saveCompanyState();

    renderCompanyState();

    addEngineLog(
      "タスク選択",
      `CEOが次の実行対象を選びました：${pending.title}`
    );

    await executeAndEvaluate(
      pending
    );

    companyState.currentFocus =
      "観測中";

    saveCompanyState();

    engineSummary.textContent =
      "タスクを実行し、評価し、学習記録を保存しました。";

    cycleBusy =
      false;

    renderCompanyState();

    return;
  }

  // ---------------------------------------------
  // Phase 4
  // Strategic Planning
  // ---------------------------------------------

  companyState.currentFocus =
    "戦略を立案中";

  saveCompanyState();

  renderCompanyState();

  const analysis =
    analyzeCompanyState();

  addEngineLog(
    "状況分析",
    `未完了${analysis.pendingCount}件 / 完了${analysis.completedCount}件 / 記憶${analysis.memoryCount}件を確認しました。`
  );

  const strategy =
    buildStrategy();

  addEngineLog(
    "戦略立案",
    `CEOが次の仕事を提案しました：${strategy.title}`
  );

  // ---------------------------------------------
  // Phase 5
  // Department Council
  // ---------------------------------------------

  companyState.currentFocus =
    "部署協議中";

  saveCompanyState();

  renderCompanyState();

  const council =
    runStrategyCouncil(
      strategy
    );

  addEngineLog(
    "部署協議",
    `必要部署：${council.departments.join("・")}`
  );

  // ---------------------------------------------
  // Phase 6
  // CEO Decision
  // ---------------------------------------------

  companyState.currentFocus =
    "CEO戦略決定中";

  saveCompanyState();

  renderCompanyState();

  const decision =
    createCeoStrategyDecision(
      strategy,
      council
    );

  setCurrentDecision(
    decision
  );

  saveStrategy(
    strategy,
    decision
  );

  addEngineLog(
    "CEO戦略決定",
    `${decision.decision}：「${decision.title}」`
  );

  // ---------------------------------------------
  // Phase 7
  // Create Task
  // ---------------------------------------------

  companyState.currentFocus =
    "タスク生成中";

  saveCompanyState();

  renderCompanyState();

  const task =
    createTaskFromStrategy(
      strategy,
      decision
    );

  if (task) {

    addEngineLog(
      "自律タスク生成",
      `CEO判断からTask Coreへ登録しました：${task.title}`
    );

    renderTasks();

    // -------------------------------------------
    // Phase 8
    // Execute
    // -------------------------------------------

    companyState.currentFocus =
      "タスク実行中";

    saveCompanyState();

    renderCompanyState();

    await executeAndEvaluate(
      task
    );

    // -------------------------------------------
    // Phase 9
    // Next Planning
    // -------------------------------------------

    companyState.currentFocus =
      "次の戦略を待機中";

    companyState.nextAction =
      task.evaluation
        ? task.evaluation.nextAction
        : "次の会社状態を分析する";

    saveCompanyState();

    addEngineLog(
      "次の計画",
      `今回の学習を次の判断へ引き継ぎます。`
    );
  }

  companyState.currentFocus =
    "観測中";

  saveCompanyState();

  engineSummary.textContent =
    "会社が状況分析→部署協議→CEO判断→実行→評価→記憶まで1サイクル完了しました。";

  renderCompanyState();

  cycleBusy =
    false;
}

// =====================================================
// Autonomous Operation
// =====================================================

function restartEngineTimer() {

  if (engineInterval) {
    clearInterval(
      engineInterval
    );
  }

  const pace =
    getOperationalPace();

  engineInterval =
    setInterval(
      () => {

        if (
          companyState.running
        ) {

          runCompanyCycle();
        }

        restartEngineTimer();

      },
      pace.seconds * 1000
    );
}

function startAutonomousEngine() {

  if (
    companyState.running
  ) {
    return;
  }

  companyState.running =
    true;

  saveCompanyState();

  addEngineLog(
    "自律運転",
    "自律運転を開始しました。"
  );

  renderCompanyState();

  runCompanyCycle();

  restartEngineTimer();
}

function stopAutonomousEngine() {

  companyState.running =
    false;

  if (engineInterval) {

    clearInterval(
      engineInterval
    );

    engineInterval =
      null;
  }

  saveCompanyState();

  addEngineLog(
    "自律運転",
    "自律運転を停止しました。"
  );

  renderCompanyState();
}

// =====================================================
// Basic Test
// =====================================================

testButton.addEventListener(
  "click",
  () => {

    const value =
      testInput.value.trim();

    if (!value) {

      testResult.textContent =
        "入力してください。";

      return;
    }

    testResult.textContent =
      `入力を受け取りました：${value}`;
  }
);

// =====================================================
// Manual Task
// =====================================================

addTaskButton.addEventListener(
  "click",
  () => {

    const task =
      addTask(
        taskInput.value,
        taskPriority.value,
        "Founder / Manual"
      );

    if (!task) {
      return;
    }

    taskInput.value =
      "";
  }
);

// =====================================================
// Founder
// =====================================================

submitFounderButton.addEventListener(
  "click",
  () => {

    const proposal =
      founderInput.value.trim();

    if (!proposal) {
      return;
    }

    const founderCase = {

      id:
        makeId("founder"),

      proposal,

      status:
        "CEO協議待ち",

      createdAt:
        nowISO(),

      departments: [],

      reviews: [],

      decision:
        null,

      nextAction:
        null,

      taskCreated:
        false
    };

    founderCases.push(
      founderCase
    );

    save(
      STORAGE_KEYS.founder,
      founderCases
    );

    founderInput.value =
      "";

    renderFounderRoom();
    renderCouncil();
  }
);

// =====================================================
// Company Goal / Mode
// =====================================================

companyGoalInput.addEventListener(
  "input",
  () => {

    companyState.goal =
      companyGoalInput.value.trim();

    saveCompanyState();

    renderCompanyState();
  }
);

companyModeSelect.addEventListener(
  "change",
  () => {

    companyState.mode =
      companyModeSelect.value;

    saveCompanyState();

    updatePaceDisplay();

    renderCompanyState();
  }
);

// =====================================================
// Engine Buttons
// =====================================================

runCycleButton.addEventListener(
  "click",
  () => {

    runCompanyCycle();
  }
);

startEngineButton.addEventListener(
  "click",
  () => {

    startAutonomousEngine();
  }
);

stopEngineButton.addEventListener(
  "click",
  () => {

    stopAutonomousEngine();
  }
);

// =====================================================
// Initialize
// =====================================================

function initialize() {

  systemStatus.textContent =
    "正常稼働";

  executorStatus.textContent =
    "Local Executor";

  apiStatus.textContent =
    "使用しない";

  companyState.running =
    false;

  saveCompanyState();

  renderTasks();

  renderFounderRoom();

  renderCouncil();

  renderEngineLog();

  renderCompanyMemory();

  renderCompanyState();

  renderActiveDepartments();
}

initialize();
