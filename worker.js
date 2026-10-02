const RUNTIME_VERSION = "6.0-external-company-loop";
const MAX_LOGS = 150;
const MAX_MEMORY = 150;
const MAX_LIST = 250;
const CYCLE_LOCK_MS = 10 * 60 * 1000;
const MAX_RETRIES = 2;
const RESEARCH_TIMEOUT_MS = 8000;
const RESEARCH_PREVIEW = 8000;
const MAX_RESEARCH_SOURCES = 4;

const DEPARTMENTS = [
  "企画",
  "技術",
  "財務",
  "リスク管理"
];

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
  departments: "dynamicDepartments"
};

const DEFAULT_STATE = {
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

  activeDepartments: DEPARTMENTS,

  runtimeVersion: RUNTIME_VERSION,

  executorAvailable: true,

  executorType: "cloud_d1_executor",

  researchGatewayAvailable: true,

  externalLoopAvailable: true,

  lastExecutionAt: null,

  lastResearchAt: null,

  lastReevaluationAt: null
};


// =====================================================
// Utility
// =====================================================

const now = () =>
  new Date().toISOString();

const makeId = prefix =>
  `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

const clone = value =>
  JSON.parse(
    JSON.stringify(value)
  );


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
    return clone(fallback);
  }

  try {
    return JSON.parse(
      row.value_json
    );
  } catch {
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
      `INSERT INTO company_store(
         key,
         value_json,
         updated_at
       )
       VALUES(?,?,?)
       ON CONFLICT(key)
       DO UPDATE SET
         value_json=excluded.value_json,
         updated_at=excluded.updated_at`
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

  await setStore(
    env,
    KEYS.engineLog,
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
      KEYS.memory,
      []
    );

  memory.unshift(
    item
  );

  await setStore(
    env,
    KEYS.memory,
    memory.slice(
      0,
      MAX_MEMORY
    )
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
         last_heartbeat_at=?,
         cycle_count=?,
         runtime_version=?
       WHERE id=1`
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
// Normalizers
// =====================================================

function normalizeBusiness(
  business = {}
) {
  return {
    id:
      business.id ||
      makeId("business"),

    name:
      String(
        business.name ||
        ""
      ),

    customer:
      String(
        business.customer ||
        ""
      ),

    problem:
      String(
        business.problem ||
        ""
      ),

    status:
      business.status ||
      "discovered",

    stage:
      business.stage ||
      "discovered",

    pipeline:
      business.pipeline ||
      "research",

    discoveredAt:
      business.discoveredAt ||
      now(),

    researchTaskId:
      business.researchTaskId ||
      null,

    productTaskId:
      business.productTaskId ||
      null,

    salesTaskId:
      business.salesTaskId ||
      null,

    salesEvaluationTaskId:
      business.salesEvaluationTaskId ||
      null,

    humanGateTaskId:
      business.humanGateTaskId ||
      null,

    publicationStatus:
      business.publicationStatus ||
      "not_published",

    paymentStatus:
      business.paymentStatus ||
      "not_connected",

    customerValidationCount:
      Number(
        business.customerValidationCount ||
        0
      )
  };
}


function normalizeTask(
  task = {}
) {
  return {
    id:
      task.id ||
      makeId("task"),

    title:
      task.title ||
      "Untitled Task",

    priority:
      task.priority ||
      "normal",

    status:
      task.status ||
      "pending",

    runCount:
      Number(
        task.runCount ||
        0
      ),

    lastRunAt:
      task.lastRunAt ||
      null,

    result:
      task.result ??
      null,

    executor:
      task.executor ||
      "Cloud Executor",

    source:
      task.source ||
      "Company Core",

    createdAt:
      task.createdAt ||
      now(),

    updatedAt:
      task.updatedAt ||
      now(),

    evaluation:
      task.evaluation ??
      null,

    level:
      task.level ||
      "general",

    retryCount:
      Number(
        task.retryCount ||
        0
      ),

    requiresHuman:
      Boolean(
        task.requiresHuman
      ),

    humanGateId:
      task.humanGateId ||
      null,

    localExecution:
      task.localExecution ??
      null,

    cloudExecution:
      task.cloudExecution ??
      null,

    pipeline:
      task.pipeline ||
      null,

    parentTaskId:
      task.parentTaskId ||
      null,

    strategyId:
      task.strategyId ||
      null
  };
}


function normalizeGate(
  gate = {}
) {
  return {
    id:
      gate.id ||
      makeId("gate"),

    taskId:
      gate.taskId ||
      null,

    taskTitle:
      gate.taskTitle ||
      "",

    reason:
      gate.reason ||
      "人間の承認が必要です。",

    status:
      gate.status ||
      "pending",

    createdAt:
      gate.createdAt ||
      now(),

    decidedAt:
      gate.decidedAt ||
      null,

    decision:
      gate.decision ||
      null
  };
}


// =====================================================
// Basic Data Helpers
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
  const list =
    await getTasks(
      env
    );

  return (
    list.find(
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
  const list =
    await getTasks(
      env
    );

  const index =
    list.findIndex(
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
          list[index]
        )
      )
    );

  next.updatedAt =
    now();

  list[index] =
    next;

  await saveList(
    env,
    KEYS.tasks,
    list
  );

  return next;
}


async function createTask(
  env,
  data
) {
  const list =
    await getTasks(
      env
    );

  const task =
    normalizeTask(
      data
    );

  list.unshift(
    task
  );

  await saveList(
    env,
    KEYS.tasks,
    list
  );

  await addLog(
    env,
    "Task Core",
    `タスクを登録しました：「${task.title}」`
  );

  return task;
}


async function setBusiness(
  env,
  businessId,
  patch
) {
  const list =
    await getBusinesses(
      env
    );

  const index =
    list.findIndex(
      business =>
        business.id ===
        businessId
    );

  if (
    index < 0
  ) {
    return null;
  }

  list[index] =
    normalizeBusiness({
      ...list[index],
      ...patch
    });

  await saveList(
    env,
    KEYS.business,
    list
  );

  return list[index];
}


// =====================================================
// Task Creation
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

        parentTaskId:
          parent?.id ||
          null,

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
// Action Detection
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

  if (
    stage ===
      "feedback_analysis" ||
    /顧客フィードバック分析/.test(
      task.title
    )
  ) {
    return "feedback_analysis";
  }

  if (
    stage ===
      "outcome_analysis" ||
    /事業成果分析/.test(
      task.title
    )
  ) {
    return "outcome_analysis";
  }

  if (
    stage ===
      "capability_review" ||
    /能力ギャップ分析/.test(
      task.title
    )
  ) {
    return "capability_review";
  }

  return "generic_execution";
}


// =====================================================
// Artifacts
// =====================================================

function genericArtifact(
  task,
  message
) {
  return {
    artifactType:
      "generic_execution",

    title:
      `${task.title} — 実行レポート`,

    message,

    generatedBy:
      "Cloud Executor",

    generatedAt:
      now(),

    sourceTaskId:
      task.id
  };
}


function researchArtifact(
  task,
  business,
  research
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

    questions:
      [
        "顧客は現在どのように市場調査を行っているか",

        "調査にどれくらいの時間・費用をかけているか",

        "どの情報が意思決定に重要か",

        "既存サービスとの差は何か",

        "継続利用する理由は何か"
      ],

    evidencePlan:
      DEFAULT_RESEARCH_URLS,

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
  context
) {
  const customerCount =
    Number(
      business?.customerValidationCount ||
      0
    );

  const published =
    business?.publicationStatus ===
    "published";

  const payment =
    business?.paymentStatus ===
    "connected";

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
          customerCount >
          0,

        paymentConnected:
          payment,

        publicationConnected:
          published
      },

    gaps:
      [
        ...(customerCount ===
        0
          ? [
              "実顧客による検証"
            ]
          : []),

        ...(context.evidenceCount ===
        0
          ? [
              "外部市場データ"
            ]
          : []),

        ...(!published
          ? [
              "公開導線"
            ]
          : []),

        ...(!payment
          ? [
              "決済導線"
            ]
          : [])
      ],

    ready_for_human_gate:
      Boolean(
        business
      ),

    generatedBy:
      "Cloud Executor",

    generatedAt:
      now(),

    sourceTaskId:
      task.id
  };
}


function feedbackArtifact(
  task,
  customers
) {
  return {
    artifactType:
      "feedback_analysis",

    title:
      "顧客フィードバック分析",

    inputCount:
      customers.length,

    positive:
      customers.filter(
        customer =>
          /良い|便利|欲しい|満足|購入/.test(
            `${customer.feedback} ${customer.request}`
          )
      ).length,

    negative:
      customers.filter(
        customer =>
          /悪い|不満|不要|高い|問題/.test(
            `${customer.feedback} ${customer.request}`
          )
      ).length,

    generatedBy:
      "Cloud Executor",

    generatedAt:
      now(),

    sourceTaskId:
      task.id
  };
}


function outcomeArtifact(
  task,
  outcomes
) {
  const revenue =
    outcomes.reduce(
      (
        total,
        outcome
      ) =>
        total +
        Number(
          outcome.revenue ||
          0
        ),
      0
    );

  return {
    artifactType:
      "outcome_analysis",

    title:
      "事業成果分析",

    outcomeCount:
      outcomes.length,

    totalRecordedRevenue:
      revenue,

    positiveOutcomes:
      outcomes.filter(
        outcome =>
          outcome.result ===
          "positive"
      ).length,

    negativeOutcomes:
      outcomes.filter(
        outcome =>
          outcome.result ===
          "negative"
      ).length,

    nextRecommendation:
      outcomes.length ===
      0
        ? "まず顧客または事業成果を取得する"
        : "成果を戦略履歴へ反映し、次の実験を決める",

    generatedBy:
      "Cloud Executor",

    generatedAt:
      now(),

    sourceTaskId:
      task.id
  };
}


function capabilityArtifact(
  task,
  capabilities
) {
  return {
    artifactType:
      "capability_review",

    title:
      "能力ギャップ分析",

    capabilities,

    generatedBy:
      "Capability Manager",

    generatedAt:
      now(),

    sourceTaskId:
      task.id
  };
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
      "\""
    )

    .replace(
      /\s+/g,
      " "
    )

    .trim();
}


function safeUrl(
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
      byte =>
        byte
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
    safeUrl(
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
                "AI-Company-Core-Research-Gateway/6.0"
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

    index.unshift({
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
    });

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
      results.push({
        ok:
          false,

        url,

        error:
          String(
            error.message ||
            error
          )
      });
    }
  }

  return {
    id:
      makeId(
        "research_run"
      ),

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

    topic:
      input.topic ||
      "",

    businessId:
      input.businessId ||
      null,

    createdAt:
      now()
  };
}


// =====================================================
// Capability Manager
// =====================================================

async function capabilitySnapshot(
  env
) {
  const businessList =
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

  const departments =
    await getStore(
      env,
      KEYS.departments,
      DEPARTMENTS
    );

  return {
    externalResearch:
      evidence.length >
      0,

    productGeneration:
      businessList.some(
        business =>
          business.productTaskId
      ),

    salesPreparation:
      businessList.some(
        business =>
          business.salesTaskId
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
          ) >
          0
      ),

    publication:
      businessList.some(
        business =>
          business.publicationStatus ===
          "published"
      ),

    payment:
      businessList.some(
        business =>
          business.paymentStatus ===
          "connected"
      ),

    selfDevelopment:
      false,

    platformIndependence:
      false,

    departments
  };
}


async function reconcileOrganization(
  env
) {
  const capabilities =
    await capabilitySnapshot(
      env
    );

  const departments =
    new Set(
      await getStore(
        env,
        KEYS.departments,
        DEPARTMENTS
      )
    );

  for (
    const department of DEPARTMENTS
  ) {
    departments.add(
      department
    );
  }

  if (
    !capabilities.externalResearch
  ) {
    departments.add(
      "調査"
    );
  }

  if (
    !capabilities.customerFeedback
  ) {
    departments.add(
      "顧客対応"
    );
  }

  if (
    !capabilities.outcomeTracking
  ) {
    departments.add(
      "事業成果"
    );
  }

  if (
    !capabilities.selfDevelopment
  ) {
    departments.add(
      "開発基盤"
    );
  }

  if (
    !capabilities.platformIndependence
  ) {
    departments.add(
      "プラットフォーム戦略"
    );
  }

  const nextDepartments =
    [
      ...departments
    ];

  await setStore(
    env,
    KEYS.departments,
    nextDepartments
  );

  await setStore(
    env,
    KEYS.capabilities,
    {
      ...capabilities,

      departments:
        nextDepartments,

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
    nextDepartments;

  state.runtimeVersion =
    RUNTIME_VERSION;

  await setStore(
    env,
    KEYS.companyState,
    state
  );

  return {
    ...capabilities,

    departments:
      nextDepartments,

    updatedAt:
      now()
  };
}


// =====================================================
// Executor
// =====================================================

async function executeTask(
  env,
  task,
  business
) {
  const action =
    taskAction(
      task
    );

  let research =
    null;

  let artifact;

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
      researchArtifact(
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
    const capability =
      await capabilitySnapshot(
        env
      );

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
        {
          evidenceCount:
            evidence.length,

          ...capability
        }
      );

  } else if (
    action ===
    "feedback_analysis"
  ) {
    const customers =
      await getStore(
        env,
        KEYS.customers,
        []
      );

    artifact =
      feedbackArtifact(
        task,
        customers
      );

  } else if (
    action ===
    "outcome_analysis"
  ) {
    const outcomes =
      await getStore(
        env,
        KEYS.outcomes,
        []
      );

    artifact =
      outcomeArtifact(
        task,
        outcomes
      );

  } else if (
    action ===
    "capability_review"
  ) {
    artifact =
      capabilityArtifact(
        task,
        await capabilitySnapshot(
          env
        )
      );

  } else {
    artifact =
      genericArtifact(
        task,
        `Cloud Executorでタスク「${task.title}」を実行しました。`
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
// Evaluation
// =====================================================

function evaluateExecution(
  execution,
  business
) {
  const action =
    execution.action;

  if (
    action ===
    "research_brief"
  ) {
    return {
      status:
        "success",

      action,

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
    action ===
    "product_prototype"
  ) {
    return {
      status:
        "success",

      action,

      level:
        "商品構成成功・顧客検証前",

      summary:
        "商品構成を生成しました。",

      nextAction:
        "販売パッケージを作成する。",

      readyForHumanGate:
        false,

      generatedAt:
        now()
    };
  }

  if (
    action ===
    "sales_package_generation"
  ) {
    return {
      status:
        "success",

      action,

      level:
        "販売準備成功・事業成果確認前",

      summary:
        "販売準備パッケージを生成しました。",

      nextAction:
        "販売構成を評価する。",

      readyForHumanGate:
        false,

      generatedAt:
        now()
    };
  }

  if (
    action ===
    "sales_evaluation"
  ) {
    return {
      status:
        "success",

      action,

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

  if (
    action ===
    "feedback_analysis"
  ) {
    return {
      status:
        "success",

      action,

      level:
        "顧客フィードバック分析完了",

      summary:
        "顧客フィードバックを分析しました。",

      nextAction:
        "フィードバックを次の戦略へ反映する。",

      readyForHumanGate:
        false,

      generatedAt:
        now()
    };
  }

  if (
    action ===
    "outcome_analysis"
  ) {
    return {
      status:
        "success",

      action,

      level:
        "事業成果分析完了",

      summary:
        "事業成果を分析しました。",

      nextAction:
        "CEO再評価を実行する。",

      readyForHumanGate:
        false,

      generatedAt:
        now()
    };
  }

  if (
    action ===
    "capability_review"
  ) {
    return {
      status:
        "success",

      action,

      level:
        "能力ギャップ分析完了",

      summary:
        "現在の能力と不足能力を整理しました。",

      nextAction:
        "必要能力の実装計画を作成する。",

      readyForHumanGate:
        false,

      generatedAt:
        now()
    };
  }

  return {
    status:
      "success",

    action,

    level:
      "実行成功・成果確認前",

    summary:
      "Cloud Executorの処理が完了しました。",

    nextAction:
      "結果を確認して次の仕事を決める。",

    readyForHumanGate:
      false,

    generatedAt:
      now()
  };
}


// =====================================================
// Pipeline
// =====================================================

async function advance(
  env,
  task,
  execution,
  evaluation,
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

    const updatedBusiness =
      normalizeBusiness({
        ...business,

        productTaskId:
          null
      });

    return {
      nextTask:
        await createProductTask(
          env,
          updatedBusiness,
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
      "sales_evaluation" &&
    evaluation.readyForHumanGate
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

    return await createHumanGate(
      env,
      {
        ...business,

        humanGateTaskId:
          null
      },
      task
    );
  }

  return {
    nextTask:
      null,

    humanGate:
      null
  };
}


// =====================================================
// Pending Executor
// =====================================================

async function executePending(
  env,
  source
) {
  const list =
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
          "pending"
      )
      .sort(
        (
          a,
          b
        ) =>
          (
            a.priority ===
            "high"
              ? 1
              : a.priority ===
                "low"
                ? 3
                : 2
          ) -
          (
            b.priority ===
            "high"
              ? 1
              : b.priority ===
                "low"
                ? 3
                : 2
          ) ||
          new Date(
            a.createdAt
          ) -
          new Date(
            b.createdAt
          )
      );

  const task =
    list[0];

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
    const businessList =
      await getBusinesses(
        env
      );

    const business =
      businessList.find(
        item =>
          item.id ===
          running
            ?.pipeline
            ?.businessId
      ) ||
      null;

    const execution =
      await executeTask(
        env,
        running,
        business
          ? normalizeBusiness(
              business
            )
          : null
      );

    const evaluation =
      evaluateExecution(
        execution,
        business
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
      await advance(
        env,
        done,
        execution,
        evaluation,
        business
          ? normalizeBusiness(
              business
            )
          : null
      );

    await reconcileOrganization(
      env
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
// Company Cycle
// =====================================================

async function cycle(
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

    const taskList =
      await getTasks(
        env
      );

    const gates =
      await getStore(
        env,
        KEYS.humanGates,
        []
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
      taskList
        .map(
          normalizeTask
        )
        .filter(
          task =>
            task.status ===
            "pending"
        );

    if (
      pending.length >
      0
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
          await executePending(
            env,
            source
          )
        ),

        cycleCount:
          state.cycleCount
      };
    }

    await reconcileOrganization(
      env
    );

    return {
      ok:
        true,

      status:
        "waiting_for_work",

      source,

      cycleCount:
        state.cycleCount,

      message:
        "現在の自動処理対象はありません。"
    };

  } catch (
    error
  ) {
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
      "cycleLock",
      null
    );
  }
}


// =====================================================
// Customer / Outcome Loop
// =====================================================

async function createFeedbackTaskIfNeeded(
  env,
  businessId
) {
  const list =
    await getTasks(
      env
    );

  const existing =
    list.find(
      task =>
        task.pipeline?.stage ===
          "feedback_analysis" &&
        task.pipeline?.businessId ===
          businessId &&
        [
          "pending",
          "running"
        ].includes(
          task.status
        )
    );

  if (existing) {
    return normalizeTask(
      existing
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


async function createOutcomeTaskIfNeeded(
  env,
  businessId
) {
  const list =
    await getTasks(
      env
    );

  const existing =
    list.find(
      task =>
        task.pipeline?.stage ===
          "outcome_analysis" &&
        task.pipeline?.businessId ===
          businessId &&
        [
          "pending",
          "running"
        ].includes(
          task.status
        )
    );

  if (existing) {
    return normalizeTask(
      existing
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
// CEO Re-Evaluation
// =====================================================

async function reevaluate(
  env
) {
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

  if (
    gates.some(
      gate =>
        gate.status ===
        "pending"
    )
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
        "waiting_human"
    };
  }

  const capabilities =
    await reconcileOrganization(
      env
    );

  const outcomes =
    await getStore(
      env,
      KEYS.outcomes,
      []
    );

  const customers =
    await getStore(
      env,
      KEYS.customers,
      []
    );

  const evidence =
    await getStore(
      env,
      KEYS.evidenceIndex,
      []
    );

  const strategy =
    {
      id:
        makeId(
          "strategy"
        ),

      title:
        outcomes.length >
        0
          ? "事業成果から次の改善を決める"
          : "外部証拠と顧客情報を集める",

      objective:
        outcomes.length >
        0
          ? "Outcome Improvement"
          : "Evidence Expansion",

      reason:
        `evidence=${evidence.length}, customers=${customers.length}, outcomes=${outcomes.length}`,

      capabilities,

      createdAt:
        now()
    };

  const strategies =
    await getStore(
      env,
      KEYS.strategies,
      []
    );

  strategies.unshift(
    strategy
  );

  await saveList(
    env,
    KEYS.strategies,
    strategies
  );

  await setStore(
    env,
    KEYS.lastDecision,
    {
      id:
        makeId(
          "decision"
        ),

      action:
        strategy.title,

      strategyId:
        strategy.id,

      createdAt:
        now()
    }
  );

  state.lastReevaluationAt =
    now();

  state.currentFocus =
    "CEO再評価完了";

  state.currentPlan =
    strategy.title;

  state.nextAction =
    "能力ギャップまたは事業成果に応じて次の実験を決める";

  await setStore(
    env,
    KEYS.companyState,
    state
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

      strategyId:
        strategy.id,

      summary:
        strategy.reason,

      createdAt:
        now()
    }
  );

  return {
    ok:
      true,

    status:
      "reevaluated",

    strategy,

    capabilities
  };
}


// =====================================================
// Health
// =====================================================

async function health(
  env
) {
  const metaRow =
    await env.DB
      .prepare(
        `SELECT
           last_heartbeat_at,
           cycle_count,
           runtime_version
         FROM runtime_meta
         WHERE id=1`
      )
      .first();

  const state =
    await getStore(
      env,
      KEYS.companyState,
      DEFAULT_STATE
    );

  const taskList =
    await getTasks(
      env
    );

  const businessList =
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
    await getStore(
      env,
      KEYS.departments,
      DEPARTMENTS
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

        currentFocus:
          state.currentFocus,

        nextAction:
          state.nextAction,

        pendingTasks:
          taskList.filter(
            task =>
              task.status ===
              "pending"
          ).length,

        businessCount:
          businessList.length,

        pendingHumanGates:
          gates.filter(
            gate =>
              gate.status ===
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

        "d1_artifacts",

        "external_read_only_research",

        "research_evidence",

        "customer_intake",

        "feedback_memory",

        "outcome_tracking",

        "ceo_reevaluation",

        "capability_manager",

        "dynamic_departments",

        "human_gate_detection",

        "cloud_heartbeat"
      ],

    execution_available:
      true,

    external_read:
      true,

    customer_gateway_available:
      true,

    outcome_gateway_available:
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

      // ===============================================
      // Health
      // ===============================================

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


      // ===============================================
      // Heartbeat
      // ===============================================

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


      // ===============================================
      // Company Cycle
      // ===============================================

      if (
        url.pathname ===
        "/api/cycle"
      ) {
        return json(
          await cycle(
            env,
            "manual"
          )
        );
      }


      // ===============================================
      // CEO Re-Evaluation
      // ===============================================

      if (
        url.pathname ===
        "/api/ceo/reevaluate"
      ) {
        return json(
          await reevaluate(
            env
          )
        );
      }


      // ===============================================
      // Capabilities
      // ===============================================

      if (
        url.pathname ===
        "/api/capabilities"
      ) {
        return json({
          ok:
            true,

          data:
            await reconcileOrganization(
              env
            ),

          time:
            now()
        });
      }


      // ===============================================
      // State
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
      // Artifact
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
      // Research Run
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
        }

        if (
          request.method ===
          "GET"
        ) {
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

        const result =
          await researchRun(
            env,
            body
          );

        const state =
          await getStore(
            env,
            KEYS.companyState,
            DEFAULT_STATE
          );

        state.lastResearchAt =
          now();

        state.researchGatewayAvailable =
          true;

        await setStore(
          env,
          KEYS.companyState,
          state
        );

        return json({
          ok:
            true,

          researchRun:
            result
        });
      }


      // ===============================================
      // Evidence
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

          evidence
        });
      }


      // ===============================================
      // Customer Intake
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

        const businessId =
          body.businessId ||
          null;

        const record =
          {
            id:
              makeId(
                "customer"
              ),

            businessId,

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
          businessId
        ) {
          const current =
            await getBusinesses(
              env
            );

          const business =
            current.find(
              item =>
                item.id ===
                businessId
            );

          if (
            business
          ) {
            await setBusiness(
              env,
              businessId,
              {
                customerValidationCount:
                  Number(
                    business.customerValidationCount ||
                    0
                  ) + 1
              }
            );

            await createFeedbackTaskIfNeeded(
              env,
              businessId
            );
          }
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

            businessId,

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
      // Outcome
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
          await createOutcomeTaskIfNeeded(
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

            summary:
              outcome.note ||
              outcome.result,

            revenue:
              outcome.revenue,

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
      // Public Preview
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


      // ===============================================
      // Assets
      // ===============================================

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
      cycle(
        env,
        "cron"
      )
        .then(
          () =>
            updateMeta(
              env,
              {
                heartbeat:
                  now()
              }
            )
        )
        .catch(
          error =>
            console.error(
              error
            )
        )
    );
  }
};
