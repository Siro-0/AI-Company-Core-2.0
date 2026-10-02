const RUNTIME_VERSION = "6.2.0-self-developing-company";
const SCHEMA_VERSION = "6.2.0";

const DEFAULT_DEPARTMENTS = ["企画", "技術", "リスク管理"];

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

const DANGEROUS_PATTERNS = [
  "eval(",
  "new Function(",
  "child_process",
  "process.binding(",
  "Deno.Command",
  "Bun.spawn(",
  "shelljs",
  "spawnSync(",
  "execSync(",
];

function nowIso() {
  return new Date().toISOString();
}

function id(prefix = "id") {
  const raw =
    typeof crypto !== "undefined" &&
    crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 9)}`;

  return `${prefix}_${raw}`;
}

function str(v, fallback = "") {
  return typeof v === "string"
    ? v.trim()
    : fallback;
}

function json(data, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: {
        "content-type":
          "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
        "access-control-allow-methods":
          "GET,POST,OPTIONS",
        "access-control-allow-headers":
          "Content-Type",
      },
    }
  );
}

async function bodyJSON(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

async function getStore(
  env,
  key,
  fallback = null
) {
  const row = await env.DB
    .prepare(
      "SELECT value_json FROM company_store WHERE key = ? LIMIT 1"
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
      INSERT INTO company_store(
        key,
        value_json,
        updated_at
      )
      VALUES(?,?,?)
      ON CONFLICT(key)
      DO UPDATE SET
        value_json=excluded.value_json,
        updated_at=excluded.updated_at
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

async function setRuntimeMeta(
  env,
  cycleCount,
  heartbeat = null
) {
  const current =
    await env.DB
      .prepare(
        "SELECT last_heartbeat_at FROM runtime_meta WHERE id=1 LIMIT 1"
      )
      .first();

  const value =
    heartbeat ??
    current?.last_heartbeat_at ??
    null;

  await env.DB
    .prepare(
      `
      UPDATE runtime_meta
      SET
        last_heartbeat_at=?,
        cycle_count=?,
        runtime_version=?
      WHERE id=1
      `
    )
    .bind(
      value,
      cycleCount,
      RUNTIME_VERSION
    )
    .run();
}

function normalizeDepartments(v) {
  const items =
    Array.isArray(v)
      ? v
      : [];

  return [
    ...new Set(
      [
        ...DEFAULT_DEPARTMENTS,
        ...Object.keys(
          GENERATED_DEPARTMENTS
        ),
        ...items,
      ]
        .map((x) => str(x))
        .filter(Boolean)
    ),
  ];
}

function normalizeTask(t) {
  const x =
    t &&
    typeof t === "object"
      ? { ...t }
      : {};

  const statusMap = {
    "保留中": "pending",
    "完了": "completed",
    "人間を待っています":
      "waiting_human",
    "実行中": "running",
    "失敗": "failed",
  };

  return {
    ...x,

    id:
      x.id ??
      id("task"),

    type:
      str(
        x.type,
        x.requiresHuman
          ? "human_gate"
          : "internal_task"
      ),

    action:
      str(
        x.action,
        x.executor ??
          "internal_analysis"
      ),

    title:
      str(
        x.title,
        "内部タスク"
      ),

    description:
      str(
        x.description,
        ""
      ),

    department:
      str(
        x.department,
        "企画"
      ),

    status:
      statusMap[x.status] ??
      x.status ??
      "pending",

    priority:
      Number.isFinite(
        Number(x.priority)
      )
        ? Number(x.priority)
        : 50,

    internalOnly:
      x.internalOnly === true,

    safeAutonomy:
      x.safeAutonomy === true,

    externalAction:
      x.externalAction ===
      true,

    requiresHuman:
      x.requiresHuman === true ||
      x.type === "human_gate",

    businessId:
      str(
        x.businessId,
        x.pipeline?.businessId ??
          ""
      ) || null,

    pipeline:
      x.pipeline &&
      typeof x.pipeline ===
        "object"
        ? { ...x.pipeline }
        : {},

    createdAt:
      x.createdAt ??
      nowIso(),

    updatedAt:
      x.updatedAt ??
      nowIso(),
  };
}

function normalizeBusiness(b) {
  const x =
    b &&
    typeof b === "object"
      ? { ...b }
      : {};

  return {
    ...x,

    id:
      str(x.id) ||
      id("business"),

    name:
      str(
        x.name ??
          x.title,
        "未定義事業"
      ),

    problem:
      str(
        x.problem,
        ""
      ),

    target:
      str(
        x.target ??
          x.customer,
        ""
      ),

    value:
      str(
        x.value,
        ""
      ),

    status:
      str(
        x.status,
        "hypothesis"
      ),

    createdAt:
      x.createdAt ??
      nowIso(),
  };
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

    humanGates: [],

    businesses: [],

    companyMemory: [],

    researchEvidenceIndex: [],

    customers: [],

    outcomes: [],

    departments:
      normalizeDepartments([]),

    capabilitySnapshot: {},

    organizationHistory: [],

    migration: {
      lastRunAt: null,
      version: null,
      businessAliases: {},
      repairs: [],
    },

    maintenance: {
      lastAuditAt: null,
      lastRepairAt: null,
      lastAnomalies: [],
    },

    selfDevelopment: {
      mode:
        "candidate_only",

      lastProposalAt:
        null,

      lastTestAt:
        null,

      lastCandidateId:
        null,
    },
  };
}

async function snapshotState(
  env,
  reason = "unspecified"
) {
  const snapshot = {
    id: id("snapshot"),

    createdAt:
      nowIso(),

    reason,

    company:
      await getStore(
        env,
        "company",
        defaultCompany()
      ),

    tasks:
      await getStore(
        env,
        "tasks",
        []
      ),

    artifactIndex:
      await getStore(
        env,
        "artifact_index",
        []
      ),
  };

  await setStore(
    env,
    `snapshot:${snapshot.id}`,
    snapshot
  );

  const index =
    await getStore(
      env,
      "snapshot_index",
      []
    );

  index.push({
    id:
      snapshot.id,

    createdAt:
      snapshot.createdAt,

    reason,
  });

  await setStore(
    env,
    "snapshot_index",
    index.slice(-100)
  );

  return snapshot;
}

async function memory(
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
      id("memory"),

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

async function migrate(
  env
) {
  let company = {
    ...defaultCompany(),
    ...(
      (await getStore(
        env,
        "company",
        {}
      )) || {}
    ),
  };

  let tasks =
    (
      await getStore(
        env,
        "tasks",
        []
      ) || []
    ).map(
      normalizeTask
    );

  company.departments =
    normalizeDepartments(
      company.departments
    );

  company.businesses =
    Array.isArray(
      company.businesses
    )
      ? company.businesses.map(
          normalizeBusiness
        )
      : [];

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

  company.selfDevelopment = {
    mode:
      "candidate_only",

    ...(company.selfDevelopment ||
      {}),
  };

  if (
    !company.businesses.length
  ) {
    const old =
      tasks
        .map((t) =>
          str(t.title)
        )
        .find(Boolean) ||
      "未定義事業";

    company.businesses.push({
      id:
        id("business"),

      name:
        old.includes("：")
          ? old
              .split("：")
              .slice(1)
              .join("：")
          : old,

      problem:
        "過去履歴から再構成された事業。",

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
    company.businesses[0];

  const byName =
    new Map(
      company.businesses.map(
        (b) => [
          b.name.toLowerCase(),
          b.id,
        ]
      )
    );

  for (
    const b of
      company.businesses.slice(
        1
      )
  ) {
    if (
      b.name &&
      byName.get(
        b.name.toLowerCase()
      ) === canonical.id
    ) {
      company.migration.businessAliases[
        b.id
      ] =
        canonical.id;
    }
  }

  const aliases =
    company.migration
      .businessAliases;

  for (
    const t of tasks
  ) {
    if (
      t.businessId &&
      aliases[t.businessId]
    ) {
      t.businessId =
        aliases[t.businessId];
    }

    if (
      t.pipeline?.businessId &&
      aliases[
        t.pipeline.businessId
      ]
    ) {
      t.pipeline.businessId =
        aliases[
          t.pipeline.businessId
        ];
    }
  }

  tasks =
    [
      ...new Map(
        tasks.map(
          (t) => [
            t.id,
            t,
          ]
        )
      ).values(),
    ];

  company.humanGates =
    tasks
      .filter(
        (t) =>
          t.type ===
            "human_gate" ||
          t.requiresHuman
      )
      .map((t) => ({
        id:
          t.humanGateId ??
          id("gate"),

        taskId:
          t.id,

        businessId:
          t.businessId,

        status:
          t.status ===
          "waiting_human"
            ? "pending"
            : t.status,

        requiresHuman:
          true,

        createdAt:
          t.createdAt,

        updatedAt:
          nowIso(),
      }));

  company.schemaVersion =
    SCHEMA_VERSION;

  company.runtimeVersion =
    RUNTIME_VERSION;

  company.externalActions =
    false;

  company.externalAI =
    false;

  company.migration.lastRunAt =
    nowIso();

  company.migration.version =
    SCHEMA_VERSION;

  await setStore(
    env,
    "company",
    company
  );

  await setStore(
    env,
    "tasks",
    tasks
  );

  await setRuntimeMeta(
    env,
    Number(
      company.cycleCount || 0
    ),
    null
  );

  return {
    company,
    tasks,
  };
}

function hasCompleted(
  tasks,
  actions
) {
  return tasks.some(
    (t) =>
      t.status ===
        "completed" &&
      actions.includes(
        t.action
      )
  );
}

function capabilities(
  company,
  tasks
) {
  return {
    externalResearch:
      company
        .researchEvidenceIndex
        .length > 0 ||
      hasCompleted(
        tasks,
        [
          "research_external_evidence",
        ]
      ),

    productGeneration:
      hasCompleted(
        tasks,
        [
          "product_prototype",
        ]
      ),

    salesPreparation:
      hasCompleted(
        tasks,
        [
          "sales_package_generation",
        ]
      ),

    customerFeedback:
      company.customers
        .length > 0,

    outcomeTracking:
      company.outcomes
        .length > 0,

    revenueTracking:
      company.outcomes.some(
        (o) =>
          Number(
            o.revenue || 0
          ) > 0
      ),

    publication:
      false,

    payment:
      false,

    selfDevelopment:
      hasCompleted(
        tasks,
        [
          "self_development_test",
          "self_maintenance_repair",
          "code_change_candidate",
        ]
      ),

    platformIndependence:
      hasCompleted(
        tasks,
        [
          "platform_decoupling",
        ]
      ),
  };
}

async function saveTask(
  env,
  task
) {
  return setStore(
    env,
    "tasks",
    task
  );
}

async function createTask(
  env,
  d
) {
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

  const duplicate =
    tasks.find(
      (t) =>
        t.action ===
          d.action &&
        t.businessId ===
          (d.businessId ||
            null) &&
        [
          "pending",
          "running",
          "waiting_human",
        ].includes(
          t.status
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
        id("task"),

      ...d,

      createdAt:
        nowIso(),

      updatedAt:
        nowIso(),
    });

  tasks.push(task);

  await saveTask(
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

  const i =
    tasks.findIndex(
      (t) =>
        t.id ===
        taskId
    );

  if (
    i < 0
  ) {
    return null;
  }

  tasks[i] =
    normalizeTask({
      ...tasks[i],

      ...patch,

      updatedAt:
        nowIso(),
    });

  await saveTask(
    env,
    tasks
  );

  return tasks[i];
}

async function saveArtifact(
  env,
  task,
  payload
) {
  const artifact = {
    id:
      id("artifact"),

    taskId:
      task.id,

    businessId:
      task.businessId ||
      null,

    department:
      task.department ||
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

  index.push({
    id:
      artifact.id,

    taskId:
      task.id,

    businessId:
      task.businessId,

    department:
      task.department,

    action:
      task.action,

    createdAt:
      artifact.createdAt,
  });

  await setStore(
    env,
    "artifact_index",
    index.slice(
      -1000
    )
  );

  return artifact;
}

async function audit(env) {
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
      company.businesses.map(
        (b) => b.id
      )
    );

  for (
    const t of tasks
  ) {
    if (
      t.businessId &&
      !businessIds.has(
        t.businessId
      )
    ) {
      anomalies.push({
        type:
          "orphan_business_reference",

        taskId:
          t.id,

        businessId:
          t.businessId,
      });
    }
  }

  const currentCaps =
    capabilities(
      company,
      tasks
    );

  if (
    JSON.stringify(
      currentCaps
    ) !==
    JSON.stringify(
      company.capabilitySnapshot ||
        {}
    )
  ) {
    anomalies.push({
      type:
        "capability_snapshot_stale",
    });
  }

  const gateIds =
    new Set(
      company.humanGates.map(
        (g) =>
          g.taskId
      )
    );

  for (
    const t of tasks.filter(
      (t) =>
        t.type ===
          "human_gate" ||
        t.requiresHuman
    )
  ) {
    if (
      !gateIds.has(
        t.id
      )
    ) {
      anomalies.push({
        type:
          "missing_human_gate_record",

        taskId:
          t.id,
      });
    }
  }

  for (
    const t of tasks.filter(
      (t) =>
        t.status ===
          "completed" &&
        t.artifactId
    )
  ) {
    const artifact =
      await getStore(
        env,
        `artifact:${t.artifactId}`,
        null
      );

    if (!artifact) {
      anomalies.push({
        type:
          "missing_artifact",

        taskId:
          t.id,

        artifactId:
          t.artifactId,
      });
    }
  }

  if (
    company.schemaVersion !==
    SCHEMA_VERSION
  ) {
    anomalies.push({
      type:
        "schema_version_mismatch",

      current:
        company.schemaVersion,

      expected:
        SCHEMA_VERSION,
    });
  }

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

    capabilities:
      currentCaps,
  };
}

async function ensureMaintenance(
  env,
  report
) {
  const mappings = {
    orphan_business_reference: [
      "self_maintenance_state_reconciliation",
      "自己保守：事業参照を修復する",
    ],

    capability_snapshot_stale: [
      "self_maintenance_capability_reconciliation",
      "自己保守：Capabilityを再構築する",
    ],

    missing_human_gate_record: [
      "self_maintenance_human_gate_reconciliation",
      "自己保守：Human Gateを再構築する",
    ],

    missing_artifact: [
      "self_maintenance_artifact_reconciliation",
      "自己保守：Artifact参照を修復する",
    ],

    schema_version_mismatch: [
      "self_maintenance_state_reconciliation",
      "自己保守：Schema移行を完了する",
    ],
  };

  const out = [];

  for (
    const a of
      report.anomalies
  ) {
    const d =
      mappings[
        a.type
      ];

    if (!d) {
      continue;
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

    if (
      tasks.some(
        (t) =>
          t.action ===
            d[0] &&
          [
            "pending",
            "running",
          ].includes(
            t.status
          )
      )
    ) {
      continue;
    }

    out.push(
      await createTask(
        env,
        {
          type:
            "internal_task",

          action:
            d[0],

          title:
            d[1],

          description:
            `Detected: ${a.type}`,

          department:
            "開発基盤",

          priority:
            120,

          internalOnly:
            true,

          safeAutonomy:
            true,

          externalAction:
            false,
        }
      )
    );
  }

  return out;
}

function candidatePatch(
  problemType = "generic"
) {
  if (
    problemType ===
    "capability_snapshot_stale"
  ) {
    return `export function rebuildCapabilitySnapshot(company, tasks) {
  return {
    externalResearch: company.researchEvidenceIndex.length > 0,
    productGeneration: tasks.some(t => t.status === "completed" && t.action === "product_prototype"),
    salesPreparation: tasks.some(t => t.status === "completed" && t.action === "sales_package_generation"),
    customerFeedback: company.customers.length > 0,
    outcomeTracking: company.outcomes.length > 0,
    revenueTracking: company.outcomes.some(o => Number(o.revenue || 0) > 0),
    publication: false,
    payment: false,
    selfDevelopment: tasks.some(t => t.status === "completed" && ["self_development_test", "self_maintenance_repair", "code_change_candidate"].includes(t.action)),
    platformIndependence: tasks.some(t => t.status === "completed" && t.action === "platform_decoupling")
  };
}`;
  }

  if (
    problemType ===
    "human_gate_sync"
  ) {
    return `export function syncHumanGates(company, tasks) {
  company.humanGates = tasks
    .filter(t => t.type === "human_gate" || t.requiresHuman)
    .map(t => ({
      taskId: t.id,
      status: t.status,
      requiresHuman: true
    }));
  return company;
}`;
  }

  return `export function selfMaintenanceStep(state) {
  const next = { ...state };
  next.runtimeVersion = "${RUNTIME_VERSION}";
  next.schemaVersion = "${SCHEMA_VERSION}";
  return next;
}`;
}

function testCandidate(
  code
) {
  const failures =
    [];

  const src =
    String(
      code || ""
    );

  if (
    src.length < 30
  ) {
    failures.push(
      "candidate_too_small"
    );
  }

  if (
    !src.includes(
      "export"
    )
  ) {
    failures.push(
      "missing_export"
    );
  }

  if (
    !src.includes(
      "function"
    )
  ) {
    failures.push(
      "missing_function"
    );
  }

  for (
    const p of
      DANGEROUS_PATTERNS
  ) {
    if (
      src.includes(
        p
      )
    ) {
      failures.push(
        `dangerous_pattern:${p}`
      );
    }
  }

  if (
    src.includes(
      "fetch("
    ) &&
    src.includes(
      "POST"
    )
  ) {
    failures.push(
      "possible_external_write"
    );
  }

  const balanced =
    [
      "(",
      "[",
      "{",
    ].every(
      (open) => {
        const close =
          {
            "(": ")",
            "[": "]",
            "{": "}",
          }[open];

        return (
          src.split(
            open
          ).length ===
          src.split(
            close
          ).length
        );
      }
    );

  if (
    !balanced
  ) {
    failures.push(
      "unbalanced_delimiters"
    );
  }

  return {
    passed:
      failures.length === 0,

    failures,

    checks:
      [
        "length",
        "export",
        "function",
        "dangerous_patterns",
        "external_write",
        "delimiter_balance",
      ],
  };
}

async function selfDevelopmentProposal(
  env
) {
  const report =
    await audit(
      env
    );

  const first =
    report.anomalies[0]
      ?.type ??
    "capability_gap";

  const capabilityGaps =
    Object.entries(
      report.capabilities
    )
      .filter(
        ([, v]) =>
          v === false
      )
      .map(
        ([k]) => k
      );

  const proposal = {
    id:
      id("proposal"),

    type:
      "self_development_proposal",

    createdAt:
      nowIso(),

    target:
      "company_core",

    trigger:
      first,

    anomalyCount:
      report.anomalyCount,

    capabilityGaps,

    intendedChange:
      first ===
      "capability_snapshot_stale"
        ? "Capability computation and state synchronization"
        : first ===
          "missing_human_gate_record"
        ? "Human Gate synchronization"
        : "Self-maintenance and capability growth",

    generatedCodeType:
      "safe_internal_module_candidate",

    productionDeploy:
      false,

    externalActions:
      false,

    externalAI:
      false,
  };

  const candidateCode =
    candidatePatch(
      first ===
        "missing_human_gate_record"
        ? "human_gate_sync"
        : first
    );

  const artifact =
    await saveArtifact(
      env,
      {
        id:
          proposal.id,

        action:
          "code_change_candidate",

        businessId:
          null,

        department:
          "開発基盤",
      },
      {
        proposal,
        candidateCode,
      }
    );

  await setStore(
    env,
    `proposal:${proposal.id}`,
    proposal
  );

  await setStore(
    env,
    `candidate:${proposal.id}`,
    {
      ...proposal,

      candidateCode,

      test:
        null,

      safety:
        null,
    }
  );

  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  company.selfDevelopment.lastProposalAt =
    nowIso();

  company.selfDevelopment.lastCandidateId =
    proposal.id;

  await setStore(
    env,
    "company",
    company
  );

  await memory(
    env,
    {
      type:
        "self_development_proposal",

      proposalId:
        proposal.id,

      artifactId:
        artifact.id,

      summary:
        "会社自身が自己開発候補を生成した。",
    }
  );

  return {
    proposal,

    candidateId:
      proposal.id,

    artifact,

    candidateCode,
  };
}

async function selfDevelopmentTest(
  env,
  candidateId
) {
  const candidate =
    await getStore(
      env,
      `candidate:${candidateId}`,
      null
    );

  if (!candidate) {
    throw new Error(
      "Candidate not found"
    );
  }

  const result =
    testCandidate(
      candidate.candidateCode
    );

  const safety = {
    externalActions:
      false,

    productionDeploy:
      false,

    externalAI:
      false,

    dangerousPatternsBlocked:
      true,

    riskLevel:
      result.passed
        ? "low"
        : "high",
  };

  candidate.test =
    result;

  candidate.safety =
    safety;

  candidate.testedAt =
    nowIso();

  await setStore(
    env,
    `candidate:${candidateId}`,
    candidate
  );

  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  company.selfDevelopment.lastTestAt =
    nowIso();

  await setStore(
    env,
    "company",
    company
  );

  return {
    candidateId,

    test:
      result,

    safety,
  };
}

async function createDeployCandidate(
  env,
  candidateId
) {
  const candidate =
    await getStore(
      env,
      `candidate:${candidateId}`,
      null
    );

  if (!candidate) {
    throw new Error(
      "Candidate not found"
    );
  }

  if (
    !candidate.test?.passed
  ) {
    throw new Error(
      "Candidate has not passed tests"
    );
  }

  const snapshot =
    await snapshotState(
      env,
      "before_self_development_deploy_candidate"
    );

  const task =
    await createTask(
      env,
      {
        type:
          "human_gate",

        action:
          "self_development_deploy_candidate",

        title:
          `自己開発Deploy Candidate承認：${candidateId}`,

        description:
          "生成・テスト済みの内部コード変更候補。本番反映にはHuman Gateが必要。",

        department:
          "開発基盤",

        priority:
          130,

        status:
          "waiting_human",

        internalOnly:
          false,

        safeAutonomy:
          false,

        externalAction:
          false,

        requiresHuman:
          true,
      }
    );

  candidate.snapshotId =
    snapshot.id;

  candidate.deployCandidateTaskId =
    task.id;

  candidate.status =
    "waiting_human";

  candidate.deployCandidateAt =
    nowIso();

  await setStore(
    env,
    `candidate:${candidateId}`,
    candidate
  );

  await memory(
    env,
    {
      type:
        "self_development_deploy_candidate",

      candidateId,

      taskId:
        task.id,

      snapshotId:
        snapshot.id,

      summary:
        "自己開発候補を安全なDeploy CandidateとしてHuman Gateへ送った。",
    }
  );

  return {
    candidate,

    task,

    snapshotId:
      snapshot.id,
  };
}

async function createBusinessPipelineTask(
  env,
  business,
  stage
) {
  const map = {
    research_brief: [
      "市場調査：",
      "調査",
      "business_task",
    ],

    product_prototype: [
      "商品設計・試作：",
      "技術",
      "business_task",
    ],

    sales_package_generation: [
      "販売準備：",
      "企画",
      "business_task",
    ],

    sales_evaluation: [
      "販売構成評価：",
      "事業成果",
      "business_task",
    ],
  };

  if (
    stage ===
    "human_gate_publication"
  ) {
    return createTask(
      env,
      {
        type:
          "human_gate",

        action:
          "human_gate_publication",

        title:
          `Human Gate：公開承認：${business.name}`,

        department:
          "リスク管理",

        priority:
          100,

        status:
          "waiting_human",

        businessId:
          business.id,

        requiresHuman:
          true,

        externalAction:
          true,

        pipeline:
          {
            type:
              "business_pipeline",

            stage:
              "human_gate",

            businessId:
              business.id,
          },
      }
    );
  }

  const d =
    map[stage];

  if (!d) {
    throw new Error(
      `Unknown business stage: ${stage}`
    );
  }

  return createTask(
    env,
    {
      type:
        d[2],

      action:
        stage,

      title:
        `${d[0]}${business.name}`,

      department:
        d[1],

      priority:
        90,

      status:
        "pending",

      businessId:
        business.id,

      internalOnly:
        false,

      safeAutonomy:
        false,

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

async function executeBusinessTask(
  env,
  task
) {
  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  const business =
    company.businesses.find(
      (b) =>
        b.id ===
        task.businessId
    );

  if (!business) {
    throw new Error(
      "Business not found for task"
    );
  }

  let payload;
  let nextTask = null;

  switch (
    task.action
  ) {
    case "research_brief":
      payload = {
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
            "継続利用する理由は何か",
          ],

        status:
          "調査設計成功・外部データ確認前",

        generatedAt:
          nowIso(),
      };

      nextTask =
        await createBusinessPipelineTask(
          env,
          business,
          "product_prototype"
        );

      break;

    case "product_prototype":
      payload = {
        type:
          "product_prototype",

        businessId:
          business.id,

        businessName:
          business.name,

        productConcept:
          "小規模事業者向け市場調査レポート生成サービス",

        workflow:
          [
            "依頼受付",
            "調査設計",
            "情報整理",
            "レポート生成",
            "確認・修正",
          ],

        validationPlan:
          [
            "3〜5件の小テスト",
            "処理時間測定",
            "修正回数記録",
            "購入意図確認",
          ],

        status:
          "商品構成成功・顧客検証前",

        generatedAt:
          nowIso(),
      };

      nextTask =
        await createBusinessPipelineTask(
          env,
          business,
          "sales_package_generation"
        );

      break;

    case "sales_package_generation":
      payload = {
        type:
          "sales_package_generation",

        businessId:
          business.id,

        businessName:
          business.name,

        salesMessage:
          "市場調査の設計から整理までを支援し、意思決定に使える形へまとめます。",

        acquisitionChannels:
          [
            "直接営業",
            "紹介",
            "公開ページ",
            "コミュニティ",
          ],

        publicationStatus:
          "not_published",

        paymentStatus:
          "not_connected",

        status:
          "販売準備成功・事業成果確認前",

        generatedAt:
          nowIso(),
      };

      nextTask =
        await createBusinessPipelineTask(
          env,
          business,
          "sales_evaluation"
        );

      break;

    case "sales_evaluation":
      payload = {
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

            paymentConnected:
              false,
          },

        result:
          "販売構成評価完了・公開承認待ち",

        generatedAt:
          nowIso(),
      };

      nextTask =
        await createBusinessPipelineTask(
          env,
          business,
          "human_gate_publication"
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

  await memory(
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
        payload.status ||
        payload.result ||
        "事業タスク完了",
    }
  );

  return {
    payload,

    artifact,

    nextTask,
  };
}

async function executeMaintenance(
  env,
  task
) {
  await snapshotState(
    env,
    `before_${task.action}`
  );

  let payload;

  if (
    task.action ===
    "self_maintenance_capability_reconciliation"
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

    company.capabilitySnapshot =
      capabilities(
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

    payload = {
      repaired:
        "capability",

      capabilitySnapshot:
        company.capabilitySnapshot,
    };
  } else if (
    task.action ===
    "self_maintenance_human_gate_reconciliation"
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

    company.humanGates =
      tasks
        .filter(
          (t) =>
            t.type ===
              "human_gate" ||
            t.requiresHuman
        )
        .map((t) => ({
          id:
            t.humanGateId ??
            id("gate"),

          taskId:
            t.id,

          businessId:
            t.businessId,

          status:
            t.status ===
            "waiting_human"
              ? "pending"
              : t.status,

          requiresHuman:
            true,

          createdAt:
            t.createdAt,

          updatedAt:
            nowIso(),
        }));

    await setStore(
      env,
      "company",
      company
    );

    payload = {
      repaired:
        "human_gates",

      count:
        company
          .humanGates.length,
    };
  } else {
    const result =
      await migrate(
        env
      );

    payload = {
      repaired:
        "state",

      migrationVersion:
        result.company
          .migration
          .version,

      businessCount:
        result.company
          .businesses.length,

      taskCount:
        result.tasks.length,
    };
  }

  const artifact =
    await saveArtifact(
      env,
      task,
      payload
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
          task.runCount ||
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
        await executeMaintenance(
          env,
          task
        );
    } else if (
      task.type ===
      "business_task"
    ) {
      result =
        await executeBusinessTask(
          env,
          task
        );
    } else if (
      task.action ===
      "self_development_test"
    ) {
      result =
        await selfDevelopmentTest(
          env,
          task.input
            ?.candidateId
        );
    } else if (
      task.action ===
      "self_development_proposal"
    ) {
      result =
        await selfDevelopmentProposal(
          env
        );
    } else {
      result = {
        payload:
          {
            status:
              "internal_task_completed",

            action:
              task.action,
          },

        artifact:
          await saveArtifact(
            env,
            task,
            {
              status:
                "internal_task_completed",

              action:
                task.action,
            }
          ),
      };
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
            result.test ??
            null,

          artifactId:
            result.artifact?.id ??
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
    };
  } catch (e) {
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
                e?.message ??
                String(e),
            },
        }
      );

    return {
      status:
        "task_failed",

      task:
        failed,

      error:
        e?.message ??
        String(e),
    };
  }
}

async function companyCycle(
  env
) {
  const {
    company,
  } =
    await migrate(
      env
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

  const pendingHuman =
    tasks.filter(
      (t) =>
        (
          t.type ===
            "human_gate" ||
          t.requiresHuman
        ) &&
        t.status ===
          "waiting_human"
    );

  let executable =
    tasks
      .filter(
        (t) =>
          t.status ===
            "pending" &&
          t.type !==
            "human_gate"
      )
      .sort(
        (a, b) =>
          Number(
            b.priority
          ) -
          Number(
            a.priority
          )
      );

  if (
    !executable.length &&
    !pendingHuman.length
  ) {
    const business =
      company
        .businesses[0];

    const actionOrder = [
      "research_brief",
      "product_prototype",
      "sales_package_generation",
      "sales_evaluation",
    ];

    const done =
      new Set(
        tasks
          .filter(
            (t) =>
              t.businessId ===
                business.id &&
              t.status ===
                "completed"
          )
          .map(
            (t) =>
              t.action
          )
      );

    const next =
      actionOrder.find(
        (a) =>
          !done.has(a)
      );

    if (next) {
      const titles = {
        research_brief:
          "市場調査",

        product_prototype:
          "商品設計・試作",

        sales_package_generation:
          "販売準備",

        sales_evaluation:
          "販売構成評価",
      };

      const departments = {
        research_brief:
          "調査",

        product_prototype:
          "技術",

        sales_package_generation:
          "企画",

        sales_evaluation:
          "事業成果",
      };

      await createTask(
        env,
        {
          type:
            "business_task",

          action:
            next,

          title:
            `${titles[next]}：${business.name}`,

          department:
            departments[next],

          priority:
            90,

          status:
            "pending",

          businessId:
            business.id,

          internalOnly:
            false,

          safeAutonomy:
            false,

          pipeline:
            {
              type:
                "business_pipeline",

              stage:
                next,

              businessId:
                business.id,
            },
        }
      );
    } else if (
      !tasks.some(
        (t) =>
          t.type ===
            "human_gate" &&
          t.businessId ===
            business.id &&
          t.status ===
            "waiting_human"
      )
    ) {
      await createTask(
        env,
        {
          type:
            "human_gate",

          action:
            "human_gate_publication",

          title:
            `Human Gate：公開承認：${business.name}`,

          department:
            "リスク管理",

          priority:
            100,

          status:
            "waiting_human",

          businessId:
            business.id,

          requiresHuman:
            true,

          externalAction:
            true,

          pipeline:
            {
              type:
                "business_pipeline",

              stage:
                "human_gate",

              businessId:
                business.id,
            },
        }
      );
    }

    tasks =
      (
        await getStore(
          env,
          "tasks",
          []
        )
      ).map(
        normalizeTask
      );

    executable =
      tasks
        .filter(
          (t) =>
            t.status ===
              "pending" &&
            t.type !==
              "human_gate"
        )
        .sort(
          (a, b) =>
            Number(
              b.priority
            ) -
            Number(
              a.priority
            )
        );
  }

  const execution =
    executable.length
      ? await executeTask(
          env,
          executable[0]
        )
      : null;

  const updatedCompany =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  const updatedTasks =
    (
      await getStore(
        env,
        "tasks",
        []
      )
    ).map(
      normalizeTask
    );

  updatedCompany.cycleCount =
    Number(
      updatedCompany.cycleCount ||
        0
    ) + 1;

  updatedCompany.capabilitySnapshot =
    capabilities(
      updatedCompany,
      updatedTasks
    );

  updatedCompany.currentFocus =
    updatedTasks.some(
      (t) =>
        (
          t.type ===
            "human_gate" ||
          t.requiresHuman
        ) &&
        t.status ===
          "waiting_human"
    )
      ? "人間承認待ち"
      : execution
        ? "自律実行中"
        : "自律待機";

  updatedCompany.nextAction =
    execution?.task?.title ??
    "自己保守・自己開発・組織能力を評価する";

  await setStore(
    env,
    "company",
    updatedCompany
  );

  await setRuntimeMeta(
    env,
    updatedCompany.cycleCount,
    null
  );

  return {
    runtime:
      RUNTIME_VERSION,

    execution,

    company:
      updatedCompany,
  };
}

async function selfOrganizationCycle(
  env
) {
  const {
    company,
  } =
    await migrate(
      env
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

  const caps =
    capabilities(
      company,
      tasks
    );

  company.capabilitySnapshot =
    caps;

  const added =
    [];

  for (
    const [
      name,
    ] of Object.entries(
      GENERATED_DEPARTMENTS
    )
  ) {
    if (
      !company.departments.includes(
        name
      )
    ) {
      company.departments.push(
        name
      );

      added.push(
        name
      );
    }
  }

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
    status:
      "self_organization_completed",

    addedDepartments:
      added,

    departments:
      company.departments,

    capabilities:
      caps,
  };
}

async function selfDevelopmentCycle(
  env
) {
  const report =
    await audit(
      env
    );

  if (
    report.anomalyCount >
    0
  ) {
    await ensureMaintenance(
      env,
      report
    );

    return {
      mode:
        "repair_first",

      report,
    };
  }

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

  const caps =
    capabilities(
      company,
      tasks
    );

  const needDeveloper =
    !caps.selfDevelopment;

  if (
    !needDeveloper
  ) {
    return {
      mode:
        "observe",

      report,

      capabilities:
        caps,
    };
  }

  const proposal =
    await selfDevelopmentProposal(
      env
    );

  const candidateId =
    proposal.candidateId;

  const testTask =
    await createTask(
      env,
      {
        type:
          "internal_task",

        action:
          "self_development_test",

        title:
          `自己開発テスト：${candidateId}`,

        department:
          "開発基盤",

        priority:
          125,

        internalOnly:
          true,

        safeAutonomy:
          true,

        externalAction:
          false,

        input:
          {
            candidateId,
          },
      }
    );

  const execution =
    await executeTask(
      env,
      testTask
    );

  const candidate =
    await getStore(
      env,
      `candidate:${candidateId}`,
      null
    );

  let deployCandidate =
    null;

  if (
    candidate?.test?.passed
  ) {
    deployCandidate =
      await createDeployCandidate(
        env,
        candidateId
      );
  }

  return {
    mode:
      "develop",

    report,

    proposal,

    testExecution:
      execution,

    deployCandidate,
  };
}

async function health(
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

  const idx =
    await getStore(
      env,
      "artifact_index",
      []
    );

  return {
    ok:
      true,

    runtime:
      RUNTIME_VERSION,

    schemaVersion:
      SCHEMA_VERSION,

    runtime_meta:
      await env.DB
        .prepare(
          `
          SELECT
            last_heartbeat_at,
            cycle_count,
            runtime_version
          FROM runtime_meta
          WHERE id=1
          `
        )
        .first(),

    company:
      {
        cycleCount:
          company.cycleCount,

        currentFocus:
          company.currentFocus,

        nextAction:
          company.nextAction,

        pendingTasks:
          tasks.filter(
            (t) =>
              [
                "pending",
                "running",
              ].includes(
                t.status
              )
          ).length,

        pendingInternalTasks:
          tasks.filter(
            (t) =>
              t.internalOnly &&
              [
                "pending",
                "running",
              ].includes(
                t.status
              )
          ).length,

        pendingHumanGates:
          tasks.filter(
            (t) =>
              (
                t.type ===
                  "human_gate" ||
                t.requiresHuman
              ) &&
              t.status ===
                "waiting_human"
          ).length,

        businessCount:
          company.businesses
            .length,

        evidenceCount:
          company
            .researchEvidenceIndex
            .length,

        customerCount:
          company.customers
            .length,

        outcomeCount:
          company.outcomes
            .length,

        departmentCount:
          company.departments
            .length,

        departments:
          company.departments,
      },

    execution_available:
      true,

    executor:
      "Cloud Executor (D1-backed)",

    self_maintenance_available:
      true,

    migration_manager_available:
      true,

    self_development_available:
      true,

    sandbox_available:
      true,

    test_runner_available:
      true,

    deploy_candidate_available:
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

    production_deploy_autonomy:
      false,

    artifactCount:
      Array.isArray(idx)
        ? idx.length
        : 0,
  };
}

async function route(
  req,
  env
) {
  const u =
    new URL(
      req.url
    );

  const p =
    u.pathname;

  const m =
    req.method.toUpperCase();

  if (
    m ===
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
    p ===
      "/api/health" &&
    m ===
      "GET"
  ) {
    return json(
      await health(
        env
      )
    );
  }

  if (
    p ===
      "/api/state" &&
    m ===
      "GET"
  ) {
    await migrate(
      env
    );

    return json({
      runtime:
        RUNTIME_VERSION,

      schemaVersion:
        SCHEMA_VERSION,

      company:
        await getStore(
          env,
          "company",
          defaultCompany()
        ),

      tasks:
        (
          await getStore(
            env,
            "tasks",
            []
          )
        ).map(
          normalizeTask
        ),

      artifacts:
        await getStore(
          env,
          "artifact_index",
          []
        ),

      policy:
        {
          autonomousInternalChanges:
            true,

          selfMaintenance:
            true,

          selfDevelopmentProposal:
            true,

          sandbox:
            true,

          testing:
            true,

          deployCandidate:
            true,

          humanGateForProductionSelfModification:
            true,

          publicationAutonomy:
            false,

          paymentAutonomy:
            false,

          contractAutonomy:
            false,

          externalCommunicationAutonomy:
            false,

          productionDeployAutonomy:
            false,
        },
    });
  }

  if (
    p ===
      "/api/cycle" &&
    m ===
      "POST"
  ) {
    return json(
      await companyCycle(
        env
      )
    );
  }

  if (
    p ===
      "/api/self-organization/cycle" &&
    m ===
      "POST"
  ) {
    return json(
      await selfOrganizationCycle(
        env
      )
    );
  }

  if (
    p ===
      "/api/self-development/cycle" &&
    m ===
      "POST"
  ) {
    return json(
      await selfDevelopmentCycle(
        env
      )
    );
  }

  if (
    p ===
      "/api/self-development/proposal" &&
    m ===
      "POST"
  ) {
    return json(
      await selfDevelopmentProposal(
        env
      )
    );
  }

  if (
    p ===
      "/api/self-development/test" &&
    m ===
      "POST"
  ) {
    const b =
      await bodyJSON(
        req
      );

    return json(
      await selfDevelopmentTest(
        env,
        str(
          b.candidateId
        )
      )
    );
  }

  if (
    p ===
      "/api/self-development/deploy-candidate" &&
    m ===
      "POST"
  ) {
    const b =
      await bodyJSON(
        req
      );

    return json(
      await createDeployCandidate(
        env,
        str(
          b.candidateId
        )
      )
    );
  }

  if (
    p ===
      "/api/maintenance/audit" &&
    m ===
      "GET"
  ) {
    return json(
      await audit(
        env
      )
    );
  }

  if (
    p ===
      "/api/maintenance/cycle" &&
    m ===
      "POST"
  ) {
    const a =
      await audit(
        env
      );

    const created =
      await ensureMaintenance(
        env,
        a
      );

    return json({
      status:
        "maintenance_completed",

      audit:
        a,

      created,
    });
  }

  if (
    p ===
      "/api/migration/status" &&
    m ===
      "GET"
  ) {
    await migrate(
      env
    );

    return json({
      runtime:
        RUNTIME_VERSION,

      schemaVersion:
        SCHEMA_VERSION,

      migration:
        (
          await getStore(
            env,
            "company",
            defaultCompany()
          )
        ).migration,
    });
  }

  if (
    p ===
      "/api/self-development/candidate" &&
    m ===
      "GET"
  ) {
    const cid =
      str(
        u.searchParams.get(
          "id"
        )
      );

    return json(
      await getStore(
        env,
        `candidate:${cid}`,
        null
      ) || {
        ok:
          false,

        error:
          "Candidate not found",
      }
    );
  }

  if (
    p ===
      "/api/snapshots" &&
    m ===
      "GET"
  ) {
    return json(
      await getStore(
        env,
        "snapshot_index",
        []
      )
    );
  }

  if (
    p ===
      "/api/departments" &&
    m ===
      "GET"
  ) {
    const c =
      await getStore(
        env,
        "company",
        defaultCompany()
      );

    return json({
      runtime:
        RUNTIME_VERSION,

      departments:
        c.departments,
    });
  }

  if (
    p ===
      "/api/capabilities" &&
    m ===
      "GET"
  ) {
    await migrate(
      env
    );

    const c =
      await getStore(
        env,
        "company",
        defaultCompany()
      );

    const t =
      (
        await getStore(
          env,
          "tasks",
          []
        )
      ).map(
        normalizeTask
      );

    return json({
      runtime:
        RUNTIME_VERSION,

      capabilities:
        capabilities(
          c,
          t
        ),

      departments:
        c.departments,
    });
  }

  if (
    p ===
      "/api/heartbeat" &&
    m ===
      "GET"
  ) {
    const c =
      await getStore(
        env,
        "company",
        defaultCompany()
      );

    await setRuntimeMeta(
      env,
      Number(
        c.cycleCount || 0
      ),
      nowIso()
    );

    return json({
      ok:
        true,

      runtime:
        RUNTIME_VERSION,

      heartbeatAt:
        nowIso(),
    });
  }

  if (
    p ===
      "/api/customer/intake" &&
    m ===
      "POST"
  ) {
    const b =
      await bodyJSON(
        req
      );

    const c =
      await getStore(
        env,
        "company",
        defaultCompany()
      );

    const x = {
      id:
        id("customer"),

      source:
        str(
          b.source,
          "unknown"
        ),

      message:
        str(
          b.message
        ),

      createdAt:
        nowIso(),

      metadata:
        b.metadata ||
        {},
    };

    c.customers.push(
      x
    );

    await setStore(
      env,
      "company",
      c
    );

    return json(
      {
        status:
          "customer_received",

        customer:
          x,
      },
      201
    );
  }

  if (
    p ===
      "/api/outcome" &&
    m ===
      "POST"
  ) {
    const b =
      await bodyJSON(
        req
      );

    const c =
      await getStore(
        env,
        "company",
        defaultCompany()
      );

    const x = {
      id:
        id("outcome"),

      businessId:
        str(
          b.businessId
        ) || null,

      revenue:
        Number(
          b.revenue || 0
        ),

      cost:
        Number(
          b.cost || 0
        ),

      conversions:
        Number(
          b.conversions ||
            0
        ),

      notes:
        str(
          b.notes
        ),

      createdAt:
        nowIso(),
    };

    c.outcomes.push(
      x
    );

    await setStore(
      env,
      "company",
      c
    );

    return json(
      {
        status:
          "outcome_recorded",

        outcome:
          x,
      },
      201
    );
  }

  if (
    p ===
      "/api/research/fetch" &&
    m ===
      "GET"
  ) {
    const sid =
      str(
        u.searchParams.get(
          "source"
        )
      );

    const src =
      RESEARCH_SOURCES[
        sid
      ];

    if (!src) {
      return json(
        {
          ok:
            false,

          error:
            "Unknown source",

          available:
            Object.keys(
              RESEARCH_SOURCES
            ),
        },
        400
      );
    }

    const r =
      await fetch(
        src.url,
        {
          headers:
            {
              "user-agent":
                "AI-Company-Core/6.2.0",
            },
        }
      );

    const text =
      await r.text();

    const e = {
      id:
        id("evidence"),

      sourceId:
        sid,

      sourceName:
        src.name,

      url:
        src.url,

      status:
        r.status,

      ok:
        r.ok,

      retrievedAt:
        nowIso(),

      contentPreview:
        text.slice(
          0,
          20000
        ),
    };

    await setStore(
      env,
      `evidence:${e.id}`,
      e
    );

    const c =
      await getStore(
        env,
        "company",
        defaultCompany()
      );

    c.researchEvidenceIndex.push(
      {
        id:
          e.id,

        sourceId:
          sid,

        sourceName:
          src.name,

        url:
          src.url,

        status:
          r.status,

        ok:
          r.ok,

        retrievedAt:
          e.retrievedAt,
      }
    );

    await setStore(
      env,
      "company",
      c
    );

    return json({
      ok:
        true,

      evidence:
        e,
    });
  }

  if (
    p ===
      "/api/artifact" &&
    m ===
      "GET"
  ) {
    const aid =
      str(
        u.searchParams.get(
          "id"
        )
      );

    return json(
      await getStore(
        env,
        `artifact:${aid}`,
        null
      ) || {
        ok:
          false,

        error:
          "Artifact not found",
      }
    );
  }

  if (
    p ===
      "/api/human-gate/approve" &&
    m ===
      "POST"
  ) {
    const b =
      await bodyJSON(
        req
      );

    const task =
      await updateTask(
        env,
        str(
          b.taskId
        ),
        {
          status:
            "approved",

          approvedAt:
            nowIso(),
        }
      );

    return json({
      ok:
        !!task,

      task,

      externalActionPerformed:
        false,
    });
  }

  if (
    p ===
      "/api/human-gate/reject" &&
    m ===
      "POST"
  ) {
    const b =
      await bodyJSON(
        req
      );

    const task =
      await updateTask(
        env,
        str(
          b.taskId
        ),
        {
          status:
            "rejected",

          rejectedAt:
            nowIso(),
        }
      );

    return json({
      ok:
        !!task,

      task,
    });
  }

  return null;
}

export default {
  async fetch(
    request,
    env
  ) {
    try {
      const r =
        await route(
          request,
          env
        );

      if (r) {
        return r;
      }

      if (
        request.method !==
        "GET"
      ) {
        return new Response(
          "Method Not Allowed",
          {
            status:
              405,
          }
        );
      }

      return env.ASSETS
        ? env.ASSETS.fetch(
            request
          )
        : json({
            ok:
              true,

            runtime:
              RUNTIME_VERSION,
          });
    } catch (e) {
      return json(
        {
          ok:
            false,

          runtime:
            RUNTIME_VERSION,

          error:
            e?.message ??
            String(e),
        },
        500
      );
    }
  },

  async scheduled(
    controller,
    env,
    ctx
  ) {
    ctx.waitUntil(
      (async () => {
        await migrate(
          env
        );

        const report =
          await audit(
            env
          );

        if (
          report.anomalyCount
        ) {
          await ensureMaintenance(
            env,
            report
          );
        }

        await selfOrganizationCycle(
          env
        );

        await selfDevelopmentCycle(
          env
        );

        await companyCycle(
          env
        );
      })()
    );
  },
};
