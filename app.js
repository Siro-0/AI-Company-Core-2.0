// =====================================================
// AI Company Core 2.0
// Company Core 4.0
// Research -> Product -> Sales -> Human Gate
// 外部AI APIなし
// =====================================================

const STORAGE_KEYS = {
  tasks: "ai_company_tasks_v5",
  founder: "ai_company_founder_v5",
  companyState: "ai_company_state_v5",
  engineLog: "ai_company_engine_log_v5",
  companyMemory: "ai_company_memory_v5",
  strategy: "ai_company_strategy_v5",
  business: "ai_company_business_v5",
  humanGate: "ai_company_human_gate_v5",
  improvements: "ai_company_improvements_v5",
  council: "ai_company_council_v5"
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
    const raw =
      localStorage.getItem(key);

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

  if (status === "waiting_human") {
    return "人間承認待ち";
  }

  if (status === "failed") {
    return "失敗";
  }

  return "未完了";
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

const councilCasesEl =
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

let councilCases =
  load(
    STORAGE_KEYS.council,
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
        null,

      pipelineStage:
        "idle"
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
      null,

    pipeline:
      task.pipeline ||
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
// Persistence
// =====================================================

function saveTasks() {
  save(
    STORAGE_KEYS.tasks,
    tasks
  );
}

function saveCompanyState() {
  save(
    STORAGE_KEYS.companyState,
    companyState
  );
}

function saveBusinesses() {
  save(
    STORAGE_KEYS.business,
    businessOpportunities
  );
}

function saveGates() {
  save(
    STORAGE_KEYS.humanGate,
    humanGates
  );
}

function saveMemory() {
  save(
    STORAGE_KEYS.companyMemory,
    companyMemory
  );
}

function saveImprovements() {
  save(
    STORAGE_KEYS.improvements,
    improvementIdeas
  );
}

function saveCouncil() {
  save(
    STORAGE_KEYS.council,
    councilCases
  );
}


// =====================================================
// Company State
// =====================================================

function getOperationalPace() {
  const hour =
    new Date().getHours();

  const pending =
    tasks.filter(
      (task) =>
        task.status ===
        "pending"
    ).length;

  let seconds =
    60;

  if (
    companyState.mode ===
    "offense"
  ) {
    seconds =
      45;
  }

  if (
    companyState.mode ===
    "defense"
  ) {
    seconds =
      90;
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

  systemStatus.textContent =
    "正常稼働";

  apiStatus.textContent =
    "使用しない";

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


// =====================================================
// Logs
// =====================================================

function addEngineLog(
  source,
  message
) {
  engineLogs.unshift({
    id:
      makeId("log"),

    source,

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

  renderEngineLogs();
}

function renderEngineLogs() {
  if (
    engineLogs.length ===
    0
  ) {
    engineLog.textContent =
      "まだサイクルは実行されていません。";

    return;
  }

  engineLog.innerHTML =
    engineLogs
      .slice(
        0,
        40
      )
      .map(
        (item) =>
          `<div class="log-item">
             <strong>${escapeHTML(
               item.source
             )}</strong>
             <span>${escapeHTML(
               item.message
             )}</span>
             <small>${escapeHTML(
               formatDate(
                 item.createdAt
               )
             )}</small>
           </div>`
      )
      .join("");
}


// =====================================================
// Executor
// =====================================================

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
        3000
      );

    const response =
      await fetch(
        `${LOCAL_EXECUTOR_URL}/health`,
        {
          method:
            "GET",

          cache:
            "no-store",

          signal:
            controller.signal
        }
      );

    clearTimeout(
      timeout
    );

    if (
      !response.ok
    ) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    if (
      !data.ok
    ) {
      throw new Error(
        "Executor returned an invalid response."
      );
    }

    setExecutorStatus(
      true,
      showLog
        ? "Python Local Executorへ接続できました。"
        : ""
    );

    if (
      Array.isArray(
        data.capabilities
      )
    ) {
      companyState.executorCapabilities =
        data.capabilities;

      saveCompanyState();
    }

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

async function executeLocalTask(
  task
) {
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
            JSON.stringify({
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
                  task.parentTaskId,

                pipeline:
                  task.pipeline || null
              }
            })
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        `Executor HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    if (
      !data.ok
    ) {
      throw new Error(
        data.error ||
        "Executor failed."
      );
    }

    return data;

  } catch (error) {

    addEngineLog(
      "Executor待機",
      `Local Executor実行に失敗しました：${error.message}`
    );

    return null;
  }
}


// =====================================================
// Task Core
// =====================================================

function findTask(
  taskId
) {
  return tasks.find(
    (task) =>
      task.id ===
      taskId
  );
}

function sortTasks() {
  tasks.sort(
    (a, b) => {

      const priorityDiff =
        (
          PRIORITY_ORDER[
            a.priority
          ] || 2
        ) -
        (
          PRIORITY_ORDER[
            b.priority
          ] || 2
        );

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
        (
          statusRank[
            a.status
          ] || 1
        ) -
        (
          statusRank[
            b.status
          ] || 1
        );

      if (
        statusDiff !== 0
      ) {
        return statusDiff;
      }

      return (
        new Date(
          b.updatedAt
        ) -
        new Date(
          a.updatedAt
        )
      );
    }
  );
}

function addTask(
  title,
  priority = "normal",
  source = "Task Core",
  metadata = {}
) {
  const cleanTitle =
    String(
      title || ""
    ).trim();

  if (
    !cleanTitle
  ) {
    return null;
  }

  const task = normalizeTask({
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
      metadata.strategyId ||
      null,

    parentTaskId:
      metadata.parentTaskId ||
      null,

    level:
      metadata.level ||
      "task",

    retryCount:
      0,

    requiresHuman:
      false,

    humanGateId:
      null,

    localExecution:
      null,

    pipeline:
      metadata.pipeline ||
      null
  });

  tasks.unshift(
    task
  );

  saveTasks();
  renderTasks();

  addEngineLog(
    "Task Core",
    `タスクを登録しました：「${cleanTitle}」`
  );

  if (
    detectHumanGate(
      task
    )
  ) {
    createHumanGate(
      task
    );
  }

  return task;
}

function editTask(
  taskId
) {
  const task =
    findTask(
      taskId
    );

  if (!task) {
    return;
  }

  const next =
    prompt(
      "新しいタスク名",
      task.title
    );

  if (
    !next ||
    !next.trim()
  ) {
    return;
  }

  task.title =
    next.trim();

  task.updatedAt =
    nowISO();

  saveTasks();
  renderTasks();

  addEngineLog(
    "Task Core",
    `タスクを編集しました：「${task.title}」`
  );
}

function deleteTask(
  taskId
) {
  const task =
    findTask(
      taskId
    );

  if (!task) {
    return;
  }

  if (
    !confirm(
      `「${task.title}」を削除しますか？`
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

  humanGates =
    humanGates.filter(
      (gate) =>
        gate.taskId !==
        taskId
    );

  saveTasks();
  saveGates();

  renderTasks();
  renderHumanGates();
}

function returnTask(
  taskId
) {
  const task =
    findTask(
      taskId
    );

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

  addEngineLog(
    "Task Core",
    `タスクを未完了へ戻しました：「${task.title}」`
  );
}

function renderTasks() {
  sortTasks();

  taskCount.textContent =
    `登録数：${tasks.length}件`;

  if (
    tasks.length ===
    0
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

          const localHTML =
            task.localExecution
              ? `
                <div class="task-meta">
                  実処理：
                  ${escapeHTML(
                    task.localExecution.action ||
                    "local"
                  )}
                  <br>
                  出力：
                  ${escapeHTML(
                    task.localExecution.output_path ||
                    "なし"
                  )}
                </div>
              `
              : "";

          const pipelineHTML =
            task.pipeline
              ? `
                <div class="task-meta">
                  Pipeline：
                  ${escapeHTML(
                    task.pipeline.stage ||
                    "unknown"
                  )}
                  ${
                    task.pipeline.businessId
                      ? " / Business ID: " +
                        escapeHTML(
                          task.pipeline.businessId
                        )
                      : ""
                  }
                </div>
              `
              : "";

          return `
            <article class="task-card">
              <div class="task-title">
                ${escapeHTML(
                  task.title
                )}
              </div>

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
                ${escapeHTML(
                  statusLabel(
                    task.status
                  )
                )}
              </div>

              <div class="task-meta">
                レベル：
                ${escapeHTML(
                  task.level
                )}
              </div>

              <div class="task-meta">
                実行回数：
                ${escapeHTML(
                  task.runCount
                )}回
              </div>

              <div class="task-meta">
                再試行：
                ${escapeHTML(
                  task.retryCount
                )}回
              </div>

              <div class="task-meta">
                最終実行：
                ${escapeHTML(
                  formatDate(
                    task.lastRunAt
                  )
                )}
              </div>

              ${
                task.result
                  ? `
                    <div class="task-meta">
                      実行結果：
                      ${escapeHTML(
                        task.result
                      )}
                    </div>
                  `
                  : ""
              }

              ${
                task.executor
                  ? `
                    <div class="task-meta">
                      実行方式：
                      ${escapeHTML(
                        task.executor
                      )}
                    </div>
                  `
                  : ""
              }

              <div class="task-meta">
                起点：
                ${escapeHTML(
                  task.source
                )}
              </div>

              ${pipelineHTML}
              ${localHTML}
              ${evaluationHTML}

              <div class="button-row">

                ${
                  task.status ===
                  "pending" ||
                  task.status ===
                  "failed"
                    ? `
                      <button
                        onclick="window.runTaskById('${task.id}')"
                      >
                        実行
                      </button>
                    `
                    : ""
                }

                ${
                  task.status ===
                  "completed"
                    ? `
                      <button
                        onclick="window.returnTaskById('${task.id}')"
                      >
                        未完了へ
                      </button>
                    `
                    : ""
                }

                <button
                  onclick="window.editTaskById('${task.id}')"
                >
                  編集
                </button>

                <button
                  onclick="window.deleteTaskById('${task.id}')"
                >
                  削除
                </button>

              </div>
            </article>
          `;
        }
      )
      .join("");
}

async function runSingleTask(
  taskId
) {
  const task =
    findTask(
      taskId
    );

  if (!task) {
    return;
  }

  if (
    task.status ===
    "waiting_human"
  ) {
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

  task.status =
    "running";

  task.updatedAt =
    nowISO();

  saveTasks();
  renderTasks();

  const result =
    await executeLocalTask(
      task
    );

  if (!result) {

    task.status =
      "failed";

    task.retryCount =
      Number(
        task.retryCount || 0
      ) + 1;

    task.updatedAt =
      nowISO();

    saveTasks();
    renderTasks();

    return;
  }

  task.status =
    "completed";

  task.runCount =
    Number(
      task.runCount || 0
    ) + 1;

  task.lastRunAt =
    nowISO();

  task.updatedAt =
    nowISO();

  task.executor =
    "Python Local Executor";

  task.result =
    result.result ||
    "処理完了";

  task.localExecution =
    result;

  saveTasks();

  evaluateTask(
    task
  );

  recordMemoryFromTask(
    task
  );

  maybeCreateImprovement();

  await advancePipelineFromTask(
    task
  );

  saveTasks();

  renderTasks();
  renderBusiness();
  renderCompanyMemory();
  renderImprovements();
  renderHumanGates();
  renderCompanyState();
}


// =====================================================
// Human Gate
// =====================================================

function detectHumanGate(
  task
) {
  const text =
    String(
      task.title
    )
      .toLowerCase();

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

    status:
      "pending",

    reason:
      "外部公開・契約・支払いなど、人間の承認が必要な操作です。",

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

  saveGates();
  saveTasks();

  addEngineLog(
    "Human Gate",
    `人間承認が必要なタスクを停止しました：「${task.title}」`
  );

  renderHumanGates();
  renderTasks();

  return gate;
}

function approveHumanGate(
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

  gate.status =
    "approved";

  gate.resolvedAt =
    nowISO();

  if (task) {

    task.status =
      "completed";

    task.requiresHuman =
      false;

    task.updatedAt =
      nowISO();

    task.evaluation = {
      level:
        "人間承認済み",

      summary:
        "Human Gateで人間による承認を取得しました。ただし外部公開・販売そのものはまだ実行していません。",

      lesson:
        `「${task.title}」について人間承認を取得できた。`,

      nextAction:
        "外部公開Gatewayまたは販売チャネルとの接続を行う。",

      evaluatedAt:
        nowISO()
    };
  }

  saveGates();
  saveTasks();

  addEngineLog(
    "Human Gate",
    `人間承認を取得しました：「${gate.taskTitle}」`
  );

  companyState.currentFocus =
    "承認取得済み・外部Gateway待機";

  companyState.nextAction =
    "外部公開Gatewayまたは販売チャネルを接続する";

  saveCompanyState();

  renderHumanGates();
  renderTasks();
  renderCompanyState();
}

function rejectHumanGate(
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

  gate.status =
    "rejected";

  gate.resolvedAt =
    nowISO();

  if (task) {

    task.status =
      "failed";

    task.requiresHuman =
      false;

    task.updatedAt =
      nowISO();

    task.evaluation = {
      level:
        "人間判断により停止",

      summary:
        "Human Gateで公開・実行を承認しませんでした。",

      lesson:
        `「${task.title}」は承認されなかった。`,

      nextAction:
        "条件を見直して再評価する。",

      evaluatedAt:
        nowISO()
    };
  }

  saveGates();
  saveTasks();

  addEngineLog(
    "Human Gate",
    `人間承認が拒否されました：「${gate.taskTitle}」`
  );

  renderHumanGates();
  renderTasks();
}

function renderHumanGates() {
  const pending =
    humanGates.filter(
      (gate) =>
        gate.status ===
        "pending"
    );

  if (
    humanGates.length ===
    0
  ) {
    humanGateList.textContent =
      "現在、承認待ちはありません。";

    return;
  }

  humanGateList.innerHTML =
    humanGates
      .slice(
        0,
        30
      )
      .map(
        (gate) =>
          `
            <article class="gate-card">
              <strong>
                ${escapeHTML(
                  gate.taskTitle
                )}
              </strong>

              <div class="task-meta">
                状態：
                ${escapeHTML(
                  gate.status
                )}
              </div>

              <div class="task-meta">
                理由：
                ${escapeHTML(
                  gate.reason
                )}
              </div>

              <div class="button-row">
                ${
                  gate.status ===
                  "pending"
                    ? `
                      <button
                        onclick="window.approveGateById('${gate.id}')"
                      >
                        承認
                      </button>

                      <button
                        onclick="window.rejectGateById('${gate.id}')"
                      >
                        拒否
                      </button>
                    `
                    : ""
                }
              </div>
            </article>
          `
      )
      .join("");

  if (
    pending.length >
    0
  ) {
    companyState.waiting =
      true;
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

  const action =
    task.localExecution?.action ||
    "";

  let level =
    "実行成功・成果確認前";

  let summary =
    "Python Local Executorで実処理を実行し、ローカル成果物または処理結果を取得しました。ただし事業上の成功までは確認していません。";

  let nextAction =
    "生成された成果物・実データを確認し、事業上の価値または改善効果を再評価する。";

  if (
    action ===
    "research_brief"
  ) {
    level =
      "調査設計成功・外部データ確認前";

    summary =
      "市場調査の設計とローカル証跡の生成に成功しました。外部市場データ自体はまだ取得していません。";

    nextAction =
      "外部市場情報・競合・顧客課題を取得して仮説を更新する。";
  }

  if (
    action ===
    "product_prototype"
  ) {
    level =
      "商品構成成功・顧客検証前";

    summary =
      "商品仕様と最小プロトタイプ構成を生成しました。実利用による価値確認はまだです。";

    nextAction =
      "最小プロトタイプを検証して顧客価値を確認する。";
  }

  if (
    action ===
    "sales_package_generation"
  ) {
    level =
      "販売準備成功・事業成果確認前";

    summary =
      "販売準備パッケージを生成しました。販売実績・顧客購入・収益はまだ確認していません。";

    nextAction =
      "販売パッケージを評価し、人間承認を経て公開可否を判断する。";
  }

  if (
    action ===
    "sales_evaluation"
  ) {
    const ready =
      Boolean(
        task.localExecution
          ?.metrics
          ?.ready_for_human_gate
      );

    level =
      ready
        ? "販売構成評価完了・公開承認待ち"
        : "販売構成に不足あり";

    summary =
      ready
        ? "販売準備パッケージの必要構成を確認しました。ただし販売成功や顧客需要は未確認です。"
        : "販売準備パッケージに不足があります。";

    nextAction =
      ready
        ? "Human Gateで公開承認を確認する。"
        : "不足ファイルを生成して再評価する。";
  }

  task.evaluation = {
    level,

    summary,

    lesson:
      `「${task.title}」を実行単位として処理できた。`,

    nextAction,

    evaluatedAt:
      nowISO()
  };

  companyState.lastEvaluation =
    task.evaluation;

  saveTasks();
  saveCompanyState();
}

function recordMemoryFromTask(
  task
) {
  if (
    !task ||
    !task.evaluation
  ) {
    return;
  }

  const memoryItem = {
    id:
      makeId("memory"),

    taskId:
      task.id,

    title:
      task.title,

    lesson:
      task.evaluation.lesson,

    result:
      task.result,

    evaluation:
      task.evaluation.level,

    nextAction:
      task.evaluation.nextAction,

    createdAt:
      nowISO()
  };

  companyMemory.unshift(
    memoryItem
  );

  companyMemory =
    companyMemory.slice(
      0,
      100
    );

  saveMemory();
}

function renderCompanyMemory() {
  if (
    companyMemory.length ===
    0
  ) {
    companyMemoryEl.textContent =
      "まだ学習記録はありません。";

    return;
  }

  companyMemoryEl.innerHTML =
    companyMemory
      .slice(
        0,
        30
      )
      .map(
        (item) =>
          `
            <div class="memory-item">
              <strong>
                ${escapeHTML(
                  item.title
                )}
              </strong>

              <div>
                評価：
                ${escapeHTML(
                  item.evaluation
                )}
              </div>

              <div>
                学習：
                ${escapeHTML(
                  item.lesson
                )}
              </div>

              <div>
                次の行動：
                ${escapeHTML(
                  item.nextAction
                )}
              </div>

              <small>
                ${escapeHTML(
                  formatDate(
                    item.createdAt
                  )
                )}
              </small>
            </div>
          `
      )
      .join("");
}


// =====================================================
// Self Improvement
// =====================================================

function maybeCreateImprovement() {
  const failed =
    tasks.filter(
      (task) =>
        task.status ===
        "failed"
    );

  if (
    failed.length >
    0
  ) {

    const latest =
      failed[0];

    const exists =
      improvementIdeas.some(
        (idea) =>
          idea.sourceTaskId ===
          latest.id
      );

    if (!exists) {

      improvementIdeas.unshift({
        id:
          makeId("improve"),

        sourceTaskId:
          latest.id,

        title:
          "失敗タスクの再設計",

        description:
          `「${latest.title}」の再試行条件と失敗原因を確認する。`,

        status:
          "候補",

        createdAt:
          nowISO()
      });
    }
  }

  const titleMap =
    new Map();

  for (
    const task of tasks
  ) {

    const count =
      titleMap.get(
        task.title
      ) || 0;

    titleMap.set(
      task.title,
      count + 1
    );
  }

  for (
    const [
      title,
      count
    ] of titleMap
  ) {

    if (
      count >= 2
    ) {

      const exists =
        improvementIdeas.some(
          (idea) =>
            idea.title ===
            "重複タスク削減" &&
            idea.target ===
            title
        );

      if (!exists) {

        improvementIdeas.unshift({
          id:
            makeId("improve"),

          title:
            "重複タスク削減",

          target:
            title,

          description:
            `「${title}」が複数登録されています。統合条件を検討します。`,

          status:
            "候補",

          createdAt:
            nowISO()
        });
      }
    }
  }

  improvementIdeas =
    improvementIdeas.slice(
      0,
      50
    );

  saveImprovements();
}

function renderImprovements() {
  if (
    improvementIdeas.length ===
    0
  ) {
    improvementList.textContent =
      "まだ改善候補はありません。";

    return;
  }

  improvementList.innerHTML =
    improvementIdeas
      .slice(
        0,
        30
      )
      .map(
        (idea) =>
          `
            <div class="improvement-item">
              <strong>
                ${escapeHTML(
                  idea.title
                )}
              </strong>

              <div>
                ${escapeHTML(
                  idea.description
                )}
              </div>

              <small>
                状態：
                ${escapeHTML(
                  idea.status
                )}
              </small>
            </div>
          `
      )
      .join("");
}


// =====================================================
// Business Discovery
// =====================================================

function createBusinessIdea(
  name,
  problem,
  customer,
  mode
) {
  const item = {
    id:
      makeId("business"),

    name,

    problem,

    customer,

    mode,

    status:
      "discovered",

    stage:
      "discovered",

    createdAt:
      nowISO(),

    researchTaskId:
      null,

    productTaskId:
      null,

    salesTaskId:
      null,

    evaluationTaskId:
      null,

    humanGateTaskId:
      null
  };

  businessOpportunities.unshift(
    item
  );

  saveBusinesses();

  return item;
}

function discoverBusiness(
  automatic = false
) {
  const mode =
    companyState.mode;

  const ideas =
    mode ===
    "offense"
      ? [
          {
            name:
              "中小企業向けAI業務改善パック",

            problem:
              "定型業務や情報整理に時間がかかる",

            customer:
              "小規模事業者"
          },

          {
            name:
              "個人事業向け業務自動化ツール",

            problem:
              "少人数運営で事務作業が負担になる",

            customer:
              "個人事業主"
          }
        ]
      : mode ===
        "defense"
      ? [
          {
            name:
              "既存Webサービス改善支援",

            problem:
              "既存サービスの運用負荷が高い",

            customer:
              "小規模Web事業者"
          }
        ]
      : [
          {
            name:
              "AI業務整理アシスタント",

            problem:
              "日々のタスク整理と優先順位づけに時間がかかる",

            customer:
              "個人・小規模チーム"
          },

          {
            name:
              "小規模事業向け調査レポート生成サービス",

            problem:
              "市場調査や競合調査に時間がかかる",

            customer:
              "小規模事業者"
          }
        ];

  const selected =
    ideas[
      Math.floor(
        Math.random() *
        ideas.length
      )
    ];

  const business =
    createBusinessIdea(
      selected.name,
      selected.problem,
      selected.customer,
      mode
    );

  addEngineLog(
    "Business Discovery",
    `事業候補を発見しました：「${business.name}」`
  );

  if (!automatic) {
    companyState.currentFocus =
      "事業機会を探索中";

    companyState.nextAction =
      "発見した候補の市場調査を開始する";

    saveCompanyState();
  }

  renderBusiness();

  return business;
}

function getNextPipelineBusiness() {
  return businessOpportunities.find(
    (business) =>
      business.stage ===
      "discovered"
  );
}

function renderBusiness() {
  if (
    businessOpportunities.length ===
    0
  ) {
    businessList.textContent =
      "まだ事業候補はありません。";

    return;
  }

  businessList.innerHTML =
    businessOpportunities
      .slice(
        0,
        30
      )
      .map(
        (business) =>
          `
            <article class="business-card">
              <strong>
                ${escapeHTML(
                  business.name
                )}
              </strong>

              <div>
                顧客：
                ${escapeHTML(
                  business.customer
                )}
              </div>

              <div>
                課題：
                ${escapeHTML(
                  business.problem
                )}
              </div>

              <div>
                状態：
                ${escapeHTML(
                  business.status
                )}
              </div>

              <div>
                Pipeline：
                ${escapeHTML(
                  business.stage
                )}
              </div>

              <div class="task-meta">
                発見日時：
                ${escapeHTML(
                  formatDate(
                    business.createdAt
                  )
                )}
              </div>
            </article>
          `
      )
      .join("");
}


// =====================================================
// Pipeline
// =====================================================

function updateBusinessStage(
  businessId,
  stage,
  status = null
) {
  const business =
    businessOpportunities.find(
      (item) =>
        item.id ===
        businessId
    );

  if (!business) {
    return null;
  }

  business.stage =
    stage;

  if (status) {
    business.status =
      status;
  }

  business.updatedAt =
    nowISO();

  saveBusinesses();
  renderBusiness();

  return business;
}

function createResearchTask(
  business
) {
  const task =
    addTask(
      `市場調査:${business.name}`,
      "normal",
      "Business Discovery",
      {
        level:
          "research",

        pipeline: {
          type:
            "business_pipeline",

          stage:
            "research",

          businessId:
            business.id
        }
      }
    );

  if (!task) {
    return null;
  }

  business.researchTaskId =
    task.id;

  business.stage =
    "research";

  business.status =
    "researching";

  saveBusinesses();

  return task;
}

function createProductTask(
  business,
  parentTask
) {
  const task =
    addTask(
      `商品作成:${business.name}`,
      "normal",
      "CEO Strategy",
      {
        level:
          "product",

        parentTaskId:
          parentTask.id,

        pipeline: {
          type:
            "business_pipeline",

          stage:
            "product",

          businessId:
            business.id
        }
      }
    );

  if (!task) {
    return null;
  }

  business.productTaskId =
    task.id;

  business.stage =
    "product";

  business.status =
    "building";

  saveBusinesses();

  return task;
}

function createSalesTask(
  business,
  parentTask
) {
  const task =
    addTask(
      `販売準備:${business.name}`,
      "normal",
      "CEO Strategy",
      {
        level:
          "sales",

        parentTaskId:
          parentTask.id,

        pipeline: {
          type:
            "business_pipeline",

          stage:
            "sales",

          businessId:
            business.id
        }
      }
    );

  if (!task) {
    return null;
  }

  business.salesTaskId =
    task.id;

  business.stage =
    "sales";

  business.status =
    "sales_preparation";

  saveBusinesses();

  return task;
}

function createSalesEvaluationTask(
  business,
  parentTask
) {
  const task =
    addTask(
      `販売評価:${business.name}`,
      "normal",
      "CEO Strategy",
      {
        level:
          "sales_evaluation",

        parentTaskId:
          parentTask.id,

        pipeline: {
          type:
            "business_pipeline",

          stage:
            "sales_evaluation",

          businessId:
            business.id
        }
      }
    );

  if (!task) {
    return null;
  }

  business.evaluationTaskId =
    task.id;

  business.stage =
    "sales_evaluation";

  business.status =
    "evaluating";

  saveBusinesses();

  return task;
}

function createPublishGateTask(
  business,
  parentTask
) {
  const task =
    addTask(
      `公開承認:${business.name}`,
      "high",
      "CEO Strategy",
      {
        level:
          "human_gate",

        parentTaskId:
          parentTask.id,

        pipeline: {
          type:
            "business_pipeline",

          stage:
            "human_gate",

          businessId:
            business.id
        }
      }
    );

  if (!task) {
    return null;
  }

  business.humanGateTaskId =
    task.id;

  business.stage =
    "human_gate";

  business.status =
    "human_approval";

  saveBusinesses();

  return task;
}

async function advancePipelineFromTask(
  task
) {
  if (
    !task.pipeline ||
    task.pipeline.type !==
      "business_pipeline"
  ) {
    return;
  }

  const business =
    businessOpportunities.find(
      (item) =>
        item.id ===
        task.pipeline.businessId
    );

  if (!business) {
    return;
  }

  const stage =
    task.pipeline.stage;

  if (
    stage ===
    "research"
  ) {

    if (
      !business.productTaskId
    ) {
      const next =
        createProductTask(
          business,
          task
        );

      if (next) {
        addEngineLog(
          "Pipeline",
          `市場調査完了 → 商品作成へ：「${business.name}」`
        );
      }
    }

    return;
  }

  if (
    stage ===
    "product"
  ) {

    if (
      !business.salesTaskId
    ) {
      const next =
        createSalesTask(
          business,
          task
        );

      if (next) {
        addEngineLog(
          "Pipeline",
          `商品作成完了 → 販売準備へ：「${business.name}」`
        );
      }
    }

    return;
  }

  if (
    stage ===
    "sales"
  ) {

    if (
      !business.evaluationTaskId
    ) {
      const next =
        createSalesEvaluationTask(
          business,
          task
        );

      if (next) {
        addEngineLog(
          "Pipeline",
          `販売準備完了 → 販売評価へ：「${business.name}」`
        );
      }
    }

    return;
  }

  if (
    stage ===
    "sales_evaluation"
  ) {

    const ready =
      Boolean(
        task.localExecution
          ?.metrics
          ?.ready_for_human_gate
      );

    if (
      ready &&
      !business.humanGateTaskId
    ) {

      const next =
        createPublishGateTask(
          business,
          task
        );

      if (next) {

        createHumanGate(
          next
        );

        addEngineLog(
          "Pipeline",
          `販売評価完了 → Human Gateへ：「${business.name}」`
        );
      }
    }

    return;
  }

  if (
    stage ===
    "human_gate"
  ) {

    updateBusinessStage(
      business.id,
      "approved_waiting_external_gateway",
      "承認済み・外部Gateway待ち"
    );

    addEngineLog(
      "Pipeline",
      `Human Gate通過。外部公開Gateway待ち：「${business.name}」`
    );
  }
}

async function runBusinessPipeline() {
  let business =
    getNextPipelineBusiness();

  if (!business) {

    business =
      discoverBusiness(
        true
      );
  }

  if (!business) {
    return;
  }

  if (
    business.stage ===
    "discovered" &&
    !business.researchTaskId
  ) {

    const task =
      createResearchTask(
        business
      );

    if (task) {

      companyState.currentFocus =
        "市場調査";

      companyState.currentPlan =
        `「${business.name}」の市場調査`;

      companyState.nextAction =
        "市場調査結果から商品構成を決定する";

      saveCompanyState();

      addEngineLog(
        "CEO",
        `市場調査タスクを生成しました：「${business.name}」`
      );
    }

    return;
  }
}


// =====================================================
// Strategy
// =====================================================

function analyzeCompanySituation() {
  const pending =
    tasks.filter(
      (task) =>
        task.status ===
        "pending"
    ).length;

  const running =
    tasks.filter(
      (task) =>
        task.status ===
        "running"
    ).length;

  const waitingHuman =
    humanGates.filter(
      (gate) =>
        gate.status ===
        "pending"
    ).length;

  const businessCount =
    businessOpportunities.length;

  return {
    pending,
    running,
    waitingHuman,
    businessCount
  };
}

function chooseActiveDepartments(
  strategy
) {
  const departments =
    new Set(
      BASE_DEPARTMENTS
    );

  if (
    strategy.includes(
      "市場"
    ) ||
    strategy.includes(
      "顧客"
    ) ||
    strategy.includes(
      "商品"
    ) ||
    strategy.includes(
      "事業"
    )
  ) {
    departments.add(
      "企画"
    );
  }

  if (
    strategy.includes(
      "商品"
    ) ||
    strategy.includes(
      "実装"
    ) ||
    strategy.includes(
      "技術"
    )
  ) {
    departments.add(
      "技術"
    );
  }

  if (
    strategy.includes(
      "販売"
    ) ||
    strategy.includes(
      "収益"
    ) ||
    strategy.includes(
      "価格"
    )
  ) {
    departments.add(
      "財務"
    );
  }

  if (
    strategy.includes(
      "公開"
    ) ||
    strategy.includes(
      "契約"
    ) ||
    strategy.includes(
      "リスク"
    )
  ) {
    departments.add(
      "リスク管理"
    );
  }

  return [
    ...departments
  ];
}

function makeStrategy(
  situation
) {
  if (
    situation.waitingHuman >
    0
  ) {
    return {
      id:
        makeId("strategy"),

      title:
        "Human Gate管理",

      reason:
        "人間承認が必要な処理を先に停止・確認する。",

      objective:
        "Human Gate管理"
    };
  }

  if (
    situation.pending >
    0
  ) {
    return {
      id:
        makeId("strategy"),

      title:
        "既存タスクを実行して結果を取得",

      reason:
        "すでに登録された仕事を処理し、結果を次の判断へ戻す。",

      objective:
        "Execution"
    };
  }

  if (
    businessOpportunities.length ===
    0
  ) {
    return {
      id:
        makeId("strategy"),

      title:
        "新しい事業候補を探索",

      reason:
        "会社の現在目標に対して新しい収益機会を発見する。",

      objective:
        "Discovery"
    };
  }

  const nextBusiness =
    getNextPipelineBusiness();

  if (
    nextBusiness
  ) {
    return {
      id:
        makeId("strategy"),

      title:
        `事業候補「${nextBusiness.name}」を検証`,

      reason:
        "発見済みの候補について市場調査から段階的に検証する。",

      objective:
        "Business Pipeline"
    };
  }

  return {
    id:
      makeId("strategy"),

    title:
      "既存事業候補の改善",

    reason:
      "これまでの結果を確認し、次の改善候補を選ぶ。",

    objective:
      "Improvement"
  };
}

function makeCouncil(
  strategy
) {
  const departments =
    chooseActiveDepartments(
      strategy.title
    );

  const reviews =
    departments.map(
      (
        department
      ) => {

        const reviewMap = {
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
              "収益性・コスト・継続性を確認します。",

            recommendation:
              "低コストで検証します。"
          },

          "リスク管理": {
            summary:
              "安全・法務・規約・運営リスクを確認します。",

            recommendation:
              "不可逆な操作を避けます。"
          }
        };

        const item =
          reviewMap[
            department
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
    );

  const council = {
    id:
      makeId("council"),

    strategyId:
      strategy.id,

    title:
      strategy.title,

    departments,

    reviews,

    createdAt:
      nowISO()
  };

  councilCases.unshift(
    council
  );

  councilCases =
    councilCases.slice(
      0,
      50
    );

  saveCouncil();

  return council;
}

function makeDecision(
  strategy,
  council
) {
  let decision =
    "小規模実行";

  if (
    strategy.objective ===
    "Human Gate管理"
  ) {
    decision =
      "人間承認を待つ";
  }

  const riskIncluded =
    council.departments.includes(
      "リスク管理"
    );

  if (
    riskIncluded &&
    strategy.objective !==
      "Human Gate管理"
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
        decision.departments.join(
          "・"
        )
      )}
    </div>
  `;

  companyState.currentPlan =
    decision.title;

  companyState.nextAction =
    decision.nextAction;

  saveCompanyState();
}

function renderActiveDepartments() {
  activeDepartmentList.textContent =
    (
      companyState.activeDepartments ||
      BASE_DEPARTMENTS
    ).join(
      "・"
    );
}

function renderCouncil() {
  if (
    councilCases.length ===
    0
  ) {
　　councilCasesEl.textContent =
 　　 "まだ協議案件はありません。";

    return;
  }

　　　councilCasesEl.innerHTML =
  　　　councilCases
      .slice(
        0,
        20
      )
      .map(
        (item) =>
          `
            <article class="council-card">
              <strong>
                ${escapeHTML(
                  item.title
                )}
              </strong>

              <div class="task-meta">
                協議部署：
                ${escapeHTML(
                  item.departments.join(
                    "・"
                  )
                )}
              </div>

              ${
                item.reviews
                  .map(
                    (review) =>
                      `
                        <div class="task-meta">
                          <strong>
                            ${escapeHTML(
                              review.department
                            )}
                          </strong>
                          ：
                          ${escapeHTML(
                            review.recommendation
                          )}
                        </div>
                      `
                  )
                  .join("")
              }
            </article>
          `
      )
      .join("");
}


// =====================================================
// Founder Room
// =====================================================

function founderDepartments(
  proposal
) {
  const set =
    new Set();

  if (
    /事業|商品|サービス|市場|顧客|企画|収益|販売/.test(
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
    /リスク|危険|安全|法務|規約|公開|契約/.test(
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
        "収益性・コスト・継続性を確認します。",

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
  const risk =
    item.reviews.some(
      (review) =>
        review.department ===
        "リスク管理"
    );

  item.decision =
    risk
      ? "リスク確認後に小規模検証"
      : "検討継続";

  item.nextAction =
    risk
      ? "リスク確認後に最小実装へ進む"
      : "市場検証と小規模実装を開始する";

  item.status =
    "協議完了";

  return item;
}

function renderFounderCases() {
  if (
    founderCases.length ===
    0
  ) {
    founderRecords.textContent =
      "まだ協議記録はありません。";

    return;
  }

  founderRecords.innerHTML =
    founderCases
      .slice(
        0,
        20
      )
      .map(
        (item) =>
          `
            <article class="record-card">
              <strong>
                ${escapeHTML(
                  item.proposal
                )}
              </strong>

              <div>
                状態：
                ${escapeHTML(
                  item.status
                )}
              </div>

              ${
                item.departments?.length
                  ? `
                    <div>
                      部署：
                      ${escapeHTML(
                        item.departments.join(
                          "・"
                        )
                      )}
                    </div>
                  `
                  : ""
              }

              ${
                item.reviews?.length
                  ? item.reviews
                      .map(
                        (review) =>
                          `
                            <div class="task-meta">
                              <strong>
                                ${escapeHTML(
                                  review.department
                                )}
                              </strong>
                              ：
                              ${escapeHTML(
                                review.recommendation
                              )}
                            </div>
                          `
                      )
                      .join("")
                  : ""
              }

              ${
                item.decision
                  ? `
                    <div class="evaluation-box">
                      CEO判断：
                      ${escapeHTML(
                        item.decision
                      )}
                      <br>
                      次の行動：
                      ${escapeHTML(
                        item.nextAction
                      )}
                    </div>
                  `
                  : ""
              }
            </article>
          `
      )
      .join("");
}

function processFounderProposal(
  proposal
) {
  const departments =
    founderDepartments(
      proposal
    );

  const reviews =
    departments.map(
      founderReview
    );

  const item =
    founderDecision({
      id:
        makeId("founder"),

      proposal,

      status:
        "CEO協議待ち",

      createdAt:
        nowISO(),

      departments,

      reviews,

      decision:
        null,

      nextAction:
        null,

      taskCreated:
        false
    });

  founderCases.unshift(
    item
  );

  save(
    STORAGE_KEYS.founder,
    founderCases
  );

  addEngineLog(
    "Founder Room",
    `Founder提案を部署協議しました：「${proposal}」`
  );

  if (
    !item.taskCreated
  ) {

    const task =
      addTask(
        item.nextAction ||
          "市場検証と小規模実装を開始する",
        "normal",
        "Founder / Manual",
        {
          level:
            "task",

          pipeline:
            {
              type:
                "founder",

              stage:
                "founder_execution",

              founderId:
                item.id
            }
        }
      );

    if (task) {

      item.taskCreated =
        true;

      save(
        STORAGE_KEYS.founder,
        founderCases
      );
    }
  }

  renderFounderCases();
}


// =====================================================
// Company Cycle
// =====================================================

async function evaluateUnevaluatedTask() {
  const task =
    tasks.find(
      (item) =>
        item.status ===
          "completed" &&
        !item.evaluation
    );

  if (!task) {
    return false;
  }

  evaluateTask(
    task
  );

  recordMemoryFromTask(
    task
  );

  await advancePipelineFromTask(
    task
  );

  renderTasks();
  renderCompanyMemory();
  renderBusiness();

  return true;
}

async function executeNextPendingTask() {
  const task =
    tasks.find(
      (item) =>
        item.status ===
        "pending"
    );

  if (!task) {
    return false;
  }

  await runSingleTask(
    task.id
  );

  return true;
}

async function runCompanyCycle() {
  if (
    cycleBusy
  ) {
    return;
  }

  cycleBusy =
    true;

  addEngineLog(
    "Company Engine",
    "サイクルを開始しました。"
  );

  companyState.cycleCount =
    Number(
      companyState.cycleCount || 0
    ) + 1;

  companyState.lastCycleAt =
    nowISO();

  companyState.currentFocus =
    "会社状態を分析中";

  saveCompanyState();
  renderCompanyState();

  try {

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

      return;
    }

    companyState.waiting =
      false;

    // -------------------------------------------------
    // Evaluate finished task
    // -------------------------------------------------

    const evaluated =
      await evaluateUnevaluatedTask();

    if (evaluated) {

      companyState.currentFocus =
        "実行結果を評価中";

      companyState.nextAction =
        "評価結果から次のタスクを決定する";

      saveCompanyState();
      renderCompanyState();

      return;
    }

    // -------------------------------------------------
    // Pending Task
    // -------------------------------------------------

    const executed =
      await executeNextPendingTask();

    if (executed) {

      companyState.currentFocus =
        "タスクを実行中";

      companyState.nextAction =
        "実行結果を確認して次の段階へ進む";

      saveCompanyState();
      renderCompanyState();

      return;
    }

    // -------------------------------------------------
    // Situation Analysis
    // -------------------------------------------------

    const situation =
      analyzeCompanySituation();

    addEngineLog(
      "CEO",
      `状況分析：pending=${situation.pending}, business=${situation.businessCount}`
    );

    // -------------------------------------------------
    // Strategy
    // -------------------------------------------------

    const strategy =
      makeStrategy(
        situation
      );

    strategyHistory.unshift(
      strategy
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

    addEngineLog(
      "CEO",
      `戦略決定：「${strategy.title}」`
    );

    // -------------------------------------------------
    // Departments
    // -------------------------------------------------

    const council =
      makeCouncil(
        strategy
      );

    companyState.activeDepartments =
      council.departments;

    addEngineLog(
      "CEO Council",
      `協議部署：${council.departments.join(
        "・"
      )}`
    );

    // -------------------------------------------------
    // CEO Decision
    // -------------------------------------------------

    const decision =
      makeDecision(
        strategy,
        council
      );

    displayDecision(
      decision
    );

    renderCouncil();

    // -------------------------------------------------
    // Autonomous Pipeline
    // -------------------------------------------------

    if (
      strategy.objective ===
      "Discovery"
    ) {

      discoverBusiness(
        true
      );

      companyState.currentFocus =
        "事業機会を探索中";

      companyState.nextAction =
        "発見した候補の市場調査を開始する";

      saveCompanyState();
      renderCompanyState();

      return;
    }

    if (
      strategy.objective ===
      "Business Pipeline"
    ) {

      await runBusinessPipeline();

      return;
    }

    if (
      strategy.objective ===
      "Improvement"
    ) {

      maybeCreateImprovement();

      companyState.currentFocus =
        "改善候補を整理中";

      companyState.nextAction =
        "改善候補をタスク化する";

      saveCompanyState();
      renderCompanyState();

      return;
    }

    if (
      strategy.objective ===
      "Execution"
    ) {

      await executeNextPendingTask();

      return;
    }

    companyState.currentFocus =
      "観測中";

    companyState.nextAction =
      "会社状態を再評価する";

    saveCompanyState();
    renderCompanyState();

  } catch (error) {

    console.error(
      error
    );

    addEngineLog(
      "Company Engine",
      `サイクル中にエラーが発生しました：${error.message}`
    );

    companyState.currentFocus =
      "エラー確認中";

    companyState.nextAction =
      "エラー内容を確認して再実行する";

    saveCompanyState();
    renderCompanyState();

  } finally {

    cycleBusy =
      false;

    addEngineLog(
      "Company Engine",
      "サイクルを終了しました。"
    );
  }
}


// =====================================================
// Autonomous Engine
// =====================================================

function restartEngineTimer() {
  if (
    engineInterval
  ) {
    clearInterval(
      engineInterval
    );
  }

  if (
    !companyState.running
  ) {
    engineInterval =
      null;

    return;
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

    processFounderProposal(
      proposal
    );

    founderInput.value =
      "";
  }
);

discoverBusinessButton.addEventListener(
  "click",
  () => {

    discoverBusiness(
      false
    );
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

companyGoalInput.addEventListener(
  "change",
  () => {

    companyState.goal =
      companyGoalInput.value.trim();

    saveCompanyState();

    addEngineLog(
      "Founder",
      `会社目標を更新しました：「${companyState.goal}」`
    );

    renderCompanyState();
  }
);

companyModeSelect.addEventListener(
  "change",
  () => {

    companyState.mode =
      companyModeSelect.value;

    saveCompanyState();

    addEngineLog(
      "CEO",
      `会社モードを変更しました：「${getModeLabel(
        companyState.mode
      )}」`
    );

    renderCompanyState();

    restartEngineTimer();
  }
);


// =====================================================
// Global UI Functions
// =====================================================

window.runTaskById =
  function(taskId) {
    runSingleTask(
      taskId
    );
  };

window.returnTaskById =
  function(taskId) {
    returnTask(
      taskId
    );
  };

window.editTaskById =
  function(taskId) {
    editTask(
      taskId
    );
  };

window.deleteTaskById =
  function(taskId) {
    deleteTask(
      taskId
    );
  };

window.approveGateById =
  function(gateId) {
    approveHumanGate(
      gateId
    );
  };

window.rejectGateById =
  function(gateId) {
    rejectHumanGate(
      gateId
    );
  };


// =====================================================
// Initial Render
// =====================================================

function initialRender() {
  renderCompanyState();

  renderEngineLogs();

  renderTasks();

  renderBusiness();

  renderHumanGates();

  renderImprovements();

  renderCompanyMemory();

  renderFounderCases();

  renderCouncil();

  companyState.currentFocus =
    companyState.currentFocus ||
    "観測中";

  companyState.nextAction =
    companyState.nextAction ||
    "会社状態を分析して次の仕事を決定する";

  saveCompanyState();

  checkExecutorConnection(
    false
  );
}

initialRender();


// =====================================================
// Safety note
// =====================================================
//
// このCompany Coreは以下を自動実行しない:
//
// - 任意のシェルコマンド
// - 銀行操作
// - 決済
// - 購入
// - 契約
// - 署名
// - 外部公開
// - 顧客への送信
//
// Human Gateを通過した場合でも、
// 現在は「承認済み・外部Gateway待ち」で停止する。
// =====================================================
