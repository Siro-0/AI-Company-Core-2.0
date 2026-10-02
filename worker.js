const RUNTIME_VERSION = "6.1-self-organizing-company";
const MAX_LOGS = 180;
const MAX_MEMORY = 180;
const MAX_LIST = 300;
const CYCLE_LOCK_MS = 10 * 60 * 1000;
const ORG_LOCK_MS = 5 * 60 * 1000;
const MAX_RETRIES = 2;
const RESEARCH_TIMEOUT_MS = 8000;
const RESEARCH_PREVIEW = 8000;
const MAX_RESEARCH_SOURCES = 4;

const BASE_DEPARTMENTS = [
  "企画",
  "技術",
  "財務",
  "リスク管理"
];

const GENERATED_DEPARTMENTS = {
  "調査": {
    key: "research",
    reason: "外部Research能力が未成熟",
    mission: "外部証拠を収集し、事業仮説を更新する"
  },

  "顧客対応": {
    key: "customer",
    reason: "顧客フィードバックが未取得",
    mission: "顧客要求・フィードバックを収集し分析する"
  },

  "事業成果": {
    key: "outcome",
    reason: "事業成果・売上データが不足",
    mission: "成果、コスト、売上、顧客反応を記録する"
  },

  "開発基盤": {
    key: "development",
    reason: "自己開発能力が未構築",
    mission: "安全な自己開発・テスト・配備基盤を構築する"
  },

  "プラットフォーム戦略": {
    key: "platform",
    reason: "プラットフォーム独立性が未構築",
    mission: "Cloudflare依存箇所を分離し移行可能性を高める"
  }
};

const KEYS = {
  companyState: "companyState",
  tasks: "tasks",
  business: "business",
  humanGates: "humanGates",
  memory: "companyMemory",
  strategies: "strategyHistory",
  council: "councilCases",
  engineLog: "engineLog",
  lastDecision: "lastDecision",
  evidenceIndex: "researchEvidenceIndex",
  customers: "customerRecords",
  outcomes: "businessOutcomes",
  capabilities: "capabilityState",
  departments: "dynamicDepartments",
  departmentRegistry: "departmentRegistry"
};

const RESEARCH_ALLOWLIST = new Set([
  "stat.go.jp",
  "www.stat.go.jp",
  "meti.go.jp",
  "www.meti.go.jp",
  "chusho.meti.go.jp",
  "www.chusho.meti.go.jp",
  "jetro.go.jp",
  "www.jetro.go.jp",
  "soumu.go.jp",
  "www.soumu.go.jp",
  "cao.go.jp",
  "www.cao.go.jp",
  "digital.go.jp",
  "www.digital.go.jp",
  "data.go.jp",
  "www.data.go.jp",
  "oecd.org",
  "www.oecd.org",
  "worldbank.org",
  "data.worldbank.org"
]);

const DEFAULT_RESEARCH_URLS = [
  "https://www.stat.go.jp/",
  "https://www.meti.go.jp/",
  "https://www.chusho.meti.go.jp/",
  "https://www.jetro.go.jp/"
];

const DEFAULT_STATE = {
  goal:
    "事業を継続的に改善し、収益化できる機会を見つける",

  mode:
    "normal",

  running:
    true,

  waiting:
    false,

  cycleCount:
    0,

  organizationCycleCount:
    0,

  lastCycleAt:
    null,

  lastOrganizationCycleAt:
    null,

  currentFocus:
    "観測中",

  currentPlan:
    "",

  nextAction:
    "会社状態を分析して次の仕事を決定する",

  activeDepartments:
    BASE_DEPARTMENTS,

  runtimeVersion:
    RUNTIME_VERSION,

  executorAvailable:
    true,

  executorType:
    "cloud_d1_executor",

  researchGatewayAvailable:
    true,

  externalLoopAvailable:
    true,

  internalAutonomyAvailable:
    true,

  lastExecutionAt:
    null,

  lastResearchAt:
    null,

  lastReevaluationAt:
    null
};


// =====================================================
// Utility
// =====================================================

function now() {
  return new Date().toISOString();
}


function makeId(prefix) {
  return (
    `${prefix}_${Date.now()}_` +
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
  headers = {}
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

        ...headers
      }
    }
  );
}


function uniqueStrings(
  values
) {
  return [
    ...new Set(
      (
        Array.isArray(values)
          ? values
          : []
      )
        .map(
          value =>
            String(
              value || ""
            ).trim()
        )
        .filter(Boolean)
    )
  ];
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
      ),

    customer:
      String(
        value.customer || ""
      ),

    problem:
      String(
        value.problem || ""
      ),

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
      now(),

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
      null,

    publicationStatus:
      value.publicationStatus ||
      "not_published",

    paymentStatus:
      value.paymentStatus ||
      "not_connected",

    customerValidationCount:
      Number(
        value.customerValidationCount ||
        0
      )
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
      value.title ||
      "Untitled Task",

    priority:
      value.priority ||
      "normal",

    status:
      value.status ||
      "pending",

    runCount:
      Number(
        value.runCount ||
        0
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
      now(),

    updatedAt:
      value.updatedAt ||
      now(),

    evaluation:
      value.evaluation ??
      null,

    level:
      value.level ||
      "general",

    retryCount:
      Number(
        value.retryCount ||
        0
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
      null,

    internalOnly:
      Boolean(
        value.internalOnly
      ),

    department:
      value.department ||
      null,

    safeAutonomy:
      value.safeAutonomy !== false
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
      now(),

    decidedAt:
      value.decidedAt ||
      null,

    decision:
      value.decision ||
      null
  };
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
        "SELECT value_json FROM company_store WHERE key = ?"
      )
      .bind(key)
      .first();

  if (!row) {
    return clone(
      fallback
    );
  }

  try {
    return JSON.parse(
      row.value_json
    );
  } catch {
    return clone(
      fallback
    );
  }
}


async function setStore(
  env,
  key,
  value
) {
  await env.DB
    .prepare(
      `INSERT INTO company_store(
         key,
         value_json,
         updated_at
       )
       VALUES(
         ?,
         ?,
         ?
       )
       ON CONFLICT(key)
       DO UPDATE SET
         value_json =
           excluded.value_json,
         updated_at =
           excluded.updated_at`
    )
    .bind(
      key,
      JSON.stringify(value),
      now()
    )
    .run();
}


async function saveList(
  env,
  key,
  list
) {
  await setStore(
    env,
    key,
    list.slice(
      0,
      MAX_LIST
    )
  );
}


// =====================================================
// Logs / Memory
// =====================================================

async function addLog(
  env,
  source,
  message
) {
  const logs =
    await getStore(
      env,
      KEYS.engineLog,
      []
    );

  logs.unshift({
    id:
      makeId("log"),

    source,

    message,

    createdAt:
      now()
  });

  await saveList(
    env,
    KEYS.engineLog,
    logs
  );
}


async function addMemory(
  env,
  item
) {
  const memory =
    await getStore(
      env,
      KEYS.memory,
      []
    );

  memory.unshift(
    item
  );

  await saveList(
    env,
    KEYS.memory,
    memory
  );
}


// =====================================================
// Runtime Meta
// =====================================================

async function updateMeta(
  env,
  patch = {}
) {
  const row =
    await env.DB
      .prepare(
        "SELECT last_heartbeat_at, cycle_count FROM runtime_meta WHERE id=1"
      )
      .first();

  await env.DB
    .prepare(
      `UPDATE runtime_meta
       SET
         last_heartbeat_at = ?,
         cycle_count = ?,
         runtime_version = ?
       WHERE id = 1`
    )
    .bind(
      patch.heartbeat ??
        row?.last_heartbeat_at ??
        null,

      patch.cycles ??
        Number(
          row?.cycle_count ||
          0
        ),

      RUNTIME_VERSION
    )
    .run();
}


// =====================================================
// Basic Data
// =====================================================

async function getTasks(
  env
) {
  return getStore(
    env,
    KEYS.tasks,
    []
  );
}


async function getBusinesses(
  env
) {
  return getStore(
    env,
    KEYS.business,
    []
  );
}


async function findTask(
  env,
  taskId
) {
  const tasks =
    await getTasks(
      env
    );

  return (
    tasks.find(
      task =>
        task.id ===
        taskId
    ) ||
    null
  );
}


async function updateTask(
  env,
  taskId,
  updater
) {
  const tasks =
    await getTasks(
      env
    );

  const index =
    tasks.findIndex(
      task =>
        task.id ===
        taskId
    );

  if (
    index < 0
  ) {
    return null;
  }

  const next =
    normalizeTask(
      updater(
        normalizeTask(
          tasks[index]
        )
      )
    );

  next.updatedAt =
    now();

  tasks[index] =
    next;

  await saveList(
    env,
    KEYS.tasks,
    tasks
  );

  return next;
}


async function createTask(
  env,
  data
) {
  const tasks =
    await getTasks(
      env
    );

  const task =
    normalizeTask(
      data
    );

  tasks.unshift(
    task
  );

  await saveList(
    env,
    KEYS.tasks,
    tasks
  );

  return task;
}


async function setBusiness(
  env,
  businessId,
  patch
) {
  const businesses =
    await getBusinesses(
      env
    );

  const index =
    businesses.findIndex(
      business =>
        business.id ===
        businessId
    );

  if (
    index < 0
  ) {
    return null;
  }

  businesses[index] =
    normalizeBusiness({
      ...businesses[index],
      ...patch
    });

  await saveList(
    env,
    KEYS.business,
    businesses
  );

  return businesses[index];
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
    const existing =
      await findTask(
        env,
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

        executor:
          "Cloud Executor",

        source:
          "Business Discovery",

        level:
          "research",

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

  await setBusiness(
    env,
    business.id,
    {
      status:
        "researching",

      stage:
        "research",

      pipeline:
        "research",

      researchTaskId:
        task.id
    }
  );

  return task;
}


// =====================================================
// Capability Manager
// =====================================================

async function capabilitySnapshot(
  env
) {
  const businesses =
    await getBusinesses(
      env
    );

  const customers =
    await getStore(
      env,
      KEYS.customers,
      []
    );

  const outcomes =
    await getStore(
      env,
      KEYS.outcomes,
      []
    );

  const evidence =
    await getStore(
      env,
      KEYS.evidenceIndex,
      []
    );

  const stored =
    await getStore(
      env,
      KEYS.capabilities,
      {}
    );

  return {
    externalResearch:
      evidence.length >
      0,

    productGeneration:
      businesses.some(
        business =>
          Boolean(
            business.productTaskId
          )
      ),

    salesPreparation:
      businesses.some(
        business =>
          Boolean(
            business.salesTaskId
          )
      ),

    customerFeedback:
      customers.length >
      0,

    outcomeTracking:
      outcomes.length >
      0,

    revenueTracking:
      outcomes.some(
        outcome =>
          Number(
            outcome.revenue ||
            0
          ) > 0
      ),

    publication:
      businesses.some(
        business =>
          business.publicationStatus ===
          "published"
      ),

    payment:
      businesses.some(
        business =>
          business.paymentStatus ===
          "connected"
      ),

    selfDevelopment:
      Boolean(
        stored.selfDevelopment
      ),

    platformIndependence:
      Boolean(
        stored.platformIndependence
      ),

    developmentUnderConstruction:
      true,

    platformUnderConstruction:
      true,

    updatedAt:
      now()
  };
}


async function reconcileOrganization(
  env
) {
  const capabilities =
    await capabilitySnapshot(
      env
    );

  const existingNames =
    uniqueStrings(
      await getStore(
        env,
        KEYS.departments,
        BASE_DEPARTMENTS
      )
    );

  const names =
    new Set(
      existingNames
    );

  const registry =
    await getStore(
      env,
      KEYS.departmentRegistry,
      {}
    );

  const added =
    [];

  for (
    const base of BASE_DEPARTMENTS
  ) {
    names.add(
      base
    );

    if (
      !registry[base]
    ) {
      registry[base] =
        {
          name:
            base,

          type:
            "core",

          mission:
            "会社運営を支える中核部門",

          status:
            "active",

          createdAt:
            now()
        };
    }
  }

  const missing = {
    "調査":
      !capabilities.externalResearch,

    "顧客対応":
      !capabilities.customerFeedback,

    "事業成果":
      !capabilities.outcomeTracking,

    "開発基盤":
      !capabilities.selfDevelopment,

    "プラットフォーム戦略":
      !capabilities.platformIndependence
  };

  for (
    const [
      name,
      needed
    ]
    of Object.entries(
      missing
    )
  ) {
    if (!needed) {
      continue;
    }

    names.add(
      name
    );

    if (
      !registry[name]
    ) {
      registry[name] =
        {
          name,

          type:
            "generated",

          capabilityKey:
            GENERATED_DEPARTMENTS[
              name
            ].key,

          reason:
            GENERATED_DEPARTMENTS[
              name
            ].reason,

          mission:
            GENERATED_DEPARTMENTS[
              name
            ].mission,

          status:
            "active",

          createdAt:
            now(),

          selfGenerated:
            true
        };

      added.push(
        name
      );
    }
  }

  const departmentNames =
    uniqueStrings(
      [
        ...names
      ]
    );

  await setStore(
    env,
    KEYS.departments,
    departmentNames
  );

  await setStore(
    env,
    KEYS.departmentRegistry,
    registry
  );

  await setStore(
    env,
    KEYS.capabilities,
    {
      ...capabilities,

      departments:
        departmentNames,

      generatedDepartments:
        departmentNames.filter(
          name =>
            registry[name]?.type ===
            "generated"
        ),

      updatedAt:
        now()
    }
  );

  const state =
    await getStore(
      env,
      KEYS.companyState,
      DEFAULT_STATE
    );

  state.activeDepartments =
    departmentNames;

  state.runtimeVersion =
    RUNTIME_VERSION;

  state.internalAutonomyAvailable =
    true;

  await setStore(
    env,
    KEYS.companyState,
    state
  );

  if (
    added.length
  ) {
    await addMemory(
      env,
      {
        id:
          makeId(
            "memory"
          ),

        type:
          "organization_change",

        addedDepartments:
          added,

        reason:
          "能力ギャップから必要部門を自動生成",

        createdAt:
          now()
      }
    );

    await addLog(
      env,
      "Capability Manager",
      `必要能力に応じて部門を生成しました：${added.join("・")}`
    );
  }

  return {
    capabilities,

    departments:
      departmentNames,

    registry,

    addedDepartments:
      added
  };
}


// =====================================================
// Department Work Definition
// =====================================================

function internalWorkDefinition(
  name
) {
  const definitions =
    {
      "調査":
        {
          action:
            "department_research_readiness",

          objective:
            "外部調査の証拠取得・評価能力を整える",

          output:
            {
              workType:
                "research_capability",

              nextSteps:
                [
                  "許可された外部情報源を確認",

                  "証拠をD1に保存",

                  "出典と取得時刻を保持",

                  "仮説と証拠の差分を評価"
                ]
            }
        },

      "顧客対応":
        {
          action:
            "department_customer_readiness",

          objective:
            "顧客受付とフィードバック分析能力を整える",

          output:
            {
              workType:
                "customer_capability",

              nextSteps:
                [
                  "顧客要求を構造化",

                  "フィードバックを分類",

                  "頻出要求を抽出",

                  "CEO改善案へ渡す"
                ]
            }
        },

      "事業成果":
        {
          action:
            "department_outcome_readiness",

          objective:
            "事業成果・コスト・売上の記録能力を整える",

          output:
            {
              workType:
                "outcome_capability",

              nextSteps:
                [
                  "成果イベントを記録",

                  "収益とコストを分離",

                  "顧客数と成果を紐付け",

                  "CEO評価用指標を作る"
                ]
            }
        },

      "開発基盤":
        {
          action:
            "department_development_readiness",

          objective:
            "安全な自己開発・テスト・配備の基盤を設計する",

          output:
            {
              workType:
                "self_development_capability",

              nextSteps:
                [
                  "変更要求をタスク化",

                  "サンドボックスで検証",

                  "テスト結果を保存",

                  "承認境界を設定",

                  "本番変更はHuman Gateへ送る"
                ]
            }
        },

      "プラットフォーム戦略":
        {
          action:
            "department_platform_readiness",

          objective:
            "Cloudflare依存点を抽象化し移行可能な構造を作る",

          output:
            {
              workType:
                "platform_independence_capability",

              nextSteps:
                [
                  "Storage Adapterを分離",

                  "Scheduler Adapterを分離",

                  "Executor Adapterを分離",

                  "Web Adapterを分離",

                  "環境移行テストを可能にする"
                ]
            }
        },

      "企画":
        {
          action:
            "department_planning_review",

          objective:
            "会社目標と各部門の優先順位を再評価する",

          output:
            {
              workType:
                "planning_capability",

              nextSteps:
                [
                  "現在の目的を確認",

                  "重複仕事を削減",

                  "次の実験候補を整理"
                ]
            }
        },

      "技術":
        {
          action:
            "department_technical_review",

          objective:
            "実行基盤の安定性と技術負債を確認する",

          output:
            {
              workType:
                "technical_capability",

              nextSteps:
                [
                  "runtime状態確認",

                  "失敗経路確認",

                  "テスト候補整理"
                ]
            }
        },

      "財務":
        {
          action:
            "department_finance_review",

          objective:
            "収益・コスト計測の準備を確認する",

          output:
            {
              workType:
                "finance_capability",

              nextSteps:
                [
                  "収益データ項目定義",

                  "コスト項目定義",

                  "ROI計測準備"
                ]
            }
        },

      "リスク管理":
        {
          action:
            "department_risk_review",

          objective:
            "外部操作と自己変更の境界を確認する",

          output:
            {
              workType:
                "risk_capability",

              nextSteps:
                [
                  "Human Gate対象確認",

                  "外部操作禁止範囲確認",

                  "自己変更テスト境界確認"
                ]
            }
        }
    };

  return (
    definitions[name] ||
    {
      action:
        "department_generic_review",

      objective:
        "必要能力を整理する",

      output:
        {
          workType:
            "generic_capability",

          nextSteps:
            [
              "現状確認",

              "不足能力整理",

              "次タスク生成"
            ]
        }
    }
  );
}


// =====================================================
// Department Task Creation
// =====================================================

async function ensureDepartmentTasks(
  env,
  departmentNames
) {
  const tasks =
    await getTasks(
      env
    );

  const created =
    [];

  const registry =
    await getStore(
      env,
      KEYS.departmentRegistry,
      {}
    );

  for (
    const name of departmentNames
  ) {
    const definition =
      registry[name];

    if (!definition) {
      continue;
    }

    const active =
      tasks.find(
        task => {
          const t =
            normalizeTask(
              task
            );

          return (
            t.internalOnly &&
            t.department ===
              name &&
            [
              "pending",
              "running"
            ].includes(
              t.status
            )
          );
        }
      );

    if (active) {
      continue;
    }

    const alreadyCompleted =
      tasks.some(
        task => {
          const t =
            normalizeTask(
              task
            );

          return (
            t.internalOnly &&
            t.department ===
              name &&
            t.status ===
              "completed"
          );
        }
      );

    if (
      alreadyCompleted
    ) {
      continue;
    }

    const work =
      internalWorkDefinition(
        name
      );

    const task =
      await createTask(
        env,
        {
          id:
            makeId(
              "orgtask"
            ),

          title:
            `${name}部門:能力構築:${work.objective}`,

          priority:
            "normal",

          executor:
            "Cloud Executor",

          source:
            "Capability Manager",

          level:
            "internal_department_work",

          internalOnly:
            true,

          safeAutonomy:
            true,

          department:
            name,

          pipeline:
            {
              type:
                "organization_pipeline",

              stage:
                "department_capability_build",

              department:
                name
            }
        }
      );

    created.push(
      task
    );
  }

  return created;
}


// =====================================================
// Department Artifact
// =====================================================

function buildDepartmentArtifact(
  task
) {
  const definition =
    internalWorkDefinition(
      task.department
    );

  return {
    artifactType:
      "department_capability_plan",

    department:
      task.department,

    objective:
      definition.objective,

    workType:
      definition.output.workType,

    nextSteps:
      definition.output.nextSteps,

    autonomyBoundary:
      {
        allowed:
          [
            "D1への内部状態更新",

            "内部タスク生成",

            "内部成果物生成",

            "能力ギャップ分析"
          ],

        prohibited:
          [
            "外部公開",

            "決済",

            "契約",

            "資金移動",

            "重要な対外送信",

            "本番コードの無承認変更"
          ]
      },

    generatedBy:
      "Capability Manager",

    generatedAt:
      now(),

    sourceTaskId:
      task.id
  };
}


// =====================================================
// Internal Department Execution
// =====================================================

function definitionNextAction(
  department
) {
  if (
    department ===
    "開発基盤"
  ) {
    return:
      "Sandbox/Test/Deployの分離を実装する。";
  }

  if (
    department ===
    "プラットフォーム戦略"
  ) {
    return:
      "Storage/Scheduler/Executor/WebのAdapter境界を実装する。";
  }

  if (
    department ===
    "調査"
  ) {
    return:
      "外部証拠取得結果を事業仮説へ反映する。";
  }

  if (
    department ===
    "顧客対応"
  ) {
    return:
      "顧客フィードバックを改善タスクへ変換する。";
  }

  if (
    department ===
    "事業成果"
  ) {
    return:
      "成果・売上・コストをCEO評価へ接続する。";
  }

  return:
    "部門成果をCEOの次戦略へ渡す。";
}


async function executeInternalTask(
  env,
  task
) {
  const artifact =
    buildDepartmentArtifact(
      task
    );

  const artifactKey =
    `artifact:${task.id}`;

  await setStore(
    env,
    artifactKey,
    artifact
  );

  await updateTask(
    env,
    task.id,
    current => ({
      ...current,

      status:
        "completed",

      result:
        `部門「${task.department}」の能力構築作業を完了しました。`,

      cloudExecution:
        {
          action:
            "internal_department_capability_build",

          artifactKey,

          artifact,

          metrics:
            {
              internalOnly:
                true,

              externalActions:
                false,

              deployment:
                false
            },

          executedAt:
            now()
        },

      evaluation:
        {
          status:
            "success",

          level:
            "部門能力構築完了",

          summary:
            `${task.department}部門の役割と次の能力構築工程を定義しました。`,

          nextAction:
            definitionNextAction(
              task.department
            ),

          generatedAt:
            now()
        }
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
        "department_capability_build",

      department:
        task.department,

      taskId:
        task.id,

      summary:
        artifact.objective,

      createdAt:
        now()
    }
  );

  return artifact;
}


// =====================================================
// Self Organization Cycle
// =====================================================

async function selfOrganizationCycle(
  env,
  source = "internal"
) {
  const lock =
    await getStore(
      env,
      "organizationLock",
      null
    );

  if (
    lock &&
    Number(
      lock.at ||
      0
    ) >
      Date.now() -
      ORG_LOCK_MS
  ) {
    return {
      ok:
        true,

      status:
        "busy",

      source
    };
  }

  await setStore(
    env,
    "organizationLock",
    {
      at:
        Date.now(),

      source
    }
  );

  try {
    const organization =
      await reconcileOrganization(
        env
      );

    const created =
      await ensureDepartmentTasks(
        env,
        organization.departments
      );

    const executed =
      [];

    for (
      const task of created
    ) {
      executed.push(
        {
          taskId:
            task.id,

          department:
            task.department,

          artifact:
            await executeInternalTask(
              env,
              task
            )
        }
      );
    }

    const state =
      await getStore(
        env,
        KEYS.companyState,
        DEFAULT_STATE
      );

    state.organizationCycleCount =
      Number(
        state.organizationCycleCount ||
        0
      ) + 1;

    state.lastOrganizationCycleAt =
      now();

    state.runtimeVersion =
      RUNTIME_VERSION;

    state.internalAutonomyAvailable =
      true;

    await setStore(
      env,
      KEYS.companyState,
      state
    );

    await addLog(
      env,
      "Self Organization",
      `組織自律サイクル完了。部門=${organization.departments.length} 新規タスク=${created.length}`
    );

    return {
      ok:
        true,

      status:
        "organization_cycle_completed",

      source,

      departments:
        organization.departments,

      addedDepartments:
        organization.addedDepartments,

      createdTasks:
        created,

      executed,

      capabilities:
        organization.capabilities
    };

  } finally {
    await setStore(
      env,
      "organizationLock",
      null
    );
  }
}


// =====================================================
// Research Gateway
// =====================================================

function cleanText(
  value
) {
  return value
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      " "
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      " "
    )
    .replace(
      /<[^>]+>/g,
      " "
    )
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function safeResearchUrl(
  rawUrl
) {
  const url =
    new URL(
      rawUrl
    );

  if (
    !/^https?:$/.test(
      url.protocol
    )
  ) {
    throw new Error(
      "Only http/https URLs are allowed"
    );
  }

  if (
    url.username ||
    url.password
  ) {
    throw new Error(
      "URL credentials are not allowed"
    );
  }

  const host =
    url.hostname.toLowerCase();

  if (
    host ===
      "localhost" ||
    host ===
      "127.0.0.1" ||
    host ===
      "0.0.0.0" ||
    host ===
      "::1" ||
    host.endsWith(
      ".local"
    ) ||
    host.endsWith(
      ".internal"
    ) ||
    host.startsWith(
      "169.254."
    )
  ) {
    throw new Error(
      "Unsafe hostname"
    );
  }

  const allowed =
    RESEARCH_ALLOWLIST.has(
      host
    ) ||
    [
      ...RESEARCH_ALLOWLIST
    ].some(
      item =>
        host.endsWith(
          `.${item}`
        )
    );

  if (!allowed) {
    throw new Error(
      `Host is not allowlisted: ${host}`
    );
  }

  return url;
}


async function sha256(
  text
) {
  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        text
      )
    );

  return [
    ...new Uint8Array(
      digest
    )
  ]
    .map(
      value =>
        value
          .toString(16)
          .padStart(
            2,
            "0"
          )
    )
    .join("");
}


async function fetchEvidence(
  env,
  rawUrl,
  context = {}
) {
  const url =
    safeResearchUrl(
      rawUrl
    );

  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      RESEARCH_TIMEOUT_MS
    );

  try {
    const response =
      await fetch(
        url.toString(),
        {
          method:
            "GET",

          redirect:
            "follow",

          headers:
            {
              Accept:
                "text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.8",

              "User-Agent":
                "AI-Company-Core-Research-Gateway/6.1"
            },

          signal:
            controller.signal
        }
      );

    const raw =
      await response.text();

    const text =
      cleanText(
        raw
      ).slice(
        0,
        RESEARCH_PREVIEW
      );

    const titleMatch =
      raw.match(
        /<title[^>]*>([\s\S]*?)<\/title>/i
      );

    const evidence =
      {
        id:
          makeId(
            "evidence"
          ),

        url:
          url.toString(),

        hostname:
          url.hostname,

        status:
          response.status,

        ok:
          response.ok,

        title:
          titleMatch
            ? cleanText(
                titleMatch[1]
              ).slice(
                0,
                300
              )
            : "",

        contentType:
          response.headers.get(
            "content-type"
          ) ||
          "",

        preview:
          text,

        hash:
          await sha256(
            raw
          ),

        businessId:
          context.businessId ||
          null,

        topic:
          context.topic ||
          null,

        fetchedAt:
          now(),

        source:
          "External Research Gateway"
      };

    await setStore(
      env,
      `evidence:${evidence.id}`,
      evidence
    );

    const index =
      await getStore(
        env,
        KEYS.evidenceIndex,
        []
      );

    index.unshift(
      {
        id:
          evidence.id,

        url:
          evidence.url,

        status:
          evidence.status,

        title:
          evidence.title,

        businessId:
          evidence.businessId,

        fetchedAt:
          evidence.fetchedAt
      }
    );

    await saveList(
      env,
      KEYS.evidenceIndex,
      index
    );

    await addMemory(
      env,
      {
        id:
          makeId(
            "memory"
          ),

        type:
          "external_research",

        evidenceId:
          evidence.id,

        businessId:
          evidence.businessId,

        summary:
          evidence.title ||
          evidence.url,

        createdAt:
          now()
      }
    );

    return evidence;

  } finally {
    clearTimeout(
      timer
    );
  }
}


async function researchRun(
  env,
  input = {}
) {
  const urls =
    [
      ...new Set(
        (
          Array.isArray(
            input.urls
          )
            ? input.urls
            : DEFAULT_RESEARCH_URLS
        ).filter(
          Boolean
        )
      )
    ].slice(
      0,
      MAX_RESEARCH_SOURCES
    );

  const results =
    [];

  for (
    const url of urls
  ) {
    try {
      results.push(
        await fetchEvidence(
          env,
          url,
          {
            businessId:
              input.businessId ||
              null,

            topic:
              input.topic ||
              ""
          }
        )
      );
    } catch (
      error
    ) {
      results.push(
        {
          ok:
            false,

          url,

          error:
            String(
              error.message ||
              error
            )
        }
      );
    }
  }

  return {
    id:
      makeId(
        "research_run"
      ),

    topic:
      input.topic ||
      "",

    businessId:
      input.businessId ||
      null,

    requestedUrls:
      urls,

    successful:
      results.filter(
        item =>
          item.ok
      ).length,

    failed:
      results.filter(
        item =>
          !item.ok
      ).length,

    results,

    createdAt:
      now()
  };
}


// =====================================================
// Core Business Pipeline
// =====================================================

function taskAction(
  task
) {
  const stage =
    task?.pipeline?.stage ||
    task.level ||
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


function businessResearchArtifact(
  task,
  business,
  research
) {
  return {
    artifactType:
      "research_brief",

    title:
      `${business?.name || task.title} — 市場調査ブリーフ`,

    targetCustomer:
      business?.customer ||
      "未定義",

    problem:
      business?.problem ||
      "未定義",

    researchQuestions:
      [
        "顧客は現在どのように市場調査を行っているか",

        "調査にどれくらいの時間・費用をかけているか",

        "どの情報が意思決定に重要か",

        "既存サービスとの差は何か",

        "継続利用する理由は何か"
      ],

    evidence:
      research,

    externalEvidenceAvailable:
      research.successful >
      0,

    generatedBy:
      "Cloud Executor",

    generatedAt:
      now(),

    sourceTaskId:
      task.id
  };
}


function productArtifact(
  task,
  business
) {
  return {
    artifactType:
      "product_prototype",

    title:
      `${business?.name || task.title} — 最小商品プロトタイプ`,

    productConcept:
      "小規模事業者向け市場調査レポートを短時間で作成できるサービス",

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

    validationPlan:
      [
        "小規模テスト",
        "所要時間測定",
        "修正回数記録",
        "購入意向確認"
      ],

    generatedBy:
      "Cloud Executor",

    generatedAt:
      now(),

    sourceTaskId:
      task.id
  };
}


function salesArtifact(
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

    salesMessage:
      "市場調査の設計から整理までを支援し、意思決定に使える形へまとめます。",

    acquisitionChannels:
      [
        "直接営業",
        "紹介",
        "公開ページ",
        "コミュニティ"
      ],

    publicationStatus:
      business?.publicationStatus ||
      "not_published",

    paymentStatus:
      business?.paymentStatus ||
      "not_connected",

    generatedBy:
      "Cloud Executor",

    generatedAt:
      now(),

    sourceTaskId:
      task.id
  };
}


function salesEvaluationArtifact(
  task,
  business,
  evidenceCount
) {
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
          Number(
            business?.customerValidationCount ||
            0
          ) > 0,

        paymentConnected:
          business?.paymentStatus ===
          "connected",

        publicationConnected:
          business?.publicationStatus ===
          "published",

        externalEvidence:
          evidenceCount >
          0
      },

    gaps:
      [
        ...(Number(
          business?.customerValidationCount ||
          0
        ) === 0
          ? [
              "実顧客による検証"
            ]
          : []),

        ...(evidenceCount ===
        0
          ? [
              "外部市場データ"
            ]
          : []),

        ...(business?.publicationStatus !==
        "published"
          ? [
              "公開導線"
            ]
          : []),

        ...(business?.paymentStatus !==
        "connected"
          ? [
              "決済導線"
            ]
          : [])
      ],

    ready_for_human_gate:
      true,

    generatedBy:
      "Cloud Executor",

    generatedAt:
      now(),

    sourceTaskId:
      task.id
  };
}


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
  let research =
    null;

  if (
    action ===
    "research_brief"
  ) {
    research =
      await researchRun(
        env,
        {
          businessId:
            business?.id ||
            null,

          topic:
            business?.problem ||
            business?.name ||
            task.title
        }
      );

    artifact =
      businessResearchArtifact(
        task,
        business,
        research
      );

  } else if (
    action ===
    "product_prototype"
  ) {
    artifact =
      productArtifact(
        task,
        business
      );

  } else if (
    action ===
    "sales_package_generation"
  ) {
    artifact =
      salesArtifact(
        task,
        business
      );

  } else if (
    action ===
    "sales_evaluation"
  ) {
    const evidence =
      await getStore(
        env,
        KEYS.evidenceIndex,
        []
      );

    artifact =
      salesEvaluationArtifact(
        task,
        business,
        evidence.length
      );

  } else {
    artifact =
      {
        artifactType:
          "generic_execution",

        title:
          `${task.title} — 実行レポート`,

        message:
          `Cloud Executorでタスク「${task.title}」を実行しました。`,

        generatedBy:
          "Cloud Executor",

        generatedAt:
          now(),

        sourceTaskId:
          task.id
      };
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

    research,

    result:
      `Cloud Executorで${action}を実行し、D1へ成果物を保存しました。`,

    metrics:
      {
        artifact_saved:
          true,

        execution_available:
          true,

        external_read:
          Boolean(
            research
          ),

        external_actions:
          false,

        external_ai:
          false
      },

    executedAt:
      now()
  };
}


// =====================================================
// Pipeline Advancement
// =====================================================

async function advancePipeline(
  env,
  task,
  execution,
  business
) {
  if (!business) {
    return {
      nextTask:
        null,

      humanGate:
        null
    };
  }

  if (
    execution.action ===
    "research_brief"
  ) {
    await setBusiness(
      env,
      business.id,
      {
        status:
          "research_completed",

        stage:
          "product",

        pipeline:
          "product"
      }
    );

    return {
      nextTask:
        await createProductTask(
          env,
          {
            ...business,

            productTaskId:
              null
          },

          task
        ),

      humanGate:
        null
    };
  }

  if (
    execution.action ===
    "product_prototype"
  ) {
    await setBusiness(
      env,
      business.id,
      {
        status:
          "product_completed",

        stage:
          "sales_preparation",

        pipeline:
          "sales"
      }
    );

    return {
      nextTask:
        await createSalesTask(
          env,
          {
            ...business,

            salesTaskId:
              null
          },

          task
        ),

      humanGate:
        null
    };
  }

  if (
    execution.action ===
    "sales_package_generation"
  ) {
    await setBusiness(
      env,
      business.id,
      {
        status:
          "sales_package_completed",

        stage:
          "sales_evaluation",

        pipeline:
          "sales_evaluation"
      }
    );

    return {
      nextTask:
        await createSalesEvaluationTask(
          env,
          {
            ...business,

            salesEvaluationTaskId:
              null
          },

          task
        ),

      humanGate:
        null
    };
  }

  if (
    execution.action ===
    "sales_evaluation"
  ) {
    await setBusiness(
      env,
      business.id,
      {
        status:
          "waiting_human",

        stage:
          "human_approval",

        pipeline:
          "human_gate"
      }
    );

    return {
      nextTask:
        null,

      humanGate:
        await createHumanGate(
          env,
          {
            ...business,

            humanGateTaskId:
              null
          },

          task
        )
    };
  }

  return {
    nextTask:
      null,

    humanGate:
      null
  };
}


// =====================================================
// Create Pipeline Tasks
// =====================================================

async function createProductTask(
  env,
  business,
  parent
) {
  if (
    business.productTaskId
  ) {
    const existing =
      await findTask(
        env,
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
          makeId(
            "task"
          ),

        title:
          `商品設計・試作:${business.name}`,

        executor:
          "Cloud Executor",

        source:
          "Research Result",

        level:
          "product",

        parentTaskId:
          parent?.id ||
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

  await setBusiness(
    env,
    business.id,
    {
      status:
        "product_building",

      stage:
        "product",

      pipeline:
        "product",

      productTaskId:
        task.id
    }
  );

  return task;
}


async function createSalesTask(
  env,
  business,
  parent
) {
  if (
    business.salesTaskId
  ) {
    const existing =
      await findTask(
        env,
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
          makeId(
            "task"
          ),

        title:
          `販売準備:${business.name}`,

        executor:
          "Cloud Executor",

        source:
          "Product Result",

        level:
          "sales",

        parentTaskId:
          parent?.id ||
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

  await setBusiness(
    env,
    business.id,
    {
      status:
        "sales_preparing",

      stage:
        "sales_preparation",

      pipeline:
        "sales",

      salesTaskId:
        task.id
    }
  );

  return task;
}


async function createSalesEvaluationTask(
  env,
  business,
  parent
) {
  if (
    business.salesEvaluationTaskId
  ) {
    const existing =
      await findTask(
        env,
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
          makeId(
            "task"
          ),

        title:
          `販売構成評価:${business.name}`,

        executor:
          "Cloud Executor",

        source:
          "Sales Package Result",

        level:
          "sales_evaluation",

        parentTaskId:
          parent?.id ||
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

  await setBusiness(
    env,
    business.id,
    {
      status:
        "sales_evaluating",

      stage:
        "sales_evaluation",

      pipeline:
        "sales_evaluation",

      salesEvaluationTaskId:
        task.id
    }
  );

  return task;
}


async function createHumanGate(
  env,
  business,
  parent
) {
  if (
    business.humanGateTaskId
  ) {
    const existing =
      await findTask(
        env,
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
          makeId(
            "task"
          ),

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
          },

        parentTaskId:
          parent?.id ||
          null,

        internalOnly:
          false,

        safeAutonomy:
          false
      }
    );

  const gate =
    normalizeGate({
      id:
        makeId(
          "gate"
        ),

      taskId:
        task.id,

      taskTitle:
        task.title,

      reason:
        "外部公開・顧客向け提供などの不可逆な外部行動には人間承認が必要です。"
    });

  const gates =
    await getStore(
      env,
      KEYS.humanGates,
      []
    );

  gates.unshift(
    gate
  );

  await saveList(
    env,
    KEYS.humanGates,
    gates
  );

  await updateTask(
    env,
    task.id,
    current => ({
      ...current,

      status:
        "waiting_human",

      humanGateId:
        gate.id,

      requiresHuman:
        true
    })
  );

  await setBusiness(
    env,
    business.id,
    {
      status:
        "waiting_human",

      stage:
        "human_approval",

      pipeline:
        "human_gate",

      humanGateTaskId:
        task.id
    }
  );

  return {
    task:
      normalizeTask(
        await findTask(
          env,
          task.id
        )
      ),

    gate
  };
}


// =====================================================
// Evaluation
// =====================================================

async function evaluateExecution(
  execution
) {
  if (
    execution.action ===
    "research_brief"
  ) {
    return {
      status:
        "success",

      action:
        execution.action,

      level:
        execution.research?.successful >
        0
          ? "外部調査取得成功・検証継続"
          : "調査設計成功・外部取得失敗",

      summary:
        execution.research?.successful >
        0
          ? "外部情報を取得し、証拠をD1へ保存しました。"
          : "調査設計は成功しましたが、外部証拠は取得できませんでした。",

      nextAction:
        "外部証拠と商品仮説を合わせて次の検証を行う。",

      readyForHumanGate:
        false,

      generatedAt:
        now()
    };
  }

  if (
    execution.action ===
    "sales_evaluation"
  ) {
    return {
      status:
        "success",

      action:
        execution.action,

      level:
        "販売構成評価完了・公開承認待ち",

      summary:
        "販売構成の評価が完了し、Human Gate候補になりました。",

      nextAction:
        "Human Gateで公開承認の判断を待つ。",

      readyForHumanGate:
        true,

      generatedAt:
        now()
    };
  }

  return {
    status:
      "success",

    action:
      execution.action,

    level:
      execution.action ===
        "product_prototype"
        ? "商品構成成功・顧客検証前"
        : execution.action ===
          "sales_package_generation"
          ? "販売準備成功・事業成果確認前"
          : "実行成功・成果確認前",

    summary:
      "Cloud Executorの処理が完了しました。",

    nextAction:
      execution.action ===
        "product_prototype"
        ? "販売パッケージを作成する。"
        : execution.action ===
          "sales_package_generation"
          ? "販売構成を評価する。"
          : "結果を確認して次の仕事を決める。",

    readyForHumanGate:
      false,

    generatedAt:
      now()
  };
}


// =====================================================
// Pending Executor
// =====================================================

async function executePendingTask(
  env,
  source
) {
  const candidates =
    (
      await getTasks(
        env
      )
    )
      .map(
        normalizeTask
      )
      .filter(
        task =>
          task.status ===
            "pending" &&
          !task.internalOnly
      )
      .sort(
        (
          a,
          b
        ) => {
          const priority =
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
              priority[
                a.priority
              ] ||
              2
            ) -
            (
              priority[
                b.priority
              ] ||
              2
            )
          ) ||
          (
            new Date(
              a.createdAt
            ) -
            new Date(
              b.createdAt
            )
          );
        }
      );

  const task =
    candidates[0];

  if (!task) {
    return {
      ok:
        true,

      status:
        "no_pending_task",

      source
    };
  }

  const running =
    await updateTask(
      env,
      task.id,
      current => ({
        ...current,

        status:
          "running",

        runCount:
          current.runCount +
          1,

        lastRunAt:
          now(),

        executor:
          "Cloud Executor"
      })
    );

  try {
    const businesses =
      await getBusinesses(
        env
      );

    const business =
      businesses.find(
        item =>
          item.id ===
          running
            ?.pipeline
            ?.businessId
      );

    const execution =
      await executeCloudTask(
        env,
        running,
        business
          ? normalizeBusiness(
              business
            )
          : null
      );

    const evaluation =
      await evaluateExecution(
        execution
      );

    const done =
      await updateTask(
        env,
        running.id,
        current => ({
          ...current,

          status:
            "completed",

          result:
            execution.result,

          evaluation,

          cloudExecution:
            execution,

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
          done.id,

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

        createdAt:
          now()
      }
    );

    const next =
      await advancePipeline(
        env,
        done,
        execution,
        business
          ? normalizeBusiness(
              business
            )
          : null
      );

    const state =
      await getStore(
        env,
        KEYS.companyState,
        DEFAULT_STATE
      );

    state.lastExecutionAt =
      now();

    state.currentFocus =
      evaluation.level;

    state.currentPlan =
      business
        ? `「${business.name}」の次工程を進める`
        : done.title;

    state.nextAction =
      next.humanGate
        ? "Human Gateの承認を待つ"
        : next.nextTask
          ? `次のタスク「${next.nextTask.title}」を実行する`
          : evaluation.nextAction;

    state.waiting =
      Boolean(
        next.humanGate
      );

    state.runtimeVersion =
      RUNTIME_VERSION;

    await setStore(
      env,
      KEYS.companyState,
      state
    );

    return {
      ok:
        true,

      status:
        "task_executed",

      source,

      task:
        done,

      execution,

      evaluation,

      nextTask:
        next.nextTask ||
        null,

      humanGate:
        next.humanGate ||
        null
    };

  } catch (
    error
  ) {
    const failed =
      await updateTask(
        env,
        running.id,
        current => {
          const retry =
            current.retryCount +
            1;

          return {
            ...current,

            status:
              retry <=
              MAX_RETRIES
                ? "pending"
                : "failed",

            retryCount:
              retry,

            result:
              `Cloud Executor error: ${
                error.message ||
                error
              }`
          };
        }
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
// CEO Cycle
// =====================================================

async function companyCycle(
  env,
  source = "manual"
) {
  const lock =
    await getStore(
      env,
      "cycleLock",
      null
    );

  if (
    lock &&
    Number(
      lock.at ||
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

      source
    };
  }

  await setStore(
    env,
    "cycleLock",
    {
      at:
        Date.now(),

      source
    }
  );

  try {
    const state =
      await getStore(
        env,
        KEYS.companyState,
        DEFAULT_STATE
      );

    const gates =
      await getStore(
        env,
        KEYS.humanGates,
        []
      );

    const tasks =
      await getTasks(
        env
      );

    state.cycleCount =
      Number(
        state.cycleCount ||
        0
      ) + 1;

    state.lastCycleAt =
      now();

    state.runtimeVersion =
      RUNTIME_VERSION;

    await updateMeta(
      env,
      {
        cycles:
          state.cycleCount
      }
    );

    const pendingGate =
      gates
        .map(
          normalizeGate
        )
        .find(
          gate =>
            gate.status ===
            "pending"
        );

    if (
      pendingGate
    ) {
      state.waiting =
        true;

      state.currentFocus =
        "人間承認待ち";

      state.nextAction =
        "Human Gateの承認を待つ";

      await setStore(
        env,
        KEYS.companyState,
        state
      );

      return {
        ok:
          true,

        status:
          "waiting_human",

        source,

        cycleCount:
          state.cycleCount,

        pendingGate
      };
    }

    const pending =
      tasks
        .map(
          normalizeTask
        )
        .filter(
          task =>
            task.status ===
              "pending" &&
            !task.internalOnly
        );

    if (
      pending.length
    ) {
      state.currentFocus =
        "Cloud Executor実行";

      state.currentPlan =
        pending[0].title;

      state.nextAction =
        "Cloud Executorでタスクを実行する";

      await setStore(
        env,
        KEYS.companyState,
        state
      );

      return {
        ...(
          await executePendingTask(
            env,
            source
          )
        ),

        cycleCount:
          state.cycleCount
      };
    }

    const businesses =
      await getBusinesses(
        env
      );

    if (
      !businesses.length
    ) {
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
            "市場調査や競合調査に時間がかかる"
        });

      await saveList(
        env,
        KEYS.business,
        [
          business
        ]
      );

      await createResearchTask(
        env,
        business
      );

      return {
        ok:
          true,

        status:
          "business_discovered",

        cycleCount:
          state.cycleCount,

        business
      };
    }

    state.currentFocus =
      "観測中";

    state.nextAction =
      "能力ギャップと事業結果を評価する";

    await setStore(
      env,
      KEYS.companyState,
      state
    );

    return {
      ok:
        true,

      status:
        "waiting_for_work",

      cycleCount:
        state.cycleCount
    };

  } finally {
    await setStore(
      env,
      "cycleLock",
      null
    );
  }
}


// =====================================================
// Customer / Outcome
// =====================================================

async function createFeedbackTask(
  env,
  businessId
) {
  const tasks =
    await getTasks(
      env
    );

  const active =
    tasks.find(
      task => {
        const t =
          normalizeTask(
            task
          );

        return (
          t.internalOnly ===
            false &&

          t.pipeline?.stage ===
            "feedback_analysis" &&

          t.pipeline?.businessId ===
            businessId &&

          [
            "pending",
            "running"
          ].includes(
            t.status
          )
        );
      }
    );

  if (
    active
  ) {
    return normalizeTask(
      active
    );
  }

  return createTask(
    env,
    {
      id:
        makeId(
          "task"
        ),

      title:
        "顧客フィードバック分析",

      executor:
        "Cloud Executor",

      source:
        "Customer Gateway",

      level:
        "feedback_analysis",

      pipeline:
        {
          type:
            "company_loop",

          stage:
            "feedback_analysis",

          businessId
        }
    }
  );
}


async function createOutcomeTask(
  env,
  businessId
) {
  const tasks =
    await getTasks(
      env
    );

  const active =
    tasks.find(
      task => {
        const t =
          normalizeTask(
            task
          );

        return (
          t.internalOnly ===
            false &&

          t.pipeline?.stage ===
            "outcome_analysis" &&

          t.pipeline?.businessId ===
            businessId &&

          [
            "pending",
            "running"
          ].includes(
            t.status
          )
        );
      }
    );

  if (
    active
  ) {
    return normalizeTask(
      active
    );
  }

  return createTask(
    env,
    {
      id:
        makeId(
          "task"
        ),

      title:
        "事業成果分析",

      executor:
        "Cloud Executor",

      source:
        "Outcome Gateway",

      level:
        "outcome_analysis",

      pipeline:
        {
          type:
            "company_loop",

          stage:
            "outcome_analysis",

          businessId
        }
    }
  );
}


// =====================================================
// Health
// =====================================================

async function health(
  env
) {
  await updateMeta(
    env,
    {}
  );

  const metaRow =
    await env.DB
      .prepare(
        "SELECT last_heartbeat_at, cycle_count, runtime_version FROM runtime_meta WHERE id=1"
      )
      .first();

  const state =
    await getStore(
      env,
      KEYS.companyState,
      DEFAULT_STATE
    );

  const tasks =
    await getTasks(
      env
    );

  const businesses =
    await getBusinesses(
      env
    );

  const gates =
    await getStore(
      env,
      KEYS.humanGates,
      []
    );

  const evidence =
    await getStore(
      env,
      KEYS.evidenceIndex,
      []
    );

  const customers =
    await getStore(
      env,
      KEYS.customers,
      []
    );

  const outcomes =
    await getStore(
      env,
      KEYS.outcomes,
      []
    );

  const departments =
    uniqueStrings(
      await getStore(
        env,
        KEYS.departments,
        BASE_DEPARTMENTS
      )
    );

  const capabilities =
    await getStore(
      env,
      KEYS.capabilities,
      {}
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
      metaRow,

    company:
      {
        cycleCount:
          state.cycleCount,

        organizationCycleCount:
          state.organizationCycleCount ||
          0,

        currentFocus:
          state.currentFocus,

        nextAction:
          state.nextAction,

        pendingTasks:
          tasks.filter(
            task =>
              normalizeTask(
                task
              ).status ===
                "pending" &&
              !normalizeTask(
                task
              ).internalOnly
          ).length,

        pendingInternalTasks:
          tasks.filter(
            task =>
              normalizeTask(
                task
              ).status ===
                "pending" &&
              normalizeTask(
                task
              ).internalOnly
          ).length,

        businessCount:
          businesses.length,

        pendingHumanGates:
          gates.filter(
            gate =>
              normalizeGate(
                gate
              ).status ===
              "pending"
          ).length,

        evidenceCount:
          evidence.length,

        customerCount:
          customers.length,

        outcomeCount:
          outcomes.length,

        departmentCount:
          departments.length
      },

    capabilities:
      [
        "cloud_ceo_cycle",

        "d1_persistent_state",

        "business_discovery",

        "cloud_executor",

        "external_read_only_research",

        "research_evidence",

        "customer_intake",

        "outcome_tracking",

        "ceo_reevaluation",

        "capability_manager",

        "dynamic_departments",

        "self_organization_cycle",

        "internal_autonomous_tasks",

        "human_gate_detection",

        "cloud_heartbeat"
      ],

    capability_state:
      capabilities,

    execution_available:
      true,

    external_read:
      true,

    internal_autonomy_available:
      true,

    external_actions:
      false,

    external_ai:
      false,

    departments,

    time:
      now()
  };
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


      if (
        url.pathname ===
        "/api/heartbeat"
      ) {
        const time =
          now();

        await updateMeta(
          env,
          {
            heartbeat:
              time
          }
        );

        return json({
          ok:
            true,

          heartbeat:
            true,

          runtime:
            RUNTIME_VERSION,

          time
        });
      }


      if (
        url.pathname ===
        "/api/cycle"
      ) {
        return json(
          await companyCycle(
            env,
            "manual"
          )
        );
      }


      // ===============================================
      // INTERNAL SELF ORGANIZATION
      // ===============================================

      if (
        url.pathname ===
        "/api/self-organization/cycle"
      ) {
        return json(
          await selfOrganizationCycle(
            env,
            "manual"
          )
        );
      }


      // ===============================================
      // DEPARTMENT REGISTRY
      // ===============================================

      if (
        url.pathname ===
        "/api/departments"
      ) {
        return json({
          ok:
            true,

          departments:
            uniqueStrings(
              await getStore(
                env,
                KEYS.departments,
                BASE_DEPARTMENTS
              )
            ),

          registry:
            await getStore(
              env,
              KEYS.departmentRegistry,
              {}
            ),

          capabilities:
            await capabilitySnapshot(
              env
            ),

          time:
            now()
        });
      }


      // ===============================================
      // CAPABILITY MANAGER
      // ===============================================

      if (
        url.pathname ===
        "/api/capabilities"
      ) {
        const result =
          await reconcileOrganization(
            env
          );

        return json({
          ok:
            true,

          data:
            result,

          time:
            now()
        });
      }


      // ===============================================
      // CEO RE-EVALUATION
      // ===============================================

      if (
        url.pathname ===
        "/api/ceo/reevaluate"
      ) {
        const result =
          await reconcileOrganization(
            env
          );

        await addMemory(
          env,
          {
            id:
              makeId(
                "memory"
              ),

            type:
              "ceo_reevaluation",

            summary:
              "能力ギャップと組織状態を再評価しました。",

            departments:
              result.departments,

            capabilities:
              result.capabilities,

            createdAt:
              now()
          }
        );

        return json({
          ok:
            true,

          status:
            "reevaluated",

          organization:
            result,

          time:
            now()
        });
      }


      // ===============================================
      // STATE
      // ===============================================

      if (
        url.pathname ===
        "/api/state"
      ) {
        const key =
          url.searchParams.get(
            "key"
          );

        if (
          !key ||
          !Object.values(
            KEYS
          ).includes(
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

        return json({
          ok:
            true,

          key,

          data:
            await getStore(
              env,
              key,
              null
            ),

          time:
            now()
        });
      }


      // ===============================================
      // ARTIFACT
      // ===============================================

      if (
        url.pathname ===
        "/api/artifact"
      ) {
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

        const artifact =
          await getStore(
            env,
            `artifact:${taskId}`,
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

        return json({
          ok:
            true,

          taskId,

          artifact,

          time:
            now()
        });
      }


      // ===============================================
      // RESEARCH RUN
      // ===============================================

      if (
        url.pathname ===
        "/api/research/run"
      ) {
        let body =
          {};

        if (
          request.method ===
          "POST"
        ) {
          body =
            await request.json();
        } else {
          body =
            {
              topic:
                url.searchParams.get(
                  "topic"
                ) ||
                "",

              businessId:
                url.searchParams.get(
                  "businessId"
                ) ||
                null,

              urls:
                (
                  url.searchParams.get(
                    "urls"
                  ) ||
                  ""
                )
                  .split(",")
                  .map(
                    value =>
                      value.trim()
                  )
                  .filter(
                    Boolean
                  )
            };
        }

        return json({
          ok:
            true,

          researchRun:
            await researchRun(
              env,
              body
            )
        });
      }


      // ===============================================
      // RESEARCH EVIDENCE
      // ===============================================

      if (
        url.pathname ===
        "/api/research/evidence"
      ) {
        const evidenceId =
          url.searchParams.get(
            "id"
          );

        if (!evidenceId) {
          return json(
            {
              ok:
                false,

              error:
                "id is required"
            },
            400
          );
        }

        const evidence =
          await getStore(
            env,
            `evidence:${evidenceId}`,
            null
          );

        if (!evidence) {
          return json(
            {
              ok:
                false,

              error:
                "evidence_not_found"
            },
            404
          );
        }

        return json({
          ok:
            true,

          evidence,

          time:
            now()
        });
      }


      // ===============================================
      // CUSTOMER INTAKE
      // ===============================================

      if (
        url.pathname ===
        "/api/customer/intake"
      ) {
        if (
          request.method !==
          "POST"
        ) {
          return json(
            {
              ok:
                false,

              error:
                "POST required"
            },
            405,
            {
              Allow:
                "POST"
            }
          );
        }

        const body =
          await request.json();

        const record =
          {
            id:
              makeId(
                "customer"
              ),

            businessId:
              body.businessId ||
              null,

            name:
              String(
                body.name ||
                "anonymous"
              ),

            contact:
              String(
                body.contact ||
                ""
              ),

            request:
              String(
                body.request ||
                ""
              ),

            feedback:
              String(
                body.feedback ||
                ""
              ),

            createdAt:
              now(),

            source:
              "Customer Gateway"
          };

        const customers =
          await getStore(
            env,
            KEYS.customers,
            []
          );

        customers.unshift(
          record
        );

        await saveList(
          env,
          KEYS.customers,
          customers
        );

        if (
          record.businessId
        ) {
          const currentBusinesses =
            await getBusinesses(
              env
            );

          const business =
            currentBusinesses.find(
              b =>
                b.id ===
                record.businessId
            );

          await setBusiness(
            env,
            record.businessId,
            {
              customerValidationCount:
                Number(
                  business?.customerValidationCount ||
                  0
                ) + 1
            }
          );

          await createFeedbackTask(
            env,
            record.businessId
          );
        }

        await addMemory(
          env,
          {
            id:
              makeId(
                "memory"
              ),

            type:
              "customer_intake",

            customerId:
              record.id,

            businessId:
              record.businessId,

            summary:
              record.feedback ||
              record.request,

            createdAt:
              now()
          }
        );

        return json({
          ok:
            true,

          status:
            "accepted",

          customer:
            record
        });
      }


      // ===============================================
      // OUTCOME
      // ===============================================

      if (
        url.pathname ===
        "/api/outcome"
      ) {
        if (
          request.method !==
          "POST"
        ) {
          return json(
            {
              ok:
                false,

              error:
                "POST required"
            },
            405,
            {
              Allow:
                "POST"
            }
          );
        }

        const body =
          await request.json();

        const outcome =
          {
            id:
              makeId(
                "outcome"
              ),

            businessId:
              body.businessId ||
              null,

            result:
              String(
                body.result ||
                "unknown"
              ),

            revenue:
              Number(
                body.revenue ||
                0
              ),

            cost:
              Number(
                body.cost ||
                0
              ),

            customerCount:
              Number(
                body.customerCount ||
                0
              ),

            note:
              String(
                body.note ||
                ""
              ),

            createdAt:
              now(),

            source:
              "Outcome Gateway"
          };

        const outcomes =
          await getStore(
            env,
            KEYS.outcomes,
            []
          );

        outcomes.unshift(
          outcome
        );

        await saveList(
          env,
          KEYS.outcomes,
          outcomes
        );

        if (
          outcome.businessId
        ) {
          await createOutcomeTask(
            env,
            outcome.businessId
          );
        }

        await addMemory(
          env,
          {
            id:
              makeId(
                "memory"
              ),

            type:
              "business_outcome",

            outcomeId:
              outcome.id,

            businessId:
              outcome.businessId,

            revenue:
              outcome.revenue,

            summary:
              outcome.note ||
              outcome.result,

            createdAt:
              now()
          }
        );

        return json({
          ok:
            true,

          status:
            "recorded",

          outcome
        });
      }


      // ===============================================
      // PUBLIC PREVIEW
      // ===============================================

      if (
        url.pathname ===
        "/api/public/preview"
      ) {
        const businessId =
          url.searchParams.get(
            "businessId"
          );

        if (!businessId) {
          return json(
            {
              ok:
                false,

              error:
                "businessId is required"
            },
            400
          );
        }

        const business =
          (
            await getBusinesses(
              env
            )
          ).find(
            item =>
              item.id ===
              businessId
          );

        if (!business) {
          return json(
            {
              ok:
                false,

              error:
                "business_not_found"
            },
            404
          );
        }

        return json({
          ok:
            true,

          published:
            business.publicationStatus ===
            "published",

          publicationStatus:
            business.publicationStatus,

          message:
            business.publicationStatus ===
            "published"
              ? "公開モード"
              : "プレビューのみ。Human Gate未承認のため公開していません。",

          business:
            normalizeBusiness(
              business
            ),

          time:
            now()
        });
      }


      return env.ASSETS.fetch(
        request
      );

    } catch (
      error
    ) {
      console.error(
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
      (
        async () => {
          await companyCycle(
            env,
            "cron"
          );

          await selfOrganizationCycle(
            env,
            "cron-internal"
          );

          await updateMeta(
            env,
            {
              heartbeat:
                now()
            }
          );
        }
      )().catch(
        error =>
          console.error(
            "scheduled error",
            error
          )
      )
    );
  }
};
