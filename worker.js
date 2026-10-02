/**
 * AI Company Core 5.1
 * Cloud CEO + Cloud Executor Runtime
 *
 * 役割:
 * - Cloudflare Worker上でCompany CoreのCEO Cycleを実行
 * - D1へ会社状態・タスク・記憶・成果物を永続保存
 * - Cronから定期的に自律サイクルを開始
 * - pending task があれば Cloud Executor が実行
 * - Research -> Product -> Sales -> Sales Evaluation -> Human Gate を継続
 * - 外部AI API、決済、公開、顧客送信はまだ行わない
 *
 * 重要:
 * - Cloud Executorは現段階では「D1に成果物JSONを生成する実行基盤」
 * - Python Local Executorや外部サービスには依存しない
 */

const RUNTIME_VERSION = "5.1-cloud-ceo-executor";

const MAX_LOGS = 120;
const MAX_MEMORY = 120;
const MAX_STRATEGIES = 60;
const MAX_COUNCIL_CASES = 60;
const MAX_TASKS = 200;
const MAX_BUSINESSES = 50;
const MAX_GATES = 100;

const CYCLE_LOCK_MS = 10 * 60 * 1000;
const MAX_RETRIES = 2;

const BASE_DEPARTMENTS = [
  "企画",
  "技術",
  "財務",
  "リスク管理"
];

const STORE_KEYS = {
  companyState: "companyState",
  tasks: "tasks",
  business: "business",
  humanGates: "humanGates",
  memory: "companyMemory",
  strategies: "strategyHistory",
  council: "councilCases",
  engineLog: "engineLog",
  lastDecision: "lastDecision"
};

const DEFAULT_COMPANY_STATE = {
  goal: "事業を継続的に改善し、収益化できる機会を見つける",

  mode: "normal",

  running: true,

  waiting: false,

  cycleCount: 0,

  lastCycleAt: null,

  currentFocus: "観測中",

  currentPlan: "",

  nextAction:
    "会社状態を分析して次の仕事を決定する",

  activeDepartments: BASE_DEPARTMENTS,

  runtimeVersion: RUNTIME_VERSION,

  executorAvailable: true,

  executorType: "cloud_d1_executor",

  lastExecutionAt: null
};


// =====================================================
// Utility
// =====================================================

function nowISO() {
  return new Date().toISOString();
}


function makeId(prefix) {
  return (
    `${prefix}_` +
    `${Date.now()}_` +
    Math.random()
      .toString(36)
      .slice(2, 8)
  );
}


function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}


function json(
  data,
  status = 200,
  extraHeaders = {}
) {
  return new Response(
    JSON.stringify(
      data,
      null,
      2
    ),
    {
      status,

      headers: {
        "Content-Type":
          "application/json; charset=utf-8",

        "Cache-Control":
          "no-store",

        ...extraHeaders
      }
    }
  );
}


function isObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}


// =====================================================
// D1 Store
// =====================================================

async function getStore(
  env,
  key,
  fallback
) {
  const row =
    await env.DB
      .prepare(
        `SELECT
           value_json,
           updated_at
         FROM company_store
         WHERE key = ?`
      )
      .bind(key)
      .first();

  if (!row) {
    return clone(fallback);
  }

  try {
    return JSON.parse(
      row.value_json
    );

  } catch (error) {

    console.error(
      "D1 JSON parse error:",
      key,
      error
    );

    return clone(fallback);
  }
}


async function setStore(
  env,
  key,
  value
) {
  await env.DB
    .prepare(
      `INSERT INTO company_store (
         key,
         value_json,
         updated_at
       )
       VALUES (?, ?, ?)
       ON CONFLICT(key)
       DO UPDATE SET
         value_json = excluded.value_json,
         updated_at = excluded.updated_at`
    )
    .bind(
      key,
      JSON.stringify(value),
      nowISO()
    )
    .run();
}


async function deleteStore(
  env,
  key
) {
  await env.DB
    .prepare(
      `DELETE FROM company_store
       WHERE key = ?`
    )
    .bind(key)
    .run();
}


// =====================================================
// Logs / Memory
// =====================================================

async function addLog(
  env,
  source,
  message,
  extra = {}
) {
  const logs =
    await getStore(
      env,
      STORE_KEYS.engineLog,
      []
    );

  logs.unshift({
    id: makeId("log"),

    source,

    message,

    ...extra,

    createdAt: nowISO()
  });

  await setStore(
    env,
    STORE_KEYS.engineLog,
    logs.slice(
      0,
      MAX_LOGS
    )
  );
}


async function addMemory(
  env,
  item
) {
  const memory =
    await getStore(
      env,
      STORE_KEYS.memory,
      []
    );

  memory.unshift(item);

  await setStore(
    env,
    STORE_KEYS.memory,
    memory.slice(
      0,
      MAX_MEMORY
    )
  );
}


// =====================================================
// Runtime Meta
// =====================================================

async function updateRuntimeMeta(
  env,
  patch = {}
) {
  const current =
    await env.DB
      .prepare(
        `SELECT
           last_heartbeat_at,
           cycle_count,
           runtime_version
         FROM runtime_meta
         WHERE id = 1`
      )
      .first();

  const nextHeartbeat =
    patch.lastHeartbeatAt ??
    current?.last_heartbeat_at ??
    null;

  const nextCycleCount =
    patch.cycleCount ??
    Number(
      current?.cycle_count || 0
    );

  const nextRuntime =
    patch.runtimeVersion ??
    RUNTIME_VERSION;

  await env.DB
    .prepare(
      `UPDATE runtime_meta
       SET last_heartbeat_at = ?,
           cycle_count = ?,
           runtime_version = ?
       WHERE id = 1`
    )
    .bind(
      nextHeartbeat,
      nextCycleCount,
      nextRuntime
    )
    .run();
}


// =====================================================
// Normalizers
// =====================================================

function normalizeBusiness(
  value = {}
) {
  return {
    id:
      value.id ||
      makeId("business"),

    name:
      String(
        value.name || ""
      ).trim(),

    customer:
      String(
        value.customer || ""
      ).trim(),

    problem:
      String(
        value.problem || ""
      ).trim(),

    status:
      value.status ||
      "discovered",

    stage:
      value.stage ||
      "discovered",

    pipeline:
      value.pipeline ||
      "research",

    discoveredAt:
      value.discoveredAt ||
      nowISO(),

    researchTaskId:
      value.researchTaskId ||
      null,

    productTaskId:
      value.productTaskId ||
      null,

    salesTaskId:
      value.salesTaskId ||
      null,

    salesEvaluationTaskId:
      value.salesEvaluationTaskId ||
      null,

    humanGateTaskId:
      value.humanGateTaskId ||
      null
  };
}


function normalizeTask(
  value = {}
) {
  return {
    id:
      value.id ||
      makeId("task"),

    title:
      String(
        value.title ||
        "Untitled Task"
      ),

    priority:
      value.priority ||
      "normal",

    status:
      value.status ||
      "pending",

    runCount:
      Number(
        value.runCount || 0
      ),

    lastRunAt:
      value.lastRunAt ||
      null,

    result:
      value.result ??
      null,

    executor:
      value.executor ||
      "Cloud Executor",

    source:
      value.source ||
      "Company Core",

    createdAt:
      value.createdAt ||
      nowISO(),

    updatedAt:
      value.updatedAt ||
      nowISO(),

    evaluation:
      value.evaluation ??
      null,

    level:
      value.level ||
      "general",

    retryCount:
      Number(
        value.retryCount || 0
      ),

    requiresHuman:
      Boolean(
        value.requiresHuman
      ),

    humanGateId:
      value.humanGateId ||
      null,

    localExecution:
      value.localExecution ??
      null,

    cloudExecution:
      value.cloudExecution ??
      null,

    pipeline:
      value.pipeline ||
      null,

    parentTaskId:
      value.parentTaskId ||
      null,

    strategyId:
      value.strategyId ||
      null
  };
}


function normalizeGate(
  value = {}
) {
  return {
    id:
      value.id ||
      makeId("gate"),

    taskId:
      value.taskId ||
      null,

    taskTitle:
      value.taskTitle ||
      "",

    reason:
      value.reason ||
      "人間の承認が必要です。",

    status:
      value.status ||
      "pending",

    createdAt:
      value.createdAt ||
      nowISO(),

    decidedAt:
      value.decidedAt ||
      null,

    decision:
      value.decision ||
      null
  };
}


// =====================================================
// Save helpers
// =====================================================

async function saveBusinesses(
  env,
  businesses
) {
  await setStore(
    env,
    STORE_KEYS.business,
    businesses.slice(
      0,
      MAX_BUSINESSES
    )
  );
}


async function saveTasks(
  env,
  tasks
) {
  await setStore(
    env,
    STORE_KEYS.tasks,
    tasks.slice(
      0,
      MAX_TASKS
    )
  );
}


async function saveGates(
  env,
  gates
) {
  await setStore(
    env,
    STORE_KEYS.humanGates,
    gates.slice(
      0,
      MAX_GATES
    )
  );
}


// =====================================================
// Business Pipeline
// =====================================================

async function findPipelineBusiness(
  env,
  businesses
) {
  const activeStages =
    new Set([
      "discovered",
      "research",
      "product",
      "sales_preparation",
      "sales_evaluation",
      "human_approval"
    ]);

  return (
    businesses.find(
      (business) =>
        activeStages.has(
          business.stage
        )
    ) ||
    null
  );
}


// =====================================================
// Department Council
// =====================================================

function chooseActiveDepartments(
  strategyTitle
) {
  const departments =
    new Set(
      BASE_DEPARTMENTS
    );

  if (
    /市場|顧客|商品|事業/.test(
      strategyTitle
    )
  ) {
    departments.add(
      "企画"
    );
  }

  if (
    /商品|実装|技術|開発|コード|プロト/.test(
      strategyTitle
    )
  ) {
    departments.add(
      "技術"
    );
  }

  if (
    /販売|収益|価格|利益/.test(
      strategyTitle
    )
  ) {
    departments.add(
      "財務"
    );
  }

  if (
    /公開|契約|リスク|承認|外部/.test(
      strategyTitle
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


function makeCouncil(
  strategy
) {
  const departments =
    chooseActiveDepartments(
      strategy.title
    );

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

  return {
    id: makeId(
      "council"
    ),

    strategyId:
      strategy.id,

    title:
      strategy.title,

    departments,

    reviews:
      departments.map(
        (department) => ({
          department,

          ...(
            reviewMap[
              department
            ] || {
              summary:
                "必要な能力を確認します。",

              recommendation:
                "小さく検証します。"
            }
          ),

          source:
            "内部ルール",

          createdAt:
            nowISO()
        })
      ),

    createdAt:
      nowISO()
  };
}


// =====================================================
// CEO Decision
// =====================================================

function makeDecision(
  strategy,
  council
) {
  let action =
    "安全条件を守って小規模実行";

  if (
    strategy.objective ===
    "Human Gate"
  ) {
    action =
      "人間承認を待つ";
  }

  if (
    strategy.objective ===
    "Execution"
  ) {
    action =
      "Cloud Executorで登録タスクを実行";
  }

  if (
    strategy.objective ===
    "Discovery"
  ) {
    action =
      "新しい事業候補を探索";
  }

  if (
    strategy.objective ===
    "Business Pipeline"
  ) {
    action =
      "事業候補を段階的に検証";
  }

  return {
    id: makeId(
      "decision"
    ),

    action,

    strategyTitle:
      strategy.title,

    reason:
      strategy.reason,

    departments:
      council.departments,

    createdAt:
      nowISO()
  };
}


// =====================================================
// Strategy
// =====================================================

function makeStrategy({
  pending,
  waitingHuman,
  businesses,
  nextBusiness
}) {
  if (
    waitingHuman > 0
  ) {
    return {
      id:
        makeId("strategy"),

      title:
        "Human Gate管理",

      reason:
        "人間承認が必要な処理を先に停止・確認する。",

      objective:
        "Human Gate"
    };
  }

  if (
    pending > 0
  ) {
    return {
      id:
        makeId("strategy"),

      title:
        "既存タスクをCloud Executorで実行",

      reason:
        "登録済みタスクを処理して事業パイプラインを前進させる。",

      objective:
        "Execution"
    };
  }

  if (
    businesses.length ===
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

  if (
    nextBusiness
  ) {
    return {
      id:
        makeId("strategy"),

      title:
        `事業候補「${nextBusiness.name}」を検証`,

      reason:
        "発見済みの候補についてResearchから段階的に検証する。",

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


// =====================================================
// Business Discovery
// =====================================================

async function discoverBusiness(
  env
) {
  const businesses =
    await getStore(
      env,
      STORE_KEYS.business,
      []
    );

  const existing =
    businesses.find(
      (item) =>
        item.name ===
          "小規模事業向け調査レポート生成サービス" &&
        item.status !==
          "rejected"
    );

  if (existing) {
    return normalizeBusiness(
      existing
    );
  }

  const business =
    normalizeBusiness({
      id:
        makeId(
          "business"
        ),

      name:
        "小規模事業向け調査レポート生成サービス",

      customer:
        "小規模事業者",

      problem:
        "市場調査や競合調査に時間がかかる",

      status:
        "discovered",

      stage:
        "discovered",

      pipeline:
        "research",

      discoveredAt:
        nowISO()
    });

  businesses.unshift(
    business
  );

  await saveBusinesses(
    env,
    businesses
  );

  await addLog(
    env,
    "Business Discovery",
    `事業候補を発見しました：「${business.name}」`
  );

  return business;
}


// =====================================================
// Task Core
// =====================================================

async function createTask(
  env,
  taskInput
) {
  const tasks =
    await getStore(
      env,
      STORE_KEYS.tasks,
      []
    );

  const task =
    normalizeTask(
      taskInput
    );

  tasks.unshift(
    task
  );

  await saveTasks(
    env,
    tasks
  );

  await addLog(
    env,
    "Task Core",
    `タスクを登録しました：「${task.title}」`
  );

  return task;
}


async function updateTask(
  env,
  taskId,
  updater
) {
  const tasks =
    await getStore(
      env,
      STORE_KEYS.tasks,
      []
    );

  const index =
    tasks.findIndex(
      (task) =>
        task.id ===
        taskId
    );

  if (index < 0) {
    return null;
  }

  const current =
    normalizeTask(
      tasks[index]
    );

  const next =
    normalizeTask(
      typeof updater ===
        "function"
        ? updater(current)
        : {
            ...current,
            ...updater
          }
    );

  next.updatedAt =
    nowISO();

  tasks[index] =
    next;

  await saveTasks(
    env,
    tasks
  );

  return next;
}


// =====================================================
// Research Task
// =====================================================

async function createResearchTask(
  env,
  business
) {
  if (
    business.researchTaskId
  ) {
    const tasks =
      await getStore(
        env,
        STORE_KEYS.tasks,
        []
      );

    const existing =
      tasks.find(
        (task) =>
          task.id ===
          business.researchTaskId
      );

    if (existing) {
      return normalizeTask(
        existing
      );
    }
  }

  const task =
    await createTask(
      env,
      {
        id:
          makeId(
            "task"
          ),

        title:
          `市場調査:${business.name}`,

        priority:
          "normal",

        status:
          "pending",

        runCount:
          0,

        lastRunAt:
          null,

        result:
          null,

        executor:
          "Cloud Executor",

        source:
          "Business Discovery",

        createdAt:
          nowISO(),

        updatedAt:
          nowISO(),

        evaluation:
          null,

        level:
          "research",

        retryCount:
          0,

        requiresHuman:
          false,

        humanGateId:
          null,

        localExecution:
          null,

        cloudExecution:
          null,

        pipeline:
          {
            type:
              "business_pipeline",

            stage:
              "research",

            businessId:
              business.id
          }
      }
    );

  const businesses =
    await getStore(
      env,
      STORE_KEYS.business,
      []
    );

  const index =
    businesses.findIndex(
      (item) =>
        item.id ===
        business.id
    );

  if (index >= 0) {
    businesses[index] =
      normalizeBusiness({
        ...businesses[index],

        status:
          "researching",

        stage:
          "research",

        pipeline:
          "research",

        researchTaskId:
          task.id
      });

    await saveBusinesses(
      env,
      businesses
    );
  }

  await addLog(
    env,
    "CEO",
    `市場調査タスクを生成しました：「${business.name}」`
  );

  return task;
}


// =====================================================
// Product Task
// =====================================================

async function createProductTask(
  env,
  business,
  parentTask
) {
  if (
    business.productTaskId
  ) {
    const tasks =
      await getStore(
        env,
        STORE_KEYS.tasks,
        []
      );

    const existing =
      tasks.find(
        (task) =>
          task.id ===
          business.productTaskId
      );

    if (existing) {
      return normalizeTask(
        existing
      );
    }
  }

  const task =
    await createTask(
      env,
      {
        id:
          makeId("task"),

        title:
          `商品設計・試作:${business.name}`,

        priority:
          "normal",

        status:
          "pending",

        executor:
          "Cloud Executor",

        source:
          "Research Result",

        level:
          "product",

        parentTaskId:
          parentTask?.id ||
          null,

        strategyId:
          parentTask?.strategyId ||
          null,

        pipeline:
          {
            type:
              "business_pipeline",

            stage:
              "product",

            businessId:
              business.id
          }
      }
    );

  const businesses =
    await getStore(
      env,
      STORE_KEYS.business,
      []
    );

  const index =
    businesses.findIndex(
      (item) =>
        item.id ===
        business.id
    );

  if (index >= 0) {
    businesses[index] =
      normalizeBusiness({
        ...businesses[index],

        status:
          "product_building",

        stage:
          "product",

        pipeline:
          "product",

        productTaskId:
          task.id
      });

    await saveBusinesses(
      env,
      businesses
    );
  }

  await addLog(
    env,
    "CEO",
    `商品タスクを生成しました：「${business.name}」`
  );

  return task;
}


// =====================================================
// Sales Task
// =====================================================

async function createSalesTask(
  env,
  business,
  parentTask
) {
  if (
    business.salesTaskId
  ) {
    const tasks =
      await getStore(
        env,
        STORE_KEYS.tasks,
        []
      );

    const existing =
      tasks.find(
        (task) =>
          task.id ===
          business.salesTaskId
      );

    if (existing) {
      return normalizeTask(
        existing
      );
    }
  }

  const task =
    await createTask(
      env,
      {
        id:
          makeId("task"),

        title:
          `販売準備:${business.name}`,

        priority:
          "normal",

        status:
          "pending",

        executor:
          "Cloud Executor",

        source:
          "Product Result",

        level:
          "sales",

        parentTaskId:
          parentTask?.id ||
          null,

        strategyId:
          parentTask?.strategyId ||
          null,

        pipeline:
          {
            type:
              "business_pipeline",

            stage:
              "sales_preparation",

            businessId:
              business.id
          }
      }
    );

  const businesses =
    await getStore(
      env,
      STORE_KEYS.business,
      []
    );

  const index =
    businesses.findIndex(
      (item) =>
        item.id ===
        business.id
    );

  if (index >= 0) {
    businesses[index] =
      normalizeBusiness({
        ...businesses[index],

        status:
          "sales_preparing",

        stage:
          "sales_preparation",

        pipeline:
          "sales",

        salesTaskId:
          task.id
      });

    await saveBusinesses(
      env,
      businesses
    );
  }

  await addLog(
    env,
    "CEO",
    `販売準備タスクを生成しました：「${business.name}」`
  );

  return task;
}


// =====================================================
// Sales Evaluation Task
// =====================================================

async function createSalesEvaluationTask(
  env,
  business,
  parentTask
) {
  if (
    business.salesEvaluationTaskId
  ) {
    const tasks =
      await getStore(
        env,
        STORE_KEYS.tasks,
        []
      );

    const existing =
      tasks.find(
        (task) =>
          task.id ===
          business.salesEvaluationTaskId
      );

    if (existing) {
      return normalizeTask(
        existing
      );
    }
  }

  const task =
    await createTask(
      env,
      {
        id:
          makeId("task"),

        title:
          `販売構成評価:${business.name}`,

        priority:
          "normal",

        status:
          "pending",

        executor:
          "Cloud Executor",

        source:
          "Sales Package Result",

        level:
          "sales_evaluation",

        parentTaskId:
          parentTask?.id ||
          null,

        strategyId:
          parentTask?.strategyId ||
          null,

        pipeline:
          {
            type:
              "business_pipeline",

            stage:
              "sales_evaluation",

            businessId:
              business.id
          }
      }
    );

  const businesses =
    await getStore(
      env,
      STORE_KEYS.business,
      []
    );

  const index =
    businesses.findIndex(
      (item) =>
        item.id ===
        business.id
    );

  if (index >= 0) {
    businesses[index] =
      normalizeBusiness({
        ...businesses[index],

        status:
          "sales_evaluating",

        stage:
          "sales_evaluation",

        pipeline:
          "sales_evaluation",

        salesEvaluationTaskId:
          task.id
      });

    await saveBusinesses(
      env,
      businesses
    );
  }

  await addLog(
    env,
    "CEO",
    `販売評価タスクを生成しました：「${business.name}」`
  );

  return task;
}


// =====================================================
// Human Gate
// =====================================================

async function createHumanGateTask(
  env,
  business,
  parentTask
) {
  if (
    business.humanGateTaskId
  ) {
    const tasks =
      await getStore(
        env,
        STORE_KEYS.tasks,
        []
      );

    const existing =
      tasks.find(
        (task) =>
          task.id ===
          business.humanGateTaskId
      );

    if (existing) {
      return {
        task:
          normalizeTask(
            existing
          ),

        gate:
          null
      };
    }
  }

  const task =
    await createTask(
      env,
      {
        id:
          makeId("task"),

        title:
          `Human Gate:公開承認:${business.name}`,

        priority:
          "high",

        status:
          "waiting_human",

        executor:
          "Human Gate",

        source:
          "Sales Evaluation",

        level:
          "human_gate",

        parentTaskId:
          parentTask?.id ||
          null,

        strategyId:
          parentTask?.strategyId ||
          null,

        requiresHuman:
          true,

        pipeline:
          {
            type:
              "business_pipeline",

            stage:
              "human_approval",

            businessId:
              business.id
          }
      }
    );

  const gate =
    normalizeGate({
      id:
        makeId("gate"),

      taskId:
        task.id,

      taskTitle:
        task.title,

      reason:
        "販売準備が完了しました。外部公開・顧客向け提供は人間承認が必要です。",

      status:
        "pending",

      createdAt:
        nowISO()
    });

  const gates =
    await getStore(
      env,
      STORE_KEYS.humanGates,
      []
    );

  gates.unshift(
    gate
  );

  await saveGates(
    env,
    gates
  );

  const tasks =
    await getStore(
      env,
      STORE_KEYS.tasks,
      []
    );

  const taskIndex =
    tasks.findIndex(
      (item) =>
        item.id ===
        task.id
    );

  if (taskIndex >= 0) {
    tasks[taskIndex] =
      normalizeTask({
        ...tasks[taskIndex],

        status:
          "waiting_human",

        humanGateId:
          gate.id,

        requiresHuman:
          true,

        updatedAt:
          nowISO()
      });

    await saveTasks(
      env,
      tasks
    );
  }

  const businesses =
    await getStore(
      env,
      STORE_KEYS.business,
      []
    );

  const businessIndex =
    businesses.findIndex(
      (item) =>
        item.id ===
        business.id
    );

  if (businessIndex >= 0) {
    businesses[businessIndex] =
      normalizeBusiness({
        ...businesses[businessIndex],

        status:
          "waiting_human",

        stage:
          "human_approval",

        pipeline:
          "human_gate",

        humanGateTaskId:
          task.id
      });

    await saveBusinesses(
      env,
      businesses
    );
  }

  await addLog(
    env,
    "Human Gate",
    `人間承認待ちを生成しました：「${task.title}」`
  );

  const updatedTask =
    tasks.find(
      (item) =>
        item.id ===
        task.id
    );

  return {
    task:
      normalizeTask(
        updatedTask ||
        task
      ),

    gate
  };
}


// =====================================================
// Task Action Detection
// =====================================================

function taskAction(
  task
) {
  const stage =
    task?.pipeline?.stage ||
    task?.level ||
    "";

  if (
    stage ===
      "research" ||
    /市場調査/.test(
      task.title
    )
  ) {
    return "research_brief";
  }

  if (
    stage ===
      "product" ||
    /商品|試作/.test(
      task.title
    )
  ) {
    return "product_prototype";
  }

  if (
    stage ===
      "sales_preparation" ||
    /販売準備/.test(
      task.title
    )
  ) {
    return "sales_package_generation";
  }

  if (
    stage ===
      "sales_evaluation" ||
    /販売構成評価/.test(
      task.title
    )
  ) {
    return "sales_evaluation";
  }

  return "generic_execution";
}


// =====================================================
// Business Lookup
// =====================================================

async function getBusinessForTask(
  env,
  task
) {
  const businessId =
    task?.pipeline?.businessId;

  if (!businessId) {
    return null;
  }

  const businesses =
    await getStore(
      env,
      STORE_KEYS.business,
      []
    );

  const business =
    businesses.find(
      (item) =>
        item.id ===
        businessId
    );

  return business
    ? normalizeBusiness(
        business
      )
    : null;
}


// =====================================================
// Cloud Executor
// =====================================================

function generateResearchArtifact(
  task,
  business
) {
  return {
    artifactType:
      "research_brief",

    title:
      `${business?.name || task.title} — 市場調査ブリーフ`,

    business:
      business
        ? {
            id:
              business.id,

            name:
              business.name,

            customer:
              business.customer,

            problem:
              business.problem
          }
        : null,

    purpose:
      "顧客課題・競合・提供価値を検証するための調査設計",

    targetCustomer:
      business?.customer ||
      "未定義",

    problemHypotheses:
      [
        business?.problem ||
          "顧客が抱える主要課題を確認する",

        "既存手段より短時間・低コストで調査できる可能性",

        "調査結果を意思決定に使える形式へ整理できる可能性"
      ],

    researchQuestions:
      [
        "顧客は現在どのように市場調査を行っているか",

        "調査にどれくらいの時間・費用をかけているか",

        "どの情報が意思決定に最も重要か",

        "既存サービスとの差は何か",

        "継続利用する理由は何か"
      ],

    evidencePlan:
      [
        "顧客インタビュー",

        "競合サービス確認",

        "公開情報確認",

        "価格仮説比較",

        "小規模テスト"
      ],

    currentLimitation:
      "このWorker単体では外部市場データを取得していません。これは調査設計・仮説整理の成果物です。",

    generatedBy:
      "Cloud Executor",

    generatedAt:
      nowISO(),

    sourceTaskId:
      task.id
  };
}


function generateProductArtifact(
  task,
  business
) {
  return {
    artifactType:
      "product_prototype",

    title:
      `${business?.name || task.title} — 最小商品プロトタイプ`,

    productConcept:
      "小規模事業者向けの市場調査レポートを短時間で作成できるサービス",

    input:
      [
        "調査対象",
        "顧客業種",
        "地域",
        "知りたい意思決定"
      ],

    output:
      [
        "調査目的",
        "競合整理",
        "顧客課題仮説",
        "市場観点",
        "次に確認すべき事項"
      ],

    workflow:
      [
        "依頼受付",
        "調査設計",
        "情報整理",
        "レポート生成",
        "確認・修正"
      ],

    pricingHypothesis:
      {
        entry:
          "小規模・単発プラン",

        recurring:
          "月次調査プラン",

        note:
          "価格は顧客検証後に更新する"
      },

    validationPlan:
      [
        "3〜5件の小規模テスト",

        "所要時間を測定",

        "修正回数を記録",

        "購入意向を確認"
      ],

    limitation:
      "顧客利用による価値検証はまだ行っていません。",

    generatedBy:
      "Cloud Executor",

    generatedAt:
      nowISO(),

    sourceTaskId:
      task.id
  };
}


function generateSalesArtifact(
  task,
  business
) {
  return {
    artifactType:
      "sales_package_generation",

    title:
      `${business?.name || task.title} — 販売準備パッケージ`,

    offer:
      {
        headline:
          "小規模事業者向け市場調査レポート生成サービス",

        customer:
          business?.customer ||
          "小規模事業者",

        value:
          "調査の準備・整理・レポート化にかかる手間を減らす"
      },

    package:
      {
        deliverable:
          "市場調査レポート",

        turnaround:
          "小規模案件を短時間で処理する前提",

        revision:
          "初回確認・修正を含む仮設計"
      },

    salesMessage:
      "市場調査の設計から整理までを支援し、意思決定に使える形へまとめます。",

    acquisitionChannels:
      [
        "直接営業",
        "紹介",
        "公開ページ",
        "コミュニティ"
      ],

    salesRisks:
      [
        "顧客ニーズ未検証",
        "外部市場データ取得方法未接続",
        "実売価格未検証",
        "公開・決済未接続"
      ],

    publicationStatus:
      "not_published",

    paymentStatus:
      "not_connected",

    generatedBy:
      "Cloud Executor",

    generatedAt:
      nowISO(),

    sourceTaskId:
      task.id
  };
}


function generateSalesEvaluationArtifact(
  task,
  business
) {
  const ready =
    Boolean(
      business
    );

  return {
    artifactType:
      "sales_evaluation",

    title:
      `${business?.name || task.title} — 販売構成評価`,

    criteria:
      {
        customerDefined:
          Boolean(
            business?.customer
          ),

        problemDefined:
          Boolean(
            business?.problem
          ),

        offerDefined:
          true,

        deliveryDefined:
          true,

        externalValidation:
          false,

        paymentConnected:
          false,

        publicationConnected:
          false
      },

    strengths:
      [
        "対象顧客が定義されている",

        "課題仮説が定義されている",

        "商品と販売パッケージの骨格がある"
      ],

    gaps:
      [
        "実顧客による検証",

        "外部市場データ",

        "公開導線",

        "決済導線",

        "実売上"
      ],

    readiness:
      ready
        ? "human_gate_candidate"
        : "needs_revision",

    ready_for_human_gate:
      ready,

    note:
      "公開・決済・顧客送信などの外部行動はまだ実行しません。",

    generatedBy:
      "Cloud Executor",

    generatedAt:
      nowISO(),

    sourceTaskId:
      task.id
  };
}


function generateGenericArtifact(
  task,
  business
) {
  return {
    artifactType:
      "generic_execution",

    title:
      `${business?.name || "Company"} — 実行レポート`,

    message:
      `Cloud Executorでタスク「${task.title}」を実行しました。`,

    taskId:
      task.id,

    generatedBy:
      "Cloud Executor",

    generatedAt:
      nowISO()
  };
}


// =====================================================
// Execute Cloud Task
// =====================================================

async function executeCloudTask(
  env,
  task,
  business
) {
  const action =
    taskAction(
      task
    );

  let artifact;

  if (
    action ===
    "research_brief"
  ) {
    artifact =
      generateResearchArtifact(
        task,
        business
      );

  } else if (
    action ===
    "product_prototype"
  ) {
    artifact =
      generateProductArtifact(
        task,
        business
      );

  } else if (
    action ===
    "sales_package_generation"
  ) {
    artifact =
      generateSalesArtifact(
        task,
        business
      );

  } else if (
    action ===
    "sales_evaluation"
  ) {
    artifact =
      generateSalesEvaluationArtifact(
        task,
        business
      );

  } else {
    artifact =
      generateGenericArtifact(
        task,
        business
      );
  }

  const artifactKey =
    `artifact:${task.id}`;

  await setStore(
    env,
    artifactKey,
    artifact
  );

  return {
    action,

    artifactKey,

    artifact,

    result:
      `Cloud Executorで${action}を実行し、D1へ成果物を保存しました。`,

    metrics:
      {
        artifact_saved:
          true,

        execution_available:
          true,

        external_actions:
          false,

        external_ai:
          false
      },

    executedAt:
      nowISO()
  };
}


// =====================================================
// Evaluation
// =====================================================

function evaluateCloudExecution(
  task,
  execution
) {
  const action =
    execution?.action ||
    "";

  let level =
    "実行成功・成果確認前";

  let summary =
    "Cloud Executorが実行に成功し、D1へ成果物を保存しました。";

  let nextAction =
    "生成された成果物を次工程へ渡して検証を続ける。";

  let readyForHumanGate =
    false;

  if (
    action ===
    "research_brief"
  ) {
    level =
      "調査設計成功・外部データ確認前";

    summary =
      "市場調査の設計と仮説整理に成功しました。外部市場データ自体はまだ取得していません。";

    nextAction =
      "商品プロトタイプを作成し、顧客価値を検証する。";
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
      "販売パッケージを作成し、販売可能性を整理する。";
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
      "販売構成を評価し、人間承認の要否を判断する。";
  }

  if (
    action ===
    "sales_evaluation"
  ) {
    readyForHumanGate =
      Boolean(
        execution?.metrics
          ?.artifact_saved &&
        execution?.artifact
          ?.ready_for_human_gate
      );

    level =
      readyForHumanGate
        ? "販売構成評価完了・公開承認待ち"
        : "販売構成に不足あり";

    summary =
      readyForHumanGate
        ? "販売構成の評価が完了し、外部公開前のHuman Gate候補になりました。"
        : "販売構成評価で不足が検出されました。";

    nextAction =
      readyForHumanGate
        ? "Human Gateで公開承認の判断を待つ。"
        : "不足項目を補って再評価する。";
  }

  return {
    status:
      "success",

    action,

    level,

    summary,

    nextAction,

    readyForHumanGate,

    generatedAt:
      nowISO()
  };
}


// =====================================================
// Pipeline Advancement
// =====================================================

async function advancePipeline(
  env,
  task,
  execution,
  evaluation,
  business
) {
  if (!business) {
    return {
      advanced:
        false,

      nextTask:
        null,

      humanGate:
        null
    };
  }

  const businesses =
    await getStore(
      env,
      STORE_KEYS.business,
      []
    );

  const index =
    businesses.findIndex(
      (item) =>
        item.id ===
        business.id
    );

  if (index < 0) {
    return {
      advanced:
        false,

      nextTask:
        null,

      humanGate:
        null
    };
  }

  const current =
    normalizeBusiness(
      businesses[index]
    );

  const action =
    execution.action;

  let nextTask =
    null;

  let humanGate =
    null;

  if (
    action ===
    "research_brief"
  ) {
    businesses[index] =
      normalizeBusiness({
        ...current,

        status:
          "research_completed",

        stage:
          "product",

        pipeline:
          "product"
      });

    await saveBusinesses(
      env,
      businesses
    );

    nextTask =
      await createProductTask(
        env,
        businesses[index],
        task
      );

  } else if (
    action ===
    "product_prototype"
  ) {
    businesses[index] =
      normalizeBusiness({
        ...current,

        status:
          "product_completed",

        stage:
          "sales_preparation",

        pipeline:
          "sales"
      });

    await saveBusinesses(
      env,
      businesses
    );

    nextTask =
      await createSalesTask(
        env,
        businesses[index],
        task
      );

  } else if (
    action ===
    "sales_package_generation"
  ) {
    businesses[index] =
      normalizeBusiness({
        ...current,

        status:
          "sales_package_completed",

        stage:
          "sales_evaluation",

        pipeline:
          "sales_evaluation"
      });

    await saveBusinesses(
      env,
      businesses
    );

    nextTask =
      await createSalesEvaluationTask(
        env,
        businesses[index],
        task
      );

  } else if (
    action ===
    "sales_evaluation"
  ) {
    if (
      evaluation.readyForHumanGate
    ) {
      const refreshed =
        normalizeBusiness(
          businesses[index]
        );

      businesses[index] =
        normalizeBusiness({
          ...refreshed,

          status:
            "waiting_human",

          stage:
            "human_approval",

          pipeline:
            "human_gate"
        });

      await saveBusinesses(
        env,
        businesses
      );

      const result =
        await createHumanGateTask(
          env,
          businesses[index],
          task
        );

      humanGate =
        result.gate;

      nextTask =
        result.task;
    }
  }

  return {
    advanced:
      Boolean(
        nextTask ||
        humanGate
      ),

    nextTask,

    humanGate
  };
}


// =====================================================
// Execute One Pending Task
// =====================================================

async function executePendingTask(
  env,
  source = "manual"
) {
  const tasks =
    await getStore(
      env,
      STORE_KEYS.tasks,
      []
    );

  const pending =
    tasks
      .map(
        normalizeTask
      )
      .filter(
        (task) =>
          task.status ===
          "pending"
      )
      .sort(
        (a, b) => {
          const priorityOrder =
            {
              high:
                1,

              normal:
                2,

              low:
                3
            };

          return (
            (
              priorityOrder[
                a.priority
              ] || 2
            ) -
            (
              priorityOrder[
                b.priority
              ] || 2
            )
          ) ||
          (
            new Date(
              a.createdAt
            ).getTime() -
            new Date(
              b.createdAt
            ).getTime()
          );
        }
      );

  const task =
    pending[0];

  if (!task) {
    return {
      ok:
        true,

      status:
        "no_pending_task",

      source
    };
  }

  const startedAt =
    nowISO();

  const running =
    await updateTask(
      env,
      task.id,
      (current) => ({
        ...current,

        status:
          "running",

        runCount:
          Number(
            current.runCount || 0
          ) + 1,

        lastRunAt:
          startedAt,

        executor:
          "Cloud Executor"
      })
    );

  try {
    const business =
      await getBusinessForTask(
        env,
        running
      );

    const execution =
      await executeCloudTask(
        env,
        running,
        business
      );

    const evaluation =
      evaluateCloudExecution(
        running,
        execution
      );

    const completed =
      await updateTask(
        env,
        running.id,
        (current) => ({
          ...current,

          status:
            "completed",

          result:
            execution.result,

          evaluation,

          cloudExecution:
            execution,

          localExecution:
            null,

          retryCount:
            0
        })
      );

    await addMemory(
      env,
      {
        id:
          makeId(
            "memory"
          ),

        type:
          "task_execution",

        taskId:
          running.id,

        businessId:
          business?.id ||
          null,

        action:
          execution.action,

        level:
          evaluation.level,

        summary:
          evaluation.summary,

        nextAction:
          evaluation.nextAction,

        source:
          "Cloud Executor",

        createdAt:
          nowISO()
      }
    );

    const advancement =
      await advancePipeline(
        env,
        completed,
        execution,
        evaluation,
        business
      );

    const companyState =
      await getStore(
        env,
        STORE_KEYS.companyState,
        clone(
          DEFAULT_COMPANY_STATE
        )
      );

    companyState.lastExecutionAt =
      nowISO();

    companyState.currentFocus =
      evaluation.level;

    companyState.currentPlan =
      business
        ? `「${business.name}」の次工程を進める`
        : completed.title;

    companyState.nextAction =
      advancement.humanGate
        ? "Human Gateの承認を待つ"
        : advancement.nextTask
          ? `次のタスク「${advancement.nextTask.title}」を実行する`
          : evaluation.nextAction;

    companyState.waiting =
      Boolean(
        advancement.humanGate
      );

    companyState.executorAvailable =
      true;

    companyState.runtimeVersion =
      RUNTIME_VERSION;

    await setStore(
      env,
      STORE_KEYS.companyState,
      companyState
    );

    await addLog(
      env,
      "Cloud Executor",
      `タスクを実行しました：「${completed.title}」 action=${execution.action}`
    );

    return {
      ok:
        true,

      status:
        "task_executed",

      source,

      task:
        completed,

      execution,

      evaluation,

      nextTask:
        advancement.nextTask,

      humanGate:
        advancement.humanGate
    };

  } catch (error) {

    const failed =
      await updateTask(
        env,
        running.id,
        (current) => {
          const nextRetryCount =
            Number(
              current.retryCount || 0
            ) + 1;

          const shouldRetry =
            nextRetryCount <=
            MAX_RETRIES;

          return {
            ...current,

            status:
              shouldRetry
                ? "pending"
                : "failed",

            retryCount:
              nextRetryCount,

            result:
              `Cloud Executor error: ${
                error.message ||
                error
              }`,

            evaluation:
              {
                status:
                  "failed",

                error:
                  String(
                    error.message ||
                    error
                  ),

                retryable:
                  shouldRetry,

                createdAt:
                  nowISO()
              }
          };
        }
      );

    await addLog(
      env,
      "Cloud Executor",
      `タスク実行に失敗しました：「${running.title}」 error=${
        error.message ||
        error
      }`
    );

    return {
      ok:
        false,

      status:
        failed?.status ===
          "pending"
          ? "task_retry_scheduled"
          : "task_failed",

      source,

      task:
        failed,

      error:
        String(
          error.message ||
          error
        )
    };
  }
}


// =====================================================
// Company Cycle
// =====================================================

async function executeCloudCycle(
  env,
  source = "manual"
) {
  const lockKey =
    "cycleLock";

  const currentLock =
    await getStore(
      env,
      lockKey,
      null
    );

  if (
    currentLock &&
    Number(
      currentLock.lockedAtMs ||
      0
    ) >
      Date.now() -
      CYCLE_LOCK_MS
  ) {
    return {
      ok:
        true,

      status:
        "busy",

      source,

      message:
        "別のCompany Cycleが実行中です。"
    };
  }

  await setStore(
    env,
    lockKey,
    {
      lockedAtMs:
        Date.now(),

      source
    }
  );

  const startedAt =
    nowISO();

  try {
    const companyState =
      await getStore(
        env,
        STORE_KEYS.companyState,
        clone(
          DEFAULT_COMPANY_STATE
        )
      );

    const tasks =
      await getStore(
        env,
        STORE_KEYS.tasks,
        []
      );

    const businesses =
      await getStore(
        env,
        STORE_KEYS.business,
        []
      );

    const humanGates =
      await getStore(
        env,
        STORE_KEYS.humanGates,
        []
      );

    const strategies =
      await getStore(
        env,
        STORE_KEYS.strategies,
        []
      );

    const councilCases =
      await getStore(
        env,
        STORE_KEYS.council,
        []
      );

    companyState.runtimeVersion =
      RUNTIME_VERSION;

    companyState.cycleCount =
      Number(
        companyState.cycleCount ||
        0
      ) + 1;

    companyState.lastCycleAt =
      startedAt;

    companyState.waiting =
      false;

    companyState.executorAvailable =
      true;

    await updateRuntimeMeta(
      env,
      {
        cycleCount:
          companyState.cycleCount,

        runtimeVersion:
          RUNTIME_VERSION
      }
    );

    await setStore(
      env,
      STORE_KEYS.companyState,
      companyState
    );

    await addLog(
      env,
      "Company Engine",
      `サイクルを開始しました。source=${source}`
    );


    // -------------------------------------------------
    // Human Gate check
    // -------------------------------------------------

    const pendingGate =
      humanGates
        .map(
          normalizeGate
        )
        .find(
          (gate) =>
            gate.status ===
            "pending"
        );

    if (pendingGate) {
      companyState.waiting =
        true;

      companyState.currentFocus =
        "人間承認待ち";

      companyState.nextAction =
        "Human Gateの承認を待つ";

      await setStore(
        env,
        STORE_KEYS.companyState,
        companyState
      );

      await addLog(
        env,
        "待機",
        `人間承認が必要なため停止しました：「${pendingGate.taskTitle}」`
      );

      return {
        ok:
          true,

        status:
          "waiting_human",

        source,

        cycleCount:
          companyState.cycleCount,

        pendingGate
      };
    }


    // -------------------------------------------------
    // Pending Task -> Cloud Executor
    // -------------------------------------------------

    const pendingTasks =
      tasks
        .map(
          normalizeTask
        )
        .filter(
          (task) =>
            task.status ===
            "pending"
        );

    if (
      pendingTasks.length >
      0
    ) {
      companyState.currentFocus =
        "Cloud Executor実行";

      companyState.currentPlan =
        pendingTasks[0].title;

      companyState.nextAction =
        "Cloud Executorでタスクを実行する";

      await setStore(
        env,
        STORE_KEYS.companyState,
        companyState
      );

      const executionResult =
        await executePendingTask(
          env,
          source
        );

      return {
        ...executionResult,

        cycleCount:
          companyState.cycleCount
      };
    }


    // -------------------------------------------------
    // Strategy
    // -------------------------------------------------

    const nextBusiness =
      await findPipelineBusiness(
        env,
        businesses
      );

    const strategy =
      makeStrategy({
        pending:
          0,

        waitingHuman:
          0,

        businesses,

        nextBusiness
      });

    strategies.unshift(
      strategy
    );

    await setStore(
      env,
      STORE_KEYS.strategies,
      strategies.slice(
        0,
        MAX_STRATEGIES
      )
    );

    await addLog(
      env,
      "CEO",
      `戦略決定：「${strategy.title}」`
    );


    // -------------------------------------------------
    // Council
    // -------------------------------------------------

    const council =
      makeCouncil(
        strategy
      );

    councilCases.unshift(
      council
    );

    await setStore(
      env,
      STORE_KEYS.council,
      councilCases.slice(
        0,
        MAX_COUNCIL_CASES
      )
    );

    const decision =
      makeDecision(
        strategy,
        council
      );

    await setStore(
      env,
      STORE_KEYS.lastDecision,
      decision
    );

    await addLog(
      env,
      "CEO Council",
      `協議部署：${council.departments.join("・")}`
    );

    await addLog(
      env,
      "CEO",
      `意思決定：「${decision.action}」`
    );


    // -------------------------------------------------
    // Discovery
    // -------------------------------------------------

    if (
      strategy.objective ===
      "Discovery"
    ) {
      const discovered =
        await discoverBusiness(
          env
        );

      companyState.currentFocus =
        "事業機会を探索中";

      companyState.currentPlan =
        `「${discovered.name}」を検証`;

      companyState.nextAction =
        "発見した候補の市場調査タスクを生成する";

      await setStore(
        env,
        STORE_KEYS.companyState,
        companyState
      );

      return {
        ok:
          true,

        status:
          "discovered",

        source,

        cycleCount:
          companyState.cycleCount,

        strategy,

        decision,

        business:
          discovered,

        council
      };
    }


    // -------------------------------------------------
    // New Research Task
    // -------------------------------------------------

    if (
      strategy.objective ===
        "Business Pipeline" &&
      nextBusiness &&
      nextBusiness.stage ===
        "discovered" &&
      !nextBusiness.researchTaskId
    ) {
      const task =
        await createResearchTask(
          env,
          nextBusiness
        );

      companyState.currentFocus =
        "市場調査";

      companyState.currentPlan =
        `「${nextBusiness.name}」の市場調査`;

      companyState.nextAction =
        "Cloud Executorで市場調査タスクを実行する";

      await setStore(
        env,
        STORE_KEYS.companyState,
        companyState
      );

      return {
        ok:
          true,

        status:
          "task_created",

        source,

        cycleCount:
          companyState.cycleCount,

        strategy,

        decision,

        council,

        task
      };
    }


    // -------------------------------------------------
    // Default
    // -------------------------------------------------

    companyState.currentFocus =
      "観測中";

    companyState.nextAction =
      "会社状態を再評価する";

    await setStore(
      env,
      STORE_KEYS.companyState,
      companyState
    );

    return {
      ok:
        true,

      status:
        "completed",

      source,

      cycleCount:
        companyState.cycleCount,

      strategy,

      decision,

      council,

      business:
        nextBusiness ||
        null
    };

  } catch (error) {

    console.error(
      "Company Cycle error:",
      error
    );

    const companyState =
      await getStore(
        env,
        STORE_KEYS.companyState,
        clone(
          DEFAULT_COMPANY_STATE
        )
      );

    companyState.currentFocus =
      "エラー確認中";

    companyState.nextAction =
      "エラー内容を確認して再実行する";

    await setStore(
      env,
      STORE_KEYS.companyState,
      companyState
    );

    await addLog(
      env,
      "Company Engine",
      `サイクル中にエラーが発生しました：${
        error.message ||
        error
      }`
    );

    return {
      ok:
        false,

      status:
        "error",

      source,

      error:
        String(
          error.message ||
          error
        )
    };

  } finally {

    await setStore(
      env,
      lockKey,
      null
    );

    await addLog(
      env,
      "Company Engine",
      "サイクルを終了しました。"
    );
  }
}


// =====================================================
// Heartbeat
// =====================================================

async function heartbeat(
  env
) {
  const now =
    nowISO();

  await updateRuntimeMeta(
    env,
    {
      lastHeartbeatAt:
        now,

      runtimeVersion:
        RUNTIME_VERSION
    }
  );

  return {
    ok:
      true,

    heartbeat:
      true,

    runtime:
      RUNTIME_VERSION,

    time:
      now
  };
}


// =====================================================
// Health
// =====================================================

async function health(
  env
) {
  const runtimeMeta =
    await env.DB
      .prepare(
        `SELECT
           last_heartbeat_at,
           cycle_count,
           runtime_version
         FROM runtime_meta
         WHERE id = 1`
      )
      .first();

  const companyState =
    await getStore(
      env,
      STORE_KEYS.companyState,
      clone(
        DEFAULT_COMPANY_STATE
      )
    );

  const tasks =
    await getStore(
      env,
      STORE_KEYS.tasks,
      []
    );

  const businesses =
    await getStore(
      env,
      STORE_KEYS.business,
      []
    );

  const humanGates =
    await getStore(
      env,
      STORE_KEYS.humanGates,
      []
    );

  return {
    ok:
      true,

    service:
      "AI Company Core Cloud Runtime",

    runtime:
      RUNTIME_VERSION,

    database:
      true,

    runtime_meta:
      runtimeMeta,

    company:
      {
        cycleCount:
          companyState.cycleCount,

        currentFocus:
          companyState.currentFocus,

        nextAction:
          companyState.nextAction,

        pendingTasks:
          tasks.filter(
            (task) =>
              task.status ===
              "pending"
          ).length,

        businessCount:
          businesses.length,

        pendingHumanGates:
          humanGates.filter(
            (gate) =>
              gate.status ===
              "pending"
          ).length
      },

    capabilities:
      [
        "cloud_ceo_cycle",

        "d1_persistent_state",

        "business_discovery",

        "task_generation",

        "department_council",

        "cloud_executor",

        "d1_artifacts",

        "pipeline_advancement",

        "company_memory",

        "human_gate_detection",

        "cloud_heartbeat"
      ],

    execution_available:
      true,

    executor:
      "Cloud Executor (D1-backed)",

    external_actions:
      false,

    external_ai:
      false,

    time:
      nowISO()
  };
}


// =====================================================
// State Read
// =====================================================

async function handleStateRead(
  request,
  env
) {
  const url =
    new URL(
      request.url
    );

  const key =
    url.searchParams.get(
      "key"
    );

  if (!key) {
    return json(
      {
        ok:
          false,

        error:
          "key is required"
      },
      400
    );
  }

  const allowedKeys =
    new Set(
      Object.values(
        STORE_KEYS
      )
    );

  if (
    !allowedKeys.has(
      key
    )
  ) {
    return json(
      {
        ok:
          false,

        error:
          "key is not readable"
      },
      403
    );
  }

  const data =
    await getStore(
      env,
      key,
      null
    );

  return json(
    {
      ok:
        true,

      key,

      data,

      time:
        nowISO()
    }
  );
}


// =====================================================
// Artifact Read
// =====================================================

async function handleArtifactRead(
  request,
  env
) {
  const url =
    new URL(
      request.url
    );

  const taskId =
    url.searchParams.get(
      "taskId"
    );

  if (!taskId) {
    return json(
      {
        ok:
          false,

        error:
          "taskId is required"
      },
      400
    );
  }

  const key =
    `artifact:${taskId}`;

  const artifact =
    await getStore(
      env,
      key,
      null
    );

  if (!artifact) {
    return json(
      {
        ok:
          false,

        error:
          "artifact_not_found"
      },
      404
    );
  }

  return json(
    {
      ok:
        true,

      taskId,

      artifact,

      time:
        nowISO()
    }
  );
}


// =====================================================
// Worker
// =====================================================

export default {

  async fetch(
    request,
    env
  ) {
    const url =
      new URL(
        request.url
      );

    try {

      // -----------------------------------------------
      // Health
      // -----------------------------------------------

      if (
        url.pathname ===
        "/api/health"
      ) {
        return json(
          await health(
            env
          )
        );
      }


      // -----------------------------------------------
      // Heartbeat
      // -----------------------------------------------

      if (
        url.pathname ===
        "/api/heartbeat"
      ) {
        if (
          request.method !==
            "GET" &&
          request.method !==
            "POST"
        ) {
          return json(
            {
              ok:
                false,

              error:
                "method_not_allowed"
            },
            405,
            {
              Allow:
                "GET, POST"
            }
          );
        }

        return json(
          await heartbeat(
            env
          )
        );
      }


      // -----------------------------------------------
      // Cycle
      // -----------------------------------------------

      if (
        url.pathname ===
        "/api/cycle"
      ) {
        if (
          request.method !==
            "GET" &&
          request.method !==
            "POST"
        ) {
          return json(
            {
              ok:
                false,

              error:
                "method_not_allowed"
            },
            405,
            {
              Allow:
                "GET, POST"
            }
          );
        }

        return json(
          await executeCloudCycle(
            env,
            "manual"
          )
        );
      }


      // -----------------------------------------------
      // State
      // -----------------------------------------------

      if (
        url.pathname ===
        "/api/state"
      ) {
        if (
          request.method !==
          "GET"
        ) {
          return json(
            {
              ok:
                false,

              error:
                "state_write_disabled"
            },
            405,
            {
              Allow:
                "GET"
            }
          );
        }

        return handleStateRead(
          request,
          env
        );
      }


      // -----------------------------------------------
      // Artifact
      // -----------------------------------------------

      if (
        url.pathname ===
        "/api/artifact"
      ) {
        if (
          request.method !==
          "GET"
        ) {
          return json(
            {
              ok:
                false,

              error:
                "artifact_read_only"
            },
            405,
            {
              Allow:
                "GET"
            }
          );
        }

        return handleArtifactRead(
          request,
          env
        );
      }


      // -----------------------------------------------
      // Static Assets
      // -----------------------------------------------

      return env.ASSETS.fetch(
        request
      );

    } catch (error) {

      console.error(
        "Worker request error:",
        error
      );

      return json(
        {
          ok:
            false,

          error:
            String(
              error.message ||
              error
            ),

          runtime:
            RUNTIME_VERSION
        },
        500
      );
    }
  },


  // ===================================================
  // Cron
  // ===================================================

  async scheduled(
    controller,
    env,
    ctx
  ) {
    ctx.waitUntil(
      executeCloudCycle(
        env,
        "cron"
      )
        .then(() =>
          heartbeat(
            env
          )
        )
        .catch(
          (error) => {
            console.error(
              "Scheduled cycle error:",
              error
            );
          }
        )
    );
  }
};
