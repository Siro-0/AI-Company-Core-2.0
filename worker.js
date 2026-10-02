const RUNTIME_VERSION = "6.1.1-self-organizing-company";

const DEFAULT_DEPARTMENTS = [
  "企画",
  "技術",
  "リスク管理",
];

const GENERATED_DEPARTMENTS = {
  "調査": {
    mission: "外部証拠を取得し、事業仮説の精度を高める。",
    trigger: "externalResearch",
    action: "research_external_evidence",
  },
  "顧客対応": {
    mission: "顧客入力を整理し、改善要求へ変換する。",
    trigger: "customerFeedback",
    action: "customer_feedback_analysis",
  },
  "事業成果": {
    mission: "成果・売上・コストを把握し、CEO評価へ接続する。",
    trigger: "outcomeTracking",
    action: "outcome_analysis",
  },
  "開発基盤": {
    mission: "安全な開発・テスト・デプロイ基盤を整備する。",
    trigger: "selfDevelopment",
    action: "development_infrastructure",
  },
  "プラットフォーム戦略": {
    mission: "Storage / Scheduler / Executor / Web の依存を分離する。",
    trigger: "platformIndependence",
    action: "platform_decoupling",
  },
};

const RESEARCH_SOURCES = {
  stat_economy: {
    name: "総務省統計局",
    url: "https://www.stat.go.jp/",
  },
  soumu: {
    name: "総務省",
    url: "https://www.soumu.go.jp/",
  },
  meti: {
    name: "経済産業省",
    url: "https://www.meti.go.jp/",
  },
  mhlw: {
    name: "厚生労働省",
    url: "https://www.mhlw.go.jp/",
  },
  digital: {
    name: "デジタル庁",
    url: "https://www.digital.go.jp/",
  },
  estat: {
    name: "e-Stat",
    url: "https://www.e-stat.go.jp/",
  },
};

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix = "id") {
  const random =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}_${random}`;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "Content-Type",
    },
  });
}

function textResponse(text, status = 200, type = "text/plain; charset=utf-8") {
  return new Response(text, {
    status,
    headers: {
      "content-type": type,
      "access-control-allow-origin": "*",
    },
  });
}

async function readJSON(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function safeString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, n));
}

async function getStore(env, key, fallback = null) {
  const row = await env.DB
    .prepare(
      `
      SELECT value_json
      FROM company_store
      WHERE key = ?
      LIMIT 1
      `
    )
    .bind(key)
    .first();

  if (!row) {
    return fallback;
  }

  try {
    return JSON.parse(row.value_json);
  } catch {
    return fallback;
  }
}

async function setStore(env, key, value) {
  await env.DB
    .prepare(
      `
      INSERT INTO company_store (key, value_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key)
      DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
      `
    )
    .bind(key, JSON.stringify(value), nowIso())
    .run();

  return value;
}

async function updateRuntimeMeta(env, patch = {}) {
  const current = await env.DB
    .prepare(
      `
      SELECT *
      FROM runtime_meta
      WHERE id = 1
      LIMIT 1
      `
    )
    .first();

  const lastHeartbeatAt =
    patch.lastHeartbeatAt !== undefined
      ? patch.lastHeartbeatAt
      : current?.last_heartbeat_at ?? null;

  const cycleCount =
    patch.cycleCount !== undefined
      ? patch.cycleCount
      : Number(current?.cycle_count ?? 0);

  await env.DB
    .prepare(
      `
      UPDATE runtime_meta
      SET
        last_heartbeat_at = ?,
        cycle_count = ?,
        runtime_version = ?
      WHERE id = 1
      `
    )
    .bind(
      lastHeartbeatAt,
      cycleCount,
      RUNTIME_VERSION
    )
    .run();
}

function normalizeDepartments(input) {
  const list = Array.isArray(input) ? input : [];

  const merged = [
    ...DEFAULT_DEPARTMENTS,
    ...Object.keys(GENERATED_DEPARTMENTS),
    ...list,
  ];

  return [
    ...new Set(
      merged
        .map((name) => safeString(name))
        .filter(Boolean)
    ),
  ];
}

function defaultCompany() {
  return {
    cycleCount: 0,
    currentFocus: "会社初期化完了",
    nextAction: "組織・能力・事業状態を確認する",
    mode: "autonomous",
    goal: "人間の管理負担を下げながら、自律的に事業を発見・実行・改善する",
    runtimeVersion: RUNTIME_VERSION,
    externalActions: false,
    externalAI: false,
    humanGates: [],
    businesses: [],
    companyMemory: [],
    researchEvidenceIndex: [],
    customers: [],
    outcomes: [],
    departments: normalizeDepartments([]),
    capabilitySnapshot: {},
    organizationHistory: [],
  };
}

async function ensureInitialized(env) {
  let company = await getStore(
    env,
    "company",
    null
  );

  let tasks = await getStore(
    env,
    "tasks",
    []
  );

  if (!company) {
    company = defaultCompany();
  }

  company.departments = normalizeDepartments(
    company.departments
  );

  company.humanGates = Array.isArray(company.humanGates)
    ? company.humanGates
    : [];

  company.businesses = Array.isArray(company.businesses)
    ? company.businesses
    : [];

  company.companyMemory = Array.isArray(company.companyMemory)
    ? company.companyMemory
    : [];

  company.researchEvidenceIndex = Array.isArray(
    company.researchEvidenceIndex
  )
    ? company.researchEvidenceIndex
    : [];

  company.customers = Array.isArray(company.customers)
    ? company.customers
    : [];

  company.outcomes = Array.isArray(company.outcomes)
    ? company.outcomes
    : [];

  company.organizationHistory = Array.isArray(
    company.organizationHistory
  )
    ? company.organizationHistory
    : [];

  tasks = Array.isArray(tasks) ? tasks : [];

  await setStore(env, "company", company);
  await setStore(env, "tasks", tasks);

  await updateRuntimeMeta(env, {
    cycleCount: Number(company.cycleCount ?? 0),
  });

  return {
    company,
    tasks,
  };
}

function getPendingTasks(tasks) {
  return tasks.filter(
    (task) =>
      task.status === "pending" ||
      task.status === "running"
  );
}

function getPendingInternalTasks(tasks) {
  return tasks.filter(
    (task) =>
      task.internalOnly === true &&
      (task.status === "pending" || task.status === "running")
  );
}

function getHumanGateTasks(tasks) {
  return tasks.filter(
    (task) =>
      task.type === "human_gate" &&
      task.status === "waiting_human"
  );
}

function taskPriority(task) {
  if (task.type === "business_task") {
    return 100;
  }

  if (task.type === "external_research") {
    return 90;
  }

  if (task.type === "internal_task") {
    return 50;
  }

  return 10;
}

function sortTasksForExecution(tasks) {
  return [...tasks].sort(
    (a, b) =>
      taskPriority(b) - taskPriority(a) ||
      String(a.createdAt).localeCompare(
        String(b.createdAt)
      )
  );
}

async function saveTasks(env, tasks) {
  await setStore(env, "tasks", tasks);
}

async function findTaskById(env, taskId) {
  const tasks = await getStore(env, "tasks", []);

  return tasks.find(
    (task) => task.id === taskId
  ) || null;
}

async function updateTask(env, taskId, patch) {
  const tasks = await getStore(env, "tasks", []);

  const index = tasks.findIndex(
    (task) => task.id === taskId
  );

  if (index === -1) {
    return null;
  }

  tasks[index] = {
    ...tasks[index],
    ...patch,
    updatedAt: nowIso(),
  };

  await saveTasks(env, tasks);

  return tasks[index];
}

async function createTask(env, definition) {
  const tasks = await getStore(env, "tasks", []);

  const existing = tasks.find(
    (task) =>
      task.title === definition.title &&
      (
        task.status === "pending" ||
        task.status === "running" ||
        task.status === "waiting_human"
      )
  );

  if (existing) {
    return existing;
  }

  const task = {
    id: randomId("task"),
    type: definition.type ?? "internal_task",
    action: definition.action ?? "internal_analysis",
    title: definition.title ?? "内部タスク",
    description: definition.description ?? "",
    department: definition.department ?? "企画",
    priority: definition.priority ?? 50,
    status: definition.status ?? "pending",
    internalOnly: definition.internalOnly ?? false,
    safeAutonomy: definition.safeAutonomy ?? false,
    externalAction: definition.externalAction ?? false,
    businessId: definition.businessId ?? null,
    input: definition.input ?? {},
    result: null,
    artifactId: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  tasks.push(task);

  await saveTasks(env, tasks);

  return task;
}

async function saveArtifact(env, task, payload) {
  const artifact = {
    id: randomId("artifact"),
    taskId: task.id,
    businessId: task.businessId ?? null,
    department: task.department ?? null,
    action: task.action,
    createdAt: nowIso(),
    payload,
  };

  await setStore(
    env,
    `artifact:${artifact.id}`,
    artifact
  );

  const index = await getStore(
    env,
    "artifact_index",
    []
  );

  index.push({
    id: artifact.id,
    taskId: artifact.taskId,
    businessId: artifact.businessId,
    department: artifact.department,
    action: artifact.action,
    createdAt: artifact.createdAt,
  });

  await setStore(
    env,
    "artifact_index",
    index.slice(-500)
  );

  return artifact;
}

async function saveMemory(env, memory) {
  const company = await getStore(
    env,
    "company",
    defaultCompany()
  );

  company.companyMemory = Array.isArray(
    company.companyMemory
  )
    ? company.companyMemory
    : [];

  company.companyMemory.push({
    id: randomId("memory"),
    ...memory,
    createdAt: nowIso(),
  });

  company.companyMemory =
    company.companyMemory.slice(-500);

  await setStore(env, "company", company);

  return company.companyMemory.at(-1);
}

function definitionNextAction(department) {
  if (department === "開発基盤") {
    return "Sandbox / Test / Deploy の分離を実装する。";
  }

  if (department === "プラットフォーム戦略") {
    return "Storage / Scheduler / Executor / Web の Adapter 境界を実装する。";
  }

  if (department === "調査") {
    return "外部証拠取得結果を事業仮説へ反映する。";
  }

  if (department === "顧客対応") {
    return "顧客フィードバックを改善タスクへ変換する。";
  }

  if (department === "事業成果") {
    return "成果・売上・コストをCEO評価へ接続する。";
  }

  if (department === "技術") {
    return "実行系の安定性と再利用可能な構造を改善する。";
  }

  if (department === "リスク管理") {
    return "外部作用と不可逆操作のリスク境界を確認する。";
  }

  if (department === "企画") {
    return "新しい事業仮説と優先順位を整理する。";
  }

  return "部門成果をCEOの次戦略へ渡す。";
}

function buildDepartmentCapability(
  department,
  company
) {
  const generated = GENERATED_DEPARTMENTS[department];

  return {
    department,
    mission:
      generated?.mission ??
      `${department}に関する会社能力を維持・改善する。`,
    currentCapability:
      generated?.trigger
        ? company.capabilitySnapshot?.[
            generated.trigger
          ] ?? false
        : true,
    nextAction:
      definitionNextAction(department),
    autonomy:
      {
        internalTaskCreation: true,
        internalArtifactCreation: true,
        externalIrreversibleAction: false,
      },
  };
}

function capabilitySnapshot(company, tasks) {
  const completedTasks = tasks.filter(
    (task) => task.status === "completed"
  );

  const hasAction = (action) =>
    completedTasks.some(
      (task) => task.action === action
    );

  const revenueObserved = company.outcomes.some(
    (outcome) =>
      Number(outcome.revenue ?? 0) > 0
  );

  return {
    externalResearch:
      company.researchEvidenceIndex.length > 0,

    productGeneration:
      hasAction("product_prototype"),

    salesPreparation:
      hasAction("sales_package_generation"),

    customerFeedback:
      company.customers.length > 0,

    outcomeTracking:
      company.outcomes.length > 0,

    revenueTracking:
      revenueObserved,

    publication:
      false,

    payment:
      false,

    selfDevelopment:
      hasAction("development_infrastructure"),

    platformIndependence:
      hasAction("platform_decoupling"),
  };
}

async function reconcileOrganization(env) {
  const company = await getStore(
    env,
    "company",
    defaultCompany()
  );

  const tasks = await getStore(
    env,
    "tasks",
    []
  );

  company.departments = normalizeDepartments(
    company.departments
  );

  company.capabilitySnapshot =
    capabilitySnapshot(company, tasks);

  const added = [];
  const removed = [];

  for (const [department, definition] of Object.entries(
    GENERATED_DEPARTMENTS
  )) {
    const capability =
      company.capabilitySnapshot[
        definition.trigger
      ];

    if (!capability) {
      if (!company.departments.includes(department)) {
        company.departments.push(department);
        added.push(department);
      }
    }
  }

  company.departments = normalizeDepartments(
    company.departments
  );

  if (added.length > 0) {
    company.organizationHistory.push({
      type: "department_created",
      departments: added,
      reason: "capability_gap",
      createdAt: nowIso(),
    });
  }

  company.organizationHistory =
    company.organizationHistory.slice(-200);

  await setStore(env, "company", company);

  return {
    company,
    added,
    removed,
  };
}

async function createCapabilityArtifact(
  env,
  department
) {
  const company = await getStore(
    env,
    "company",
    defaultCompany()
  );

  const capability =
    buildDepartmentCapability(
      department,
      company
    );

  const task = {
    id: randomId("capability"),
    action: "capability_analysis",
    department,
    businessId: null,
  };

  const artifact = await saveArtifact(
    env,
    task,
    capability
  );

  return artifact;
}

async function ensureDepartmentTasks(env) {
  let company = await getStore(
    env,
    "company",
    defaultCompany()
  );

  let tasks = await getStore(
    env,
    "tasks",
    []
  );

  company.departments = normalizeDepartments(
    company.departments
  );

  const pendingInternal =
    getPendingInternalTasks(tasks);

  if (pendingInternal.length >= 3) {
    return {
      created: [],
    };
  }

  const created = [];

  for (const department of company.departments) {
    if (created.length >= 1) {
      break;
    }

    const hasPendingForDepartment =
      tasks.some(
        (task) =>
          task.internalOnly === true &&
          task.department === department &&
          (
            task.status === "pending" ||
            task.status === "running"
          )
      );

    if (hasPendingForDepartment) {
      continue;
    }

    const generated =
      GENERATED_DEPARTMENTS[department];

    const shouldCreate =
      generated ||
      department === "企画" ||
      department === "技術" ||
      department === "リスク管理";

    if (!shouldCreate) {
      continue;
    }

    const task = await createTask(env, {
      type: "internal_task",
      action:
        generated?.action ??
        "internal_department_improvement",
      title:
        `${department}：${definitionNextAction(department)}`,
      description:
        generated?.mission ??
        `${department}の内部能力を点検・改善する。`,
      department,
      priority:
        department === "リスク管理"
          ? 80
          : 50,
      internalOnly: true,
      safeAutonomy: true,
      externalAction: false,
    });

    created.push(task);
  }

  return {
    created,
  };
}

async function researchSource(env, sourceId) {
  const source =
    RESEARCH_SOURCES[sourceId];

  if (!source) {
    throw new Error(
      `Unknown research source: ${sourceId}`
    );
  }

  const response = await fetch(
    source.url,
    {
      method: "GET",
      headers: {
        "user-agent":
          "AI-Company-Core/6.1.1 research gateway",
        accept:
          "text/html,application/xhtml+xml,application/json",
      },
    }
  );

  const rawText = await response.text();

  const text =
    rawText.length > 20000
      ? rawText.slice(0, 20000)
      : rawText;

  const evidence = {
    id: randomId("evidence"),
    sourceId,
    sourceName: source.name,
    url: source.url,
    status: response.status,
    ok: response.ok,
    retrievedAt: nowIso(),
    contentPreview: text,
  };

  await setStore(
    env,
    `evidence:${evidence.id}`,
    evidence
  );

  const company = await getStore(
    env,
    "company",
    defaultCompany()
  );

  company.researchEvidenceIndex =
    Array.isArray(
      company.researchEvidenceIndex
    )
      ? company.researchEvidenceIndex
      : [];

  company.researchEvidenceIndex.push({
    id: evidence.id,
    sourceId: evidence.sourceId,
    sourceName: evidence.sourceName,
    url: evidence.url,
    status: evidence.status,
    ok: evidence.ok,
    retrievedAt: evidence.retrievedAt,
  });

  company.researchEvidenceIndex =
    company.researchEvidenceIndex.slice(-500);

  await setStore(env, "company", company);

  await saveMemory(env, {
    type: "external_research",
    summary:
      `${source.name}から外部証拠を取得した。`,
    evidenceId: evidence.id,
  });

  return evidence;
}

async function businessDiscovery(env) {
  const company = await getStore(
    env,
    "company",
    defaultCompany()
  );

  if (company.businesses.length > 0) {
    return company.businesses[0];
  }

  const business = {
    id: randomId("business"),
    name:
      "小規模事業向け調査レポート生成サービス",
    problem:
      "小規模事業者が必要な市場・競合・制度情報の調査に時間を取られる。",
    target:
      "小規模事業者・個人事業主",
    value:
      "調査設計からレポート生成までを短時間で支援する。",
    status: "hypothesis",
    createdAt: nowIso(),
  };

  company.businesses.push(business);

  await setStore(env, "company", company);

  return business;
}

async function createBusinessPipelineTask(
  env,
  business,
  stage
) {
  const definitions = {
    research: {
      action: "research_brief",
      title:
        `調査設計：${business.name}`,
      department: "調査",
    },

    product: {
      action: "product_prototype",
      title:
        `商品設計・試作：${business.name}`,
      department: "技術",
    },

    sales: {
      action: "sales_package_generation",
      title:
        `販売準備：${business.name}`,
      department: "企画",
    },

    sales_evaluation: {
      action: "sales_evaluation",
      title:
        `販売構成評価：${business.name}`,
      department: "事業成果",
    },

    human_gate: {
      action: "human_gate_publication",
      title:
        `Human Gate：公開承認 ${business.name}`,
      department: "リスク管理",
    },
  };

  const definition =
    definitions[stage];

  if (!definition) {
    throw new Error(
      `Unknown business stage: ${stage}`
    );
  }

  const type =
    stage === "human_gate"
      ? "human_gate"
      : "business_task";

  const status =
    stage === "human_gate"
      ? "waiting_human"
      : "pending";

  return createTask(env, {
    type,
    action: definition.action,
    title: definition.title,
    department: definition.department,
    priority:
      stage === "human_gate"
        ? 100
        : 90,
    status,
    internalOnly: false,
    safeAutonomy: false,
    externalAction:
      stage === "human_gate",
    businessId: business.id,
  });
}

async function executeBusinessTask(
  env,
  task,
  business
) {
  let payload = null;
  let nextTask = null;
  let evaluationLevel = null;
  let readyForHumanGate = false;

  switch (task.action) {
    case "workspace_analysis": {
      payload = {
        type: "workspace_analysis",
        status: "success",
        summary:
          "会社ワークスペースを分析し、事業実行に必要な内部情報を整理した。",
        generatedAt: nowIso(),
      };

      evaluationLevel =
        "内部分析成功・次工程実行可能";
      break;
    }

    case "research_brief": {
      payload = {
        type: "research_brief",
        businessId: business.id,
        businessName: business.name,
        target: business.target,
        researchQuestions: [
          "市場にどのような需要があるか",
          "既存サービスは何を提供しているか",
          "小規模事業者が調査で困るポイントは何か",
          "継続課金にできる余地があるか",
        ],
        status:
          "調査設計成功・外部データ確認前",
        generatedAt: nowIso(),
      };

      evaluationLevel =
        "調査設計成功・外部データ確認前";

      nextTask =
        await createBusinessPipelineTask(
          env,
          business,
          "product"
        );

      break;
    }

    case "product_prototype": {
      payload = {
        type: "product_prototype",
        businessId: business.id,
        businessName: business.name,
        offer: {
          product:
            "小規模事業向け調査レポート生成サービス",
          output:
            "市場・競合・制度情報を整理した簡易レポート",
          delivery:
            "オンライン提供",
        },
        status:
          "商品構成成功・顧客検証前",
        generatedAt: nowIso(),
      };

      evaluationLevel =
        "商品構成成功・顧客検証前";

      nextTask =
        await createBusinessPipelineTask(
          env,
          business,
          "sales"
        );

      break;
    }

    case "sales_package_generation": {
      payload = {
        type: "sales_package_generation",
        businessId: business.id,
        businessName: business.name,
        package: {
          headline:
            "調査にかかる時間を短縮する小規模事業向けレポート",
          salesPoints: [
            "調査項目の整理を支援",
            "競合・市場・制度情報を一つにまとめる",
            "意思決定用の要点を短時間で把握する",
          ],
          monetization:
            "単発レポート + 継続利用",
        },
        status:
          "販売準備成功・事業成果確認前",
        generatedAt: nowIso(),
      };

      evaluationLevel =
        "販売準備成功・事業成果確認前";

      nextTask =
        await createBusinessPipelineTask(
          env,
          business,
          "sales_evaluation"
        );

      break;
    }

    case "sales_evaluation": {
      payload = {
        type: "sales_evaluation",
        businessId: business.id,
        businessName: business.name,
        checks: {
          offerDefined: true,
          targetDefined: true,
          salesMessageDefined: true,
          revenueVerified: false,
          customerVerified: false,
          externalPublication: false,
        },
        result:
          "販売構成評価完了・公開承認待ち",
        generatedAt: nowIso(),
      };

      evaluationLevel =
        "販売構成評価完了・公開承認待ち";

      readyForHumanGate = true;

      nextTask =
        await createBusinessPipelineTask(
          env,
          business,
          "human_gate"
        );

      break;
    }

    default:
      throw new Error(
        `Unknown business action: ${task.action}`
      );
  }

  const artifact =
    await saveArtifact(
      env,
      task,
      payload
    );

  await saveMemory(env, {
    type: "business_execution",
    businessId: business.id,
    taskId: task.id,
    action: task.action,
    summary:
      evaluationLevel ??
      "事業タスク完了",
  });

  return {
    payload,
    artifact,
    nextTask,
    evaluationLevel,
    readyForHumanGate,
  };
}

async function executeInternalTask(
  env,
  task
) {
  let payload;

  switch (task.action) {
    case "research_external_evidence": {
      const evidence =
        await researchSource(
          env,
          "meti"
        );

      payload = {
        department: task.department,
        action: task.action,
        result:
          "外部証拠取得を実行した。",
        evidenceId:
          evidence.id,
        source:
          evidence.sourceName,
        retrievedAt:
          evidence.retrievedAt,
      };

      break;
    }

    case "customer_feedback_analysis": {
      const company = await getStore(
        env,
        "company",
        defaultCompany()
      );

      payload = {
        department: task.department,
        action: task.action,
        customerCount:
          company.customers.length,
        conclusion:
          company.customers.length > 0
            ? "顧客入力を確認し、改善候補を抽出した。"
            : "顧客データ未取得。顧客接点の構築が必要。",
      };

      break;
    }

    case "outcome_analysis": {
      const company = await getStore(
        env,
        "company",
        defaultCompany()
      );

      const totalRevenue =
        company.outcomes.reduce(
          (sum, outcome) =>
            sum + Number(outcome.revenue ?? 0),
          0
        );

      payload = {
        department: task.department,
        action: task.action,
        outcomeCount:
          company.outcomes.length,
        totalRevenue,
        conclusion:
          company.outcomes.length > 0
            ? "事業成果を評価可能。"
            : "事業成果データ未取得。実成果観測の接続が必要。",
      };

      break;
    }

    case "development_infrastructure": {
      payload = {
        department: task.department,
        action: task.action,
        architecture: {
          sandbox:
            "本番環境から分離された安全な検証領域",
          test:
            "自動テスト・構文検証・回帰確認",
          deploy:
            "検証後にのみ本番反映可能な境界",
        },
        policy:
          "本番破壊・外部不可逆操作は自律実行しない。",
        next:
          "コード生成・テスト・差分評価の自動化へ進む。",
      };

      break;
    }

    case "platform_decoupling": {
      payload = {
        department: task.department,
        action: task.action,
        adapters: {
          storage:
            "StorageAdapter",
          scheduler:
            "SchedulerAdapter",
          executor:
            "ExecutorAdapter",
          web:
            "WebAdapter",
        },
        goal:
          "Cloudflare固有実装を会社Coreから分離する。",
        next:
          "プラットフォーム交換時にCoreの変更を最小化する。",
      };

      break;
    }

    case "internal_department_improvement": {
      payload = {
        department: task.department,
        action: task.action,
        mission:
          definitionNextAction(
            task.department
          ),
        status:
          "内部能力改善案を生成した。",
      };

      break;
    }

    default: {
      payload = {
        department: task.department,
        action: task.action,
        result:
          "内部部門タスクを実行した。",
        nextAction:
          definitionNextAction(
            task.department
          ),
      };
    }
  }

  const artifact =
    await saveArtifact(
      env,
      task,
      payload
    );

  await saveMemory(env, {
    type: "internal_execution",
    department: task.department,
    taskId: task.id,
    action: task.action,
    summary:
      payload.result ??
      payload.conclusion ??
      payload.status ??
      "内部能力を更新した。",
  });

  return {
    payload,
    artifact,
  };
}

async function executeTask(
  env,
  task
) {
  const locked =
    await updateTask(
      env,
      task.id,
      {
        status: "running",
      }
    );

  if (!locked) {
    throw new Error(
      `Task not found: ${task.id}`
    );
  }

  try {
    let result;

    if (
      task.type === "business_task"
    ) {
      const company =
        await getStore(
          env,
          "company",
          defaultCompany()
        );

      const business =
        company.businesses.find(
          (item) =>
            item.id === task.businessId
        );

      if (!business) {
        throw new Error(
          "Business not found for task."
        );
      }

      result =
        await executeBusinessTask(
          env,
          task,
          business
        );
    } else if (
      task.type === "internal_task"
    ) {
      result =
        await executeInternalTask(
          env,
          task
        );
    } else if (
      task.action ===
      "research_external_evidence"
    ) {
      result =
        await executeInternalTask(
          env,
          task
        );
    } else {
      throw new Error(
        `Unsupported task type: ${task.type}`
      );
    }

    const updated =
      await updateTask(
        env,
        task.id,
        {
          status: "completed",
          result: result.payload ?? null,
          artifactId:
            result.artifact?.id ?? null,
        }
      );

    return {
      status: "task_executed",
      task: updated,
      artifact:
        result.artifact ?? null,
      nextTask:
        result.nextTask ?? null,
      evaluationLevel:
        result.evaluationLevel ?? null,
      readyForHumanGate:
        result.readyForHumanGate ?? false,
    };
  } catch (error) {
    const failed =
      await updateTask(
        env,
        task.id,
        {
          status: "failed",
          result: {
            error:
              error?.message ??
              String(error),
          },
        }
      );

    await saveMemory(env, {
      type: "execution_failure",
      taskId: task.id,
      department: task.department,
      error:
        error?.message ??
        String(error),
    });

    return {
      status: "task_failed",
      task: failed,
      error:
        error?.message ??
        String(error),
    };
  }
}

async function companyCycle(env) {
  const {
    company,
    tasks,
  } = await ensureInitialized(env);

  const business =
    await businessDiscovery(env);

  let currentTasks =
    await getStore(
      env,
      "tasks",
      tasks
    );

  const activeBusinessTask =
    currentTasks.find(
      (task) =>
        task.type === "business_task" &&
        task.status === "pending"
    );

  if (!activeBusinessTask) {
    const hasCompletedResearch =
      currentTasks.some(
        (task) =>
          task.action ===
            "research_brief" &&
          task.status === "completed"
      );

    const hasCompletedProduct =
      currentTasks.some(
        (task) =>
          task.action ===
            "product_prototype" &&
          task.status === "completed"
      );

    const hasCompletedSales =
      currentTasks.some(
        (task) =>
          task.action ===
            "sales_package_generation" &&
          task.status === "completed"
      );

    const hasCompletedEvaluation =
      currentTasks.some(
        (task) =>
          task.action ===
            "sales_evaluation" &&
          task.status === "completed"
      );

    const hasHumanGate =
      currentTasks.some(
        (task) =>
          task.type === "human_gate" &&
          task.status === "waiting_human"
      );

    if (
      !hasCompletedResearch &&
      !hasHumanGate
    ) {
      await createBusinessPipelineTask(
        env,
        business,
        "research"
      );
    } else if (
      hasCompletedResearch &&
      !hasCompletedProduct &&
      !hasHumanGate
    ) {
      await createBusinessPipelineTask(
        env,
        business,
        "product"
      );
    } else if (
      hasCompletedProduct &&
      !hasCompletedSales &&
      !hasHumanGate
    ) {
      await createBusinessPipelineTask(
        env,
        business,
        "sales"
      );
    } else if (
      hasCompletedSales &&
      !hasCompletedEvaluation &&
      !hasHumanGate
    ) {
      await createBusinessPipelineTask(
        env,
        business,
        "sales_evaluation"
      );
    }
  }

  currentTasks =
    await getStore(
      env,
      "tasks",
      []
    );

  const executable =
    sortTasksForExecution(
      currentTasks.filter(
        (task) =>
          task.status === "pending" &&
          task.type !== "human_gate"
      )
    );

  let execution = null;

  if (executable.length > 0) {
    execution =
      await executeTask(
        env,
        executable[0]
      );
  }

  const refreshedCompany =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  const refreshedTasks =
    await getStore(
      env,
      "tasks",
      []
    );

  refreshedCompany.cycleCount =
    Number(
      refreshedCompany.cycleCount ?? 0
    ) + 1;

  const pendingHumanGates =
    getHumanGateTasks(
      refreshedTasks
    );

  if (pendingHumanGates.length > 0) {
    refreshedCompany.currentFocus =
      "人間承認待ち";

    refreshedCompany.nextAction =
      "Human Gateで外部不可逆操作を確認する";
  } else if (execution?.status === "task_executed") {
    refreshedCompany.currentFocus =
      execution.evaluationLevel ??
      execution.task?.result?.result ??
      execution.task?.title ??
      "タスク実行完了";

    refreshedCompany.nextAction =
      execution.nextTask?.title ??
      "次の会社タスクを評価する";
  } else {
    refreshedCompany.currentFocus =
      "自律ループ稼働中";

    refreshedCompany.nextAction =
      "Capability Managerで組織と能力を再評価する";
  }

  refreshedCompany.runtimeVersion =
    RUNTIME_VERSION;

  refreshedCompany.externalActions =
    false;

  refreshedCompany.externalAI =
    false;

  await setStore(
    env,
    "company",
    refreshedCompany
  );

  await updateRuntimeMeta(
    env,
    {
      cycleCount:
        refreshedCompany.cycleCount,
    }
  );

  return {
    runtime:
      RUNTIME_VERSION,
    status:
      execution?.status ??
      "no_task",
    execution,
    company:
      refreshedCompany,
  };
}

async function selfOrganizationCycle(
  env
) {
  const {
    company,
  } = await ensureInitialized(env);

  const before =
    normalizeDepartments(
      company.departments
    );

  const result =
    await reconcileOrganization(env);

  const created =
    await ensureDepartmentTasks(env);

  const after =
    normalizeDepartments(
      result.company.departments
    );

  const newDepartments =
    after.filter(
      (department) =>
        !before.includes(department)
    );

  for (const department of newDepartments) {
    await createCapabilityArtifact(
      env,
      department
    );
  }

  return {
    status:
      "self_organization_completed",
    addedDepartments:
      newDepartments,
    internalTasksCreated:
      created.created,
    departments:
      after,
    capabilitySnapshot:
      result.company.capabilitySnapshot,
  };
}

async function heartbeat(env) {
  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  await updateRuntimeMeta(
    env,
    {
      lastHeartbeatAt:
        nowIso(),
      cycleCount:
        Number(
          company.cycleCount ?? 0
        ),
    }
  );

  return {
    ok: true,
    runtime:
      RUNTIME_VERSION,
    heartbeatAt:
      nowIso(),
  };
}

async function buildHealth(env) {
  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  const tasks =
    await getStore(
      env,
      "tasks",
      []
    );

  const runtimeMeta =
    await env.DB
      .prepare(
        `
        SELECT
          id,
          last_heartbeat_at,
          cycle_count,
          runtime_version
        FROM runtime_meta
        WHERE id = 1
        LIMIT 1
        `
      )
      .first();

  const pendingTasks =
    getPendingTasks(tasks).length;

  const pendingInternalTasks =
    getPendingInternalTasks(
      tasks
    ).length;

  const pendingHumanGates =
    getHumanGateTasks(
      tasks
    ).length;

  const artifactIndex =
    await getStore(
      env,
      "artifact_index",
      []
    );

  return {
    ok: true,

    runtime:
      RUNTIME_VERSION,

    runtime_meta: {
      cycle_count:
        Number(
          runtimeMeta?.cycle_count ??
          company.cycleCount ??
          0
        ),
      runtime_version:
        RUNTIME_VERSION,
      last_heartbeat_at:
        runtimeMeta?.last_heartbeat_at ??
        null,
    },

    company: {
      cycleCount:
        company.cycleCount ?? 0,

      currentFocus:
        company.currentFocus,

      nextAction:
        company.nextAction,

      pendingTasks,

      pendingInternalTasks,

      pendingHumanGates,

      businessCount:
        company.businesses.length,

      evidenceCount:
        company.researchEvidenceIndex.length,

      customerCount:
        company.customers.length,

      outcomeCount:
        company.outcomes.length,

      departmentCount:
        normalizeDepartments(
          company.departments
        ).length,

      departments:
        normalizeDepartments(
          company.departments
        ),
    },

    execution_available: true,

    executor:
      "Cloud Executor (D1-backed)",

    external_read: true,

    customer_gateway_available:
      true,

    outcome_gateway_available:
      true,

    internal_autonomy_available:
      true,

    external_actions:
      false,

    external_ai:
      false,

    artifactCount:
      artifactIndex.length,
  };
}

async function getState(env) {
  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  const tasks =
    await getStore(
      env,
      "tasks",
      []
    );

  const artifactIndex =
    await getStore(
      env,
      "artifact_index",
      []
    );

  return {
    runtime:
      RUNTIME_VERSION,

    company,

    tasks,

    departments:
      company.departments,

    artifacts:
      artifactIndex,

    policy: {
      autonomousInternalChanges:
        true,
      humanGateForIrreversibleExternalActions:
        true,
      paymentAutonomy:
        false,
      publicationAutonomy:
        false,
      contractAutonomy:
        false,
      externalCommunicationAutonomy:
        false,
    },
  };
}

async function getDepartments(env) {
  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  return normalizeDepartments(
    company.departments
  ).map((department) => ({
    department,
    ...buildDepartmentCapability(
      department,
      company
    ),
  }));
}

async function getCapabilities(env) {
  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  const tasks =
    await getStore(
      env,
      "tasks",
      []
    );

  const snapshot =
    capabilitySnapshot(
      company,
      tasks
    );

  company.capabilitySnapshot =
    snapshot;

  company.departments =
    normalizeDepartments(
      company.departments
    );

  await setStore(
    env,
    "company",
    company
  );

  return {
    runtime:
      RUNTIME_VERSION,

    capabilities:
      snapshot,

    departments:
      company.departments,

    departmentDetails:
      company.departments.map(
        (department) =>
          buildDepartmentCapability(
            department,
            company
          )
      ),
  };
}

async function customerIntake(
  env,
  request
) {
  const body =
    await readJSON(request);

  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  const customer = {
    id: randomId("customer"),
    source:
      safeString(
        body.source,
        "unknown"
      ),
    name:
      safeString(
        body.name,
        ""
      ),
    message:
      safeString(
        body.message,
        ""
      ),
    product:
      safeString(
        body.product,
        ""
      ),
    metadata:
      body.metadata &&
      typeof body.metadata ===
        "object"
        ? body.metadata
        : {},
    createdAt: nowIso(),
  };

  company.customers.push(
    customer
  );

  company.customers =
    company.customers.slice(-1000);

  await setStore(
    env,
    "company",
    company
  );

  await saveMemory(env, {
    type: "customer_intake",
    customerId:
      customer.id,
    summary:
      customer.message ||
      "顧客入力を受領した。",
  });

  return {
    status:
      "customer_received",
    customer,
  };
}

async function outcomeRecord(
  env,
  request
) {
  const body =
    await readJSON(request);

  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  const outcome = {
    id: randomId("outcome"),

    businessId:
      safeString(
        body.businessId,
        ""
      ) || null,

    customerId:
      safeString(
        body.customerId,
        ""
      ) || null,

    revenue:
      Number(body.revenue ?? 0),

    cost:
      Number(body.cost ?? 0),

    conversions:
      Number(
        body.conversions ?? 0
      ),

    notes:
      safeString(
        body.notes,
        ""
      ),

    createdAt:
      nowIso(),
  };

  company.outcomes.push(
    outcome
  );

  company.outcomes =
    company.outcomes.slice(-1000);

  await setStore(
    env,
    "company",
    company
  );

  await saveMemory(env, {
    type: "outcome_recorded",
    outcomeId:
      outcome.id,
    businessId:
      outcome.businessId,
    revenue:
      outcome.revenue,
    cost:
      outcome.cost,
  });

  return {
    status:
      "outcome_recorded",
    outcome,
  };
}

async function publicPreview(env) {
  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  const artifacts =
    await getStore(
      env,
      "artifact_index",
      []
    );

  const salesEvaluation =
    artifacts
      .filter(
        (item) =>
          item.action ===
          "sales_evaluation"
      )
      .at(-1);

  const salesPackage =
    artifacts
      .filter(
        (item) =>
          item.action ===
          "sales_package_generation"
      )
      .at(-1);

  return {
    publishable:
      false,

    humanApprovalRequired:
      true,

    reason:
      "外部公開はHuman Gate承認が必要。",

    business:
      company.businesses[0] ?? null,

    salesPackage:
      salesPackage ?? null,

    salesEvaluation:
      salesEvaluation ?? null,

    externalActions:
      false,
  };
}

async function ceoReevaluate(env) {
  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  const tasks =
    await getStore(
      env,
      "tasks",
      []
    );

  const capabilities =
    capabilitySnapshot(
      company,
      tasks
    );

  company.capabilitySnapshot =
    capabilities;

  company.departments =
    normalizeDepartments(
      company.departments
    );

  const pendingHumanGates =
    getHumanGateTasks(
      tasks
    );

  const pendingInternal =
    getPendingInternalTasks(
      tasks
    );

  let decision;

  if (pendingHumanGates.length > 0) {
    decision = {
      type: "defer",
      reason:
        "外部不可逆操作はHuman Gate待ち。",
    };

    company.currentFocus =
      "人間承認待ち";

    company.nextAction =
      "Human Gateで公開等の外部操作を確認する";
  } else if (
    pendingInternal.length > 0
  ) {
    decision = {
      type: "continue",
      reason:
        "内部能力改善タスクを優先実行する。",
    };

    company.currentFocus =
      "内部能力改善中";
  } else {
    decision = {
      type: "continue",
      reason:
        "事業・組織・能力を継続評価する。",
    };

    company.currentFocus =
      "自律評価継続";
  }

  await setStore(
    env,
    "company",
    company
  );

  await saveMemory(env, {
    type: "ceo_reevaluation",
    decision,
    capabilities,
  });

  return {
    runtime:
      RUNTIME_VERSION,
    decision,
    capabilities,
    pendingHumanGates:
      pendingHumanGates.length,
    pendingInternal:
      pendingInternal.length,
    departments:
      company.departments,
  };
}

async function approveHumanGate(
  env,
  request
) {
  const body =
    await readJSON(request);

  const taskId =
    safeString(
      body.taskId,
      ""
    );

  const tasks =
    await getStore(
      env,
      "tasks",
      []
    );

  const task =
    tasks.find(
      (item) => item.id === taskId
    );

  if (
    !task ||
    task.type !== "human_gate"
  ) {
    return {
      status: 404,
      body: {
        ok: false,
        error:
          "Human Gate task not found.",
      },
    };
  }

  const updated =
    await updateTask(
      env,
      taskId,
      {
        status:
          "approved",
        approvedAt:
          nowIso(),
        result: {
          ...(task.result ?? {}),
          humanApproved: true,
        },
      }
    );

  await saveMemory(env, {
    type: "human_gate_approved",
    taskId,
    summary:
      "Human Gateが承認された。",
  });

  return {
    status: 200,
    body: {
      ok: true,
      message:
        "Human Gate approved.",
      task: updated,
      externalActionPerformed:
        false,
      note:
        "承認のみを記録。実際の外部公開・決済・契約等は別実装が必要。",
    },
  };
}

async function rejectHumanGate(
  env,
  request
) {
  const body =
    await readJSON(request);

  const taskId =
    safeString(
      body.taskId,
      ""
    );

  const tasks =
    await getStore(
      env,
      "tasks",
      []
    );

  const task =
    tasks.find(
      (item) => item.id === taskId
    );

  if (
    !task ||
    task.type !== "human_gate"
  ) {
    return {
      status: 404,
      body: {
        ok: false,
        error:
          "Human Gate task not found.",
      },
    };
  }

  const updated =
    await updateTask(
      env,
      taskId,
      {
        status:
          "rejected",
        rejectedAt:
          nowIso(),
        result: {
          ...(task.result ?? {}),
          humanApproved: false,
        },
      }
    );

  await saveMemory(env, {
    type: "human_gate_rejected",
    taskId,
    summary:
      "Human Gateが拒否された。",
  });

  return {
    status: 200,
    body: {
      ok: true,
      message:
        "Human Gate rejected.",
      task: updated,
    },
  };
}

async function getArtifact(
  env,
  artifactId
) {
  if (!artifactId) {
    return null;
  }

  return getStore(
    env,
    `artifact:${artifactId}`,
    null
  );
}

async function getEvidence(
  env,
  evidenceId
) {
  if (!evidenceId) {
    return null;
  }

  return getStore(
    env,
    `evidence:${evidenceId}`,
    null
  );
}

async function routeAPI(
  request,
  env
) {
  const url =
    new URL(request.url);

  const path =
    url.pathname;

  const method =
    request.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods":
          "GET,POST,OPTIONS",
        "access-control-allow-headers":
          "Content-Type",
      },
    });
  }

  if (
    path === "/api/health" &&
    method === "GET"
  ) {
    return jsonResponse(
      await buildHealth(env)
    );
  }

  if (
    path === "/api/heartbeat" &&
    method === "GET"
  ) {
    return jsonResponse(
      await heartbeat(env)
    );
  }

  if (
    path === "/api/state" &&
    method === "GET"
  ) {
    return jsonResponse(
      await getState(env)
    );
  }

  if (
    path === "/api/capabilities" &&
    method === "GET"
  ) {
    return jsonResponse(
      await getCapabilities(env)
    );
  }

  if (
    path === "/api/departments" &&
    method === "GET"
  ) {
    return jsonResponse({
      runtime:
        RUNTIME_VERSION,
      departments:
        await getDepartments(env),
    });
  }

  if (
    path === "/api/cycle" &&
    method === "POST"
  ) {
    return jsonResponse(
      await companyCycle(env)
    );
  }

  if (
    path ===
      "/api/self-organization/cycle" &&
    method === "POST"
  ) {
    return jsonResponse(
      await selfOrganizationCycle(
        env
      )
    );
  }

  if (
    path === "/api/ceo/reevaluate" &&
    method === "POST"
  ) {
    return jsonResponse(
      await ceoReevaluate(env)
    );
  }

  if (
    path === "/api/customer/intake" &&
    method === "POST"
  ) {
    return jsonResponse(
      await customerIntake(
        env,
        request
      ),
      201
    );
  }

  if (
    path === "/api/outcome" &&
    method === "POST"
  ) {
    return jsonResponse(
      await outcomeRecord(
        env,
        request
      ),
      201
    );
  }

  if (
    path === "/api/public/preview" &&
    method === "GET"
  ) {
    return jsonResponse(
      await publicPreview(env)
    );
  }

  if (
    path === "/api/human-gate/approve" &&
    method === "POST"
  ) {
    const result =
      await approveHumanGate(
        env,
        request
      );

    return jsonResponse(
      result.body,
      result.status
    );
  }

  if (
    path === "/api/human-gate/reject" &&
    method === "POST"
  ) {
    const result =
      await rejectHumanGate(
        env,
        request
      );

    return jsonResponse(
      result.body,
      result.status
    );
  }

  if (
    path === "/api/research/fetch" &&
    method === "GET"
  ) {
    const sourceId =
      safeString(
        url.searchParams.get(
          "source"
        ),
        ""
      );

    if (!sourceId) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Missing ?source=<sourceId>",
          availableSources:
            Object.keys(
              RESEARCH_SOURCES
            ),
        },
        400
      );
    }

    try {
      const evidence =
        await researchSource(
          env,
          sourceId
        );

      return jsonResponse({
        ok: true,
        evidence,
      });
    } catch (error) {
      return jsonResponse(
        {
          ok: false,
          error:
            error?.message ??
            String(error),
        },
        500
      );
    }
  }

  if (
    path === "/api/research/sources" &&
    method === "GET"
  ) {
    return jsonResponse({
      ok: true,
      sources:
        Object.entries(
          RESEARCH_SOURCES
        ).map(
          ([id, source]) => ({
            id,
            ...source,
          })
        ),
      readOnly: true,
    });
  }

  if (
    path === "/api/artifact" &&
    method === "GET"
  ) {
    const artifactId =
      safeString(
        url.searchParams.get(
          "id"
        ),
        ""
      );

    const artifact =
      await getArtifact(
        env,
        artifactId
      );

    if (!artifact) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Artifact not found.",
        },
        404
      );
    }

    return jsonResponse({
      ok: true,
      artifact,
    });
  }

  if (
    path === "/api/evidence" &&
    method === "GET"
  ) {
    const evidenceId =
      safeString(
        url.searchParams.get(
          "id"
        ),
        ""
      );

    const evidence =
      await getEvidence(
        env,
        evidenceId
      );

    if (!evidence) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Evidence not found.",
        },
        404
      );
    }

    return jsonResponse({
      ok: true,
      evidence,
    });
  }

  if (
    path === "/api/task" &&
    method === "GET"
  ) {
    const taskId =
      safeString(
        url.searchParams.get(
          "id"
        ),
        ""
      );

    const task =
      await findTaskById(
        env,
        taskId
      );

    if (!task) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Task not found.",
        },
        404
      );
    }

    return jsonResponse({
      ok: true,
      task,
    });
  }

  if (
    path === "/api/task" &&
    method === "POST"
  ) {
    const body =
      await readJSON(request);

    const task =
      await createTask(
        env,
        {
          type:
            safeString(
              body.type,
              "internal_task"
            ),
          action:
            safeString(
              body.action,
              "internal_analysis"
            ),
          title:
            safeString(
              body.title,
              "Internal Task"
            ),
          description:
            safeString(
              body.description,
              ""
            ),
          department:
            safeString(
              body.department,
              "企画"
            ),
          priority:
            clampNumber(
              body.priority,
              1,
              100,
              50
            ),
          internalOnly:
            body.internalOnly === true,
          safeAutonomy:
            body.safeAutonomy === true,
          externalAction:
            body.externalAction === true,
          businessId:
            safeString(
              body.businessId,
              ""
            ) || null,
          input:
            body.input &&
            typeof body.input ===
              "object"
              ? body.input
              : {},
        }
      );

    return jsonResponse(
      {
        ok: true,
        task,
      },
      201
    );
  }

  return null;
}

async function handleRequest(
  request,
  env
) {
  try {
    const apiResponse =
      await routeAPI(
        request,
        env
      );

    if (apiResponse) {
      return apiResponse;
    }

    if (
      request.method !== "GET"
    ) {
      return textResponse(
        "Method Not Allowed",
        405
      );
    }

    if (!env.ASSETS) {
      return jsonResponse(
        {
          ok: true,
          runtime:
            RUNTIME_VERSION,
          message:
            "AI Company Core Worker is running.",
        }
      );
    }

    return env.ASSETS.fetch(
      request
    );
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        runtime:
          RUNTIME_VERSION,
        error:
          error?.message ??
          String(error),
      },
      500
    );
  }
}

export default {
  async fetch(request, env) {
    return handleRequest(
      request,
      env
    );
  },

  async scheduled(
    controller,
    env,
    ctx
  ) {
    ctx.waitUntil(
      (async () => {
        await ensureInitialized(
          env
        );

        await heartbeat(env);

        await companyCycle(
          env
        );

        await selfOrganizationCycle(
          env
        );

        await ceoReevaluate(
          env
        );
      })()
    );
  },
};
