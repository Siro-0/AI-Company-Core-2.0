// =====================================================
// AI Company Core 2.0
// Company Core 3.0 + Real Local Executor
// 外部AI APIなし
// =====================================================

const STORAGE_KEYS = {
  tasks: "ai_company_tasks_v4",
  founder: "ai_company_founder_v4",
  companyState: "ai_company_state_v4",
  engineLog: "ai_company_engine_log_v4",
  companyMemory: "ai_company_memory_v4",
  strategy: "ai_company_strategy_v4",
  business: "ai_company_business_v4",
  humanGate: "ai_company_human_gate_v4",
  improvements: "ai_company_improvements_v4"
};

const LOCAL_EXECUTOR_URL =
  "http://127.0.0.1:8765";

const BASE_DEPARTMENTS = [
  "企画",
  "技術",
  "財務",
  "リスク管理"
];

const PRIORITY_ORDER = {
  high: 1,
  normal: 2,
  low: 3
};

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
    const raw = localStorage.getItem(key);

    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw);
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
  document.getElementById(
    "systemStatus"
  );

const ceoStatus =
  document.getElementById(
    "ceoStatus"
  );

const engineStatus =
  document.getElementById(
    "engineStatus"
  );

const executorStatus =
  document.getElementById(
    "executorStatus"
  );

const apiStatus =
  document.getElementById(
    "apiStatus"
  );

const paceStatus =
  document.getElementById(
    "paceStatus"
  );

const companyGoalInput =
  document.getElementById(
    "companyGoal"
  );

const companyModeSelect =
  document.getElementById(
    "companyMode"
  );

const runCycleButton =
  document.getElementById(
    "runCycleButton"
  );

const startEngineButton =
  document.getElementById(
    "startEngineButton"
  );

const stopEngineButton =
  document.getElementById(
    "stopEngineButton"
  );

const checkExecutorButton =
  document.getElementById(
    "checkExecutorButton"
  );

const engineDecision =
  document.getElementById(
    "engineDecision"
  );

const engineSummary =
  document.getElementById(
    "engineSummary"
  );

const engineLog =
  document.getElementById(
    "engineLog"
  );

const businessList =
  document.getElementById(
    "businessList"
  );

const humanGateList =
  document.getElementById(
    "humanGateList"
  );

const improvementList =
  document.getElementById(
    "improvementList"
  );

const companyMemoryEl =
  document.getElementById(
    "companyMemory"
  );

const activeDepartmentList =
  document.getElementById(
    "activeDepartmentList"
  );

const discoverBusinessButton =
  document.getElementById(
    "discoverBusinessButton"
  );

const testInput =
  document.getElementById(
    "testInput"
  );

const testButton =
  document.getElementById(
    "testButton"
  );

const testResult =
  document.getElementById(
    "testResult"
  );

const taskInput =
  document.getElementById(
    "taskInput"
  );

const taskPriority =
  document.getElementById(
    "taskPriority"
  );

const addTaskButton =
  document.getElementById(
    "addTaskButton"
  );

const taskCount =
  document.getElementById(
    "taskCount"
  );

const taskList =
  document.getElementById(
    "taskList"
  );

const founderInput =
  document.getElementById(
    "founderInput"
  );

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

let tasks =
  load(
    STORAGE_KEYS.tasks,
    []
  );

let founderCases =
  load(
    STORAGE_KEYS.founder,
    []
  );

let engineLogs =
  load(
    STORAGE_KEYS.engineLog,
    []
  );

let companyMemory =
  load(
    STORAGE_KEYS.companyMemory,
    []
  );

let strategyHistory =
  load(
    STORAGE_KEYS.strategy,
    []
  );

let businessOpportunities =
  load(
    STORAGE_KEYS.business,
    []
  );

let humanGates =
  load(
    STORAGE_KEYS.humanGate,
    []
  );

let improvementIdeas =
  load(
    STORAGE_KEYS.improvements,
    []
  );

let companyState =
  load(
    STORAGE_KEYS.companyState,
    {
      goal:
        "事業を継続的に改善し、収益化できる機会を見つける",

      mode:
        "normal",

      running:
        false,

      cycleCount:
        0,

      lastCycleAt:
        null,

      currentFocus:
        "観測中",

      currentPlan:
        "まだ戦略判断はありません。",

      nextAction:
        "会社状態を分析して次の仕事を決定する",

      activeDepartments:
        [
          ...BASE_DEPARTMENTS
        ],

      waiting:
        false,

      executorConnected:
        false,

      lastEvaluation:
        null
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
      Number(
        task.runCount || 0
      ),

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

    strategyId:
      task.strategyId ||
      null,

    parentTaskId:
      task.parentTaskId ||
      null,

    level:
      task.level ||
      "task",

    retryCount:
      Number(
        task.retryCount || 0
      ),

    requiresHuman:
      Boolean(
        task.requiresHuman
      ),

    humanGateId:
      task.humanGateId ||
      null,

    localExecution:
      task.localExecution ||
      null
  };
}

function normalizeFounder(item) {
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
        ? item.reviews
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

tasks =
  tasks.map(
    normalizeTask
  );

founderCases =
  founderCases.map(
    normalizeFounder
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
// Labels
// =====================================================

function priorityLabel(
  priority
) {
  if (
    priority === "high"
  ) {
    return "高";
  }

  if (
    priority === "low"
  ) {
    return "低";
  }

  return "通常";
}

function statusLabel(
  status
) {
  if (
    status === "running"
  ) {
    return "実行中";
  }

  if (
    status === "completed"
  ) {
    return "完了";
  }

  if (
    status ===
    "waiting_human"
  ) {
    return "人間承認待ち";
  }

  if (
    status === "failed"
  ) {
    return "失敗";
  }

  return "未完了";
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

function getModeLabel(
  mode
) {
  if (
    mode === "offense"
  ) {
    return "攻め";
  }

  if (
    mode === "defense"
  ) {
    return "守り";
  }

  return "通常";
}

function getOperationalPace() {
  const hour =
    new Date().getHours();

  const pending =
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
    pending >= 3
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

  const pace =
    getOperationalPace();

  paceStatus.textContent =
    pace.label;

  engineSummary.textContent =
    `目標：${
      companyState.goal ||
      "未設定"
    } / ` +
    `モード：${
      getModeLabel(
        companyState.mode
      )
    } / ` +
    `サイクル：${
      companyState.cycleCount
    }回 / ` +
    `次の行動：${
      companyState.nextAction ||
      "未定"
    }`;

  renderActiveDepartments();
}

function setExecutorStatus(
  connected,
  message = ""
) {
  companyState.executorConnected =
    connected;

  executorStatus.textContent =
    connected
      ? "Python Local Executor 接続済み"
      : "Python Local Executor 未接続";

  if (message) {
    addEngineLog(
      "Executor",
      message
    );
  }

  saveCompanyState();
  renderCompanyState();
}

// =====================================================
// Executor Health Check
// =====================================================

async function checkExecutorConnection(
  showLog = true
) {
  try {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        2500
      );

    const response =
      await fetch(
        `${LOCAL_EXECUTOR_URL}/health`,
        {
          method: "GET",
          cache: "no-store",
          signal:
            controller.signal
        }
      );

    clearTimeout(timeout);

    if (
      !response.ok
    ) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    if (!data.ok) {
      throw new Error(
        "Executor returned an invalid health response."
      );
    }

    setExecutorStatus(
      true,

      showLog
        ? "Python Local Executorへ接続できました。"
        : ""
    );

    return true;

  } catch (error) {

    setExecutorStatus(
      false,

      showLog
        ? `Python Local Executorへ接続できません：${error.message}`
        : ""
    );

    return false;
  }
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

      if (
        priorityDiff !== 0
      ) {
        return priorityDiff;
      }

      const statusRank = {
        pending: 1,
        running: 2,
        waiting_human: 3,
        failed: 4,
        completed: 5
      };

      const statusDiff =
        (statusRank[
          a.status
        ] || 1) -
        (statusRank[
          b.status
        ] || 1);

      if (
        statusDiff !== 0
      ) {
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

  if (
    tasks.length === 0
  ) {
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
                      task
                        .evaluation
                        .level
                    )}
                  </strong>

                  <div>
                    ${escapeHTML(
                      task
                        .evaluation
                        .summary
                    )}
                  </div>

                  <div>
                    <strong>
                      学習：
                    </strong>

                    ${escapeHTML(
                      task
                        .evaluation
                        .lesson
                    )}
                  </div>

                  <div>
                    <strong>
                      次の行動：
                    </strong>

                    ${escapeHTML(
                      task
                        .evaluation
                        .nextAction
                    )}
                  </div>

                  <div class="small">
                    評価日時：
                    ${escapeHTML(
                      formatDate(
                        task
                          .evaluation
                          .evaluatedAt
                      )
                    )}
                  </div>

                </div>
              `
              : "";

          const localExecutionHTML =
            task.localExecution
              ? `
                <div class="task-meta">
                  実処理：
                  ${escapeHTML(
                    task
                      .localExecution
                      .action ||
                    "Local Executor"
                  )}
                </div>

                <div class="task-meta">
                  出力：
                  ${escapeHTML(
                    task
                      .localExecution
                      .outputPath ||
                    "なし"
                  )}
                </div>
              `
              : "";

          return `
            <div class="task-card">

              <h4>
                ${escapeHTML(
                  task.title
                )}
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
                レベル：
                ${escapeHTML(
                  task.level
                )}
              </div>

              <div class="task-meta">
                実行回数：
                ${task.runCount}回
              </div>

              <div class="task-meta">
                再試行：
                ${task.retryCount}回
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

              ${localExecutionHTML}

              ${
                task.requiresHuman
                  ? `
                    <div class="task-meta">
                      Human Gate：
                      ${escapeHTML(
                        task.humanGateId ||
                        "必要"
                      )}
                    </div>
                  `
                  : ""
              }

              ${evaluationHTML}

              <div class="task-buttons">

                <button
                  onclick="
                    editTask(
                      '${task.id}'
                    )
                  ">
                  編集
                </button>

                ${
                  task.status ===
                  "completed"

                    ? `
                      <button
                        onclick="
                          returnTask(
                            '${task.id}'
                          )
                        ">
                        未完了に戻す
                      </button>
                    `

                    : task.status ===
                      "waiting_human"

                    ? `
                      <button
                        onclick="
                          openTaskGate(
                            '${task.id}'
                          )
                        ">
                        承認確認
                      </button>
                    `

                    : `
                      <button
                        onclick="
                          runSingleTask(
                            '${task.id}'
                          )
                        ">
                        実行
                      </button>
                    `
                }

                <button
                  onclick="
                    deleteTask(
                      '${task.id}'
                    )
                  ">
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
  options = {}
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
      "Python Local Executor",

    source,

    createdAt:
      nowISO(),

    updatedAt:
      nowISO(),

    evaluation:
      null,

    strategyId:
      options.strategyId ||
      null,

    parentTaskId:
      options.parentTaskId ||
      null,

    level:
      options.level ||
      "task",

    retryCount:
      0,

    requiresHuman:
      Boolean(
        options.requiresHuman
      ),

    humanGateId:
      null,

    localExecution:
      null
  };

  tasks.push(task);

  saveTasks();
  renderTasks();

  return task;
}

function findTask(
  taskId
) {
  return tasks.find(
    (task) =>
      task.id ===
      taskId
  );
}

function editTask(
  taskId
) {
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

  const clean =
    value.trim();

  if (!clean) {
    return;
  }

  task.title =
    clean;

  task.updatedAt =
    nowISO();

  saveTasks();
  renderTasks();
}

function deleteTask(
  taskId
) {
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
        item.id !==
        taskId
    );

  saveTasks();
  renderTasks();
}

function returnTask(
  taskId
) {
  const task =
    findTask(taskId);

  if (!task) {
    return;
  }

  task.status =
    "pending";

  task.evaluation =
    null;

  task.localExecution =
    null;

  task.updatedAt =
    nowISO();

  saveTasks();
  renderTasks();
}

async function runSingleTask(
  taskId
) {
  const task =
    findTask(taskId);

  if (!task) {
    return;
  }

  const executorReady =
    await checkExecutorConnection(
      false
    );

  if (!executorReady) {

    testResult.textContent =
      "Python Local Executorが起動していません。";

    return;
  }

  const result =
    await executeTask(
      task
    );

  if (!result) {
    return;
  }

  evaluateTask(task);

  recordMemoryFromTask(
    task
  );

  maybeCreateImprovement();

  renderTasks();

  renderCompanyMemory();

  renderImprovements();
}

// =====================================================
// Human Gate
// =====================================================

function detectHumanGate(
  task
) {
  const text =
    task.title.toLowerCase();

  const patterns = [
    "送金",
    "銀行",
    "決済",
    "支払い",
    "支払",
    "購入",
    "契約",
    "署名",
    "公開",
    "削除",
    "外部サービス",
    "個人情報"
  ];

  return patterns.some(
    (keyword) =>
      text.includes(
        keyword
      )
  );
}

function createHumanGate(
  task
) {
  const existing =
    humanGates.find(
      (gate) =>
        gate.taskId ===
          task.id &&
        gate.status ===
          "pending"
    );

  if (existing) {

    task.status =
      "waiting_human";

    task.requiresHuman =
      true;

    task.humanGateId =
      existing.id;

    saveTasks();

    return existing;
  }

  const gate = {

    id:
      makeId("gate"),

    taskId:
      task.id,

    taskTitle:
      task.title,

    reason:
      "この操作は人間による確認が必要です。",

    status:
      "pending",

    createdAt:
      nowISO(),

    resolvedAt:
      null
  };

  humanGates.unshift(
    gate
  );

  task.status =
    "waiting_human";

  task.requiresHuman =
    true;

  task.humanGateId =
    gate.id;

  save(
    STORAGE_KEYS.humanGate,
    humanGates
  );

  saveTasks();

  addEngineLog(
    "Human Gate",
    `人間承認が必要なタスクを停止しました：${task.title}`
  );

  return gate;
}

function approveGate(
  gateId
) {
  const gate =
    humanGates.find(
      (item) =>
        item.id ===
        gateId
    );

  if (!gate) {
    return;
  }

  const task =
    findTask(
      gate.taskId
    );

  if (!task) {
    return;
  }

  gate.status =
    "approved";

  gate.resolvedAt =
    nowISO();

  task.status =
    "pending";

  task.updatedAt =
    nowISO();

  save(
    STORAGE_KEYS.humanGate,
    humanGates
  );

  saveTasks();

  addEngineLog(
    "Human Gate",
    `人間承認済み：${task.title}`
  );

  renderHumanGates();
  renderTasks();
}

function rejectGate(
  gateId
) {
  const gate =
    humanGates.find(
      (item) =>
        item.id ===
        gateId
    );

  if (!gate) {
    return;
  }

  const task =
    findTask(
      gate.taskId
    );

  if (!task) {
    return;
  }

  gate.status =
    "rejected";

  gate.resolvedAt =
    nowISO();

  task.status =
    "failed";

  task.result =
    "人間承認が得られなかったため実行を停止しました。";

  task.updatedAt =
    nowISO();

  save(
    STORAGE_KEYS.humanGate,
    humanGates
  );

  saveTasks();

  addEngineLog(
    "Human Gate",
    `人間承認によりタスクを停止しました：${task.title}`
  );

  renderHumanGates();
  renderTasks();
}

function openTaskGate(
  taskId
) {
  const task =
    findTask(taskId);

  if (
    !task ||
    !task.humanGateId
  ) {
    return;
  }

  alert(
    "Human Gateを確認してください。"
  );
}

function renderHumanGates() {

  const pending =
    humanGates.filter(
      (gate) =>
        gate.status ===
        "pending"
    );

  if (
    pending.length ===
    0
  ) {

    humanGateList.innerHTML =
      "現在、承認待ちはありません。";

    return;
  }

  humanGateList.innerHTML =
    pending
      .map(
        (gate) => `
          <div class="gate-card pending">

            <h4>
              ${escapeHTML(
                gate.taskTitle
              )}
            </h4>

            <div class="meta">
              理由：
              ${escapeHTML(
                gate.reason
              )}
            </div>

            <div class="meta">
              作成：
              ${escapeHTML(
                formatDate(
                  gate.createdAt
                )
              )}
            </div>

            <div class="card-buttons">

              <button
                onclick="
                  approveGate(
                    '${gate.id}'
                  )
                ">
                承認
              </button>

              <button
                onclick="
                  rejectGate(
                    '${gate.id}'
                  )
                ">
                拒否
              </button>

            </div>

          </div>
        `
      )
      .join("");
}

// =====================================================
// Real Local Executor
// =====================================================

async function executeTask(
  task
) {

  if (
    detectHumanGate(
      task
    )
  ) {

    createHumanGate(
      task
    );

    renderHumanGates();
    renderTasks();

    return null;
  }

  task.status =
    "running";

  task.executor =
    "Python Local Executor";

  task.updatedAt =
    nowISO();

  saveTasks();
  renderTasks();

  try {

    const response =
      await fetch(
        `${LOCAL_EXECUTOR_URL}/execute`,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              {
                task: {
                  id:
                    task.id,

                  title:
                    task.title,

                  priority:
                    task.priority,

                  source:
                    task.source,

                  strategy_id:
                    task.strategyId,

                  parent_task_id:
                    task.parentTaskId
                }
              }
            )
        }
      );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.ok
    ) {

      throw new Error(
        data.error ||
        `HTTP ${response.status}`
      );
    }

    task.status =
      "completed";

    task.runCount +=
      1;

    task.lastRunAt =
      nowISO();

    task.result =
      data.result ||
      "実行完了";

    task.executor =
      "Python Local Executor";

    task.updatedAt =
      nowISO();

    task.localExecution = {

      action:
        data.action ||
        "Local Executor",

      outputPath:
        data.output_path ||
        null,

      metrics:
        data.metrics ||
        null,

      raw:
        data.data ||
        null
    };

    saveTasks();
    renderTasks();

    testResult.textContent =
      task.result;

    addEngineLog(
      "実ローカル実行",
      `${data.result || "実行完了"} / 出力：${data.output_path || "なし"}`
    );

    return task;

  } catch (error) {

    task.status =
      "pending";

    task.executor =
      "Python Local Executor";

    task.result =
      `実行待機：${error.message}`;

    task.retryCount +=
      1;

    task.updatedAt =
      nowISO();

    saveTasks();
    renderTasks();

    addEngineLog(
      "Executor待機",
      `Local Executor実行に失敗しました：${error.message}`
    );

    return null;
  }
}

// =====================================================
// Evaluation / Memory
// =====================================================

function evaluateTask(
  task
) {

  if (
    !task ||
    task.status !==
    "completed"
  ) {
    return;
  }

  const isReal =
    task.executor ===
    "Python Local Executor";

  task.evaluation = {

    level:
      isReal
        ? "実行成功・成果確認前"
        : "暫定成功",

    summary:
      isReal
        ? "Python Local Executorで実処理を実行し、ローカル成果物または処理結果を取得しました。ただし事業上の成功までは確認していません。"
        : "Executor上では処理が完了しました。",

    lesson:
      `「${task.title}」を実行単位として処理できた。`,

    nextAction:
      isReal
        ? "生成された成果物・実データを確認し、事業上の価値または改善効果を再評価する。"
        : "実際の成果を取得できる実行基盤へ拡張する。",

    evaluatedAt:
      nowISO()
  };

  saveTasks();
}

function recordMemoryFromTask(
  task
) {

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

    outputPath:
      task.localExecution
        ?.outputPath ||
      null,

    createdAt:
      nowISO()
  };

  companyMemory.unshift(
    memory
  );

  companyMemory =
    companyMemory.slice(
      0,
      100
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

function renderCompanyMemory() {

  if (
    companyMemory.length ===
    0
  ) {

    companyMemoryEl.innerHTML =
      `<div class="empty">
        まだ学習記録はありません。
      </div>`;

    return;
  }

  companyMemoryEl.innerHTML =
    companyMemory
      .slice(0, 20)
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

            ${
              memory.outputPath
                ? `
                  <div class="small">
                    成果物：
                    ${escapeHTML(
                      memory.outputPath
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

// =====================================================
// Situation / Strategy
// =====================================================

function analyzeCompany() {

  return {

    pending:
      tasks.filter(
        (task) =>
          task.status ===
          "pending"
      ).length,

    running:
      tasks.filter(
        (task) =>
          task.status ===
          "running"
      ).length,

    waitingHuman:
      tasks.filter(
        (task) =>
          task.status ===
          "waiting_human"
      ).length,

    failed:
      tasks.filter(
        (task) =>
          task.status ===
          "failed"
      ).length,

    completed:
      tasks.filter(
        (task) =>
          task.status ===
          "completed"
      ).length,

    memory:
      companyMemory.length,

    businesses:
      businessOpportunities.length,

    improvements:
      improvementIdeas.length,

    mode:
      companyState.mode,

    goal:
      companyState.goal,

    latestMemory:
      companyMemory[0] ||
      null
  };
}

function buildStrategy() {

  const analysis =
    analyzeCompany();

  if (
    analysis.waitingHuman >
    0
  ) {

    return {

      id:
        makeId("strategy"),

      title:
        "人間承認待ち案件を保持し、他の業務を整理する",

      reason:
        "重要な操作は人間承認を待つ必要があるため、承認待ち案件を停止したまま他の業務を進めます。",

      objective:
        "Human Gate管理",

      goal:
        companyState.goal,

      mode:
        companyState.mode,

      createdAt:
        nowISO()
    };
  }

  if (
    companyState.mode ===
    "offense"
  ) {

    return {

      id:
        makeId("strategy"),

      title:
        analysis.latestMemory

          ? "過去の学習を踏まえ、新規事業候補を具体的に検証する"

          : "新規事業候補を探索し、検証優先順位を決める",

      reason:
        analysis.latestMemory

          ? "既存の学習結果を次の事業探索へつなげ、検証可能な候補を増やします。"

          : "会社目標達成のため、新しい事業機会を探索します。",

      objective:
        "事業探索",

      goal:
        companyState.goal,

      mode:
        companyState.mode,

      createdAt:
        nowISO()
    };
  }

  if (
    companyState.mode ===
    "defense"
  ) {

    return {

      id:
        makeId("strategy"),

      title:
        "会社運営上のリスクと改善候補を整理する",

      reason:
        "将来の問題を減らし、安定した運営基盤を作る必要があります。",

      objective:
        "安定運営",

      goal:
        companyState.goal,

      mode:
        companyState.mode,

      createdAt:
        nowISO()
    };
  }

  return {

    id:
      makeId("strategy"),

    title:
      analysis.latestMemory

        ? "過去の学習を踏まえ、改善候補を具体化する"

        : "既存業務の改善候補を整理し、優先順位を決める",

    reason:
      analysis.latestMemory

        ? "実行結果から得た知識を次の改善行動へつなげます。"

        : "会社目標に対して、現在の運営を改善する余地を確認します。",

    objective:
      "継続改善",

    goal:
      companyState.goal,

    mode:
      companyState.mode,

    createdAt:
      nowISO()
  };
}

// =====================================================
// Departments / Council
// =====================================================

function selectDepartments(
  strategy
) {

  const text =
    `${strategy.title} ${strategy.reason} ${strategy.objective}`;

  const departments =
    new Set();

  if (
    /事業|市場|顧客|商品|サービス|企画|検証/.test(
      text
    )
  ) {
    departments.add(
      "企画"
    );
  }

  if (
    /技術|実装|開発|自動化|改善|システム/.test(
      text
    )
  ) {
    departments.add(
      "技術"
    );
  }

  if (
    /収益|コスト|資金|価格|利益|事業/.test(
      text
    )
  ) {
    departments.add(
      "財務"
    );
  }

  if (
    /リスク|安全|法務|規約|契約|問題/.test(
      text
    )
  ) {
    departments.add(
      "リスク管理"
    );
  }

  if (
    departments.size ===
    0
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

function runCouncil(
  strategy
) {

  const departments =
    selectDepartments(
      strategy
    );

  const reviews =
    departments.map(
      (department) => {

        switch (
          department
        ) {

          case "企画":

            return {

              department,

              opinion:
                "顧客価値・事業性・検証方法を確認します。",

              recommendation:
                "小さな検証単位に分解します。",

              source:
                "内部企画部"
            };

          case "技術":

            return {

              department,

              opinion:
                "実装可能性・開発負荷・自動化可能性を確認します。",

              recommendation:
                "最小構成で実行できる形に分解します。",

              source:
                "内部技術部"
            };

          case "財務":

            return {

              department,

              opinion:
                "収益性・コスト・継続可能性を確認します。",

              recommendation:
                "大きな固定費を避けて検証します。",

              source:
                "内部財務部"
            };

          default:

            return {

              department:
                "リスク管理",

              opinion:
                "安全・法務・規約・運営リスクを確認します。",

              recommendation:
                "不可逆な行動を避け、小規模で確認します。",

              source:
                "内部リスク管理部"
            };
        }
      }
    );

  return {
    departments,
    reviews
  };
}

function makeDecision(
  strategy,
  council
) {

  const risk =
    council.departments.includes(
      "リスク管理"
    );

  const waitingHuman =
    strategy.objective ===
    "Human Gate管理";

  let decision =
    "小規模実行";

  if (
    waitingHuman
  ) {
    decision =
      "人間承認を待つ";
  }

  if (
    risk &&
    !waitingHuman
  ) {
    decision =
      "安全条件を守って小規模実行";
  }

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

function displayDecision(
  decision
) {

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
        decision
          .departments
          .join("・")
      )}
    </div>
  `;

  companyState.currentPlan =
    decision.title;

  companyState.nextAction =
    decision.nextAction;

  companyState.activeDepartments =
    decision.departments;

  saveCompanyState();

  renderActiveDepartments();
}

function createStrategyTask(
  strategy,
  decision
) {

  const exists =
    tasks.find(
      (task) =>
        task.title ===
          strategy.title &&
        task.status ===
          "pending"
    );

  if (exists) {
    return exists;
  }

  return addTask(
    strategy.title,
    "normal",
    "CEO Strategy",
    {
      strategyId:
        strategy.id,

      level:
        "strategy-task"
    }
  );
}

function saveStrategyHistory(
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
// Business Discovery
// =====================================================

function generateBusinessOpportunity() {

  const templates = {

    offense: [

      {
        name:
          "小規模AI業務改善サービス",

        problem:
          "中小規模の業務を自動化したい需要",

        test:
          "小さな業務を1つ自動化し、実用性を確認する"
      },

      {
        name:
          "AIを使った個人生産性支援",

        problem:
          "日常業務や情報整理の効率化",

        test:
          "1つの具体的な利用ケースに絞って検証する"
      },

      {
        name:
          "小規模ゲーム・インタラクティブサービス",

        problem:
          "短時間で楽しめるデジタル体験",

        test:
          "最小試作品を作り利用反応を確認する"
      }

    ],

    normal: [

      {
        name:
          "既存業務の自動化支援",

        problem:
          "繰り返し作業の非効率",

        test:
          "1つの作業を自動化して効果を確認する"
      },

      {
        name:
          "AI活用型情報整理サービス",

        problem:
          "大量情報の整理コスト",

        test:
          "特定用途に限定した整理機能を検証する"
      }

    ],

    defense: [

      {
        name:
          "運営リスク確認支援",

        problem:
          "小規模組織の運営上の見落とし",

        test:
          "リスク項目を整理し確認フローを試す"
      }

    ]
  };

  const pool =
    templates[
      companyState.mode
    ] ||
    templates.normal;

  const template =
    pool[
      Math.floor(
        Math.random() *
        pool.length
      )
    ];

  const opportunity = {

    id:
      makeId("business"),

    name:
      template.name,

    problem:
      template.problem,

    test:
      template.test,

    status:
      "仮説",

    priority:
      companyState.mode ===
      "offense"
        ? "高"
        : "通常",

    createdAt:
      nowISO()
  };

  businessOpportunities.unshift(
    opportunity
  );

  businessOpportunities =
    businessOpportunities.slice(
      0,
      30
    );

  save(
    STORAGE_KEYS.business,
    businessOpportunities
  );

  return opportunity;
}

function renderBusiness() {

  if (
    businessOpportunities.length ===
    0
  ) {

    businessList.innerHTML =
      `<div class="empty">
        まだ事業候補はありません。
      </div>`;

    return;
  }

  businessList.innerHTML =
    businessOpportunities
      .slice(0, 10)
      .map(
        (business) => `

          <div class="business-card">

            <h4>
              ${escapeHTML(
                business.name
              )}
            </h4>

            <div>
              <strong>
                解決対象：
              </strong>

              ${escapeHTML(
                business.problem
              )}
            </div>

            <div>
              <strong>
                検証方法：
              </strong>

              ${escapeHTML(
                business.test
              )}
            </div>

            <div class="score-line">
              優先度：
              ${escapeHTML(
                business.priority
              )}
              /
              状態：
              ${escapeHTML(
                business.status
              )}
            </div>

            <div class="meta">
              発見：
              ${escapeHTML(
                formatDate(
                  business.createdAt
                )
              )}
            </div>

            <div class="business-actions">

              <button
                onclick="
                  promoteBusiness(
                    '${business.id}'
                  )
                ">
                検証タスク化
              </button>

            </div>

          </div>

        `
      )
      .join("");
}

function promoteBusiness(
  businessId
) {

  const business =
    businessOpportunities.find(
      (item) =>
        item.id ===
        businessId
    );

  if (!business) {
    return;
  }

  const exists =
    tasks.find(
      (task) =>
        task.title ===
          business.test &&
        task.source ===
          "Business Discovery"
    );

  if (!exists) {

    addTask(
      business.test,

      business.priority ===
      "高"
        ? "high"
        : "normal",

      "Business Discovery"
    );

    business.status =
      "検証タスク化済み";

    save(
      STORAGE_KEYS.business,
      businessOpportunities
    );

    addEngineLog(
      "Business Discovery",
      `事業候補を検証タスクへ変換しました：${business.name}`
    );
  }

  renderBusiness();
  renderTasks();
}

// =====================================================
// Self Improvement
// =====================================================

function detectImprovementIdea() {

  const sameTitleCount =
    tasks.reduce(
      (countMap, task) => {

        countMap[
          task.title
        ] =
          (countMap[
            task.title
          ] || 0) +
          1;

        return countMap;
      },

      {}
    );

  const repeated =
    Object.entries(
      sameTitleCount
    ).find(
      ([, count]) =>
        count >= 2
    );

  if (!repeated) {
    return null;
  }

  const title =
    `「${repeated[0]}」の繰り返し処理を改善する`;

  const exists =
    improvementIdeas.find(
      (idea) =>
        idea.title ===
          title &&
        idea.status ===
          "提案"
    );

  if (exists) {
    return null;
  }

  const idea = {

    id:
      makeId("improve"),

    title,

    reason:
      "同種タスクが複数回存在するため、処理の統合または自動化余地があります。",

    action:
      "重複処理の原因を分析し、より効率的な実行方法を検討する。",

    status:
      "提案",

    createdAt:
      nowISO()
  };

  improvementIdeas.unshift(
    idea
  );

  save(
    STORAGE_KEYS.improvements,
    improvementIdeas
  );

  return idea;
}

function maybeCreateImprovement() {

  const idea =
    detectImprovementIdea();

  if (!idea) {
    return;
  }

  addEngineLog(
    "Self Improvement",
    `改善候補を発見しました：${idea.title}`
  );

  renderImprovements();
}

function renderImprovements() {

  if (
    improvementIdeas.length ===
    0
  ) {

    improvementList.innerHTML =
      `<div class="empty">
        まだ改善候補はありません。
      </div>`;

    return;
  }

  improvementList.innerHTML =
    improvementIdeas
      .slice(0, 10)
      .map(
        (idea) => `

          <div class="improvement-card">

            <h4>
              ${escapeHTML(
                idea.title
              )}
            </h4>

            <div>
              理由：
              ${escapeHTML(
                idea.reason
              )}
            </div>

            <div>
              次の行動：
              ${escapeHTML(
                idea.action
              )}
            </div>

            <div class="meta">
              状態：
              ${escapeHTML(
                idea.status
              )}
            </div>

          </div>

        `
      )
      .join("");
}

// =====================================================
// Founder Room / Council
// =====================================================

function founderDepartments(
  proposal
) {

  const set =
    new Set();

  if (
    /ゲーム|事業|商品|サービス|市場|顧客|企画|収益/.test(
      proposal
    )
  ) {

    set.add(
      "企画"
    );

    set.add(
      "技術"
    );

    set.add(
      "財務"
    );
  }

  if (
    /リスク|危険|法務|規約|安全|契約|個人情報/.test(
      proposal
    )
  ) {

    set.add(
      "リスク管理"
    );
  }

  if (
    set.size ===
    0
  ) {

    set.add(
      "企画"
    );

    set.add(
      "技術"
    );
  }

  return [
    ...set
  ];
}

function founderReview(
  department
) {

  const map = {

    "企画": {

      summary:
        "顧客価値・事業性・方向性を確認します。",

      recommendation:
        "小さく検証して反応を確認します。"
    },

    "技術": {

      summary:
        "実装可能性・技術課題を確認します。",

      recommendation:
        "最小構成から始めます。"
    },

    "財務": {

      summary:
        "収益源・コスト・継続性を確認します。",

      recommendation:
        "低コストで検証します。"
    },

    "リスク管理": {

      summary:
        "安全・法務・規約を確認します。",

      recommendation:
        "不可逆な操作を避けます。"
    }
  };

  const item =
    map[
      department
    ] ||
    map[
      "企画"
    ];

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

function founderDecision(
  item
) {

  item.decision =
    item.reviews.some(
      (review) =>
        review.department ===
        "リスク管理"
    )

      ? "リスク確認後に小規模検証"

      : "検討継続";

  item.nextAction =
    "市場検証と小規模実装を開始する";

  item.status =
    "CEO判断済み";
}

function createFounderTask(
  item
) {

  if (
    item.taskCreated
  ) {
    return;
  }

  addTask(
    item.nextAction,
    "normal",
    "Founder Room"
  );

  item.taskCreated =
    true;

  item.status =
    "判断からタスク作成済み";

  save(
    STORAGE_KEYS.founder,
    founderCases
  );
}

function processFounderPipeline() {

  const waiting =
    founderCases.find(
      (item) =>
        item.status ===
        "CEO協議待ち"
    );

  if (waiting) {

    waiting.departments =
      founderDepartments(
        waiting.proposal
      );

    waiting.status =
      "CEOが各部署へ協議中";

    save(
      STORAGE_KEYS.founder,
      founderCases
    );

    addEngineLog(
      "Founder協議",
      `Founder案件を${waiting.departments.join("・")}へ回しました。`
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

  if (
    reviewing
  ) {

    const department =
      reviewing.departments[
        reviewing.reviews.length
      ];

    reviewing.reviews.push(
      founderReview(
        department
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

  if (
    decisionReady
  ) {

    founderDecision(
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

  if (
    taskReady
  ) {

    createFounderTask(
      taskReady
    );

    addEngineLog(
      "タスク化",
      "Founder案件をTask Coreへ接続しました。"
    );

    renderFounderRoom();
    renderCouncil();
    renderTasks();

    return true;
  }

  return false;
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

          const reviews =
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

                    <div class="small">
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

          const decision =
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

              ${reviews}

              ${decision}

            </div>

          `;
        }
      )
      .join("");
}

// =====================================================
// Logs
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
      150
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
      .slice(0, 50)
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
// Active Departments
// =====================================================

function renderActiveDepartments() {

  const departments =
    companyState.activeDepartments ||
    BASE_DEPARTMENTS;

  activeDepartmentList.textContent =
    departments.join("・");
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

  companyState.cycleCount +=
    1;

  companyState.lastCycleAt =
    nowISO();

  companyState.currentFocus =
    "会社状態を分析中";

  saveCompanyState();
  renderCompanyState();

  addEngineLog(
    "サイクル開始",
    "CEOが会社全体の状態を確認しています。"
  );

  // -------------------------------------------------
  // Founder案件
  // -------------------------------------------------

  if (
    processFounderPipeline()
  ) {

    companyState.currentFocus =
      "Founder案件を処理中";

    saveCompanyState();
    renderCompanyState();

    cycleBusy =
      false;

    return;
  }

  // -------------------------------------------------
  // Human Gate
  // -------------------------------------------------

  const pendingGate =
    humanGates.find(
      (gate) =>
        gate.status ===
        "pending"
    );

  if (
    pendingGate
  ) {

    companyState.currentFocus =
      "人間承認待ち";

    companyState.waiting =
      true;

    companyState.nextAction =
      "Human Gateの承認を待つ";

    saveCompanyState();
    renderCompanyState();
    renderHumanGates();

    addEngineLog(
      "待機",
      "人間承認が必要な操作があるため、該当処理を停止しています。"
    );

    cycleBusy =
      false;

    return;
  }

  companyState.waiting =
    false;

  // -------------------------------------------------
  // 未評価タスク
  // -------------------------------------------------

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
          new Date(
            b.updatedAt
          ) -
          new Date(
            a.updatedAt
          )
      )[0];

  if (
    unevaluated
  ) {

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

    maybeCreateImprovement();

    addEngineLog(
      "結果評価",
      `実行結果を評価しました：${unevaluated.title}`
    );

    renderTasks();
    renderCompanyMemory();
    renderImprovements();

    companyState.currentFocus =
      "観測中";

    saveCompanyState();
    renderCompanyState();

    cycleBusy =
      false;

    return;
  }

  // -------------------------------------------------
  // 未完了タスク
  // -------------------------------------------------

  const pendingTask =
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

  if (
    pendingTask
  ) {

    companyState.currentFocus =
      "タスク実行中";

    saveCompanyState();
    renderCompanyState();

    addEngineLog(
      "タスク選択",
      `CEOが実行対象を選びました：${pendingTask.title}`
    );

    const result =
      await executeTask(
        pendingTask
      );

    if (!result) {

      companyState.currentFocus =
        "Executor待機";

      companyState.nextAction =
        "Python Local Executorの接続と実行結果を確認する";

      saveCompanyState();
      renderCompanyState();

      cycleBusy =
        false;

      return;
    }

    evaluateTask(
      pendingTask
    );

    recordMemoryFromTask(
      pendingTask
    );

    maybeCreateImprovement();

    addEngineLog(
      "実行完了",
      `タスクを実行しました：${pendingTask.title}`
    );

    addEngineLog(
      "結果評価",
      `CEO評価：${pendingTask.evaluation.level}`
    );

    addEngineLog(
      "会社記憶",
      "学習内容をCompany Memoryへ保存しました。"
    );

    renderTasks();
    renderCompanyMemory();
    renderImprovements();

    companyState.currentFocus =
      "観測中";

    companyState.nextAction =
      pendingTask
        .evaluation
        .nextAction;

    saveCompanyState();
    renderCompanyState();

    cycleBusy =
      false;

    return;
  }

  // -------------------------------------------------
  // 戦略立案
  // -------------------------------------------------

  companyState.currentFocus =
    "CEO戦略立案中";

  saveCompanyState();
  renderCompanyState();

  const analysis =
    analyzeCompany();

  addEngineLog(
    "状況分析",
    `未完了${analysis.pending}件 / 完了${analysis.completed}件 / Human Gate${analysis.waitingHuman}件 / Memory${analysis.memory}件を確認しました。`
  );

  // -------------------------------------------------
  // Business Discovery
  // -------------------------------------------------

  if (
    companyState.mode ===
      "offense" &&
    analysis.businesses <
      5
  ) {

    const opportunity =
      generateBusinessOpportunity();

    addEngineLog(
      "Business Discovery",
      `事業機会を発見しました：${opportunity.name}`
    );

    renderBusiness();
  }

  // -------------------------------------------------
  // Strategy
  // -------------------------------------------------

  const strategy =
    buildStrategy();

  addEngineLog(
    "戦略立案",
    `CEOが次の仕事を提案しました：${strategy.title}`
  );

  // -------------------------------------------------
  // Council
  // -------------------------------------------------

  companyState.currentFocus =
    "部署協議中";

  saveCompanyState();
  renderCompanyState();

  const council =
    runCouncil(
      strategy
    );

  addEngineLog(
    "部署協議",
    `必要部署：${council.departments.join("・")}`
  );

  // -------------------------------------------------
  // CEO Decision
  // -------------------------------------------------

  companyState.currentFocus =
    "CEO判断中";

  saveCompanyState();
  renderCompanyState();

  const decision =
    makeDecision(
      strategy,
      council
    );

  displayDecision(
    decision
  );

  saveStrategyHistory(
    strategy,
    decision
  );

  addEngineLog(
    "CEO戦略決定",
    `${decision.decision}：「${decision.title}」`
  );

  // -------------------------------------------------
  // Human wait
  // -------------------------------------------------

  if (
    decision.decision ===
    "人間承認を待つ"
  ) {

    companyState.waiting =
      true;

    companyState.currentFocus =
      "待機";

    companyState.nextAction =
      "人間承認または追加判断を待つ";

    saveCompanyState();

    addEngineLog(
      "待機",
      "今は実行せず、追加の人間判断を待ちます。"
    );

    cycleBusy =
      false;

    renderCompanyState();

    return;
  }

  // -------------------------------------------------
  // Task
  // -------------------------------------------------

  const task =
    createStrategyTask(
      strategy,
      decision
    );

  if (!task) {

    companyState.currentFocus =
      "観測中";

    saveCompanyState();

    cycleBusy =
      false;

    renderCompanyState();

    return;
  }

  addEngineLog(
    "自律タスク生成",
    `CEO判断からTask Coreへ登録しました：${task.title}`
  );

  renderTasks();

  // -------------------------------------------------
  // Real Executor
  // -------------------------------------------------

  companyState.currentFocus =
    "タスク実行中";

  saveCompanyState();
  renderCompanyState();

  const result =
    await executeTask(
      task
    );

  if (!result) {

    companyState.currentFocus =
      "Executor待機";

    companyState.waiting =
      true;

    companyState.nextAction =
      "Python Local Executorの接続と実行結果を確認する";

    saveCompanyState();

    cycleBusy =
      false;

    renderCompanyState();

    return;
  }

  // -------------------------------------------------
  // Evaluation
  // -------------------------------------------------

  evaluateTask(
    task
  );

  recordMemoryFromTask(
    task
  );

  maybeCreateImprovement();

  addEngineLog(
    "実行完了",
    `タスクを実行しました：${task.title}`
  );

  addEngineLog(
    "結果評価",
    `CEO評価：${task.evaluation.level}`
  );

  addEngineLog(
    "会社記憶",
    "今回の学習を次の判断へ引き継ぎます。"
  );

  // -------------------------------------------------
  // Finish
  // -------------------------------------------------

  companyState.currentFocus =
    "観測中";

  companyState.nextAction =
    task
      .evaluation
      .nextAction;

  companyState.waiting =
    false;

  saveCompanyState();

  engineSummary.textContent =
    "会社状態分析 → 戦略 → 部署協議 → CEO判断 → 実ローカル実行 → 評価 → 記憶まで完了しました。";

  renderTasks();
  renderCompanyMemory();
  renderImprovements();
  renderBusiness();
  renderHumanGates();
  renderCompanyState();

  cycleBusy =
    false;
}

// =====================================================
// Autonomous Operation
// =====================================================

function restartEngineTimer() {

  if (
    engineInterval
  ) {

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

      pace.seconds *
        1000
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

  if (
    engineInterval
  ) {

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
// Events
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

submitFounderButton.addEventListener(
  "click",
  () => {

    const proposal =
      founderInput.value.trim();

    if (!proposal) {
      return;
    }

    founderCases.push({

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
    });

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

    renderCompanyState();
  }
);

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

checkExecutorButton.addEventListener(
  "click",
  () => {

    checkExecutorConnection(
      true
    );
  }
);

discoverBusinessButton.addEventListener(
  "click",
  () => {

    const opportunity =
      generateBusinessOpportunity();

    addEngineLog(
      "Business Discovery",
      `事業候補を追加しました：${opportunity.name}`
    );

    renderBusiness();
  }
);

// =====================================================
// Initialize
// =====================================================

async function initialize() {

  systemStatus.textContent =
    "正常稼働";

  apiStatus.textContent =
    "使用しない";

  companyState.running =
    false;

  saveCompanyState();

  renderTasks();

  renderFounderRoom();

  renderCouncil();

  renderEngineLog();

  renderBusiness();

  renderHumanGates();

  renderImprovements();

  renderCompanyMemory();

  renderCompanyState();

  await checkExecutorConnection(
    false
  );
}

initialize();
