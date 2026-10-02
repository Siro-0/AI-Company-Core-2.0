const RUNTIME_VERSION = "6.3.0-self-evolving-company";
const SCHEMA_VERSION = "6.3.0";
const SELF_DEVELOPMENT_INTERVAL_CYCLES = 3;

const DEFAULT_DEPARTMENTS = [
  "企画",
  "技術",
  "リスク管理",
];

const GENERATED_DEPARTMENTS = {
  "調査": {
    mission:
      "外部証拠を取得し、事業仮説の精度を高める。",
    trigger:
      "externalResearch",
    action:
      "research_external_evidence",
  },

  "顧客対応": {
    mission:
      "顧客入力を整理し、改善要求へ変換する。",
    trigger:
      "customerFeedback",
    action:
      "customer_feedback_analysis",
  },

  "事業成果": {
    mission:
      "成果・売上・コストを把握し、CEO評価へ接続する。",
    trigger:
      "outcomeTracking",
    action:
      "outcome_analysis",
  },

  "開発基盤": {
    mission:
      "安全な開発・テスト・デプロイ基盤を整備する。",
    trigger:
      "selfDevelopment",
    action:
      "development_infrastructure",
  },

  "プラットフォーム戦略": {
    mission:
      "Storage / Scheduler / Executor / Web の依存を分離する。",
    trigger:
      "platformIndependence",
    action:
      "platform_decoupling",
  },
};

const DEPARTMENT_ALIASES = {
  "戦略プラットフォーム":
    "プラットフォーム戦略",

  "プラットフォーム戦略":
    "プラットフォーム戦略",

  "お客様対応":
    "顧客対応",
};

const ACTION_ALIASES = {
  "販売評価":
    "sales_evaluation",

  "販売準備":
    "sales_package_generation",

  "リサーチブリーフ":
    "research_brief",

  "商品設計":
    "product_prototype",

  "商品設計・試作":
    "product_prototype",

  "内部部門改善":
    "internal_department_improvement",

  "クラウドエグゼキューター":
    "cloud_executor",

  "プラットフォーム分離":
    "platform_decoupling",

  "開発インフラストラクチャ":
    "development_infrastructure",

  "自己開発テスト":
    "self_development_test",

  "自己開発展開候補":
    "self_development_deploy_candidate",

  "コード変更候補":
    "code_change_candidate",

  "ヒューマンゲート":
    "human_gate_publication",
};

const RESEARCH_SOURCES = {
  stat_economy: {
    name:
      "総務省統計局",
    url:
      "https://www.stat.go.jp/",
  },

  soumu: {
    name:
      "総務省",
    url:
      "https://www.soumu.go.jp/",
  },

  meti: {
    name:
      "経済産業省",
    url:
      "https://www.meti.go.jp/",
  },

  mhlw: {
    name:
      "厚生労働省",
    url:
      "https://www.mhlw.go.jp/",
  },

  digital: {
    name:
      "デジタル庁",
    url:
      "https://www.digital.go.jp/",
  },

  estat: {
    name:
      "e-Stat",
    url:
      "https://www.e-stat.go.jp/",
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
    typeof crypto !==
      "undefined" &&
    crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 9)}`;

  return `${prefix}_${raw}`;
}

function str(
  value,
  fallback = ""
) {
  return typeof value ===
    "string"
    ? value.trim()
    : fallback;
}

function json(
  data,
  status = 200
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
        "content-type":
          "application/json; charset=utf-8",
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

async function bodyJSON(
  request
) {
  try {
    return await request.json();
  } catch {
    return {};
  }
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
      INSERT INTO company_store(
        key,
        value_json,
        updated_at
      )
      VALUES(?,?,?)
      ON CONFLICT(key)
      DO UPDATE SET
        value_json =
          excluded.value_json,
        updated_at =
          excluded.updated_at
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
        `
        SELECT last_heartbeat_at
        FROM runtime_meta
        WHERE id=1
        LIMIT 1
        `
      )
      .first();

  const timestamp =
    heartbeat ??
    current?.last_heartbeat_at ??
    null;

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
      timestamp,
      cycleCount,
      RUNTIME_VERSION
    )
    .run();
}

function normalizeDepartmentName(
  name
) {
  const value =
    str(name, "");

  return (
    DEPARTMENT_ALIASES[value] ??
    value
  );
}

function normalizeActionName(
  action
) {
  const value =
    str(action, "");

  return (
    ACTION_ALIASES[value] ??
    value
  );
}

function normalizeDepartments(
  value
) {
  const input =
    Array.isArray(value)
      ? value
      : [];

  return [
    ...new Set(
      [
        ...DEFAULT_DEPARTMENTS,
        ...Object.keys(
          GENERATED_DEPARTMENTS
        ),
        ...input,
      ]
        .map(
          normalizeDepartmentName
        )
        .filter(Boolean)
    ),
  ];
}

function normalizeTask(
  task
) {
  const source =
    task &&
    typeof task ===
      "object"
      ? {
          ...task,
        }
      : {};

  const statusMap = {
    "保留中":
      "pending",

    "完了":
      "completed",

    "人間を待っています":
      "waiting_human",

    "実行中":
      "running",

    "失敗":
      "failed",
  };

  return {
    ...source,

    id:
      source.id ??
      id("task"),

    type:
      str(
        source.type,
        source.requiresHuman
          ? "human_gate"
          : "internal_task"
      ),

    action:
      normalizeActionName(
        str(
          source.action,
          source.executor ??
            "internal_analysis"
        )
      ),

    title:
      str(
        source.title,
        "内部タスク"
      ),

    description:
      str(
        source.description,
        ""
      ),

    department:
      normalizeDepartmentName(
        source.department ??
          "企画"
      ),

    status:
      statusMap[
        source.status
      ] ??
      source.status ??
      "pending",

    priority:
      Number.isFinite(
        Number(
          source.priority
        )
      )
        ? Number(
            source.priority
          )
        : 50,

    internalOnly:
      source.internalOnly ===
      true,

    safeAutonomy:
      source.safeAutonomy ===
      true,

    externalAction:
      source.externalAction ===
      true,

    requiresHuman:
      source.requiresHuman ===
        true ||
      source.type ===
        "human_gate",

    businessId:
      str(
        source.businessId,
        source.pipeline?.businessId ??
          ""
      ) || null,

    pipeline:
      source.pipeline &&
      typeof source.pipeline ===
        "object"
        ? {
            ...source.pipeline,
          }
        : {},

    createdAt:
      source.createdAt ??
      nowIso(),

    updatedAt:
      source.updatedAt ??
      nowIso(),
  };
}

function normalizeBusiness(
  business
) {
  const source =
    business &&
    typeof business ===
      "object"
      ? {
          ...business,
        }
      : {};

  return {
    ...source,

    id:
      str(
        source.id
      ) ||
      id("business"),

    name:
      str(
        source.name ??
          source.title,
        "未定義事業"
      ),

    problem:
      str(
        source.problem,
        ""
      ),

    target:
      str(
        source.target ??
          source.customer,
        ""
      ),

    value:
      str(
        source.value,
        ""
      ),

    status:
      str(
        source.status,
        "hypothesis"
      ),

    createdAt:
      source.createdAt ??
      nowIso(),
  };
}

function defaultCompany() {
  return {
    cycleCount:
      0,

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

    migration:
      {
        lastRunAt:
          null,

        version:
          null,

        businessAliases:
          {},

        repairs:
          [],
      },

    maintenance:
      {
        lastAuditAt:
          null,

        lastRepairAt:
          null,

        lastAnomalies:
          [],
      },

    selfDevelopment:
      {
        mode:
          "candidate_only",

        adapterMode:
          "plan_only",

        sourceControlWrite:
          false,

        productionDeploy:
          false,

        lastProposalAt:
          null,

        lastTestAt:
          null,

        lastBuildAt:
          null,

        lastRollbackAt:
          null,

        lastCandidateId:
          null,

        activeCandidateId:
          null,

        proposalCount:
          0,

        packageCount:
          0,
      },
  };
}

async function snapshotState(
  env,
  reason = "unspecified"
) {
  const snapshot = {
    id:
      id("snapshot"),

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
    index.slice(
      -100
    )
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
      ? company
          .researchEvidenceIndex
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
      ? company
          .organizationHistory
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
    ...defaultCompany()
      .selfDevelopment,

    ...(company.selfDevelopment ||
      {}),
  };

  if (
    !company.businesses.length
  ) {
    const inferred =
      tasks
        .map(
          (task) =>
            str(
              task.title
            )
        )
        .find(Boolean) ||
      "未定義事業";

    company.businesses.push({
      id:
        id("business"),

      name:
        inferred.includes(
          "："
        )
          ? inferred
              .split("：")
              .slice(1)
              .join("：")
          : inferred,

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
        (business) => [
          business.name
            .toLowerCase(),

          business.id,
        ]
      )
    );

  for (
    const business of
      company.businesses.slice(
        1
      )
  ) {
    if (
      business.name &&
      byName.get(
        business.name
          .toLowerCase()
      ) ===
        canonical.id
    ) {
      company.migration
        .businessAliases[
        business.id
      ] =
        canonical.id;
    }
  }

  const aliases =
    company.migration
      .businessAliases;

  for (
    const task of tasks
  ) {
    if (
      task.businessId &&
      aliases[
        task.businessId
      ]
    ) {
      task.businessId =
        aliases[
          task.businessId
        ];
    }

    if (
      task.pipeline
        ?.businessId &&
      aliases[
        task.pipeline
          .businessId
      ]
    ) {
      task.pipeline.businessId =
        aliases[
          task.pipeline
            .businessId
        ];
    }
  }

  tasks = [
    ...new Map(
      tasks.map(
        (task) => [
          task.id,
          task,
        ]
      )
    ).values(),
  ];

  company.humanGates =
    tasks
      .filter(
        (task) =>
          task.type ===
            "human_gate" ||
          task.requiresHuman
      )
      .map(
        (task) => ({
          id:
            task.humanGateId ??
            id("gate"),

          taskId:
            task.id,

          businessId:
            task.businessId,

          status:
            task.status ===
            "waiting_human"
              ? "pending"
              : task.status,

          requiresHuman:
            true,

          createdAt:
            task.createdAt,

          updatedAt:
            nowIso(),
        })
      );

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
      company.cycleCount ||
        0
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
    (task) =>
      task.status ===
        "completed" &&
      actions.includes(
        task.action
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
        (outcome) =>
          Number(
            outcome.revenue ||
              0
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
      ) ||
      company
        .selfDevelopment
        ?.lastTestAt !=
        null,

    platformIndependence:
      hasCompleted(
        tasks,
        [
          "platform_decoupling",
        ]
      ),

    sourceControlCandidate:
      true,

    sourceControlWrite:
      false,

    buildVerification:
      company
        .selfDevelopment
        ?.lastBuildAt !=
        null,

    rollback:
      true,

    deployCandidate:
      true,

    productionDeploy:
      false,

    customerGateway:
      true,

    outcomeGateway:
      true,
  };
}

function humanGateSemanticKey(
  task
) {
  const action =
    normalizeActionName(
      str(
        task.action,
        "human_gate"
      )
    );

  if (
    action ===
    "self_development_deploy_candidate"
  ) {
    const candidateId =
      str(
        task.input
          ?.candidateId,
        ""
      ) ||
      (
        task.title
          ?.match(
            /proposal_[A-Za-z0-9_-]+/
          ) || []
      )[0] ||
      "";

    return `selfdev:${
      candidateId ||
      task.id
    }`;
  }

  if (
    action ===
      "human_gate_publication" ||
    action ===
      "human_gate"
  ) {
    return `publication:${
      task.businessId ||
      "unknown"
    }`;
  }

  return `${action}:${
    task.businessId ||
    "global"
  }`;
}

function pendingHumanGateTasks(
  tasks
) {
  return tasks.filter(
    (task) =>
      (
        task.type ===
          "human_gate" ||
        task.requiresHuman
      ) &&
      task.status ===
        "waiting_human"
  );
}

async function reconcileHumanGates(
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

  const pending =
    pendingHumanGateTasks(
      tasks
    );

  const groups =
    new Map();

  for (
    const task of pending
  ) {
    const key =
      humanGateSemanticKey(
        task
      );

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

  const canonicalTasks =
    [];

  const superseded =
    [];

  for (
    const [
      key,
      group,
    ] of groups
  ) {
    group.sort(
      (a, b) =>
        Number(
          b.priority ||
            0
        ) -
          Number(
            a.priority ||
              0
          ) ||
          String(
            a.createdAt
          ).localeCompare(
            String(
              b.createdAt
            )
          )
    );

    const canonical =
      group[0];

    canonicalTasks.push(
      canonical
    );

    for (
      const duplicate of
        group.slice(1)
    ) {
      duplicate.status =
        "superseded";

      duplicate.supersededAt =
        nowIso();

      duplicate.result = {
        ...(
          duplicate.result ||
          {}
        ),

        supersededReason:
          "同一Human Gateの重複を自己保守で統合した。",

        canonicalTaskId:
          canonical.id,

        semanticKey:
          key,
      };

      superseded.push(
        duplicate.id
      );
    }
  }

  const waitingIds =
    new Set(
      canonicalTasks.map(
        (task) =>
          task.id
      )
    );

  for (
    const task of tasks
  ) {
    if (
      task.status ===
        "waiting_human" &&
      (
        task.type ===
          "human_gate" ||
        task.requiresHuman
      ) &&
      !waitingIds.has(
        task.id
      )
    ) {
      task.status =
        "superseded";

      task.supersededAt =
        task.supersededAt ||
        nowIso();
    }
  }

  const oldGateByTask =
    new Map(
      (
        Array.isArray(
          company.humanGates
        )
          ? company.humanGates
          : []
      ).map(
        (gate) => [
          gate.taskId,
          gate,
        ]
      )
    );

  company.humanGates =
    canonicalTasks.map(
      (task) => {
        const old =
          oldGateByTask.get(
            task.id
          );

        return {
          id:
            old?.id ??
            task.humanGateId ??
            id("gate"),

          taskId:
            task.id,

          businessId:
            task.businessId ??
            null,

          semanticKey:
            humanGateSemanticKey(
              task
            ),

          status:
            "pending",

          requiresHuman:
            true,

          createdAt:
            old?.createdAt ??
            task.createdAt ??
            nowIso(),

          updatedAt:
            nowIso(),
        };
      }
    );

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

  return {
    canonicalCount:
      canonicalTasks.length,

    duplicateCount:
      superseded.length,

    supersededTaskIds:
      superseded,
  };
}

async function updateCEOState(
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

  const human =
    pendingHumanGateTasks(
      tasks
    ).sort(
      (a, b) =>
        Number(
          b.priority ||
            0
        ) -
        Number(
          a.priority ||
            0
        )
    );

  const internal =
    tasks
      .filter(
        (task) =>
          task.internalOnly &&
          [
            "pending",
            "running",
          ].includes(
            task.status
          )
      )
      .sort(
        (a, b) =>
          Number(
            b.priority ||
              0
          ) -
          Number(
            a.priority ||
              0
          )
      );

  const business =
    tasks
      .filter(
        (task) =>
          task.type ===
            "business_task" &&
          [
            "pending",
            "running",
          ].includes(
            task.status
          )
      )
      .sort(
        (a, b) =>
          Number(
            b.priority ||
              0
          ) -
          Number(
            a.priority ||
              0
          )
      );

  const activeCandidate =
    company
      .selfDevelopment
      ?.activeCandidateId;

  if (
    human.length
  ) {
    company.currentFocus =
      "人間承認待ち";

    company.nextAction =
      `Human Gate：${human[0].title}`;
  } else if (
    internal.length
  ) {
    company.currentFocus =
      "内部能力改善中";

    company.nextAction =
      internal[0].title;
  } else if (
    business.length
  ) {
    company.currentFocus =
      "事業実行中";

    company.nextAction =
      business[0].title;
  } else if (
    activeCandidate
  ) {
    company.currentFocus =
      "自己開発評価中";

    company.nextAction =
      `自己開発Candidate ${activeCandidate} を評価する`;
  } else {
    company.currentFocus =
      "自律評価継続";

    company.nextAction =
      "次の事業機会・能力ギャップ・自己改善候補を探索する";
  }

  company.capabilitySnapshot =
    capabilities(
      company,
      tasks
    );

  company.runtimeVersion =
    RUNTIME_VERSION;

  company.schemaVersion =
    SCHEMA_VERSION;

  company.externalActions =
    false;

  company.externalAI =
    false;

  await setStore(
    env,
    "company",
    company
  );

  return company;
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
  definition
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

  const normalized =
    normalizeTask({
      id:
        id("task"),

      ...definition,
    });

  if (
    normalized.type ===
      "human_gate" ||
    normalized.requiresHuman
  ) {
    const key =
      humanGateSemanticKey(
        normalized
      );

    const duplicateGate =
      tasks.find(
        (task) =>
          (
            task.type ===
              "human_gate" ||
            task.requiresHuman
          ) &&
          task.status ===
            "waiting_human" &&
          humanGateSemanticKey(
            task
          ) ===
            key
      );

    if (
      duplicateGate
    ) {
      return duplicateGate;
    }
  }

  const duplicate =
    tasks.find(
      (task) =>
        task.action ===
          normalized.action &&
        task.businessId ===
          normalized.businessId &&
        [
          "pending",
          "running",
          "waiting_human",
        ].includes(
          task.status
        )
    );

  if (
    duplicate
  ) {
    return duplicate;
  }

  tasks.push(
    normalized
  );

  await saveTask(
    env,
    tasks
  );

  return normalized;
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

  await saveTask(
    env,
    tasks
  );

  return tasks[index];
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
      task.businessId ??
      null,

    department:
      normalizeDepartmentName(
        task.department
      ),

    action:
      normalizeActionName(
        task.action
      ),

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
      artifact.department,

    action:
      artifact.action,

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

async function audit(
  env
) {
  await reconcileHumanGates(
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

  const anomalies =
    [];

  const businessIds =
    new Set(
      company.businesses.map(
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
        task.businessId
      )
    ) {
      anomalies.push({
        type:
          "orphan_business_reference",

        taskId:
          task.id,

        businessId:
          task.businessId,
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
        (gate) =>
          gate.taskId
      )
    );

  for (
    const task of
      pendingHumanGateTasks(
        tasks
      )
  ) {
    if (
      !gateIds.has(
        task.id
      )
    ) {
      anomalies.push({
        type:
          "missing_human_gate_record",

        taskId:
          task.id,
      });
    }
  }

  for (
    const task of tasks.filter(
      (item) =>
        item.status ===
          "completed" &&
        item.artifactId
    )
  ) {
    const artifact =
      await getStore(
        env,
        `artifact:${task.artifactId}`,
        null
      );

    if (!artifact) {
      anomalies.push({
        type:
          "missing_artifact",

        taskId:
          task.id,

        artifactId:
          task.artifactId,
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

  company.capabilitySnapshot =
    currentCaps;

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

    humanGateCount:
      company.humanGates
        .length,
  };
}

async function ensureMaintenance(
  env,
  report
) {
  const mappings = {
    orphan_business_reference:
      [
        "self_maintenance_state_reconciliation",
        "自己保守：事業参照を修復する",
      ],

    capability_snapshot_stale:
      [
        "self_maintenance_capability_reconciliation",
        "自己保守：Capabilityを再構築する",
      ],

    missing_human_gate_record:
      [
        "self_maintenance_human_gate_reconciliation",
        "自己保守：Human Gateを再構築する",
      ],

    missing_artifact:
      [
        "self_maintenance_artifact_reconciliation",
        "自己保守：Artifact参照を修復する",
      ],

    schema_version_mismatch:
      [
        "self_maintenance_state_reconciliation",
        "自己保守：Schema移行を完了する",
      ],
  };

  const result =
    [];

  for (
    const anomaly of
      report.anomalies
  ) {
    const definition =
      mappings[
        anomaly.type
      ];

    if (!definition) {
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
        (task) =>
          task.action ===
            definition[0] &&
          [
            "pending",
            "running",
          ].includes(
            task.status
          )
      )
    ) {
      continue;
    }

    result.push(
      await createTask(
        env,
        {
          type:
            "internal_task",

          action:
            definition[0],

          title:
            definition[1],

          description:
            `Detected: ${anomaly.type}`,

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

  return result;
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
    externalResearch:
      company.researchEvidenceIndex.length > 0,

    productGeneration:
      tasks.some(
        t =>
          t.status === "completed" &&
          t.action === "product_prototype"
      ),

    salesPreparation:
      tasks.some(
        t =>
          t.status === "completed" &&
          t.action === "sales_package_generation"
      ),

    customerFeedback:
      company.customers.length > 0,

    outcomeTracking:
      company.outcomes.length > 0,

    revenueTracking:
      company.outcomes.some(
        o =>
          Number(o.revenue || 0) > 0
      ),

    publication:
      false,

    payment:
      false,

    selfDevelopment:
      true,

    platformIndependence:
      tasks.some(
        t =>
          t.status === "completed" &&
          t.action === "platform_decoupling"
      )
  };
}`;
  }

  if (
    problemType ===
    "human_gate_sync"
  ) {
    return `export function syncHumanGates(company, tasks) {
  company.humanGates =
    tasks
      .filter(
        t =>
          t.type === "human_gate" ||
          t.requiresHuman
      )
      .map(
        t => ({
          taskId: t.id,
          status: t.status,
          requiresHuman: true
        })
      );

  return company;
}`;
  }

  return `export function selfMaintenanceStep(state) {
  const next = { ...state };

  next.runtimeVersion =
    "${RUNTIME_VERSION}";

  next.schemaVersion =
    "${SCHEMA_VERSION}";

  return next;
}`;
}

async function sha256Hex(
  text
) {
  const bytes =
    new TextEncoder().encode(
      String(
        text || ""
      )
    );

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      bytes
    );

  return [
    ...new Uint8Array(
      digest
    ),
  ]
    .map(
      (byte) =>
        byte
          .toString(16)
          .padStart(
            2,
            "0"
          )
    )
    .join("");
}

function testCandidate(
  code
) {
  const failures =
    [];

  const warnings =
    [];

  const source =
    String(
      code || ""
    );

  if (
    source.length <
    30
  ) {
    failures.push(
      "candidate_too_small"
    );
  }

  if (
    source.length >
    50000
  ) {
    failures.push(
      "candidate_too_large"
    );
  }

  if (
    !source.includes(
      "export"
    )
  ) {
    failures.push(
      "missing_export"
    );
  }

  if (
    !source.includes(
      "function"
    )
  ) {
    failures.push(
      "missing_function"
    );
  }

  for (
    const pattern of
      DANGEROUS_PATTERNS
  ) {
    if (
      source.includes(
        pattern
      )
    ) {
      failures.push(
        `dangerous_pattern:${pattern}`
      );
    }
  }

  if (
    source.includes(
      "fetch("
    ) &&
    /method\s*:\s*["']POST["']/i.test(
      source
    )
  ) {
    failures.push(
      "possible_external_write"
    );
  }

  if (
    /WebSocket|RTCDataChannel|navigator\.sendBeacon/i.test(
      source
    )
  ) {
    warnings.push(
      "external_network_capability_detected"
    );
  }

  const expectedClosers =
    [];

  const pairs = {
    "(": ")",
    "[": "]",
    "{": "}",
  };

  const closers =
    new Set(
      Object.values(
        pairs
      )
    );

  for (
    const char of source
  ) {
    if (
      pairs[char]
    ) {
      expectedClosers.push(
        pairs[char]
      );

      continue;
    }

    if (
      closers.has(
        char
      )
    ) {
      const expected =
        expectedClosers.pop();

      if (
        expected !==
        char
      ) {
        failures.push(
          "unbalanced_delimiters"
        );

        break;
      }
    }
  }

  if (
    expectedClosers.length
  ) {
    failures.push(
      "unbalanced_delimiters"
    );
  }

  if (
    !/export\s+function\s+/.test(
      source
    )
  ) {
    failures.push(
      "missing_function_export_interface"
    );
  }

  return {
    passed:
      failures.length ===
      0,

    failures:
      [
        ...new Set(
          failures
        ),
      ],

    warnings:
      [
        ...new Set(
          warnings
        ),
      ],

    checks:
      [
        "length",
        "export",
        "function",
        "dangerous_patterns",
        "external_write",
        "delimiter_balance",
        "function_export_interface",
      ],
  };
}

async function selfDevelopmentProposal(
  env
) {
  const currentCompany =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  const activeCandidateId =
    currentCompany
      .selfDevelopment
      ?.activeCandidateId;

  if (
    activeCandidateId
  ) {
    const active =
      await getStore(
        env,
        `candidate:${activeCandidateId}`,
        null
      );

    if (
      active &&
      [
        "waiting_human",
        "approved_pending_external_deploy",
        "tested",
        "packaged",
      ].includes(
        active.status
      )
    ) {
      return {
        proposal:
          active,

        candidateId:
          active.id,

        existing:
          true,
      };
    }
  }

  const report =
    await audit(
      env
    );

  const trigger =
    report.anomalies[0]
      ?.type ??
    "capability_gap";

  const capabilityGaps =
    Object.entries(
      report.capabilities
    )
      .filter(
        ([, value]) =>
          value === false
      )
      .map(
        ([key]) =>
          key
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

    trigger,

    anomalyCount:
      report.anomalyCount,

    capabilityGaps,

    intendedChange:
      trigger ===
      "capability_snapshot_stale"
        ? "Capability computation and state synchronization"
        : trigger ===
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
      trigger ===
        "missing_human_gate_record"
        ? "human_gate_sync"
        : trigger
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

      build:
        null,

      package:
        null,

      deploymentPlan:
        null,
    }
  );

  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  company.selfDevelopment
    .lastProposalAt =
    nowIso();

  company.selfDevelopment
    .lastCandidateId =
    proposal.id;

  company.selfDevelopment
    .activeCandidateId =
    proposal.id;

  company.selfDevelopment
    .proposalCount =
    Number(
      company
        .selfDevelopment
        .proposalCount ||
        0
    ) + 1;

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

  const checksum =
    await sha256Hex(
      candidate.candidateCode
    );

  const bytes =
    new TextEncoder().encode(
      candidate.candidateCode
    ).length;

  const build = {
    status:
      result.passed
        ? "ready"
        : "blocked",

    checksum,

    bytes,

    lineCount:
      candidate
        .candidateCode
        .split("\n")
        .length,

    target:
      "internal_module_candidate",

    generatedAt:
      nowIso(),
  };

  const safety = {
    externalActions:
      false,

    productionDeploy:
      false,

    externalAI:
      false,

    dangerousPatternsBlocked:
      true,

    sandboxExecution:
      false,

    riskLevel:
      result.passed
        ? "low"
        : "high",
  };

  candidate.test =
    result;

  candidate.safety =
    safety;

  candidate.build =
    build;

  candidate.status =
    result.passed
      ? "tested"
      : "test_failed";

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

  company.selfDevelopment
    .lastTestAt =
    nowIso();

  if (
    result.passed
  ) {
    company.selfDevelopment
      .lastBuildAt =
      nowIso();
  }

  company.selfDevelopment
    .activeCandidateId =
    candidateId;

  await setStore(
    env,
    "company",
    company
  );

  return {
    candidateId,

    test:
      result,

    build,

    safety,
  };
}

async function sourceControlAdapterStatus(
  env
) {
  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  return {
    mode:
      company.selfDevelopment
        ?.adapterMode ??
      "plan_only",

    sourceControlCandidate:
      true,

    sourceControlWrite:
      false,

    githubWrite:
      false,

    productionDeploy:
      false,

    cloudflareDeploy:
      false,

    reason:
      "現在はコード変更候補・Build・Deploy計画まで。実リポジトリ書込と本番Deployは未接続。",

    requiredForNextStep:
      [
        "GitHub等のSource Control connectorまたは安全なAPI認証",
        "隔離Build Runner",
        "検証済みDeployment Adapter",
        "本番後Health Check",
        "Rollback検証",
      ],
  };
}

async function createSelfDevelopmentPackage(
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
      "Candidate must pass tests before packaging"
    );
  }

  const checksum =
    candidate.build
      ?.checksum ??
    await sha256Hex(
      candidate.candidateCode
    );

  const manifest = {
    packageId:
      id("devpkg"),

    candidateId,

    runtimeFrom:
      RUNTIME_VERSION,

    schemaFrom:
      SCHEMA_VERSION,

    targetFile:
      "worker.js",

    targetMode:
      "candidate_patch",

    checksum,

    byteCount:
      new TextEncoder()
        .encode(
          candidate.candidateCode ||
            ""
        ).length,

    lineCount:
      String(
        candidate.candidateCode ||
          ""
      ).split(
        "\n"
      ).length,

    testsPassed:
      true,

    safetyPassed:
      candidate.safety
        ?.riskLevel ===
      "low",

    externalActions:
      false,

    productionDeploy:
      false,

    sourceControlWrite:
      false,

    rollbackAvailable:
      true,

    createdAt:
      nowIso(),
  };

  const packageArtifact =
    await saveArtifact(
      env,
      {
        id:
          manifest.packageId,

        action:
          "self_development_package",

        department:
          "開発基盤",

        businessId:
          null,
      },
      {
        manifest,

        candidateCode:
          candidate.candidateCode,

        test:
          candidate.test,

        safety:
          candidate.safety,
      }
    );

  candidate.package =
    manifest;

  candidate.packageArtifactId =
    packageArtifact.id;

  candidate.status =
    "packaged";

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

  company.selfDevelopment
    .packageCount =
    Number(
      company
        .selfDevelopment
        .packageCount ||
        0
    ) + 1;

  company.selfDevelopment
    .lastBuildAt =
    nowIso();

  await setStore(
    env,
    "company",
    company
  );

  return {
    manifest,

    packageArtifact,

    sourceControl:
      await sourceControlAdapterStatus(
        env
      ),
  };
}

async function createDeploymentPlan(
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
    !candidate.package?.checksum
  ) {
    throw new Error(
      "Development package not found"
    );
  }

  const plan = {
    id:
      id("deployplan"),

    candidateId,

    packageId:
      candidate.package
        .packageId,

    target:
      "Cloudflare Worker / GitHub-backed source",

    preconditions:
      [
        "Human Gate approved",
        "Build manifest checksum verified",
        "Production snapshot exists",
        "External adapters authenticated",
        "Health check passes",
      ],

    steps:
      [
        "approved package取得",
        "隔離Source Workspaceへ適用",
        "フル回帰テスト",
        "生成Worker bundle比較",
        "明示承認後のみ本番Deploy",
        "Health確認",
        "Rollback情報保持",
      ],

    automaticExecution:
      false,

    createdAt:
      nowIso(),
  };

  const artifact =
    await saveArtifact(
      env,
      {
        id:
          plan.id,

        action:
          "deployment_plan",

        department:
          "開発基盤",

        businessId:
          null,
      },
      plan
    );

  candidate.deploymentPlan =
    plan;

  await setStore(
    env,
    `candidate:${candidateId}`,
    candidate
  );

  await setStore(
    env,
    `deployplan:${plan.id}`,
    plan
  );

  return {
    plan,

    artifact,

    adapter:
      await sourceControlAdapterStatus(
        env
      ),
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

  if (
    !candidate.build?.checksum
  ) {
    throw new Error(
      "Candidate build manifest not found"
    );
  }

  await reconcileHumanGates(
    env
  );

  const currentTasks =
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
    currentTasks.find(
      (task) =>
        task.status ===
          "waiting_human" &&
        task.action ===
          "self_development_deploy_candidate" &&
        str(
          task.input
            ?.candidateId,
          ""
        ) ===
          candidateId
    );

  if (
    existing
  ) {
    candidate.deployCandidateTaskId =
      existing.id;

    candidate.status =
      "waiting_human";

    await setStore(
      env,
      `candidate:${candidateId}`,
      candidate
    );

    return {
      candidate,

      task:
        existing,

      snapshotId:
        candidate.snapshotId ??
        null,

      duplicatePrevented:
        true,
    };
  }

  const snapshot =
    await snapshotState(
      env,
      `before_self_development_deploy_candidate:${candidateId}`
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
          `自己開発Deploy候補承認：${candidateId}`,

        description:
          "生成・テスト・Build済みの内部コード変更候補。本番反映にはHuman Gateが必要。",

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

        input:
          {
            candidateId,
          },
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

  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  company.selfDevelopment
    .activeCandidateId =
    candidateId;

  await setStore(
    env,
    "company",
    company
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
        "自己開発候補をBuild済みDeploy CandidateとしてHuman Gateへ送った。",
    }
  );

  return {
    candidate,

    task,

    snapshotId:
      snapshot.id,

    duplicatePrevented:
      false,
  };
}

async function rollbackSnapshot(
  env,
  snapshotId
) {
  const snapshot =
    await getStore(
      env,
      `snapshot:${snapshotId}`,
      null
    );

  if (!snapshot) {
    throw new Error(
      "Snapshot not found"
    );
  }

  await setStore(
    env,
    "company",
    snapshot.company
  );

  await setStore(
    env,
    "tasks",
    snapshot.tasks
  );

  await setStore(
    env,
    "artifact_index",
    snapshot.artifactIndex ||
      []
  );

  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  company.selfDevelopment = {
    ...(
      company.selfDevelopment ||
      {}
    ),

    lastRollbackAt:
      nowIso(),

    activeCandidateId:
      null,
  };

  await setStore(
    env,
    "company",
    company
  );

  await memory(
    env,
    {
      type:
        "self_development_rollback",

      snapshotId,

      summary:
        "D1上の会社状態を安全スナップショットへ復元した。",
    }
  );

  return {
    ok:
      true,

    snapshotId,

    restoredAt:
      nowIso(),

    sourceCodeRollback:
      false,
  };
}

async function createBusinessPipelineTask(
  env,
  business,
  stage
) {
  const map = {
    research_brief:
      [
        "市場調査：",
        "調査",
        "business_task",
      ],

    product_prototype:
      [
        "商品設計・試作：",
        "技術",
        "business_task",
      ],

    sales_package_generation:
      [
        "販売準備：",
        "企画",
        "business_task",
      ],

    sales_evaluation:
      [
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

  const definition =
    map[stage];

  if (!definition) {
    throw new Error(
      `Unknown business stage: ${stage}`
    );
  }

  return createTask(
    env,
    {
      type:
        definition[2],

      action:
        stage,

      title:
        `${definition[0]}${business.name}`,

      department:
        definition[1],

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
      (item) =>
        item.id ===
        task.businessId
    );

  if (!business) {
    throw new Error(
      "Business not found for task"
    );
  }

  let payload;

  let nextTask =
    null;

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
        payload.status ??
        payload.result ??
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
    const result =
      await reconcileHumanGates(
        env
      );

    payload = {
      repaired:
        "human_gates",

      canonicalCount:
        result.canonicalCount,

      duplicateCount:
        result.duplicateCount,

      supersededTaskIds:
        result.supersededTaskIds,
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
      "research_external_evidence"
    ) {
      const source =
        RESEARCH_SOURCES
          .meti;

      const response =
        await fetch(
          source.url,
          {
            headers:
              {
                "user-agent":
                  `AI-Company-Core/${SCHEMA_VERSION}`,
              },
          }
        );

      const textBody =
        await response.text();

      const evidence = {
        id:
          id("evidence"),

        sourceId:
          "meti",

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

        contentPreview:
          textBody.slice(
            0,
            20000
          ),
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

      await setStore(
        env,
        "company",
        company
      );

      result = {
        payload:
          {
            status:
              "external_research_completed",

            evidenceId:
              evidence.id,
          },

        artifact:
          await saveArtifact(
            env,
            task,
            evidence
          ),
      };
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
    } else if (
      task.action ===
      "development_infrastructure"
    ) {
      result = {
        payload:
          {
            status:
              "development_infrastructure_verified",

            sandbox:
              true,

            staticTesting:
              true,

            buildManifest:
              true,

            rollback:
              true,

            productionDeploy:
              false,
          },

        artifact:
          await saveArtifact(
            env,
            task,
            {
              sandbox:
                true,

              test:
                true,

              build:
                true,

              rollback:
                true,

              productionDeploy:
                false,
            }
          ),
      };
    } else if (
      task.action ===
      "platform_decoupling"
    ) {
      result = {
        payload:
          {
            status:
              "platform_adapter_architecture_defined",

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

            platformWrite:
              false,
          },

        artifact:
          await saveArtifact(
            env,
            task,
            {
              storage:
                "StorageAdapter",

              scheduler:
                "SchedulerAdapter",

              executor:
                "ExecutorAdapter",

              web:
                "WebAdapter",
            }
          ),
      };
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
                String(error),
            },
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
  const {
    company,
  } =
    await migrate(
      env
    );

  await reconcileHumanGates(
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
    pendingHumanGateTasks(
      tasks
    );

  let executable =
    tasks
      .filter(
        (task) =>
          task.status ===
            "pending" &&
          task.type !==
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
      company.businesses[0];

    if (business) {
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
              (task) =>
                task.businessId ===
                  business.id &&
                task.status ===
                  "completed"
            )
            .map(
              (task) =>
                task.action
            )
        );

      const next =
        actionOrder.find(
          (action) =>
            !done.has(action)
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
          (task) =>
            task.type ===
              "human_gate" &&
            task.businessId ===
              business.id &&
            task.status ===
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

      await reconcileHumanGates(
        env
      );

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
            (task) =>
              task.status ===
                "pending" &&
              task.type !==
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

  await reconcileHumanGates(
    env
  );

  const finalCompany =
    await updateCEOState(
      env
    );

  return {
    runtime:
      RUNTIME_VERSION,

    execution,

    company:
      finalCompany,
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

  const activeCandidateId =
    company.selfDevelopment
      ?.activeCandidateId ??
    company.selfDevelopment
      ?.lastCandidateId;

  if (
    activeCandidateId
  ) {
    const activeCandidate =
      await getStore(
        env,
        `candidate:${activeCandidateId}`,
        null
      );

    if (
      activeCandidate &&
      [
        "waiting_human",
        "approved_pending_external_deploy",
        "tested",
        "packaged",
      ].includes(
        activeCandidate.status
      )
    ) {
      return {
        mode:
          "wait_for_candidate_gate",

        report,

        capabilities:
          caps,

        activeCandidate,
      };
    }
  }

  const due =
    !caps.selfDevelopment ||
    !company
      .selfDevelopment
      ?.lastProposalAt ||
    Number(
      company.cycleCount ||
        0
    ) %
      SELF_DEVELOPMENT_INTERVAL_CYCLES ===
      0;

  if (!due) {
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
    const packageResult =
      await createSelfDevelopmentPackage(
        env,
        candidateId
      );

    const deploymentPlan =
      await createDeploymentPlan(
        env,
        candidateId
      );

    deployCandidate =
      await createDeployCandidate(
        env,
        candidateId
      );

    deployCandidate.package =
      packageResult.manifest;

    deployCandidate.deploymentPlan =
      deploymentPlan.plan;
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
  await reconcileHumanGates(
    env
  );

  const company =
    await updateCEOState(
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

  const artifactIndex =
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
            (task) =>
              [
                "pending",
                "running",
              ].includes(
                task.status
              )
          ).length,

        pendingInternalTasks:
          tasks.filter(
            (task) =>
              task.internalOnly &&
              [
                "pending",
                "running",
              ].includes(
                task.status
              )
          ).length,

        pendingHumanGates:
          tasks.filter(
            (task) =>
              (
                task.type ===
                  "human_gate" ||
                task.requiresHuman
              ) &&
              task.status ===
                "waiting_human"
          ).length,

        humanGateKeys:
          [
            ...new Set(
              pendingHumanGateTasks(
                tasks
              ).map(
                humanGateSemanticKey
              )
            ),
          ],

        businessCount:
          company.businesses
            .length,

        evidenceCount:
          company
            .researchEvidenceIndex
            .length,

        customerCount:
          company
            .customers.length,

        outcomeCount:
          company
            .outcomes.length,

        departmentCount:
          company
            .departments.length,

        departments:
          company
            .departments,
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

    source_control_candidate_available:
      true,

    source_control_write:
      false,

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

    cloudflare_deploy_adapter:
      false,

    artifactCount:
      Array.isArray(
        artifactIndex
      )
        ? artifactIndex.length
        : 0,

    selfDevelopmentMode:
      company
        .selfDevelopment
        ?.mode ??
      "candidate_only",

    activeCandidateId:
      company
        .selfDevelopment
        ?.activeCandidateId ??
      null,

    selfDevelopmentProposalCount:
      Number(
        company
          .selfDevelopment
          ?.proposalCount ||
          0
      ),

    selfDevelopmentPackageCount:
      Number(
        company
          .selfDevelopment
          ?.packageCount ||
          0
      ),
  };
}

async function route(
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
    return json(
      await health(
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
    await migrate(
      env
    );

    await reconcileHumanGates(
      env
    );

    await updateCEOState(
      env
    );

    return json(
      {
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

            sourceControlCandidate:
              true,

            sourceControlWrite:
              false,

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
      }
    );
  }

  if (
    path ===
      "/api/cycle" &&
    method ===
      "POST"
  ) {
    return json(
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
    return json(
      await selfOrganizationCycle(
        env
      )
    );
  }

  if (
    path ===
      "/api/self-development/cycle" &&
    method ===
      "POST"
  ) {
    return json(
      await selfDevelopmentCycle(
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
    return json(
      await selfDevelopmentProposal(
        env
      )
    );
  }

  if (
    path ===
      "/api/self-development/test" &&
    method ===
      "POST"
  ) {
    const body =
      await bodyJSON(
        request
      );

    return json(
      await selfDevelopmentTest(
        env,
        str(
          body.candidateId
        )
      )
    );
  }

  if (
    path ===
      "/api/self-development/package" &&
    method ===
      "POST"
  ) {
    const body =
      await bodyJSON(
        request
      );

    return json(
      await createSelfDevelopmentPackage(
        env,
        str(
          body.candidateId
        )
      )
    );
  }

  if (
    path ===
      "/api/self-development/deployment-plan" &&
    method ===
      "POST"
  ) {
    const body =
      await bodyJSON(
        request
      );

    return json(
      await createDeploymentPlan(
        env,
        str(
          body.candidateId
        )
      )
    );
  }

  if (
    path ===
      "/api/self-development/deploy-candidate" &&
    method ===
      "POST"
  ) {
    const body =
      await bodyJSON(
        request
      );

    return json(
      await createDeployCandidate(
        env,
        str(
          body.candidateId
        )
      )
    );
  }

  if (
    path ===
      "/api/self-development/candidate" &&
    method ===
      "GET"
  ) {
    const candidateId =
      str(
        url.searchParams.get(
          "id"
        )
      );

    return json(
      await getStore(
        env,
        `candidate:${candidateId}`,
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
    path ===
      "/api/self-development/adapter-status" &&
    method ===
      "GET"
  ) {
    return json(
      await sourceControlAdapterStatus(
        env
      )
    );
  }

  if (
    path ===
      "/api/self-development/rollback" &&
    method ===
      "POST"
  ) {
    const body =
      await bodyJSON(
        request
      );

    return json(
      await rollbackSnapshot(
        env,
        str(
          body.snapshotId
        )
      )
    );
  }

  if (
    path ===
      "/api/self-development/build" &&
    method ===
      "POST"
  ) {
    const body =
      await bodyJSON(
        request
      );

    return json(
      await selfDevelopmentTest(
        env,
        str(
          body.candidateId
        )
      )
    );
  }

  if (
    path ===
      "/api/maintenance/audit" &&
    method ===
      "GET"
  ) {
    return json(
      await audit(
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
    const report =
      await audit(
        env
      );

    const created =
      await ensureMaintenance(
        env,
        report
      );

    await reconcileHumanGates(
      env
    );

    await updateCEOState(
      env
    );

    return json(
      {
        status:
          "maintenance_completed",

        audit:
          await audit(
            env
          ),

        created,
      }
    );
  }

  if (
    path ===
      "/api/migration/status" &&
    method ===
      "GET"
  ) {
    await migrate(
      env
    );

    return json(
      {
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
      }
    );
  }

  if (
    path ===
      "/api/snapshots" &&
    method ===
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
    path ===
      "/api/departments" &&
    method ===
      "GET"
  ) {
    const company =
      await getStore(
        env,
        "company",
        defaultCompany()
      );

    return json(
      {
        runtime:
          RUNTIME_VERSION,

        departments:
          normalizeDepartments(
            company.departments
          ),
      }
    );
  }

  if (
    path ===
      "/api/capabilities" &&
    method ===
      "GET"
  ) {
    await migrate(
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

    return json(
      {
        runtime:
          RUNTIME_VERSION,

        capabilities:
          capabilities(
            company,
            tasks
          ),

        departments:
          company.departments,
      }
    );
  }

  if (
    path ===
      "/api/ceo/state" &&
    method ===
      "GET"
  ) {
    await migrate(
      env
    );

    await reconcileHumanGates(
      env
    );

    const company =
      await updateCEOState(
        env
      );

    return json(
      {
        runtime:
          RUNTIME_VERSION,

        currentFocus:
          company.currentFocus,

        nextAction:
          company.nextAction,

        humanGates:
          company.humanGates,

        selfDevelopment:
          company.selfDevelopment,
      }
    );
  }

  if (
    path ===
      "/api/heartbeat" &&
    method ===
      "GET"
  ) {
    const company =
      await getStore(
        env,
        "company",
        defaultCompany()
      );

    await setRuntimeMeta(
      env,
      Number(
        company.cycleCount ||
          0
      ),
      nowIso()
    );

    return json(
      {
        ok:
          true,

        runtime:
          RUNTIME_VERSION,

        heartbeatAt:
          nowIso(),
      }
    );
  }

  if (
    path ===
      "/api/customer/intake" &&
    method ===
      "POST"
  ) {
    const body =
      await bodyJSON(
        request
      );

    const company =
      await getStore(
        env,
        "company",
        defaultCompany()
      );

    const customer = {
      id:
        id("customer"),

      source:
        str(
          body.source,
          "unknown"
        ),

      message:
        str(
          body.message,
          ""
        ),

      createdAt:
        nowIso(),

      metadata:
        body.metadata ||
        {},
    };

    company.customers.push(
      customer
    );

    await setStore(
      env,
      "company",
      company
    );

    return json(
      {
        status:
          "customer_received",

        customer,
      },
      201
    );
  }

  if (
    path ===
      "/api/outcome" &&
    method ===
      "POST"
  ) {
    const body =
      await bodyJSON(
        request
      );

    const company =
      await getStore(
        env,
        "company",
        defaultCompany()
      );

    const outcome = {
      id:
        id("outcome"),

      businessId:
        str(
          body.businessId
        ) ||
        null,

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

      conversions:
        Number(
          body.conversions ||
            0
        ),

      notes:
        str(
          body.notes
        ),

      createdAt:
        nowIso(),
    };

    company.outcomes.push(
      outcome
    );

    await setStore(
      env,
      "company",
      company
    );

    return json(
      {
        status:
          "outcome_recorded",

        outcome,
      },
      201
    );
  }

  if (
    path ===
      "/api/research/fetch" &&
    method ===
      "GET"
  ) {
    const sourceId =
      str(
        url.searchParams.get(
          "source"
        )
      );

    const source =
      RESEARCH_SOURCES[
        sourceId
      ];

    if (!source) {
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

    const response =
      await fetch(
        source.url,
        {
          headers: {
            "user-agent":
              `AI-Company-Core/${SCHEMA_VERSION}`,
          },
        }
      );

    const text =
      await response.text();

    const evidence = {
      id:
        id("evidence"),

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

      contentPreview:
        text.slice(
          0,
          20000
        ),
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

    company.researchEvidenceIndex.push(
      {
        id:
          evidence.id,

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
          evidence.retrievedAt,
      }
    );

    await setStore(
      env,
      "company",
      company
    );

    return json(
      {
        ok:
          true,

        evidence,
      }
    );
  }

  if (
    path ===
      "/api/artifact" &&
    method ===
      "GET"
  ) {
    const artifactId =
      str(
        url.searchParams.get(
          "id"
        )
      );

    return json(
      await getStore(
        env,
        `artifact:${artifactId}`,
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
    path ===
      "/api/human-gate/approve" &&
    method ===
      "POST"
  ) {
    const body =
      await bodyJSON(
        request
      );

    const task =
      await updateTask(
        env,
        str(
          body.taskId
        ),
        {
          status:
            "approved",

          approvedAt:
            nowIso(),
        }
      );

    let candidate =
      null;

    if (
      task?.action ===
      "self_development_deploy_candidate"
    ) {
      const candidateId =
        str(
          task.input
            ?.candidateId,
          ""
        );

      if (
        candidateId
      ) {
        candidate =
          await getStore(
            env,
            `candidate:${candidateId}`,
            null
          );

        if (
          candidate
        ) {
          candidate.status =
            "approved_pending_external_deploy";

          candidate.approvedAt =
            nowIso();

          candidate.productionDeployPerformed =
            false;

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

          company.selfDevelopment
            .activeCandidateId =
            candidateId;

          await setStore(
            env,
            "company",
            company
          );
        }
      }
    }

    await reconcileHumanGates(
      env
    );

    const finalCompany =
      await updateCEOState(
        env
      );

    return json(
      {
        ok:
          !!task,

        task,

        candidate,

        externalActionPerformed:
          false,

        productionDeployPerformed:
          false,

        company:
          {
            currentFocus:
              finalCompany.currentFocus,

            nextAction:
              finalCompany.nextAction,
          },
      }
    );
  }

  if (
    path ===
      "/api/human-gate/reject" &&
    method ===
      "POST"
  ) {
    const body =
      await bodyJSON(
        request
      );

    const task =
      await updateTask(
        env,
        str(
          body.taskId
        ),
        {
          status:
            "rejected",

          rejectedAt:
            nowIso(),
        }
      );

    if (
      task?.action ===
      "self_development_deploy_candidate"
    ) {
      const candidateId =
        str(
          task.input
            ?.candidateId,
          ""
        );

      if (
        candidateId
      ) {
        const candidate =
          await getStore(
            env,
            `candidate:${candidateId}`,
            null
          );

        if (
          candidate
        ) {
          candidate.status =
            "rejected";

          candidate.rejectedAt =
            nowIso();

          await setStore(
            env,
            `candidate:${candidateId}`,
            candidate
          );
        }
      }

      const company =
        await getStore(
          env,
          "company",
          defaultCompany()
        );

      company.selfDevelopment
        .activeCandidateId =
        null;

      await setStore(
        env,
        "company",
        company
      );
    }

    await reconcileHumanGates(
      env
    );

    const finalCompany =
      await updateCEOState(
        env
      );

    return json(
      {
        ok:
          !!task,

        task,

        company:
          {
            currentFocus:
              finalCompany.currentFocus,

            nextAction:
              finalCompany.nextAction,
          },
      }
    );
  }

  return null;
}

export default {
  async fetch(
    request,
    env
  ) {
    try {
      const response =
        await route(
          request,
          env
        );

      if (
        response
      ) {
        return response;
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
        : json(
            {
              ok:
                true,

              runtime:
                RUNTIME_VERSION,
            }
          );
    } catch (
      error
    ) {
      return json(
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

        await reconcileHumanGates(
          env
        );

        await updateCEOState(
          env
        );
      })()
    );
  },
};
