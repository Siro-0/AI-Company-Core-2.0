const RUNTIME_VERSION = "6.1.2-self-maintaining-company";
const SCHEMA_VERSION = "6.1.2";

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
  const raw =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}_${raw}`;
}

function safeString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
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

function textResponse(
  text,
  status = 200,
  type = "text/plain; charset=utf-8"
) {
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

function clampNumber(value, min, max, fallback) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, n));
}

function normalizeTaskStatus(status) {
  const s = safeString(status, "pending").toLowerCase();

  const aliases = {
    pending: "pending",
    waiting: "pending",
    "保留中": "pending",

    running: "running",
    "実行中": "running",

    completed: "completed",
    complete: "completed",
    done: "completed",
    "完了": "completed",

    failed: "failed",
    error: "failed",
    "失敗": "failed",

    waiting_human: "waiting_human",
    human_wait: "waiting_human",
    "人間を待っています": "waiting_human",

    approved: "approved",
    "承認": "approved",

    rejected: "rejected",
    "拒否": "rejected",
  };

  return aliases[s] ?? status ?? "pending";
}

function normalizeTask(raw) {
  const task =
    raw && typeof raw === "object"
      ? { ...raw }
      : {};

  const pipeline =
    task.pipeline &&
    typeof task.pipeline === "object"
      ? { ...task.pipeline }
      : {};

  return {
    ...task,

    id:
      task.id ??
      randomId("task"),

    type:
      safeString(
        task.type,
        task.requiresHuman
          ? "human_gate"
          : "internal_task"
      ),

    action:
      safeString(
        task.action,
        task.executor ?? "internal_analysis"
      ),

    title:
      safeString(
        task.title,
        "内部タスク"
      ),

    description:
      safeString(
        task.description,
        ""
      ),

    department:
      safeString(
        task.department,
        task.departmentName ?? "企画"
      ),

    priority:
      clampNumber(
        task.priority,
        1,
        100,
        50
      ),

    status:
      normalizeTaskStatus(
        task.status
      ),

    internalOnly:
      task.internalOnly === true,

    safeAutonomy:
      task.safeAutonomy === true,

    externalAction:
      task.externalAction === true ||
      task.requiresHuman === true,

    requiresHuman:
      task.requiresHuman === true ||
      task.type === "human_gate",

    businessId:
      safeString(
        task.businessId,
        pipeline.businessId ?? ""
      ) || null,

    input:
      task.input &&
      typeof task.input === "object"
        ? task.input
        : {},

    pipeline,

    createdAt:
      task.createdAt ??
      nowIso(),

    updatedAt:
      task.updatedAt ??
      nowIso(),
  };
}

function normalizeDepartments(input) {
  const list =
    Array.isArray(input)
      ? input
      : [];

  const merged = [
    ...DEFAULT_DEPARTMENTS,
    ...Object.keys(
      GENERATED_DEPARTMENTS
    ),
    ...list,
  ];

  return [
    ...new Set(
      merged
        .map((name) =>
          safeString(name)
        )
        .filter(Boolean)
    ),
  ];
}

function defaultCompany() {
  return {
    cycleCount: 0,

    currentFocus:
      "会社初期化完了",

    nextAction:
      "会社状態を監査する",

    mode:
      "autonomous",

    goal:
      "人間の管理負担を削減しながら、自律的に事業を発見・実行・改善する",

    runtimeVersion:
      RUNTIME_VERSION,

    schemaVersion:
      SCHEMA_VERSION,

    externalActions:
      false,

    externalAI:
      false,

    humanGates:
      [],

    businesses:
      [],

    companyMemory:
      [],

    researchEvidenceIndex:
      [],

    customers:
      [],

    outcomes:
      [],

    departments:
      normalizeDepartments([]),

    capabilitySnapshot:
      {},

    organizationHistory:
      [],

    migration: {
      lastRunAt:
        null,

      version:
        null,

      businessAliases:
        {},

      repairs:
        [],
    },

    maintenance: {
      lastAuditAt:
        null,

      lastRepairAt:
        null,

      lastAnomalies:
        [],
    },
  };
}

async function getStore(
  env,
  key,
  fallback = null
) {
  const row =
    await env.DB
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
    return JSON.parse(
      row.value_json
    );
  } catch {
    return fallback;
  }
}

async function setStore(
  env,
  key,
  value
) {
  await env.DB
    .prepare(
      `
      INSERT INTO company_store (
        key,
        value_json,
        updated_at
      )
      VALUES (?, ?, ?)
      ON CONFLICT(key)
      DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
      `
    )
    .bind(
      key,
      JSON.stringify(value),
      nowIso()
    )
    .run();

  return value;
}

async function updateRuntimeMeta(
  env,
  patch = {}
) {
  const current =
    await env.DB
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
      : Number(
          current?.cycle_count ?? 0
        );

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

function normalizeBusiness(raw) {
  const business =
    raw &&
    typeof raw === "object"
      ? { ...raw }
      : {};

  return {
    ...business,

    id:
      safeString(
        business.id,
        randomId("business")
      ),

    name:
      safeString(
        business.name ??
          business.title,
        "未定義事業"
      ),

    problem:
      safeString(
        business.problem,
        ""
      ),

    target:
      safeString(
        business.target ??
          business.customer,
        ""
      ),

    value:
      safeString(
        business.value,
        ""
      ),

    status:
      safeString(
        business.status,
        "hypothesis"
      ),

    createdAt:
      business.createdAt ??
      nowIso(),
  };
}

function businessNameFromTask(
  task
) {
  const title =
    safeString(
      task.title,
      ""
    );

  if (!title) {
    return "";
  }

  const separators = [
    ":",
    "：",
    " — ",
    " - ",
  ];

  for (
    const separator of separators
  ) {
    const index =
      title.indexOf(
        separator
      );

    if (
      index >= 0 &&
      index <
        title.length -
          separator.length
    ) {
      const candidate =
        title
          .slice(
            index +
              separator.length
          )
          .trim();

      if (
        candidate.length >= 5
      ) {
        return candidate;
      }
    }
  }

  return "";
}

function chooseCanonicalBusiness(
  companyBusinesses,
  tasks
) {
  const businesses =
    companyBusinesses.map(
      normalizeBusiness
    );

  if (
    businesses.length === 0
  ) {
    return null;
  }

  const counts =
    new Map();

  for (
    const task of tasks
  ) {
    const id =
      safeString(
        task.businessId,
        ""
      );

    if (!id) {
      continue;
    }

    counts.set(
      id,
      (counts.get(id) ?? 0) +
        1
    );
  }

  const exactPrimary =
    businesses.find(
      (business) =>
        counts.has(
          business.id
        )
    );

  return (
    exactPrimary ??
    businesses[0]
  );
}

function uniqueTaskBusinessIds(
  tasks
) {
  return [
    ...new Set(
      tasks
        .map((task) =>
          safeString(
            task.businessId,
            ""
          )
        )
        .filter(Boolean)
    ),
  ];
}

function addAlias(
  company,
  oldId,
  newId
) {
  company.migration =
    company.migration ??
    {};

  company.migration.businessAliases =
    company.migration
      .businessAliases ??
    {};

  company.migration.businessAliases[
    oldId
  ] = newId;
}

function applyBusinessAlias(
  company,
  id
) {
  if (!id) {
    return id;
  }

  const aliases =
    company.migration
      ?.businessAliases ??
    {};

  return (
    aliases[id] ??
    id
  );
}

function canonicalizeBusinessAliasObject(
  business,
  company
) {
  const alias =
    applyBusinessAlias(
      company,
      business.id
    );

  if (
    alias !==
    business.id
  ) {
    return {
      ...business,
      id: alias,
    };
  }

  return business;
}

function mergeBusinessIdentity(
  company,
  tasks
) {
  company.businesses =
    Array.isArray(
      company.businesses
    )
      ? company.businesses.map(
          normalizeBusiness
        )
      : [];

  if (
    company.businesses.length ===
    0
  ) {
    const inferredNames =
      tasks
        .map(
          businessNameFromTask
        )
        .filter(Boolean);

    const inferredName =
      inferredNames[0] ??
      "自動生成事業";

    company.businesses.push({
      id:
        randomId(
          "business"
        ),

      name:
        inferredName,

      problem:
        "過去タスクから再構成された事業仮説。",

      target:
        "未定義",

      value:
        "未定義",

      status:
        "migrated",

      createdAt:
        nowIso(),
    });
  }

  const canonical =
    chooseCanonicalBusiness(
      company.businesses,
      tasks
    );

  const canonicalKey =
    canonical.name
      .trim()
      .toLowerCase();

  const duplicateIds =
    [];

  for (
    const business of
      company.businesses
  ) {
    if (
      business.id ===
      canonical.id
    ) {
      continue;
    }

    if (
      business.name
        .trim()
        .toLowerCase() ===
      canonicalKey
    ) {
      duplicateIds.push(
        business.id
      );
    }
  }

  for (
    const duplicateId of
      duplicateIds
  ) {
    addAlias(
      company,
      duplicateId,
      canonical.id
    );
  }

  const aliases =
    company.migration
      .businessAliases ??
    {};

  const names =
    new Set(
      company.businesses.map(
        (business) =>
          business.name
            .trim()
            .toLowerCase()
      )
    );

  for (
    const task of tasks
  ) {
    const oldId =
      safeString(
        task.businessId,
        ""
      );

    if (!oldId) {
      continue;
    }

    if (
      aliases[oldId]
    ) {
      task.businessId =
        aliases[oldId];

      if (
        task.pipeline &&
        typeof task.pipeline ===
          "object"
      ) {
        task.pipeline.businessId =
          aliases[oldId];
      }

      continue;
    }

    if (
      oldId ===
      canonical.id
    ) {
      continue;
    }

    const titleName =
      businessNameFromTask(
        task
      );

    if (
      titleName &&
      names.has(
        titleName
          .trim()
          .toLowerCase()
      )
    ) {
      const matching =
        company.businesses.find(
          (business) =>
            business.name
              .trim()
              .toLowerCase() ===
            titleName
              .trim()
              .toLowerCase()
        );

      if (matching) {
        addAlias(
          company,
          oldId,
          matching.id
        );

        task.businessId =
          matching.id;

        if (
          task.pipeline &&
          typeof task.pipeline ===
            "object"
        ) {
          task.pipeline.businessId =
            matching.id;
        }

        continue;
      }
    }
  }

  for (
    const task of tasks
  ) {
    if (
      task.businessId
    ) {
      task.businessId =
        applyBusinessAlias(
          company,
          task.businessId
        );
    }

    if (
      task.pipeline &&
      typeof task.pipeline ===
        "object" &&
      task.pipeline.businessId
    ) {
      task.pipeline.businessId =
        applyBusinessAlias(
          company,
          task.pipeline
            .businessId
        );
    }
  }

  const referencedIds =
    new Set(
      uniqueTaskBusinessIds(
        tasks
      )
    );

  for (
    const business of
      company.businesses
  ) {
    if (
      !referencedIds.has(
        business.id
      ) &&
      business.id !==
        canonical.id
    ) {
      company.migration.repairs.push(
        {
          type:
            "unreferenced_business_preserved",

          businessId:
            business.id,

          at:
            nowIso(),
        }
      );
    }
  }

  company.businesses = [
    ...new Map(
      company.businesses.map(
        (business) => [
          applyBusinessAlias(
            company,
            business.id
          ),
          business.id ===
          canonical.id
            ? business
            : canonicalizeBusinessAliasObject(
                business,
                company
              ),
        ]
      )
    ).values(),
  ];

  return canonical.id;
}

function reconcileDuplicatePipelineTasks(
  tasks
) {
  const groups =
    new Map();

  const pipelineActions =
    new Set([
      "research_brief",
      "product_prototype",
      "sales_package_generation",
      "sales_evaluation",
      "human_gate_publication",
    ]);

  for (
    const task of tasks
  ) {
    const businessId =
      safeString(
        task.businessId,
        ""
      );

    if (
      !businessId ||
      !pipelineActions.has(
        task.action
      )
    ) {
      continue;
    }

    const key =
      `${businessId}::${task.action}`;

    if (
      !groups.has(key)
    ) {
      groups.set(
        key,
        []
      );
    }

    groups
      .get(key)
      .push(task);
  }

  let supersededCount = 0;

  for (
    const group of groups.values()
  ) {
    const hasHumanWaiting =
      group.some(
        (task) =>
          task.status ===
          "waiting_human"
      );

    const hasCompleted =
      group.some(
        (task) =>
          task.status ===
          "completed"
      );

    if (
      !hasHumanWaiting &&
      !hasCompleted
    ) {
      continue;
    }

    for (
      const task of group
    ) {
      if (
        task.status !==
          "pending" &&
        task.status !==
          "running"
      ) {
        continue;
      }

      task.status =
        "superseded";

      task.supersededAt =
        nowIso();

      task.result = {
        ...(task.result ?? {}),

        supersededReason:
          hasHumanWaiting
            ? "同一事業・同一工程のHuman Gateが既に存在するため統合した。"
            : "既存の完了済み同一工程があるため統合した。",
      };

      supersededCount += 1;
    }
  }

  return supersededCount;
}

function rebuildHumanGates(
  company,
  tasks
) {
  const current =
    Array.isArray(
      company.humanGates
    )
      ? company.humanGates
      : [];

  const byTask =
    new Map(
      current.map(
        (gate) => [
          gate.taskId,
          gate,
        ]
      )
    );

  const next =
    [];

  for (
    const task of tasks
  ) {
    const isHumanGate =
      task.type ===
        "human_gate" ||
      task.requiresHuman ===
        true ||
      task.humanGateId !=
        null;

    if (!isHumanGate) {
      continue;
    }

    const existing =
      byTask.get(
        task.id
      );

    next.push({
      id:
        existing?.id ??
        task.humanGateId ??
        randomId("gate"),

      taskId:
        task.id,

      businessId:
        task.businessId ??
        task.pipeline
          ?.businessId ??
        null,

      status:
        task.status ===
        "waiting_human"
          ? "pending"
          : task.status ===
              "approved"
            ? "approved"
            : task.status ===
                "rejected"
              ? "rejected"
              : existing?.status ??
                "pending",

      requiresHuman:
        true,

      createdAt:
        existing?.createdAt ??
        task.createdAt ??
        nowIso(),

      updatedAt:
        nowIso(),
    });
  }

  company.humanGates =
    next;

  return next;
}

function actionMatches(
  action,
  aliases
) {
  const normalized =
    safeString(
      action,
      ""
    )
      .toLowerCase()
      .replace(
        /[-_\s]/g,
        ""
      );

  return aliases.some(
    (alias) =>
      normalized ===
      alias
        .toLowerCase()
        .replace(
          /[-_\s]/g,
          ""
        )
  );
}

function hasCompletedAction(
  tasks,
  aliases
) {
  return tasks.some(
    (task) =>
      normalizeTaskStatus(
        task.status
      ) ===
        "completed" &&
      actionMatches(
        task.action,
        aliases
      )
  );
}

function capabilitySnapshot(
  company,
  tasks
) {
  const externalResearch =
    (company
      .researchEvidenceIndex
      ?.length ??
      0) > 0 ||
    hasCompletedAction(
      tasks,
      [
        "research_external_evidence",
        "external_research",
        "researchgateway",
      ]
    );

  const productGeneration =
    hasCompletedAction(
      tasks,
      [
        "product_prototype",
        "productprototype",
      ]
    );

  const salesPreparation =
    hasCompletedAction(
      tasks,
      [
        "sales_package_generation",
        "salespackagegeneration",
      ]
    );

  const customerFeedback =
    (company.customers?.length ??
      0) > 0;

  const outcomeTracking =
    (company.outcomes?.length ??
      0) > 0;

  const revenueTracking =
    (company.outcomes ?? []).some(
      (outcome) =>
        Number(
          outcome.revenue ?? 0
        ) > 0
    );

  const publication =
    hasCompletedAction(
      tasks,
      [
        "publish",
        "publication",
        "external_publication",
      ]
    );

  const payment =
    hasCompletedAction(
      tasks,
      [
        "payment",
        "payment_connected",
        "external_payment",
      ]
    );

  const selfDevelopment =
    hasCompletedAction(
      tasks,
      [
        "development_infrastructure",
        "self_development",
        "code_change_candidate",
        "self_maintenance_repair",
      ]
    );

  const platformIndependence =
    hasCompletedAction(
      tasks,
      [
        "platform_decoupling",
        "platform_independence",
      ]
    );

  return {
    externalResearch,
    productGeneration,
    salesPreparation,
    customerFeedback,
    outcomeTracking,
    revenueTracking,
    publication,
    payment,
    selfDevelopment,
    platformIndependence,
  };
}

function definitionNextAction(
  department
) {
  if (
    department ===
    "開発基盤"
  ) {
    return "Sandbox / Test / Deploy の分離を実装する。";
  }

  if (
    department ===
    "プラットフォーム戦略"
  ) {
    return "Storage / Scheduler / Executor / Web の Adapter 境界を実装する。";
  }

  if (
    department ===
    "調査"
  ) {
    return "外部証拠取得結果を事業仮説へ反映する。";
  }

  if (
    department ===
    "顧客対応"
  ) {
    return "顧客フィードバックを改善タスクへ変換する。";
  }

  if (
    department ===
    "事業成果"
  ) {
    return "成果・売上・コストをCEO評価へ接続する。";
  }

  if (
    department ===
    "技術"
  ) {
    return "実行系の安定性と再利用可能な構造を改善する。";
  }

  if (
    department ===
    "リスク管理"
  ) {
    return "外部作用と不可逆操作のリスク境界を確認する。";
  }

  if (
    department ===
    "企画"
  ) {
    return "新しい事業仮説と優先順位を整理する。";
  }

  return "部門成果をCEOの次戦略へ渡す。";
}

async function addMemory(
  env,
  entry
) {
  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  company.companyMemory =
    Array.isArray(
      company.companyMemory
    )
      ? company.companyMemory
      : [];

  company.companyMemory.push({
    id:
      randomId("memory"),

    ...entry,

    createdAt:
      nowIso(),
  });

  company.companyMemory =
    company.companyMemory.slice(
      -500
    );

  await setStore(
    env,
    "company",
    company
  );
}

async function saveTasks(
  env,
  tasks
) {
  await setStore(
    env,
    "tasks",
    tasks
  );
}

async function createTask(
  env,
  definition
) {
  let tasks =
    await getStore(
      env,
      "tasks",
      []
    );

  tasks =
    Array.isArray(tasks)
      ? tasks.map(
          normalizeTask
        )
      : [];

  const sameAction =
    safeString(
      definition.action,
      ""
    );

  const sameBusiness =
    safeString(
      definition.businessId,
      ""
    ) || null;

  const duplicate =
    tasks.find(
      (task) =>
        task.action ===
          sameAction &&
        task.businessId ===
          sameBusiness &&
        (
          task.status ===
            "pending" ||
          task.status ===
            "running" ||
          task.status ===
            "waiting_human"
        )
    );

  if (
    duplicate
  ) {
    return duplicate;
  }

  const task =
    normalizeTask({
      id:
        randomId("task"),

      type:
        definition.type ??
        "internal_task",

      action:
        definition.action ??
        "internal_analysis",

      title:
        definition.title ??
        "内部タスク",

      description:
        definition.description ??
        "",

      department:
        definition.department ??
        "企画",

      priority:
        definition.priority ??
        50,

      status:
        definition.status ??
        "pending",

      internalOnly:
        definition.internalOnly ??
        false,

      safeAutonomy:
        definition.safeAutonomy ??
        false,

      externalAction:
        definition.externalAction ??
        false,

      requiresHuman:
        definition.requiresHuman ??
        false,

      businessId:
        sameBusiness,

      input:
        definition.input ??
        {},

      pipeline:
        definition.pipeline ??
        {},

      createdAt:
        nowIso(),

      updatedAt:
        nowIso(),
    });

  tasks.push(task);

  await saveTasks(
    env,
    tasks
  );

  return task;
}

async function updateTask(
  env,
  taskId,
  patch
) {
  let tasks =
    await getStore(
      env,
      "tasks",
      []
    );

  tasks =
    Array.isArray(tasks)
      ? tasks.map(
          normalizeTask
        )
      : [];

  const index =
    tasks.findIndex(
      (task) =>
        task.id ===
        taskId
    );

  if (
    index < 0
  ) {
    return null;
  }

  tasks[index] =
    normalizeTask({
      ...tasks[index],

      ...patch,

      updatedAt:
        nowIso(),
    });

  await saveTasks(
    env,
    tasks
  );

  return tasks[index];
}

async function findTaskById(
  env,
  taskId
) {
  const tasks =
    await getStore(
      env,
      "tasks",
      []
    );

  return tasks
    .map(
      normalizeTask
    )
    .find(
      (task) =>
        task.id ===
        taskId
    ) ?? null;
}

async function saveArtifact(
  env,
  task,
  payload
) {
  const artifact = {
    id:
      randomId("artifact"),

    taskId:
      task.id,

    businessId:
      task.businessId ??
      null,

    department:
      task.department ??
      null,

    action:
      task.action,

    createdAt:
      nowIso(),

    payload,
  };

  await setStore(
    env,
    `artifact:${artifact.id}`,
    artifact
  );

  const index =
    await getStore(
      env,
      "artifact_index",
      []
    );

  const next =
    Array.isArray(index)
      ? index
      : [];

  next.push({
    id:
      artifact.id,

    taskId:
      artifact.taskId,

    businessId:
      artifact.businessId,

    department:
      artifact.department,

    action:
      artifact.action,

    createdAt:
      artifact.createdAt,
  });

  await setStore(
    env,
    "artifact_index",
    next.slice(-1000)
  );

  return artifact;
}

function getPendingInternalTasks(
  tasks
) {
  return tasks.filter(
    (task) =>
      task.internalOnly ===
        true &&
      (
        task.status ===
          "pending" ||
        task.status ===
          "running"
      )
  );
}

function getPendingHumanGates(
  tasks
) {
  return tasks.filter(
    (task) =>
      (
        task.type ===
          "human_gate" ||
        task.requiresHuman ===
          true
      ) &&
      task.status ===
        "waiting_human"
  );
}

function taskPriority(
  task
) {
  if (
    task.action?.startsWith(
      "self_maintenance"
    )
  ) {
    return 120;
  }

  if (
    task.type ===
      "internal_task" &&
    task.internalOnly
  ) {
    return 110;
  }

  if (
    task.type ===
    "business_task"
  ) {
    return 90;
  }

  return Number(
    task.priority ??
      50
  );
}

function sortTasksForExecution(
  tasks
) {
  return [
    ...tasks,
  ].sort(
    (a, b) =>
      taskPriority(b) -
        taskPriority(a) ||
      String(
        a.createdAt
      ).localeCompare(
        String(
          b.createdAt
        )
      )
  );
}

async function mergeAndMigrateState(
  env
) {
  const rawCompany =
    await getStore(
      env,
      "company",
      null
    );

  const rawTasks =
    await getStore(
      env,
      "tasks",
      []
    );

  let company =
    rawCompany
      ? {
          ...defaultCompany(),
          ...rawCompany,
        }
      : defaultCompany();

  let tasks =
    Array.isArray(
      rawTasks
    )
      ? rawTasks.map(
          normalizeTask
        )
      : [];

  company.departments =
    normalizeDepartments(
      company.departments
    );

  company.companyMemory =
    Array.isArray(
      company.companyMemory
    )
      ? company.companyMemory
      : [];

  company.researchEvidenceIndex =
    Array.isArray(
      company.researchEvidenceIndex
    )
      ? company.researchEvidenceIndex
      : [];

  company.customers =
    Array.isArray(
      company.customers
    )
      ? company.customers
      : [];

  company.outcomes =
    Array.isArray(
      company.outcomes
    )
      ? company.outcomes
      : [];

  company.organizationHistory =
    Array.isArray(
      company.organizationHistory
    )
      ? company.organizationHistory
      : [];

  company.humanGates =
    Array.isArray(
      company.humanGates
    )
      ? company.humanGates
      : [];

  company.migration = {
    lastRunAt:
      company.migration
        ?.lastRunAt ??
      null,

    version:
      company.migration
        ?.version ??
      null,

    businessAliases:
      company.migration
        ?.businessAliases ??
      {},

    repairs:
      Array.isArray(
        company.migration
          ?.repairs
      )
        ? company.migration
            .repairs
        : [],
  };

  company.maintenance = {
    lastAuditAt:
      company.maintenance
        ?.lastAuditAt ??
      null,

    lastRepairAt:
      company.maintenance
        ?.lastRepairAt ??
      null,

    lastAnomalies:
      Array.isArray(
        company.maintenance
          ?.lastAnomalies
      )
        ? company.maintenance
            .lastAnomalies
        : [],
  };

  const beforeAliases =
    {
      ...company.migration
        .businessAliases,
    };

  const beforeTaskBusinessIds =
    tasks.map(
      (task) =>
        task.businessId
    );

  const canonicalBusinessId =
    mergeBusinessIdentity(
      company,
      tasks
    );

  const supersededCount =
    reconcileDuplicatePipelineTasks(
      tasks
    );

  rebuildHumanGates(
    company,
    tasks
  );

  for (
    const task of tasks
  ) {
    task.status =
      normalizeTaskStatus(
        task.status
      );

    if (
      task.pipeline
        ?.businessId
    ) {
      task.pipeline.businessId =
        applyBusinessAlias(
          company,
          task.pipeline
            .businessId
        );
    }
  }

  company.capabilitySnapshot =
    capabilitySnapshot(
      company,
      tasks
    );

  company.schemaVersion =
    SCHEMA_VERSION;

  company.runtimeVersion =
    RUNTIME_VERSION;

  company.externalActions =
    false;

  company.externalAI =
    false;

  const migrationChanged =
    JSON.stringify(
      beforeAliases
    ) !==
      JSON.stringify(
        company.migration
          .businessAliases
      ) ||
    JSON.stringify(
      beforeTaskBusinessIds
    ) !==
      JSON.stringify(
        tasks.map(
          (task) =>
            task.businessId
        )
      ) ||
    company.migration
      .version !==
      SCHEMA_VERSION;

  if (
    migrationChanged ||
    supersededCount > 0
  ) {
    company.migration.repairs.push(
      {
        type:
          "migration_run",

        fromVersion:
          company.migration
            .version,

        toVersion:
          SCHEMA_VERSION,

        canonicalBusinessId,

        taskCount:
          tasks.length,

        supersededCount,

        at:
          nowIso(),
      }
    );
  }

  company.migration.repairs =
    company.migration.repairs.slice(
      -200
    );

  company.migration.version =
    SCHEMA_VERSION;

  company.migration.lastRunAt =
    nowIso();

  await setStore(
    env,
    "tasks",
    tasks
  );

  await setStore(
    env,
    "company",
    company
  );

  await updateRuntimeMeta(
    env,
    {
      cycleCount:
        Number(
          company.cycleCount ??
          0
        ),
    }
  );

  return {
    company,
    tasks,
    changed:
      migrationChanged ||
      supersededCount > 0,
    supersededCount,
  };
}

async function ensureInitialized(
  env
) {
  return mergeAndMigrateState(
    env
  );
}

async function reconcileOrganization(
  env
) {
  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  const tasks =
    (
      await getStore(
        env,
        "tasks",
        []
      )
    ).map(
      normalizeTask
    );

  const before =
    normalizeDepartments(
      company.departments
    );

  company.departments =
    before;

  company.capabilitySnapshot =
    capabilitySnapshot(
      company,
      tasks
    );

  const added =
    [];

  for (
    const [
      department,
      definition,
    ] of Object.entries(
      GENERATED_DEPARTMENTS
    )
  ) {
    if (
      !company
        .capabilitySnapshot[
          definition.trigger
        ] &&
      !company.departments.includes(
        department
      )
    ) {
      company.departments.push(
        department
      );

      added.push(
        department
      );
    }
  }

  company.departments =
    normalizeDepartments(
      company.departments
    );

  if (
    added.length > 0
  ) {
    company.organizationHistory.push(
      {
        type:
          "department_created",

        departments:
          added,

        reason:
          "capability_gap",

        createdAt:
          nowIso(),
      }
    );
  }

  company.organizationHistory =
    company.organizationHistory.slice(
      -200
    );

  await setStore(
    env,
    "company",
    company
  );

  return {
    company,
    tasks,
    before,
    after:
      company.departments,
    added,
  };
}

async function ensureDepartmentTasks(
  env
) {
  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  let tasks =
    (
      await getStore(
        env,
        "tasks",
        []
      )
    ).map(
      normalizeTask
    );

  const created =
    [];

  const pendingInternal =
    getPendingInternalTasks(
      tasks
    );

  if (
    pendingInternal.length >=
    3
  ) {
    return {
      created,
    };
  }

  const preferredDepartments =
    [
      "開発基盤",
      "プラットフォーム戦略",
      "調査",
      "顧客対応",
      "事業成果",
      "リスク管理",
      "技術",
      "企画",
    ];

  for (
    const department of
      preferredDepartments
  ) {
    if (
      created.length >=
      1
    ) {
      break;
    }

    if (
      !company.departments.includes(
        department
      )
    ) {
      continue;
    }

    const generated =
      GENERATED_DEPARTMENTS[
        department
      ];

    const hasPending =
      tasks.some(
        (task) =>
          task.internalOnly ===
            true &&
          task.department ===
            department &&
          (
            task.status ===
              "pending" ||
            task.status ===
              "running"
          )
      );

    if (
      hasPending
    ) {
      continue;
    }

    const action =
      generated?.action ??
      "internal_department_improvement";

    const task =
      await createTask(
        env,
        {
          type:
            "internal_task",

          action,

          title:
            `${department}：${definitionNextAction(
              department
            )}`,

          description:
            generated?.mission ??
            `${department}の内部能力を点検・改善する。`,

          department,

          priority:
            department ===
            "リスク管理"
              ? 80
              : 50,

          internalOnly:
            true,

          safeAutonomy:
            true,

          externalAction:
            false,
        }
      );

    created.push(
      task
    );

    tasks.push(
      task
    );
  }

  return {
    created,
  };
}

async function createBusinessIfNeeded(
  env
) {
  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  company.businesses =
    Array.isArray(
      company.businesses
    )
      ? company.businesses.map(
          normalizeBusiness
        )
      : [];

  if (
    company.businesses.length >
    0
  ) {
    await setStore(
      env,
      "company",
      company
    );

    return company
      .businesses[0];
  }

  const business =
    {
      id:
        randomId(
          "business"
        ),

      name:
        "小規模事業向け調査レポート生成サービス",

      problem:
        "小規模事業者が必要な市場・競合・制度情報の調査に時間を取られる。",

      target:
        "小規模事業者・個人事業主",

      value:
        "調査設計からレポート生成までを短時間で支援する。",

      status:
        "hypothesis",

      createdAt:
        nowIso(),
    };

  company.businesses.push(
    business
  );

  await setStore(
    env,
    "company",
    company
  );

  return business;
}

async function createBusinessPipelineTask(
  env,
  business,
  stage
) {
  const definitions =
    {
      research: {
        action:
          "research_brief",

        title:
          `市場調査：${business.name}`,

        department:
          "調査",

        type:
          "business_task",
      },

      product: {
        action:
          "product_prototype",

        title:
          `商品設計・試作：${business.name}`,

        department:
          "技術",

        type:
          "business_task",
      },

      sales: {
        action:
          "sales_package_generation",

        title:
          `販売準備：${business.name}`,

        department:
          "企画",

        type:
          "business_task",
      },

      sales_evaluation: {
        action:
          "sales_evaluation",

        title:
          `販売構成評価：${business.name}`,

        department:
          "事業成果",

        type:
          "business_task",
      },

      human_gate: {
        action:
          "human_gate_publication",

        title:
          `Human Gate：公開承認：${business.name}`,

        department:
          "リスク管理",

        type:
          "human_gate",
      },
    };

  const definition =
    definitions[stage];

  if (!definition) {
    throw new Error(
      `Unknown business stage: ${stage}`
    );
  }

  return createTask(
    env,
    {
      type:
        definition.type,

      action:
        definition.action,

      title:
        definition.title,

      department:
        definition.department,

      priority:
        stage ===
        "human_gate"
          ? 100
          : 90,

      status:
        stage ===
        "human_gate"
          ? "waiting_human"
          : "pending",

      internalOnly:
        false,

      safeAutonomy:
        false,

      externalAction:
        stage ===
        "human_gate",

      requiresHuman:
        stage ===
        "human_gate",

      businessId:
        business.id,

      pipeline:
        {
          type:
            "business_pipeline",

          stage,

          businessId:
            business.id,
        },
    }
  );
}

async function researchSource(
  env,
  sourceId
) {
  const source =
    RESEARCH_SOURCES[
      sourceId
    ];

  if (!source) {
    throw new Error(
      `Unknown research source: ${sourceId}`
    );
  }

  const response =
    await fetch(
      source.url,
      {
        method:
          "GET",

        headers:
          {
            "user-agent":
              "AI-Company-Core/6.1.2 research gateway",

            accept:
              "text/html,application/xhtml+xml,application/json",
          },
      }
    );

  const rawText =
    await response.text();

  const contentPreview =
    rawText.length >
    20000
      ? rawText.slice(
          0,
          20000
        )
      : rawText;

  const evidence =
    {
      id:
        randomId(
          "evidence"
        ),

      sourceId,

      sourceName:
        source.name,

      url:
        source.url,

      status:
        response.status,

      ok:
        response.ok,

      retrievedAt:
        nowIso(),

      contentPreview,
    };

  await setStore(
    env,
    `evidence:${evidence.id}`,
    evidence
  );

  const company =
    await getStore(
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

  company.researchEvidenceIndex.push(
    {
      id:
        evidence.id,

      sourceId:
        evidence.sourceId,

      sourceName:
        evidence.sourceName,

      url:
        evidence.url,

      status:
        evidence.status,

      ok:
        evidence.ok,

      retrievedAt:
        evidence.retrievedAt,
    }
  );

  company.researchEvidenceIndex =
    company.researchEvidenceIndex.slice(
      -500
    );

  await setStore(
    env,
    "company",
    company
  );

  await addMemory(
    env,
    {
      type:
        "external_research",

      summary:
        `${source.name}から外部証拠を取得した。`,

      evidenceId:
        evidence.id,
    }
  );

  return evidence;
}

async function buildCapabilityArtifact(
  env,
  department
) {
  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  const generated =
    GENERATED_DEPARTMENTS[
      department
    ];

  const payload =
    {
      department,

      mission:
        generated?.mission ??
        `${department}に関する会社能力を維持・改善する。`,

      currentCapability:
        generated?.trigger
          ? company
              .capabilitySnapshot?.[
                generated.trigger
              ] ??
            false
          : true,

      nextAction:
        definitionNextAction(
          department
        ),

      autonomy:
        {
          internalTaskCreation:
            true,

          internalArtifactCreation:
            true,

          externalIrreversibleAction:
            false,
        },
    };

  const syntheticTask =
    {
      id:
        randomId(
          "capability"
        ),

      action:
        "capability_analysis",

      department,

      businessId:
        null,
    };

  return saveArtifact(
    env,
    syntheticTask,
    payload
  );
}

async function auditState(
  env
) {
  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  const tasks =
    (
      await getStore(
        env,
        "tasks",
        []
      )
    ).map(
      normalizeTask
    );

  const anomalies =
    [];

  const businessIds =
    new Set(
      (
        company.businesses ??
        []
      ).map(
        (business) =>
          business.id
      )
    );

  for (
    const task of tasks
  ) {
    if (
      task.businessId &&
      !businessIds.has(
        applyBusinessAlias(
          company,
          task.businessId
        )
      )
    ) {
      anomalies.push(
        {
          type:
            "orphan_business_reference",

          taskId:
            task.id,

          businessId:
            task.businessId,
        }
      );
    }
  }

  const names =
    new Map();

  for (
    const business of
      company.businesses ??
      []
  ) {
    const key =
      safeString(
        business.name,
        ""
      ).toLowerCase();

    if (!key) {
      continue;
    }

    names.set(
      key,
      (names.get(key) ??
        0) + 1
    );
  }

  for (
    const [
      name,
      count,
    ] of names
  ) {
    if (
      count > 1
    ) {
      anomalies.push(
        {
          type:
            "duplicate_business_name",

          name,

          count,
        }
      );
    }
  }

  const waitingHuman =
    getPendingHumanGates(
      tasks
    );

  const gateTaskIds =
    new Set(
      (
        company.humanGates ??
        []
      ).map(
        (gate) =>
          gate.taskId
      )
    );

  for (
    const task of
      waitingHuman
  ) {
    if (
      !gateTaskIds.has(
        task.id
      )
    ) {
      anomalies.push(
        {
          type:
            "missing_human_gate_record",

          taskId:
            task.id,
        }
      );
    }
  }

  const capabilities =
    capabilitySnapshot(
      company,
      tasks
    );

  if (
    !company.capabilitySnapshot ||
    JSON.stringify(
      company.capabilitySnapshot
    ) !==
      JSON.stringify(
        capabilities
      )
  ) {
    anomalies.push(
      {
        type:
          "capability_snapshot_stale",
      }
    );
  }

  const completedWithArtifactId =
    tasks.filter(
      (task) =>
        task.status ===
          "completed" &&
        task.artifactId
    );

  for (
    const task of
      completedWithArtifactId.slice(
        -100
      )
  ) {
    const artifact =
      await getStore(
        env,
        `artifact:${task.artifactId}`,
        null
      );

    if (!artifact) {
      anomalies.push(
        {
          type:
            "missing_artifact",

          taskId:
            task.id,

          artifactId:
            task.artifactId,
        }
      );
    }
  }

  const pipelineTaskCount =
    tasks.filter(
      (task) =>
        task.pipeline?.type ===
        "business_pipeline"
    ).length;

  if (
    (company
      .businesses?.length ??
      0) > 0 &&
    pipelineTaskCount ===
      0
  ) {
    anomalies.push(
      {
        type:
          "business_has_no_pipeline_history",
      }
    );
  }

  const expectedDepartments =
    normalizeDepartments(
      company.departments
    );

  if (
    JSON.stringify(
      expectedDepartments
    ) !==
    JSON.stringify(
      company.departments ??
        []
    )
  ) {
    anomalies.push(
      {
        type:
          "department_normalization_needed",
      }
    );
  }

  if (
    company.schemaVersion !==
    SCHEMA_VERSION
  ) {
    anomalies.push(
      {
        type:
          "schema_version_mismatch",

        current:
          company.schemaVersion ??
          null,

        expected:
          SCHEMA_VERSION,
      }
    );
  }

  company.maintenance =
    company.maintenance ??
    {};

  company.maintenance.lastAuditAt =
    nowIso();

  company.maintenance.lastAnomalies =
    anomalies.slice(
      -200
    );

  await setStore(
    env,
    "company",
    company
  );

  return {
    ok:
      true,

    runtime:
      RUNTIME_VERSION,

    anomalyCount:
      anomalies.length,

    anomalies,

    capabilities,
  };
}

async function ensureMaintenanceTasks(
  env,
  audit
) {
  const created =
    [];

  const mappings =
    {
      orphan_business_reference:
        {
          action:
            "self_maintenance_state_reconciliation",

          title:
            "自己保守：事業参照を修復する",
        },

      duplicate_business_name:
        {
          action:
            "self_maintenance_state_reconciliation",

          title:
            "自己保守：事業重複を整理する",
        },

      missing_human_gate_record:
        {
          action:
            "self_maintenance_human_gate_reconciliation",

          title:
            "自己保守：Human Gate記録を再構築する",
        },

      capability_snapshot_stale:
        {
          action:
            "self_maintenance_capability_reconciliation",

          title:
            "自己保守：Capability Snapshotを再構築する",
        },

      missing_artifact:
        {
          action:
            "self_maintenance_artifact_reconciliation",

          title:
            "自己保守：Artifact参照を再構築する",
        },

      business_has_no_pipeline_history:
        {
          action:
            "self_maintenance_state_reconciliation",

          title:
            "自己保守：事業パイプライン履歴を点検する",
        },

      department_normalization_needed:
        {
          action:
            "self_maintenance_organization_reconciliation",

          title:
            "自己保守：組織状態を正規化する",
        },

      schema_version_mismatch:
        {
          action:
            "self_maintenance_state_reconciliation",

          title:
            "自己保守：Schema移行を完了する",
        },
    };

  const uniqueActions =
    new Set();

  for (
    const anomaly of
      audit.anomalies
  ) {
    const definition =
      mappings[
        anomaly.type
      ];

    if (
      !definition ||
      uniqueActions.has(
        definition.action
      )
    ) {
      continue;
    }

    uniqueActions.add(
      definition.action
    );

    const tasks =
      (
        await getStore(
          env,
          "tasks",
          []
        )
      ).map(
        normalizeTask
      );

    const existing =
      tasks.find(
        (task) =>
          task.action ===
            definition.action &&
          (
            task.status ===
              "pending" ||
            task.status ===
              "running"
          )
      );

    if (
      existing
    ) {
      continue;
    }

    const task =
      await createTask(
        env,
        {
          type:
            "internal_task",

          action:
            definition.action,

          title:
            definition.title,

          description:
            `検出された状態不整合を会社自身が修復する。対象: ${anomaly.type}`,

          department:
            "開発基盤",

          priority:
            110,

          internalOnly:
            true,

          safeAutonomy:
            true,

          externalAction:
            false,
        }
      );

    created.push(
      task
    );
  }

  return {
    created,
  };
}

async function generateSelfDevelopmentProposal(
  env
) {
  const audit =
    await auditState(
      env
    );

  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  const proposal =
    {
      type:
        "self_development_proposal",

      runtime:
        RUNTIME_VERSION,

      target:
        "worker.js",

      purpose:
        "会社Core自身の状態整合性・自己保守能力を継続強化する。",

      detectedProblems:
        audit.anomalies,

      plannedChanges:
        [
          "Company / Task / Human Gate / Capability の状態を一元的に再構成する。",
          "旧バージョンのBusiness IDを正規IDへ移行する。",
          "完了済みTaskとCapability Snapshotの矛盾を自動修復する。",
          "Human GateのTask記録とCompany Stateを同期する。",
          "Artifact参照の欠落を監査する。",
          "Sandbox / Test / Deploy を将来分離できるAdapter境界を維持する。",
        ],

      tests:
        [
          "既存5.1タスクの保持",
          "旧Business IDから正規Business IDへの移行",
          "Product/Sales実績のCapability反映",
          "Human Gate pending状態の再構築",
          "再実行時の冪等性",
          "外部不可逆操作が自動実行されないこと",
        ],

      safetyBoundary:
        {
          externalPublication:
            false,

          payment:
            false,

          contract:
            false,

          externalCommunication:
            false,

          productionDeploy:
            false,
        },

      generatedAt:
        nowIso(),
    };

  const syntheticTask =
    {
      id:
        randomId(
          "selfdev"
        ),

      action:
        "code_change_candidate",

      department:
        "開発基盤",

      businessId:
        null,
    };

  const artifact =
    await saveArtifact(
      env,
      syntheticTask,
      proposal
    );

  await addMemory(
    env,
    {
      type:
        "self_development_proposal",

      summary:
        "会社自身が自己保守・自己改善の変更案を生成した。",

      artifactId:
        artifact.id,
    }
  );

  return {
    proposal,
    artifact,
    company,
  };
}

async function executeMaintenanceTask(
  env,
  task
) {
  let payload;

  switch (
    task.action
  ) {
    case "self_maintenance_state_reconciliation": {
      const result =
        await mergeAndMigrateState(
          env
        );

      payload =
        {
          action:
            task.action,

          status:
            "repaired",

          migrationChanged:
            result.changed,

          businessCount:
            result.company
              .businesses.length,

          taskCount:
            result.tasks.length,

          businessAliases:
            result.company
              .migration
              .businessAliases,

          supersededCount:
            result.supersededCount,
        };

      break;
    }

    case "self_maintenance_capability_reconciliation": {
      const company =
        await getStore(
          env,
          "company",
          defaultCompany()
        );

      const tasks =
        (
          await getStore(
            env,
            "tasks",
            []
          )
        ).map(
          normalizeTask
        );

      company.capabilitySnapshot =
        capabilitySnapshot(
          company,
          tasks
        );

      company.schemaVersion =
        SCHEMA_VERSION;

      company.runtimeVersion =
        RUNTIME_VERSION;

      await setStore(
        env,
        "company",
        company
      );

      payload =
        {
          action:
            task.action,

          status:
            "repaired",

          capabilitySnapshot:
            company.capabilitySnapshot,
        };

      break;
    }

    case "self_maintenance_human_gate_reconciliation": {
      const company =
        await getStore(
          env,
          "company",
          defaultCompany()
        );

      const tasks =
        (
          await getStore(
            env,
            "tasks",
            []
          )
        ).map(
          normalizeTask
        );

      const humanGates =
        rebuildHumanGates(
          company,
          tasks
        );

      await setStore(
        env,
        "company",
        company
      );

      payload =
        {
          action:
            task.action,

          status:
            "repaired",

          humanGateCount:
            humanGates.length,

          pending:
            humanGates.filter(
              (gate) =>
                gate.status ===
                "pending"
            ).length,
        };

      break;
    }

    case "self_maintenance_artifact_reconciliation": {
      const tasks =
        (
          await getStore(
            env,
            "tasks",
            []
          )
        ).map(
          normalizeTask
        );

      const previous =
        await getStore(
          env,
          "artifact_index",
          []
        );

      const index =
        Array.isArray(
          previous
        )
          ? [
              ...previous,
            ]
          : [];

      for (
        const item of tasks
      ) {
        if (
          item.artifactId &&
          !index.some(
            (entry) =>
              entry.id ===
              item.artifactId
          )
        ) {
          index.push(
            {
              id:
                item.artifactId,

              taskId:
                item.id,

              businessId:
                item.businessId,

              department:
                item.department,

              action:
                item.action,

              createdAt:
                item.updatedAt ??
                nowIso(),

              reconstructed:
                true,
            }
          );
        }

        const legacyKey =
          item.cloudExecution
            ?.artifactKey;

        if (
          legacyKey &&
          !index.some(
            (entry) =>
              entry.legacyKey ===
              legacyKey
          )
        ) {
          index.push(
            {
              id:
                item.artifactId ??
                randomId(
                  "legacy_artifact"
                ),

              taskId:
                item.id,

              businessId:
                item.businessId,

              department:
                item.department,

              action:
                item.action,

              createdAt:
                item.updatedAt ??
                nowIso(),

              legacyKey,

              reconstructed:
                true,
            }
          );
        }
      }

      await setStore(
        env,
        "artifact_index",
        index.slice(
          -1000
        )
      );

      payload =
        {
          action:
            task.action,

          status:
            "repaired",

          artifactIndexCount:
            index.length,
        };

      break;
    }

    case "self_maintenance_organization_reconciliation": {
      const result =
        await reconcileOrganization(
          env
        );

      payload =
        {
          action:
            task.action,

          status:
            "repaired",

          addedDepartments:
            result.added,

          departments:
            result.after,
        };

      break;
    }

    default:
      throw new Error(
        `Unsupported maintenance action: ${task.action}`
      );
  }

  const artifact =
    await saveArtifact(
      env,
      task,
      payload
    );

  await addMemory(
    env,
    {
      type:
        "self_maintenance",

      taskId:
        task.id,

      action:
        task.action,

      summary:
        payload.status ??
        "自己保守処理完了",

      artifactId:
        artifact.id,
    }
  );

  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  company.maintenance =
    company.maintenance ??
    {};

  company.maintenance.lastRepairAt =
    nowIso();

  await setStore(
    env,
    "company",
    company
  );

  return {
    payload,
    artifact,
  };
}

async function executeBusinessTask(
  env,
  task,
  business
) {
  let payload;
  let nextTask = null;
  let evaluationLevel = null;
  let readyForHumanGate =
    false;

  switch (
    task.action
  ) {
    case "research_brief":
      payload =
        {
          type:
            "research_brief",

          businessId:
            business.id,

          businessName:
            business.name,

          target:
            business.target,

          researchQuestions:
            [
              "市場にどのような需要があるか",
              "既存サービスは何を提供しているか",
              "小規模事業者が調査で困るポイントは何か",
              "継続課金にできる余地があるか",
            ],

          status:
            "調査設計成功・外部データ確認前",

          generatedAt:
            nowIso(),
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

    case "product_prototype":
      payload =
        {
          type:
            "product_prototype",

          businessId:
            business.id,

          businessName:
            business.name,

          offer:
            {
              product:
                "小規模事業向け調査レポート生成サービス",

              output:
                "市場・競合・制度情報を整理した簡易レポート",

              delivery:
                "オンライン提供",
            },

          status:
            "商品構成成功・顧客検証前",

          generatedAt:
            nowIso(),
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

    case "sales_package_generation":
      payload =
        {
          type:
            "sales_package_generation",

          businessId:
            business.id,

          businessName:
            business.name,

          package:
            {
              headline:
                "調査にかかる時間を短縮する小規模事業向けレポート",

              salesPoints:
                [
                  "調査項目の整理を支援",
                  "競合・市場・制度情報を一つにまとめる",
                  "意思決定用の要点を短時間で把握する",
                ],

              monetization:
                "単発レポート + 継続利用",
            },

          status:
            "販売準備成功・事業成果確認前",

          generatedAt:
            nowIso(),
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

    case "sales_evaluation":
      payload =
        {
          type:
            "sales_evaluation",

          businessId:
            business.id,

          businessName:
            business.name,

          checks:
            {
              offerDefined:
                true,

              targetDefined:
                true,

              salesMessageDefined:
                true,

              revenueVerified:
                false,

              customerVerified:
                false,

              externalPublication:
                false,
            },

          result:
            "販売構成評価完了・公開承認待ち",

          generatedAt:
            nowIso(),
        };

      evaluationLevel =
        "販売構成評価完了・公開承認待ち";

      readyForHumanGate =
        true;

      nextTask =
        await createBusinessPipelineTask(
          env,
          business,
          "human_gate"
        );

      break;

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

  await addMemory(
    env,
    {
      type:
        "business_execution",

      businessId:
        business.id,

      taskId:
        task.id,

      action:
        task.action,

      summary:
        evaluationLevel ??
        "事業タスク完了",
    }
  );

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

  switch (
    task.action
  ) {
    case "research_external_evidence": {
      const evidence =
        await researchSource(
          env,
          "meti"
        );

      payload =
        {
          department:
            task.department,

          action:
            task.action,

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
      const company =
        await getStore(
          env,
          "company",
          defaultCompany()
        );

      payload =
        {
          department:
            task.department,

          action:
            task.action,

          customerCount:
            company.customers
              .length,

          conclusion:
            company.customers
              .length > 0
              ? "顧客入力を確認し、改善候補を抽出した。"
              : "顧客データ未取得。顧客接点の構築が必要。",
        };

      break;
    }

    case "outcome_analysis": {
      const company =
        await getStore(
          env,
          "company",
          defaultCompany()
        );

      const totalRevenue =
        company.outcomes.reduce(
          (
            sum,
            outcome
          ) =>
            sum +
            Number(
              outcome.revenue ??
                0
            ),
          0
        );

      payload =
        {
          department:
            task.department,

          action:
            task.action,

          outcomeCount:
            company.outcomes
              .length,

          totalRevenue,

          conclusion:
            company.outcomes
              .length > 0
              ? "事業成果を評価可能。"
              : "事業成果データ未取得。実成果観測の接続が必要。",
        };

      break;
    }

    case "development_infrastructure":
      payload =
        {
          department:
            task.department,

          action:
            task.action,

          architecture:
            {
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
            "自己変更Candidate生成と検証へ進む。",
        };

      break;

    case "platform_decoupling":
      payload =
        {
          department:
            task.department,

          action:
            task.action,

          adapters:
            {
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
            "プラットフォーム交換時にCore変更を最小化する。",
        };

      break;

    case "internal_department_improvement":
      payload =
        {
          department:
            task.department,

          action:
            task.action,

          mission:
            definitionNextAction(
              task.department
            ),

          status:
            "内部能力改善案を生成した。",
        };

      break;

    default:
      payload =
        {
          department:
            task.department,

          action:
            task.action,

          result:
            "内部部門タスクを実行した。",

          nextAction:
            definitionNextAction(
              task.department
            ),
        };
  }

  const artifact =
    await saveArtifact(
      env,
      task,
      payload
    );

  await addMemory(
    env,
    {
      type:
        "internal_execution",

      department:
        task.department,

      taskId:
        task.id,

      action:
        task.action,

      summary:
        payload.result ??
        payload.conclusion ??
        payload.status ??
        "内部能力を更新した。",
    }
  );

  return {
    payload,
    artifact,
  };
}

async function executeTask(
  env,
  task
) {
  await updateTask(
    env,
    task.id,
    {
      status:
        "running",

      runCount:
        Number(
          task.runCount ??
            0
        ) + 1,

      lastRunAt:
        nowIso(),
    }
  );

  try {
    let result;

    if (
      task.action?.startsWith(
        "self_maintenance_"
      )
    ) {
      result =
        await executeMaintenanceTask(
          env,
          task
        );
    } else if (
      task.type ===
      "business_task"
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
            item.id ===
            task.businessId
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
      task.type ===
      "internal_task"
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
          status:
            "completed",

          result:
            result.payload ??
            null,

          artifactId:
            result.artifact
              ?.id ??
            null,
        }
      );

    return {
      status:
        "task_executed",

      task:
        updated,

      artifact:
        result.artifact ??
        null,

      nextTask:
        result.nextTask ??
        null,

      evaluationLevel:
        result.evaluationLevel ??
        null,

      readyForHumanGate:
        result.readyForHumanGate ??
        false,
    };
  } catch (
    error
  ) {
    const failed =
      await updateTask(
        env,
        task.id,
        {
          status:
            "failed",

          result:
            {
              error:
                error?.message ??
                String(
                  error
                ),
            },
        }
      );

    await addMemory(
      env,
      {
        type:
          "execution_failure",

        taskId:
          task.id,

        department:
          task.department,

        error:
          error?.message ??
          String(error),
      }
    );

    return {
      status:
        "task_failed",

      task:
        failed,

      error:
        error?.message ??
        String(error),
    };
  }
}

async function companyCycle(
  env
) {
  let {
    company,
  } =
    await ensureInitialized(
      env
    );

  if (
    (company.businesses?.length ??
      0) === 0
  ) {
    await createBusinessIfNeeded(
      env
    );
  }

  const tasks =
    (
      await getStore(
        env,
        "tasks",
        []
      )
    ).map(
      normalizeTask
    );

  const waitingHuman =
    getPendingHumanGates(
      tasks
    );

  let executable =
    sortTasksForExecution(
      tasks.filter(
        (task) =>
          task.status ===
            "pending" &&
          task.type !==
            "human_gate"
      )
    );

  if (
    executable.length === 0 &&
    waitingHuman.length ===
      0
  ) {
    const business =
      (
        await getStore(
          env,
          "company",
          defaultCompany()
        )
      ).businesses[0];

    const refreshedTasks =
      (
        await getStore(
          env,
          "tasks",
          []
        )
      ).map(
        normalizeTask
      );

    const hasPipeline =
      refreshedTasks.some(
        (task) =>
          task.pipeline
            ?.businessId ===
            business.id &&
          task.status ===
            "pending"
      );

    if (
      !hasPipeline &&
      business
    ) {
      const hasResearch =
        refreshedTasks.some(
          (task) =>
            task.action ===
              "research_brief" &&
            task.businessId ===
              business.id &&
            task.status ===
              "completed"
        );

      const hasProduct =
        refreshedTasks.some(
          (task) =>
            task.action ===
              "product_prototype" &&
            task.businessId ===
              business.id &&
            task.status ===
              "completed"
        );

      const hasSales =
        refreshedTasks.some(
          (task) =>
            task.action ===
              "sales_package_generation" &&
            task.businessId ===
              business.id &&
            task.status ===
              "completed"
        );

      const hasEvaluation =
        refreshedTasks.some(
          (task) =>
            task.action ===
              "sales_evaluation" &&
            task.businessId ===
              business.id &&
            task.status ===
              "completed"
        );

      const gate =
        refreshedTasks.find(
          (task) =>
            task.type ===
              "human_gate" &&
            task.businessId ===
              business.id &&
            task.status ===
              "waiting_human"
        );

      if (!gate) {
        if (
          !hasResearch
        ) {
          await createBusinessPipelineTask(
            env,
            business,
            "research"
          );
        } else if (
          !hasProduct
        ) {
          await createBusinessPipelineTask(
            env,
            business,
            "product"
          );
        } else if (
          !hasSales
        ) {
          await createBusinessPipelineTask(
            env,
            business,
            "sales"
          );
        } else if (
          !hasEvaluation
        ) {
          await createBusinessPipelineTask(
            env,
            business,
            "sales_evaluation"
          );
        } else {
          await createBusinessPipelineTask(
            env,
            business,
            "human_gate"
          );
        }
      }

      executable =
        sortTasksForExecution(
          (
            await getStore(
              env,
              "tasks",
              []
            )
          )
            .map(
              normalizeTask
            )
            .filter(
              (task) =>
                task.status ===
                  "pending" &&
                task.type !==
                  "human_gate"
            )
        );
    }
  }

  let execution =
    null;

  if (
    executable.length >
    0
  ) {
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
    (
      await getStore(
        env,
        "tasks",
        []
      )
    ).map(
      normalizeTask
    );

  refreshedCompany.cycleCount =
    Number(
      refreshedCompany.cycleCount ??
        0
    ) + 1;

  refreshedCompany.runtimeVersion =
    RUNTIME_VERSION;

  refreshedCompany.schemaVersion =
    SCHEMA_VERSION;

  refreshedCompany.externalActions =
    false;

  refreshedCompany.externalAI =
    false;

  const pendingHuman =
    getPendingHumanGates(
      refreshedTasks
    );

  if (
    pendingHuman.length > 0
  ) {
    refreshedCompany.currentFocus =
      "人間承認待ち";

    refreshedCompany.nextAction =
      "Human Gateで外部不可逆操作を確認する";
  } else if (
    execution?.status ===
    "task_executed"
  ) {
    refreshedCompany.currentFocus =
      execution
        .evaluationLevel ??
      execution.task?.title ??
      "タスク実行完了";

    refreshedCompany.nextAction =
      execution.nextTask
        ?.title ??
      "会社状態を再監査する";
  } else {
    refreshedCompany.currentFocus =
      "自律ループ稼働中";

    refreshedCompany.nextAction =
      "自己保守監査と組織再評価を行う";
  }

  refreshedCompany.capabilitySnapshot =
    capabilitySnapshot(
      refreshedCompany,
      refreshedTasks
    );

  rebuildHumanGates(
    refreshedCompany,
    refreshedTasks
  );

  await setStore(
    env,
    "company",
    refreshedCompany
  );

  await setStore(
    env,
    "tasks",
    refreshedTasks
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
  await ensureInitialized(
    env
  );

  const result =
    await reconcileOrganization(
      env
    );

  const created =
    await ensureDepartmentTasks(
      env
    );

  for (
    const department of
      result.added
  ) {
    await buildCapabilityArtifact(
      env,
      department
    );
  }

  return {
    status:
      "self_organization_completed",

    addedDepartments:
      result.added,

    internalTasksCreated:
      created.created,

    departments:
      result.after,

    capabilitySnapshot:
      result.company
        .capabilitySnapshot,
  };
}

async function maintenanceCycle(
  env
) {
  await ensureInitialized(
    env
  );

  const audit =
    await auditState(
      env
    );

  const tasksCreated =
    await ensureMaintenanceTasks(
      env,
      audit
    );

  let tasks =
    (
      await getStore(
        env,
        "tasks",
        []
      )
    ).map(
      normalizeTask
    );

  const pendingMaintenance =
    tasks.filter(
      (task) =>
        task.internalOnly ===
          true &&
        task.action?.startsWith(
          "self_maintenance_"
        ) &&
        task.status ===
          "pending"
    );

  let execution =
    null;

  if (
    pendingMaintenance.length >
    0
  ) {
    execution =
      await executeTask(
        env,
        sortTasksForExecution(
          pendingMaintenance
        )[0]
      );
  }

  return {
    status:
      "maintenance_completed",

    anomalyCount:
      audit.anomalyCount,

    anomalies:
      audit.anomalies,

    created:
      tasksCreated.created,

    execution,
  };
}

async function heartbeat(
  env
) {
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
          company.cycleCount ??
          0
        ),
    }
  );

  return {
    ok:
      true,

    runtime:
      RUNTIME_VERSION,

    heartbeatAt:
      nowIso(),
  };
}

async function buildHealth(
  env
) {
  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  const tasks =
    (
      await getStore(
        env,
        "tasks",
        []
      )
    ).map(
      normalizeTask
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

  const artifactIndex =
    await getStore(
      env,
      "artifact_index",
      []
    );

  const pendingInternalTasks =
    getPendingInternalTasks(
      tasks
    ).length;

  const pendingHumanGates =
    getPendingHumanGates(
      tasks
    ).length;

  return {
    ok:
      true,

    runtime:
      RUNTIME_VERSION,

    schemaVersion:
      SCHEMA_VERSION,

    runtime_meta:
      {
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

    company:
      {
        cycleCount:
          company.cycleCount ??
          0,

        currentFocus:
          company.currentFocus,

        nextAction:
          company.nextAction,

        pendingTasks:
          tasks.filter(
            (task) =>
              task.status ===
                "pending" ||
              task.status ===
                "running"
          ).length,

        pendingInternalTasks,

        pendingHumanGates,

        businessCount:
          company.businesses
            ?.length ??
          0,

        evidenceCount:
          company
            .researchEvidenceIndex
            ?.length ??
          0,

        customerCount:
          company.customers
            ?.length ??
          0,

        outcomeCount:
          company.outcomes
            ?.length ??
          0,

        departmentCount:
          normalizeDepartments(
            company.departments
          ).length,

        departments:
          normalizeDepartments(
            company.departments
          ),
      },

    execution_available:
      true,

    executor:
      "Cloud Executor (D1-backed)",

    self_maintenance_available:
      true,

    migration_manager_available:
      true,

    external_read:
      true,

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
      Array.isArray(
        artifactIndex
      )
        ? artifactIndex.length
        : 0,
  };
}

async function getState(
  env
) {
  await ensureInitialized(
    env
  );

  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  const tasks =
    (
      await getStore(
        env,
        "tasks",
        []
      )
    ).map(
      normalizeTask
    );

  const artifacts =
    await getStore(
      env,
      "artifact_index",
      []
    );

  return {
    runtime:
      RUNTIME_VERSION,

    schemaVersion:
      SCHEMA_VERSION,

    company,

    tasks,

    departments:
      normalizeDepartments(
        company.departments
      ),

    artifacts,

    policy:
      {
        autonomousInternalChanges:
          true,

        selfStateRepair:
          true,

        selfDevelopmentProposal:
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

        productionDeployAutonomy:
          false,
      },
  };
}

async function getDepartments(
  env
) {
  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  return normalizeDepartments(
    company.departments
  ).map(
    (
      department
    ) => {
      const generated =
        GENERATED_DEPARTMENTS[
          department
        ];

      return {
        department,

        mission:
          generated?.mission ??
          `${department}に関する会社能力を維持・改善する。`,

        currentCapability:
          generated?.trigger
            ? company
                .capabilitySnapshot?.[
                  generated.trigger
                ] ??
              false
            : true,

        nextAction:
          definitionNextAction(
            department
          ),

        autonomy:
          {
            internalTaskCreation:
              true,

            internalArtifactCreation:
              true,

            externalIrreversibleAction:
              false,
          },
      };
    }
  );
}

async function getCapabilities(
  env
) {
  await ensureInitialized(
    env
  );

  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  const tasks =
    (
      await getStore(
        env,
        "tasks",
        []
      )
    ).map(
      normalizeTask
    );

  company.capabilitySnapshot =
    capabilitySnapshot(
      company,
      tasks
    );

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
      company.capabilitySnapshot,

    departments:
      company.departments,

    departmentDetails:
      await getDepartments(
        env
      ),
  };
}

async function customerIntake(
  env,
  request
) {
  const body =
    await readJSON(
      request
    );

  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  const customer =
    {
      id:
        randomId(
          "customer"
        ),

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

      createdAt:
        nowIso(),
    };

  company.customers =
    Array.isArray(
      company.customers
    )
      ? company.customers
      : [];

  company.customers.push(
    customer
  );

  company.customers =
    company.customers.slice(
      -1000
    );

  await setStore(
    env,
    "company",
    company
  );

  await addMemory(
    env,
    {
      type:
        "customer_intake",

      customerId:
        customer.id,

      summary:
        customer.message ||
        "顧客入力を受領した。",
    }
  );

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
    await readJSON(
      request
    );

  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  const outcome =
    {
      id:
        randomId(
          "outcome"
        ),

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
        Number(
          body.revenue ??
            0
        ),

      cost:
        Number(
          body.cost ??
            0
        ),

      conversions:
        Number(
          body.conversions ??
            0
        ),

      notes:
        safeString(
          body.notes,
          ""
        ),

      createdAt:
        nowIso(),
    };

  company.outcomes =
    Array.isArray(
      company.outcomes
    )
      ? company.outcomes
      : [];

  company.outcomes.push(
    outcome
  );

  company.outcomes =
    company.outcomes.slice(
      -1000
    );

  await setStore(
    env,
    "company",
    company
  );

  await addMemory(
    env,
    {
      type:
        "outcome_recorded",

      outcomeId:
        outcome.id,

      businessId:
        outcome.businessId,

      revenue:
        outcome.revenue,

      cost:
        outcome.cost,
    }
  );

  return {
    status:
      "outcome_recorded",

    outcome,
  };
}

async function publicPreview(
  env
) {
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
      company.businesses?.[0] ??
      null,

    salesPackage:
      salesPackage ??
      null,

    salesEvaluation:
      salesEvaluation ??
      null,

    externalActions:
      false,
  };
}

async function ceoReevaluate(
  env
) {
  await ensureInitialized(
    env
  );

  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  const tasks =
    (
      await getStore(
        env,
        "tasks",
        []
      )
    ).map(
      normalizeTask
    );

  const capabilities =
    capabilitySnapshot(
      company,
      tasks
    );

  const audit =
    await auditState(
      env
    );

  const pendingHuman =
    getPendingHumanGates(
      tasks
    );

  const pendingInternal =
    getPendingInternalTasks(
      tasks
    );

  company.capabilitySnapshot =
    capabilities;

  rebuildHumanGates(
    company,
    tasks
  );

  let decision;

  if (
    pendingHuman.length >
    0
  ) {
    decision =
      {
        type:
          "defer_external",

        reason:
          "外部不可逆操作はHuman Gate待ち。",
      };

    company.currentFocus =
      "人間承認待ち";

    company.nextAction =
      audit.anomalyCount >
      0
        ? "内部不整合を自己保守しつつHuman Gateを待つ"
        : "Human Gateで外部不可逆操作を確認する";
  } else if (
    audit.anomalyCount >
    0
  ) {
    decision =
      {
        type:
          "repair_internal_state",

        reason:
          "会社内部に不整合が検出されたため自己保守を優先する。",
      };

    company.currentFocus =
      "内部状態修復中";

    company.nextAction =
      "自己保守タスクを実行する";
  } else if (
    pendingInternal.length >
    0
  ) {
    decision =
      {
        type:
          "continue_internal",

        reason:
          "内部能力改善タスクを継続する。",
      };

    company.currentFocus =
      "内部能力改善中";

    company.nextAction =
      pendingInternal[0]
        .title;
  } else {
    decision =
      {
        type:
          "continue",

        reason:
          "事業・組織・能力を継続評価する。",
      };

    company.currentFocus =
      "自律評価継続";

    company.nextAction =
      "次の能力不足と事業機会を探索する";
  }

  await setStore(
    env,
    "company",
    company
  );

  await addMemory(
    env,
    {
      type:
        "ceo_reevaluation",

      decision,

      capabilities,

      anomalyCount:
        audit.anomalyCount,
    }
  );

  return {
    runtime:
      RUNTIME_VERSION,

    decision,

    capabilities,

    audit,

    pendingHumanGates:
      pendingHuman.length,

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
    await readJSON(
      request
    );

  const taskId =
    safeString(
      body.taskId,
      ""
    );

  const task =
    await findTaskById(
      env,
      taskId
    );

  if (
    !task ||
    task.type !==
      "human_gate"
  ) {
    return {
      status:
        404,

      body:
        {
          ok:
            false,

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

        result:
          {
            ...(task.result ??
              {}),

            humanApproved:
              true,
          },
      }
    );

  await mergeAndMigrateState(
    env
  );

  await addMemory(
    env,
    {
      type:
        "human_gate_approved",

      taskId,

      summary:
        "Human Gateが承認された。",
    }
  );

  return {
    status:
      200,

    body:
      {
        ok:
          true,

        message:
          "Human Gate approved.",

        task:
          updated,

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
    await readJSON(
      request
    );

  const taskId =
    safeString(
      body.taskId,
      ""
    );

  const task =
    await findTaskById(
      env,
      taskId
    );

  if (
    !task ||
    task.type !==
      "human_gate"
  ) {
    return {
      status:
        404,

      body:
        {
          ok:
            false,

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

        result:
          {
            ...(task.result ??
              {}),

            humanApproved:
              false,
          },
      }
    );

  await mergeAndMigrateState(
    env
  );

  await addMemory(
    env,
    {
      type:
        "human_gate_rejected",

      taskId,

      summary:
        "Human Gateが拒否された。",
    }
  );

  return {
    status:
      200,

    body:
      {
        ok:
          true,

        message:
          "Human Gate rejected.",

        task:
          updated,
      },
  };
}

async function routeAPI(
  request,
  env
) {
  const url =
    new URL(
      request.url
    );

  const path =
    url.pathname;

  const method =
    request.method.toUpperCase();

  if (
    method ===
    "OPTIONS"
  ) {
    return new Response(
      null,
      {
        status:
          204,

        headers:
          {
            "access-control-allow-origin":
              "*",

            "access-control-allow-methods":
              "GET,POST,OPTIONS",

            "access-control-allow-headers":
              "Content-Type",
          },
      }
    );
  }

  if (
    path ===
      "/api/health" &&
    method ===
      "GET"
  ) {
    return jsonResponse(
      await buildHealth(
        env
      )
    );
  }

  if (
    path ===
      "/api/heartbeat" &&
    method ===
      "GET"
  ) {
    return jsonResponse(
      await heartbeat(
        env
      )
    );
  }

  if (
    path ===
      "/api/state" &&
    method ===
      "GET"
  ) {
    return jsonResponse(
      await getState(
        env
      )
    );
  }

  if (
    path ===
      "/api/capabilities" &&
    method ===
      "GET"
  ) {
    return jsonResponse(
      await getCapabilities(
        env
      )
    );
  }

  if (
    path ===
      "/api/departments" &&
    method ===
      "GET"
  ) {
    return jsonResponse(
      {
        runtime:
          RUNTIME_VERSION,

        departments:
          await getDepartments(
            env
          ),
      }
    );
  }

  if (
    path ===
      "/api/cycle" &&
    method ===
      "POST"
  ) {
    return jsonResponse(
      await companyCycle(
        env
      )
    );
  }

  if (
    path ===
      "/api/self-organization/cycle" &&
    method ===
      "POST"
  ) {
    return jsonResponse(
      await selfOrganizationCycle(
        env
      )
    );
  }

  if (
    path ===
      "/api/maintenance/audit" &&
    method ===
      "GET"
  ) {
    await ensureInitialized(
      env
    );

    return jsonResponse(
      await auditState(
        env
      )
    );
  }

  if (
    path ===
      "/api/maintenance/cycle" &&
    method ===
      "POST"
  ) {
    return jsonResponse(
      await maintenanceCycle(
        env
      )
    );
  }

  if (
    path ===
      "/api/self-development/proposal" &&
    method ===
      "POST"
  ) {
    return jsonResponse(
      await generateSelfDevelopmentProposal(
        env
      )
    );
  }

  if (
    path ===
      "/api/migration/status" &&
    method ===
      "GET"
  ) {
    await ensureInitialized(
      env
    );

    const company =
      await getStore(
        env,
        "company",
        defaultCompany()
      );

    return jsonResponse(
      {
        runtime:
          RUNTIME_VERSION,

        schemaVersion:
          SCHEMA_VERSION,

        migration:
          company.migration,
      }
    );
  }

  if (
    path ===
      "/api/ceo/reevaluate" &&
    method ===
      "POST"
  ) {
    return jsonResponse(
      await ceoReevaluate(
        env
      )
    );
  }

  if (
    path ===
      "/api/customer/intake" &&
    method ===
      "POST"
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
    path ===
      "/api/outcome" &&
    method ===
      "POST"
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
    path ===
      "/api/public/preview" &&
    method ===
      "GET"
  ) {
    return jsonResponse(
      await publicPreview(
        env
      )
    );
  }

  if (
    path ===
      "/api/human-gate/approve" &&
    method ===
      "POST"
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
    path ===
      "/api/human-gate/reject" &&
    method ===
      "POST"
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
    path ===
      "/api/research/sources" &&
    method ===
      "GET"
  ) {
    return jsonResponse(
      {
        ok:
          true,

        sources:
          Object.entries(
            RESEARCH_SOURCES
          ).map(
            ([
              id,
              source,
            ]) => ({
              id,
              ...source,
            })
          ),

        readOnly:
          true,
      }
    );
  }

  if (
    path ===
      "/api/research/fetch" &&
    method ===
      "GET"
  ) {
    const sourceId =
      safeString(
        url.searchParams.get(
          "source"
        ),
        ""
      );

    if (
      !sourceId
    ) {
      return jsonResponse(
        {
          ok:
            false,

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

      return jsonResponse(
        {
          ok:
            true,

          evidence,
        }
      );
    } catch (
      error
    ) {
      return jsonResponse(
        {
          ok:
            false,

          error:
            error?.message ??
            String(error),
        },
        500
      );
    }
  }

  if (
    path ===
      "/api/artifact" &&
    method ===
      "GET"
  ) {
    const artifactId =
      safeString(
        url.searchParams.get(
          "id"
        ),
        ""
      );

    if (
      !artifactId
    ) {
      return jsonResponse(
        {
          ok:
            false,

          error:
            "Missing ?id=<artifactId>",
        },
        400
      );
    }

    const artifact =
      await getStore(
        env,
        `artifact:${artifactId}`,
        null
      );

    if (!artifact) {
      return jsonResponse(
        {
          ok:
            false,

          error:
            "Artifact not found.",
        },
        404
      );
    }

    return jsonResponse(
      {
        ok:
          true,

        artifact,
      }
    );
  }

  if (
    path ===
      "/api/evidence" &&
    method ===
      "GET"
  ) {
    const evidenceId =
      safeString(
        url.searchParams.get(
          "id"
        ),
        ""
      );

    if (
      !evidenceId
    ) {
      return jsonResponse(
        {
          ok:
            false,

          error:
            "Missing ?id=<evidenceId>",
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
      return jsonResponse(
        {
          ok:
            false,

          error:
            "Evidence not found.",
        },
        404
      );
    }

    return jsonResponse(
      {
        ok:
          true,

        evidence,
      }
    );
  }

  if (
    path ===
      "/api/task" &&
    method ===
      "GET"
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
          ok:
            false,

          error:
            "Task not found.",
        },
        404
      );
    }

    return jsonResponse(
      {
        ok:
          true,

        task,
      }
    );
  }

  if (
    path ===
      "/api/task" &&
    method ===
      "POST"
  ) {
    const body =
      await readJSON(
        request
      );

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
            body.internalOnly ===
            true,

          safeAutonomy:
            body.safeAutonomy ===
            true,

          externalAction:
            body.externalAction ===
            true,

          requiresHuman:
            body.requiresHuman ===
            true,

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
        ok:
          true,

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

    if (
      apiResponse
    ) {
      return apiResponse;
    }

    if (
      request.method !==
      "GET"
    ) {
      return textResponse(
        "Method Not Allowed",
        405
      );
    }

    if (
      !env.ASSETS
    ) {
      return jsonResponse(
        {
          ok:
            true,

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
  } catch (
    error
  ) {
    return jsonResponse(
      {
        ok:
          false,

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
  async fetch(
    request,
    env
  ) {
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

        await heartbeat(
          env
        );

        await maintenanceCycle(
          env
        );

        await selfOrganizationCycle(
          env
        );

        await companyCycle(
          env
        );

        await ceoReevaluate(
          env
        );
      })()
    );
  },
};
