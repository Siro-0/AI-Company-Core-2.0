const RUNTIME_VERSION = "7.0.2-self-evolving-company-os-free-only";
const SCHEMA_VERSION = "7.0.2";

const SECURITY_POLICY = Object.freeze({
  internalAutonomy: true,
  externalActions: false,
  externalCompanyIntegration: false,
  externalAI: false,
  physicalActuation: false,
  regulatedOperations: false,

  paymentAutonomy: false,
  paidResourceAutonomy: false,
  autoUpgrade: false,
  maxSpend: 0,

  sourceControlWrite: false,
  productionDeploy: false,

  customerGateway: false,
  outcomeGateway: false,

  publicControlPlane: false,
  requireOwnerTokenForControl: true,

  freeOnlyMode: true,
  maxEstimatedCost: 0,

  paidResourcesDenied: true,

  financialAdaptersEnabled: false,
  physicalAdaptersEnabled: false,
  externalAdaptersEnabled: false,

  candidateMayChangeSecurityPolicy: false,
});

const CONTROL_TOKEN_ENV = "OWNER_CONTROL_TOKEN";

const FREE_ONLY_MODE = true;
const MAX_ESTIMATED_COST = 0;

const MAX_BODY_BYTES = 64 * 1024;

const LOCK_TTL_MS = 55_000;

const SELF_DEVELOPMENT_INTERVAL_CYCLES = 3;
const AUTONOMY_PLANNING_INTERVAL_CYCLES = 2;

const MAX_AUTONOMOUS_TASKS_PER_CYCLE = 2;

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
    mission:
      "Storage / Scheduler / Executor / Web の依存を分離する。",
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

  'method:"POST"',
  "method: 'POST'",

  'method:"PUT"',
  "method: 'PUT'",

  'method:"PATCH"',
  "method: 'PATCH'",

  'method:"DELETE"',
  "method: 'DELETE'",

  "navigator.sendBeacon(",
];

function nowIso() {
  return new Date().toISOString();
}

function id(prefix = "id") {
  const raw =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 9)}`;

  return `${prefix}_${raw}`;
}

function str(value, fallback = "") {
  return typeof value === "string"
    ? value.trim()
    : fallback;
}

function json(data, status = 200, extraHeaders = {}) {
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
          "Content-Type, Authorization, X-Owner-Token",

        "cache-control": "no-store",

        ...extraHeaders,
      },
    }
  );
}

async function bodyJSON(req) {
  const length = Number(
    req.headers.get("content-length") || 0
  );

  if (length > MAX_BODY_BYTES) {
    throw new Error("request_body_too_large");
  }

  try {
    return await req.json();
  } catch {
    return {};
  }
}

function unauthorized() {
  return json(
    {
      ok: false,
      error: "owner_authorization_required",
    },
    401
  );
}

async function sha256Text(value) {
  const bytes =
    new TextEncoder().encode(
      String(value ?? "")
    );

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      bytes
    );

  return new Uint8Array(digest);
}

async function secureEqual(a, b) {
  const aa = await sha256Text(a);
  const bb = await sha256Text(b);

  if (aa.length !== bb.length) {
    return false;
  }

  let diff = 0;

  for (let i = 0; i < aa.length; i += 1) {
    diff |= aa[i] ^ bb[i];
  }

  return diff === 0;
}

async function requireOwner(req, env) {
  if (
    !SECURITY_POLICY.requireOwnerTokenForControl
  ) {
    return true;
  }

  const expected = str(
    env[CONTROL_TOKEN_ENV],
    ""
  );

  if (!expected) {
    return false;
  }

  const supplied = str(
    req.headers.get("authorization") ||
      req.headers.get("x-owner-token"),
    ""
  );

  const token =
    supplied
      .toLowerCase()
      .startsWith("bearer ")
      ? supplied.slice(7).trim()
      : supplied;

  return (
    Boolean(token) &&
    (await secureEqual(token, expected))
  );
}

function isForbiddenExternalOrPhysicalTask(task) {
  const blob = [
    task?.action,
    task?.title,
    task?.description,
    task?.input?.purpose,
    task?.input?.operation,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const blocked = [
    "payment",
    "payout",
    "withdraw",
    "transfer",
    "bank",
    "stripe",
    "paypal",

    "請求",
    "決済",
    "送金",
    "口座",

    "billing",
    "subscription",
    "upgrade",
    "premium",
    "paid",
    "charge",

    "課金",
    "有料",
    "プラン変更",

    "contract",
    "agreement",
    "契約",
    "締結",
    "purchase_order",
    "発注",

    "email",
    "mail",
    "dm",
    "slack",
    "discord",
    "telegram",

    "営業メール",
    "連絡",

    "truck",
    "vehicle",
    "robot",
    "drone",
    "construction",
    "excavator",
    "factory",
    "warehouse",

    "建築",
    "重機",
    "車両",
    "配送",
    "倉庫",
    "工場",
    "ロボット",
    "ドローン",
  ];

  return (
    blocked.some((x) =>
      blob.includes(x)
    ) ||
    task?.externalAction === true
  );
}

function assertInternalTaskPolicy(task) {
  if (!task) {
    throw new Error("task_required");
  }

  const estimatedCost = Number(
    task.estimatedCost ??
      task.cost ??
      task.budget ??
      0
  );

  if (
    !Number.isFinite(estimatedCost) ||
    estimatedCost < 0
  ) {
    throw new Error(
      "invalid_cost_policy_value"
    );
  }

  if (
    FREE_ONLY_MODE &&
    estimatedCost > MAX_ESTIMATED_COST
  ) {
    throw new Error(
      "paid_resource_blocked_by_free_only_policy"
    );
  }

  if (
    task.paymentRequired === true ||
    task.paidResource === true ||
    task.requiresPayment === true
  ) {
    throw new Error(
      "paid_resource_blocked_by_free_only_policy"
    );
  }

  if (
    task.autoUpgrade === true ||
    task.accountUpgrade === true
  ) {
    throw new Error(
      "account_upgrade_blocked_by_policy"
    );
  }

  if (
    task.externalAction === true &&
    !(
      task.type === "human_gate" &&
      task.requiresHuman === true
    )
  ) {
    throw new Error(
      "external_action_blocked_by_policy"
    );
  }

  if (
    isForbiddenExternalOrPhysicalTask(task)
  ) {
    if (
      !(
        task.type === "human_gate" &&
        task.requiresHuman === true
      )
    ) {
      throw new Error(
        "external_or_physical_operation_blocked_by_policy"
      );
    }
  }
}

async function acquireLock(
  env,
  name,
  owner,
  ttlMs = LOCK_TTL_MS
) {
  const now = Date.now();

  const expires = now + ttlMs;

  const result =
    await env.DB.prepare(`
      INSERT INTO runtime_locks(
        name,
        owner,
        acquired_at,
        expires_at
      )
      VALUES(?,?,?,?)

      ON CONFLICT(name)
      DO UPDATE SET
        owner=excluded.owner,
        acquired_at=excluded.acquired_at,
        expires_at=excluded.expires_at

      WHERE runtime_locks.expires_at <= ?
    `)
      .bind(
        name,
        owner,
        new Date(now).toISOString(),
        new Date(
          expires
        ).toISOString(),
        new Date(
          now
        ).toISOString()
      )
      .run();

  return (
    Number(
      result?.meta?.changes || 0
    ) > 0
  );
}

async function releaseLock(
  env,
  name,
  owner
) {
  await env.DB.prepare(
    "DELETE FROM runtime_locks WHERE name=? AND owner=?"
  )
    .bind(name, owner)
    .run();
}

async function withLock(
  env,
  name,
  fn
) {
  const owner = id("lock");

  if (
    !(await acquireLock(
      env,
      name,
      owner
    ))
  ) {
    return {
      status: "lock_busy",
      lock: name,
    };
  }

  try {
    return await fn();
  } finally {
    await releaseLock(
      env,
      name,
      owner
    );
  }
}

async function safeResearchFetch(
  sourceId
) {
  const src =
    RESEARCH_SOURCES[sourceId];

  if (!src) {
    throw new Error(
      "unknown_research_source"
    );
  }

  const url = new URL(
    src.url
  );

  const allowedHosts =
    new Set(
      Object.values(
        RESEARCH_SOURCES
      ).map(
        (x) =>
          new URL(x.url)
            .hostname
      )
    );

  if (
    !allowedHosts.has(
      url.hostname
    ) ||
    url.protocol !== "https:"
  ) {
    throw new Error(
      "research_source_not_allowlisted"
    );
  }

  const response =
    await fetch(
      url.toString(),
      {
        method: "GET",
        headers: {
          "user-agent":
            "AI-Company-Core/7.0.2",
        },
      }
    );

  return {
    response,
    source: src,
  };
}

async function getStore(
  env,
  key,
  fallback = null
) {
  const row =
    await env.DB.prepare(
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
  await env.DB.prepare(`
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
  `)
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
    await env.DB.prepare(
      "SELECT last_heartbeat_at FROM runtime_meta WHERE id=1 LIMIT 1"
    ).first();

  const value =
    heartbeat ??
    current?.last_heartbeat_at ??
    null;

  await env.DB.prepare(`
    UPDATE runtime_meta
    SET
      last_heartbeat_at=?,
      cycle_count=?,
      runtime_version=?
    WHERE id=1
  `)
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
        ...items,
      ]
        .map((x) => str(x))
        .filter(Boolean)
    ),
  ];
}

function normalizeTask(t) {
  const x =
    t && typeof t === "object"
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

    type: str(
      x.type,
      x.requiresHuman
        ? "human_gate"
        : "internal_task"
    ),

    action: str(
      x.action,
      x.executor ??
        "internal_analysis"
    ),

    title: str(
      x.title,
      "内部タスク"
    ),

    description: str(
      x.description,
      ""
    ),

    department: str(
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
      x.externalAction === true,

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
      typeof x.pipeline === "object"
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
    b && typeof b === "object"
      ? { ...b }
      : {};

  return {
    ...x,

    id:
      str(x.id) ||
      id("business"),

    name: str(
      x.name ?? x.title,
      "未定義事業"
    ),

    problem: str(
      x.problem,
      ""
    ),

    target: str(
      x.target ?? x.customer,
      ""
    ),

    value: str(
      x.value,
      ""
    ),

    status: str(
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
    securityPolicy: {
      ...SECURITY_POLICY,
    },

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

      adapterMode:
        "plan_only",

      sourceControlCandidate:
        true,

      sourceControlWrite:
        false,

      buildVerification:
        false,

      buildVerificationMode:
        "static_manifest",

      deployCandidate:
        true,

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

      activeReleaseId:
        null,

      proposalCount:
        0,

      packageCount:
        0,

      buildCount:
        0,

      releaseCount:
        0,

      sourceControlPlanCount:
        0,

      healthCheckCount:
        0,

      lastHealthCheckAt:
        null,

      lastHealthCheckOk:
        null,
    },
  };
}

async function listStoreRows(
  env,
  likePattern
) {
  const result =
    await env.DB.prepare(
      "SELECT key, value_json FROM company_store WHERE key LIKE ? ORDER BY updated_at DESC"
    )
      .bind(likePattern)
      .all();

  return (
    result.results || []
  ).map((row) => {
    try {
      return {
        key: row.key,
        value: JSON.parse(
          row.value_json
        ),
      };
    } catch {
      return {
        key: row.key,
        value: null,
      };
    }
  });
}

async function reconcileSelfDevelopmentLedger(
  env
) {
  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  const proposals =
    await listStoreRows(
      env,
      "proposal:%"
    );

  const candidates =
    await listStoreRows(
      env,
      "candidate:%"
    );

  const releases =
    await listStoreRows(
      env,
      "release:%"
    );

  const buildManifests =
    await listStoreRows(
      env,
      "build:%"
    );

  const healthChecks =
    await listStoreRows(
      env,
      "healthcheck:%"
    );

  const candidateValues =
    candidates
      .map((x) => x.value)
      .filter(Boolean);

  const releaseValues =
    releases
      .map((x) => x.value)
      .filter(Boolean);

  const buildValues =
    buildManifests
      .map((x) => x.value)
      .filter(Boolean);

  const healthValues =
    healthChecks
      .map((x) => x.value)
      .filter(Boolean);

  const lastByTime =
    (items, field) =>
      [
        ...items,
      ].sort(
        (a, b) =>
          String(
            b?.[field] ??
              b?.createdAt ??
              ""
          ).localeCompare(
            String(
              a?.[field] ??
                a?.createdAt ??
                ""
            )
          )
      )[0] || null;

  const tested =
    candidateValues.filter(
      (x) => x.test?.passed
    );

  const built =
    candidateValues.filter(
      (x) =>
        x.build?.verification
          ?.passed ||
        x.build?.status ===
          "passed"
    );

  const active =
    candidateValues.find(
      (x) =>
        x.status ===
          "waiting_human" ||
        x.status ===
          "approved_pending_external_deploy" ||
        x.status ===
          "approved_for_deploy"
    );

  const latestCandidate =
    lastByTime(
      candidateValues,
      "updatedAt"
    ) ||
    lastByTime(
      candidateValues,
      "createdAt"
    );

  const latestProposal =
    lastByTime(
      proposals
        .map((x) => x.value)
        .filter(Boolean),
      "createdAt"
    );

  const latestRelease =
    lastByTime(
      releaseValues,
      "createdAt"
    );

  const latestBuild =
    lastByTime(
      buildValues,
      "createdAt"
    );

  const latestHealth =
    lastByTime(
      healthValues,
      "createdAt"
    );

  company.selfDevelopment = {
    ...(company.selfDevelopment ||
      {}),

    mode:
      "candidate_only",

    adapterMode:
      "plan_only",

    sourceControlCandidate:
      true,

    sourceControlWrite:
      false,

    buildVerification:
      built.length > 0,

    buildVerificationMode:
      "static_manifest",

    deployCandidate:
      true,

    productionDeploy:
      false,

    proposalCount:
      proposals.length,

    packageCount:
      releaseValues.length,

    buildCount:
      buildValues.length,

    releaseCount:
      releaseValues.length,

    sourceControlPlanCount:
      Number(
        (
          company
            .selfDevelopment ||
          {}
        ).sourceControlPlanCount ||
          0
      ),

    healthCheckCount:
      healthValues.length,

    lastProposalAt:
      latestProposal?.createdAt ||
      company.selfDevelopment
        .lastProposalAt ||
      null,

    lastTestAt:
      lastByTime(
        tested,
        "testedAt"
      )?.testedAt ||
      company.selfDevelopment
        .lastTestAt ||
      null,

    lastBuildAt:
      latestBuild?.createdAt ||
      company.selfDevelopment
        .lastBuildAt ||
      null,

    lastCandidateId:
      latestCandidate?.id ||
      company.selfDevelopment
        .lastCandidateId ||
      null,

    activeCandidateId:
      active?.id ||
      company.selfDevelopment
        .activeCandidateId ||
      null,

    activeReleaseId:
      latestRelease?.id ||
      company.selfDevelopment
        .activeReleaseId ||
      null,

    lastHealthCheckAt:
      latestHealth?.createdAt ||
      company.selfDevelopment
        .lastHealthCheckAt ||
      null,

    lastHealthCheckOk:
      latestHealth
        ? latestHealth.ok === true
        : (
            company
              .selfDevelopment
              .lastHealthCheckOk ??
            null
          ),
  };

  if (
    latestCandidate?.id &&
    !company.selfDevelopment
      .lastCandidateId
  ) {
    company.selfDevelopment
      .lastCandidateId =
      latestCandidate.id;
  }

  company.runtimeVersion =
    RUNTIME_VERSION;

  company.schemaVersion =
    SCHEMA_VERSION;

  await setStore(
    env,
    "company",
    company
  );

  return {
    company,

    counts: {
      proposals:
        proposals.length,

      candidates:
        candidates.length,

      tested:
        tested.length,

      built:
        built.length,

      releases:
        releases.length,

      buildManifests:
        buildManifests.length,

      healthChecks:
        healthChecks.length,
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
    id: snapshot.id,
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
    id: id("memory"),
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

async function migrate(env) {
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
      )
    ).map(normalizeTask);

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
        ?.lastRunAt ?? null,

    version:
      company.migration
        ?.version ?? null,

    businessAliases:
      company.migration
        ?.businessAliases ?? {},

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
        ?.lastAuditAt ?? null,

    lastRepairAt:
      company.maintenance
        ?.lastRepairAt ?? null,

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
      company.businesses.slice(1)
  ) {
    if (
      b.name &&
      byName.get(
        b.name.toLowerCase()
      ) === canonical.id
    ) {
      company.migration
        .businessAliases[b.id] =
        canonical.id;
    }
  }

  const aliases =
    company.migration
      .businessAliases;

  for (const t of tasks) {
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

  tasks = [
    ...new Map(
      tasks.map(
        (t) => [t.id, t]
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

  company.securityPolicy = {
    ...SECURITY_POLICY,
  };

  company.migration.lastRunAt =
    nowIso();

  company.migration.version =
    SCHEMA_VERSION;

  await setStore(
    env,
    "company",
    company
  );

  await reconcileSelfDevelopmentLedger(
    env
  );

  company =
    await getStore(
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
      company.customers.length > 0,

    outcomeTracking:
      company.outcomes.length > 0,

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
      ) ||
      company
        .platformIndependenceState
        ?.decoupled === true,

    sourceControlCandidate:
      true,

    sourceControlWrite:
      false,

    buildVerification:
      company
        .selfDevelopment
        ?.buildVerification ===
      true,

    rollback:
      true,

    deployCandidate:
      true,

    productionDeploy:
      false,

    customerGateway:
      SECURITY_POLICY
        .customerGateway,

    outcomeGateway:
      SECURITY_POLICY
        .outcomeGateway,

    autonomousPlanning:
      true,

    selfHealing:
      true,

    capabilitySynthesis:
      true,
  };
}function humanGateSemanticKey(
  task
) {
  const action =
    str(
      task.action,
      "human_gate"
    );

  if (
    action ===
    "self_development_deploy_candidate"
  ) {
    const candidateId =
      str(
        task.input?.candidateId,
        ""
      ) ||
      (
        task.title.match(
          /(proposal_[A-Za-z0-9_-]+)/
        )?.[1] ||
        ""
      );

    return `selfdev:${
      candidateId ||
      task.id
    }`;
  }

  if (
    action ===
      "human_gate_publication" ||
    action ===
      "ヒューマンゲート" ||
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
    (t) =>
      (
        t.type ===
          "human_gate" ||
        t.requiresHuman
      ) &&
      t.status ===
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
    ).map(normalizeTask);

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
          b.priority || 0
        ) -
          Number(
            a.priority || 0
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
        ...(duplicate.result ||
          {}),

        supersededReason:
          "同一Semantic Human Gateの重複を自己保守で統合した。",

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
        (t) => t.id
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

  const existingGateByTask =
    new Map(
      (
        Array.isArray(
          company.humanGates
        )
          ? company.humanGates
          : []
      ).map(
        (g) => [
          g.taskId,
          g,
        ]
      )
    );

  company.humanGates =
    canonicalTasks.map(
      (task) => {
        const old =
          existingGateByTask.get(
            task.id
          );

        return {
          id:
            old?.id ||
            task.humanGateId ||
            id("gate"),

          taskId:
            task.id,

          businessId:
            task.businessId ||
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
            old?.createdAt ||
            task.createdAt ||
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
    ).map(normalizeTask);

  const human =
    pendingHumanGateTasks(
      tasks
    ).sort(
      (a, b) =>
        Number(
          b.priority || 0
        ) -
        Number(
          a.priority || 0
        )
    );

  const internal =
    tasks
      .filter(
        (t) =>
          t.internalOnly &&
          [
            "pending",
            "running",
          ].includes(
            t.status
          )
      )
      .sort(
        (a, b) =>
          Number(
            b.priority || 0
          ) -
          Number(
            a.priority || 0
          )
      );

  const business =
    tasks
      .filter(
        (t) =>
          t.type ===
            "business_task" &&
          [
            "pending",
            "running",
          ].includes(
            t.status
          )
      )
      .sort(
        (a, b) =>
          Number(
            b.priority || 0
          ) -
          Number(
            a.priority || 0
          )
      );

  if (
    human.length
  ) {
    company.currentFocus =
      "人間承認待ち";

    company.nextAction =
      `Human Gate：${
        human[0].title
      }`;
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

  company.securityPolicy = {
    ...SECURITY_POLICY,
  };

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
  d
) {
  const tasks =
    (
      await getStore(
        env,
        "tasks",
        []
      )
    ).map(normalizeTask);

  const normalizedDraft =
    normalizeTask({
      id: id("task"),
      ...d,
    });

  assertInternalTaskPolicy(
    normalizedDraft
  );

  if (
    normalizedDraft.type ===
      "human_gate" ||
    normalizedDraft.requiresHuman
  ) {
    const key =
      humanGateSemanticKey(
        normalizedDraft
      );

    const duplicateGate =
      tasks.find(
        (t) =>
          (
            t.type ===
              "human_gate" ||
            t.requiresHuman
          ) &&
          t.status ===
            "waiting_human" &&
          humanGateSemanticKey(
            t
          ) === key
      );

    if (duplicateGate) {
      return duplicateGate;
    }
  }

  const duplicate =
    tasks.find(
      (t) =>
        t.action ===
          normalizedDraft.action &&
        t.businessId ===
          normalizedDraft.businessId &&
        [
          "pending",
          "running",
          "waiting_human",
        ].includes(
          t.status
        )
    );

  if (duplicate) {
    return duplicate;
  }

  tasks.push(
    normalizedDraft
  );

  await saveTask(
    env,
    tasks
  );

  return normalizedDraft;
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
    ).map(normalizeTask);

  const i =
    tasks.findIndex(
      (t) =>
        t.id ===
        taskId
    );

  if (i < 0) {
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
    index.slice(-1000)
  );

  return artifact;
}

async function audit(env) {
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
    ).map(normalizeTask);

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
      company
        .capabilitySnapshot ||
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
    const t of
      pendingHumanGateTasks(
        tasks
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
    const t of
      tasks.filter(
        (x) =>
          x.status ===
            "completed" &&
          x.artifactId
      )
  ) {
    if (
      !(
        await getStore(
          env,
          `artifact:${t.artifactId}`,
          null
        )
      )
    ) {
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
    anomalies.slice(-200);

  company.capabilitySnapshot =
    currentCaps;

  await setStore(
    env,
    "company",
    company
  );

  return {
    ok: true,

    runtime:
      RUNTIME_VERSION,

    anomalyCount:
      anomalies.length,

    anomalies,

    capabilities:
      currentCaps,

    humanGateCount:
      company.humanGates.length,
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

  const out =
    [];

  for (
    const a of
      report.anomalies
  ) {
    const d =
      mappings[a.type];

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
  company.humanGates = tasks.filter(t => t.type === "human_gate" || t.requiresHuman).map(t => ({ taskId: t.id, status: t.status, requiresHuman: true }));
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

async function sha256Hex(text) {
  const bytes =
    new TextEncoder()
      .encode(
        String(text || "")
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
      (b) =>
        b.toString(16)
          .padStart(2, "0")
    )
    .join("");
}function testCandidate(code) {
  const failures = [];
  const warnings = [];

  const src =
    String(code || "");

  if (src.length < 30) {
    failures.push(
      "candidate_too_small"
    );
  }

  if (src.length > 50000) {
    failures.push(
      "candidate_too_large"
    );
  }

  if (
    !src.includes("export")
  ) {
    failures.push(
      "missing_export"
    );
  }

  if (
    !src.includes("function")
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
      src.includes(p)
    ) {
      failures.push(
        `dangerous_pattern:${p}`
      );
    }
  }

  if (
    /\bfetch\s*\(/.test(
      src
    )
  ) {
    failures.push(
      "network_access_not_allowed_in_candidate"
    );
  }

  if (
    /\bimport\s*\(/.test(
      src
    )
  ) {
    failures.push(
      "dynamic_import_not_allowed"
    );
  }

  if (
    /https?:\/\//i.test(
      src
    )
  ) {
    failures.push(
      "remote_url_not_allowed"
    );
  }

  if (
    /OWNER_CONTROL_TOKEN|CONTROL_TOKEN_ENV|SECURITY_POLICY/.test(
      src
    )
  ) {
    failures.push(
      "security_policy_mutation_surface"
    );
  }

  if (
    /(paymentAutonomy|paidResourceAutonomy|maxSpend|productionDeploy|sourceControlWrite|externalActions)\s*[:=]/.test(
      src
    )
  ) {
    failures.push(
      "security_boundary_mutation_surface"
    );
  }

  if (
    src.includes("fetch(") &&
    /method\s*:\s*["']POST["']/i.test(
      src
    )
  ) {
    failures.push(
      "possible_external_write"
    );
  }

  if (
    /WebSocket|RTCDataChannel|navigator\.sendBeacon/i.test(
      src
    )
  ) {
    warnings.push(
      "external_network_capability_detected"
    );
  }

  const stack = [];

  const pairs = {
    "(": ")",
    "[": "]",
    "{": "}",
  };

  const closes =
    new Set(
      Object.values(
        pairs
      )
    );

  for (
    const ch of src
  ) {
    if (
      pairs[ch]
    ) {
      stack.push(
        pairs[ch]
      );
    } else if (
      closes.has(ch)
    ) {
      const expected =
        stack.pop();

      if (
        expected !== ch
      ) {
        failures.push(
          "unbalanced_delimiters"
        );

        break;
      }
    }
  }

  if (
    stack.length
  ) {
    failures.push(
      "unbalanced_delimiters"
    );
  }

  const requiredInterface =
    /export\s+function\s+/.test(
      src
    );

  if (
    !requiredInterface
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

    checks: [
      "length",
      "export",
      "function",
      "dangerous_patterns",
      "network_access_blocked",
      "remote_url_blocked",
      "security_policy_mutation_blocked",
      "external_write",
      "delimiter_balance",
      "function_export_interface",
    ],
  };
}

function sourceControlPlan(
  candidate
) {
  return {
    adapterMode:
      "plan_only",

    provider:
      "github",

    writeEnabled:
      false,

    recommendedBranch:
      `ai-company/candidate/${candidate.id}`,

    operations: [
      "create_branch",
      "write_candidate",
      "commit",
      "open_pull_request",
      "run_ci",
    ],

    externalWriteAllowed:
      false,

    reason:
      "候補変更を実リポジトリへ書き込む前にHuman Gateと外部接続を必要とする。",
  };
}

function verifyStaticBuild(
  candidateCode,
  testResult,
  checksum
) {
  const src =
    String(candidateCode || "");

  const exports =
    (
      src.match(
        /export\s+(?:async\s+)?function\s+[A-Za-z0-9_$]+/g
      ) || []
    ).length;

  const functions =
    (
      src.match(
        /\bfunction\s+[A-Za-z0-9_$]+\s*\(/g
      ) || []
    ).length;

  const imports =
    (
      src.match(
        /^\s*import\s+/gm
      ) || []
    ).length;

  const externalWrites =
    /(
      method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)["']
    )|(
      navigator\.sendBeacon\()
    )/.test(src);

  const verification = {
    passed:
      Boolean(
        testResult?.passed &&
        checksum &&
        exports >= 1 &&
        functions >= 1 &&
        !externalWrites
      ),

    mode:
      "static_manifest",

    checks: {
      testPassed:
        Boolean(
          testResult?.passed
        ),

      checksumPresent:
        Boolean(checksum),

      exportedFunctions:
        exports,

      functions,

      imports,

      externalWritesBlocked:
        !externalWrites,

      delimiterBalance:
        !testResult?.failures?.includes(
          "unbalanced_delimiters"
        ),
    },

    verifiedAt:
      nowIso(),
  };

  return verification;
}

async function buildCandidate(
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
      "Candidate must pass tests before build"
    );
  }

  const checksum =
    await sha256Hex(
      candidate.candidateCode
    );

  const verification =
    verifyStaticBuild(
      candidate.candidateCode,
      candidate.test,
      checksum
    );

  const build = {
    id:
      id("build"),

    candidateId,

    status:
      verification.passed
        ? "passed"
        : "failed",

    target:
      "company_core_internal_module",

    mode:
      "static_manifest",

    checksum,

    bytes:
      new TextEncoder()
        .encode(
          candidate.candidateCode
        ).length,

    lineCount:
      candidate.candidateCode.split(
        "\n"
      ).length,

    verification,

    createdAt:
      nowIso(),
  };

  candidate.build =
    build;

  candidate.status =
    verification.passed
      ? "built"
      : "build_failed";

  candidate.updatedAt =
    nowIso();

  await setStore(
    env,
    `candidate:${candidateId}`,
    candidate
  );

  await setStore(
    env,
    `build:${build.id}`,
    build
  );

  const artifact =
    await saveArtifact(
      env,
      {
        id:
          id("buildtask"),

        action:
          "self_development_build",

        department:
          "開発基盤",
      },
      build
    );

  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  company.selfDevelopment
    .lastBuildAt =
    build.createdAt;

  company.selfDevelopment
    .buildVerification =
    verification.passed;

  company.selfDevelopment
    .lastCandidateId =
    candidateId;

  company.selfDevelopment
    .activeCandidateId =
    candidateId;

  company.selfDevelopment
    .buildCount =
    Number(
      company
        .selfDevelopment
        .buildCount ||
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
        "self_development_build",

      candidateId,

      buildId:
        build.id,

      verified:
        verification.passed,

      summary:
        "自己開発候補の静的Build Manifest検証を完了した。",
    }
  );

  return {
    candidate,
    build,
    artifact,
  };
}

async function createSourceControlPlan(
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
    !candidate.build
      ?.verification
      ?.passed
  ) {
    throw new Error(
      "Candidate must have a verified build"
    );
  }

  const plan =
    sourceControlPlan(
      candidate
    );

  const record = {
    id:
      id("scplan"),

    candidateId,

    ...plan,

    createdAt:
      nowIso(),
  };

  await setStore(
    env,
    `source_control_plan:${record.id}`,
    record
  );

  const company =
    await getStore(
      env,
      "company",
      defaultCompany()
    );

  company.selfDevelopment
    .sourceControlPlanCount =
    Number(
      company
        .selfDevelopment
        .sourceControlPlanCount ||
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
        "source_control_plan",

      candidateId,

      planId:
        record.id,

      summary:
        "GitHubへの変更候補をplan-onlyで生成した。",
    }
  );

  return record;
}

async function createReleaseCandidate(
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
      "Candidate test failed"
    );
  }

  if (
    !candidate.build
      ?.verification
      ?.passed
  ) {
    throw new Error(
      "Candidate build verification failed"
    );
  }

  const existingRelease =
    await listStoreRows(
      env,
      "release:%"
    );

  const duplicate =
    existingRelease
      .map(
        (x) => x.value
      )
      .find(
        (x) =>
          x?.candidateId ===
            candidateId &&
          [
            "waiting_human",
            "approved_for_deploy",
          ].includes(
            x.status
          )
      );

  if (duplicate) {
    return {
      release:
        duplicate,

      duplicatePrevented:
        true,
    };
  }

  const snapshot =
    await snapshotState(
      env,
      `before_release_candidate:${candidateId}`
    );

  const plan =
    await createSourceControlPlan(
      env,
      candidateId
    );

  const release = {
    id:
      id("release"),

    candidateId,

    status:
      "waiting_human",

    createdAt:
      nowIso(),

    snapshotId:
      snapshot.id,

    sourceControlPlanId:
      plan.id,

    buildId:
      candidate.build.id,

    checksum:
      candidate.build.checksum,

    healthCheckRequired:
      true,

    productionDeployPerformed:
      false,
  };

  await setStore(
    env,
    `release:${release.id}`,
    release
  );

  const task =
    await createTask(
      env,
      {
        type:
          "human_gate",

        action:
          "self_development_release_candidate",

        title:
          `自己開発Release Candidate承認：${candidateId}`,

        description:
          "テスト・静的Build検証・Source Control Plan・Rollback Snapshotを揃えたリリース候補。本番反映は別Human Gate。",

        department:
          "開発基盤",

        priority:
          140,

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

        input: {
          candidateId,

          releaseId:
            release.id,

          snapshotId:
            snapshot.id,
        },
      }
    );

  release.taskId =
    task.id;

  await setStore(
    env,
    `release:${release.id}`,
    release
  );

  candidate.status =
    "waiting_human";

  candidate.releaseId =
    release.id;

  candidate.updatedAt =
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

  company.selfDevelopment
    .activeReleaseId =
    release.id;

  company.selfDevelopment
    .packageCount =
    Number(
      company
        .selfDevelopment
        .packageCount ||
        0
    ) + 1;

  company.selfDevelopment
    .releaseCount =
    Number(
      company
        .selfDevelopment
        .releaseCount ||
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
        "release_candidate_created",

      candidateId,

      releaseId:
        release.id,

      taskId:
        task.id,

      snapshotId:
        snapshot.id,

      summary:
        "自己開発Release CandidateをHuman Gateへ送った。",
    }
  );

  return {
    release,
    task,
    plan,
    snapshotId:
      snapshot.id,

    duplicatePrevented:
      false,
  };
}

async function healthCheck(
  env,
  candidateId = null
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
    ).map(normalizeTask);

  const candidate =
    candidateId
      ? await getStore(
          env,
          `candidate:${candidateId}`,
          null
        )
      : null;

  const checks = {
    companyStatePresent:
      Boolean(
        company &&
        company.schemaVersion
      ),

    runtimeVersionCorrect:
      company.runtimeVersion ===
      RUNTIME_VERSION,

    humanGateConsistency:
      new Set(
        company.humanGates.map(
          (g) =>
            g.semanticKey
        )
      ).size ===
      company.humanGates
        .length,

    noWaitingGateWithoutRecord:
      pendingHumanGateTasks(
        tasks
      ).every(
        (t) =>
          company.humanGates.some(
            (g) =>
              g.taskId ===
              t.id
          )
      ),

    candidateKnown:
      candidateId
        ? Boolean(candidate)
        : true,

    candidateBuildVerified:
      candidateId
        ? Boolean(
            candidate
              ?.build
              ?.verification
              ?.passed
          )
        : true,

    productionDeployStillProtected:
      company.externalActions ===
      false,
  };

  const result = {
    id:
      id("healthcheck"),

    createdAt:
      nowIso(),

    candidateId,

    ok:
      Object.values(
        checks
      ).every(Boolean),

    checks,

    mode:
      "logical_runtime_health",
  };

  await setStore(
    env,
    `healthcheck:${result.id}`,
    result
  );

  company.selfDevelopment
    .healthCheckCount =
    Number(
      company
        .selfDevelopment
        .healthCheckCount ||
        0
    ) + 1;

  company.selfDevelopment
    .lastHealthCheckAt =
    result.createdAt;

  company.selfDevelopment
    .lastHealthCheckOk =
    result.ok;

  await setStore(
    env,
    "company",
    company
  );

  return result;
}async function autonomousPlanningCycle(
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
    ).map(normalizeTask);

  const pending =
    tasks.filter(
      (t) =>
        [
          "pending",
          "running",
          "waiting_human",
        ].includes(
          t.status
        )
    );

  const created =
    [];

  if (
    pending.length >=
    MAX_AUTONOMOUS_TASKS_PER_CYCLE
  ) {
    return {
      status:
        "capacity_guard",

      created,
    };
  }

  const gaps =
    Object.entries(
      capabilities(
        company,
        tasks
      )
    )
      .filter(
        ([, value]) =>
          value === false
      )
      .map(
        ([key]) => key
      );

  if (
    gaps.includes(
      "customerFeedback"
    )
  ) {
    const t =
      await createTask(
        env,
        {
          type:
            "internal_task",

          action:
            "customer_feedback_analysis",

          title:
            "顧客フィードバック能力を確認する",

          department:
            "顧客対応",

          priority:
            115,

          internalOnly:
            true,

          safeAutonomy:
            true,

          externalAction:
            false,
        }
      );

    if (t) {
      created.push(t);
    }
  }

  if (
    gaps.includes(
      "outcomeTracking"
    )
  ) {
    const t =
      await createTask(
        env,
        {
          type:
            "internal_task",

          action:
            "outcome_analysis",

          title:
            "事業成果データの取得経路を整備する",

          department:
            "事業成果",

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

    if (t) {
      created.push(t);
    }
  }

  if (
    !created.length &&
    Number(
      company.cycleCount ||
        0
    ) %
      AUTONOMY_PLANNING_INTERVAL_CYCLES ===
      0
  ) {
    const business =
      company.businesses[0];

    if (
      business &&
      !pending.some(
        (t) =>
          t.businessId ===
            business.id &&
          t.action ===
            "business_health_analysis"
      )
    ) {
      const t =
        await createTask(
          env,
          {
            type:
              "internal_task",

            action:
              "business_health_analysis",

            title:
              `事業状態分析：${business.name}`,

            department:
              "企画",

            priority:
              105,

            internalOnly:
              true,

            safeAutonomy:
              true,

            externalAction:
              false,

            businessId:
              business.id,
          }
        );

      if (t) {
        created.push(t);
      }
    }
  }

  if (created.length) {
    await memory(
      env,
      {
        type:
          "autonomous_planning",

        actions:
          created.map(
            (t) =>
              t.action
          ),

        summary:
          "CEO自律計画が能力ギャップと会社状態から内部タスクを生成した。",
      }
    );
  }

  return {
    status:
      "autonomous_planning_completed",

    created,

    gaps,
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

  if (
    currentCompany
      .selfDevelopment
      ?.activeCandidateId
  ) {
    const active =
      await getStore(
        env,
        `candidate:${currentCompany.selfDevelopment.activeCandidateId}`,
        null
      );

    if (
      active &&
      [
        "waiting_human",
        "approved_pending_external_deploy",
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
    await audit(env);

  const first =
    report.anomalies[0]?.type ||
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

  candidate.status =
    result.passed
      ? "tested"
      : "test_failed";

  candidate.build = {
    status:
      result.passed
        ? "ready"
        : "blocked",

    checksum,

    bytes:
      new TextEncoder()
        .encode(
          candidate.candidateCode
        ).length,

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

    build:
      candidate.build,

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
    ).map(normalizeTask);

  const existing =
    currentTasks.find(
      (t) =>
        t.status ===
          "waiting_human" &&
        t.action ===
          "self_development_deploy_candidate" &&
        str(
          t.input?.candidateId,
          ""
        ) === candidateId
    );

  if (existing) {
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
        candidate.snapshotId ||
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

        input: {
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
    ...(company.selfDevelopment ||
      {}),

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
          false,

        pipeline: {
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

      pipeline: {
        type:
          "business_pipeline",

        stage,

        businessId:
          business.id,
      },
    }
  );
}async function executeBusinessTask(
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

        researchQuestions: [
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

        workflow: [
          "依頼受付",
          "調査設計",
          "情報整理",
          "レポート生成",
          "確認・修正",
        ],

        validationPlan: [
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

        acquisitionChannels: [
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

        checks: {
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
      ).map(normalizeTask);

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
      await migrate(env);

    payload = {
      repaired:
        "state",

      migrationVersion:
        result.company
          .migration
          .version,

      businessCount:
        result
          .company
          .businesses
          .length,

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
  assertInternalTaskPolicy(
    task
  );

  await updateTask(
    env,
    task.id,
    {
      status:
        "running",

      runCount:
        Number(
          task.runCount || 0
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
        payload: {
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

          result: {
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
  } = await migrate(
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
    ).map(normalizeTask);

  const pendingHuman =
    pendingHumanGateTasks(
      tasks
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

            pipeline: {
              type:
                "business_pipeline",

              stage:
                next,

              businessId:
                business.id,
            },
          }
        );
      } else {
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
              false,

            pipeline: {
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
      ).map(normalizeTask);

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
    ).map(normalizeTask);

  updatedCompany.cycleCount =
    Number(
      updatedCompany
        .cycleCount ||
      0
    ) + 1;

  updatedCompany
    .capabilitySnapshot =
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
}async function selfOrganizationCycle(
  env
) {
  const {
    company,
  } = await migrate(
    env
  );

  const tasks =
    (
      await getStore(
        env,
        "tasks",
        []
      )
    ).map(normalizeTask);

  const caps =
    capabilities(
      company,
      tasks
    );

  company.departmentStates =
    company.departmentStates ||
    {};

  const added =
    [];

  const activated =
    [];

  for (
    const [
      name,
      def,
    ] of Object.entries(
      GENERATED_DEPARTMENTS
    )
  ) {
    if (
      caps[def.trigger] ===
      false
    ) {
      if (
        !company.departments.includes(
          name
        )
      ) {
        company.departments.push(
          name
        );

        company.organizationHistory.push(
          {
            id:
              id("org"),

            action:
              "create_department",

            department:
              name,

            trigger:
              def.trigger,

            createdAt:
              nowIso(),
          }
        );

        added.push(
          name
        );
      }

      company.departmentStates[
        name
      ] = {
        status:
          "active",

        mission:
          def.mission,

        trigger:
          def.trigger,

        lastEvaluatedAt:
          nowIso(),
      };

      activated.push(
        name
      );
    } else if (
      company.departmentStates[
        name
      ]
    ) {
      company.departmentStates[
        name
      ] = {
        ...company
          .departmentStates[name],

        status:
          "hibernating",

        lastEvaluatedAt:
          nowIso(),
      };
    }
  }

  company.departments =
    normalizeDepartments(
      company.departments
    );

  company.activeDepartments =
    [
      ...new Set([
        ...DEFAULT_DEPARTMENTS,

        ...Object.entries(
          company.departmentStates
        )
          .filter(
            ([, v]) =>
              v?.status ===
              "active"
          )
          .map(
            ([name]) =>
              name
          ),
      ]),
    ];

  await setStore(
    env,
    "company",
    company
  );

  if (
    added.length
  ) {
    await memory(
      env,
      {
        type:
          "organization_evolution",

        departmentsAdded:
          added,

        summary:
          "能力ギャップに応じて必要な部門だけを生成した。",
      }
    );
  }

  return {
    status:
      "self_organization_completed",

    addedDepartments:
      added,

    activatedDepartments:
      activated,

    departments:
      company.departments,

    activeDepartments:
      company.activeDepartments,

    capabilities:
      caps,
  };
}

async function selfDevelopmentCycle(
  env
) {
  const report =
    await audit(env);

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

  await reconcileSelfDevelopmentLedger(
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
    ).map(normalizeTask);

  const caps =
    capabilities(
      company,
      tasks
    );

  const activeCandidateId =
    company
      .selfDevelopment
      ?.activeCandidateId ||
    company
      .selfDevelopment
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
        "approved_for_deploy",
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

        input: {
          candidateId,
        },
      }
    );

  const execution =
    await executeTask(
      env,
      testTask
    );

  const candidateAfterTest =
    await getStore(
      env,
      `candidate:${candidateId}`,
      null
    );

  let build =
    null;

  let sourceControlPlan =
    null;

  let releaseCandidate =
    null;

  let health =
    null;

  if (
    candidateAfterTest
      ?.test
      ?.passed
  ) {
    build =
      await buildCandidate(
        env,
        candidateId
      );

    if (
      build
        ?.build
        ?.verification
        ?.passed
    ) {
      sourceControlPlan =
        await createSourceControlPlan(
          env,
          candidateId
        );

      releaseCandidate =
        await createReleaseCandidate(
          env,
          candidateId
        );

      health =
        await healthCheck(
          env,
          candidateId
        );
    }
  }

  await reconcileSelfDevelopmentLedger(
    env
  );

  return {
    mode:
      "develop",

    report,

    proposal,

    testExecution:
      execution,

    build,

    sourceControlPlan,

    releaseCandidate,

    health,
  };
}

async function health(
  env
) {
  await reconcileHumanGates(
    env
  );

  await reconcileSelfDevelopmentLedger(
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
    ).map(normalizeTask);

  const idx =
    await getStore(
      env,
      "artifact_index",
      []
    );

  const ledger =
    company
      .selfDevelopment ||
    {};

  return {
    ok:
      true,

    runtime:
      RUNTIME_VERSION,

    schemaVersion:
      SCHEMA_VERSION,

    company: {
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

      waitingHuman:
        pendingHumanGateTasks(
          tasks
        ).length,

      businessCount:
        company.businesses.length,

      departmentCount:
        company.departments.length,

      activeDepartmentCount:
        (
          company
            .activeDepartments ||
          company.departments
        ).length,
    },

    execution_available:
      true,

    external_read:
      true,

    external_actions:
      false,

    external_ai:
      false,

    external_company_integration:
      false,

    physical_actuation:
      false,

    payment_autonomy:
      false,

    paid_resource_autonomy:
      false,

    auto_upgrade:
      false,

    max_spend:
      0,

    source_control_write:
      false,

    production_deploy_autonomy:
      false,

    customer_gateway_available:
      SECURITY_POLICY
        .customerGateway,

    outcome_gateway_available:
      SECURITY_POLICY
        .outcomeGateway,

    control_plane_public:
      false,

    owner_control_required:
      true,

    artifactCount:
      Array.isArray(idx)
        ? idx.length
        : 0,

    selfDevelopmentMode:
      ledger.mode ||
      "candidate_only",

    activeCandidateId:
      ledger.activeCandidateId ||
      null,

    activeReleaseId:
      ledger.activeReleaseId ||
      null,

    selfDevelopmentProposalCount:
      Number(
        ledger.proposalCount ||
          0
      ),

    selfDevelopmentPackageCount:
      Number(
        ledger.packageCount ||
          0
      ),

    selfDevelopmentBuildCount:
      Number(
        ledger.buildCount ||
          0
      ),

    selfDevelopmentReleaseCount:
      Number(
        ledger.releaseCount ||
          0
      ),

    selfDevelopmentBuildVerification:
      ledger.buildVerification ===
      true,

    lastBuildAt:
      ledger.lastBuildAt ||
      null,

    lastHealthCheckAt:
      ledger.lastHealthCheckAt ||
      null,

    lastHealthCheckOk:
      ledger.lastHealthCheckOk ??
      null,
  };
}

async function route(
  req,
  env
) {
  const u =
    new URL(req.url);

  const p =
    u.pathname;

  const m =
    req.method.toUpperCase();

  if (
    m === "OPTIONS"
  ) {
    return new Response(
      null,
      {
        status:
          204,

        headers: {
          "access-control-allow-origin":
            "*",

          "access-control-allow-methods":
            "GET,POST,OPTIONS",

          "access-control-allow-headers":
            "Content-Type, Authorization, X-Owner-Token",
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
    return json({
      ok:
        true,

      runtime:
        RUNTIME_VERSION,

      schemaVersion:
        SCHEMA_VERSION,

      policy: {
        externalActions:
          false,

        externalAI:
          false,

        externalCompanyIntegration:
          false,

        physicalActuation:
          false,

        paymentAutonomy:
          false,

        paidResourceAutonomy:
          false,

        autoUpgrade:
          false,

        maxSpend:
          0,

        productionDeploy:
          false,

        sourceControlWrite:
          false,

        customerGateway:
          false,

        outcomeGateway:
          false,

        ownerControlRequired:
          true,
      },
    });
  }

  const ownerOnly =
    new Set([
      "/api/state",
      "/api/cycle",
      "/api/self-organization/cycle",
      "/api/self-development/cycle",
      "/api/self-development/proposal",
      "/api/self-development/test",
      "/api/self-development/deploy-candidate",

      "/api/maintenance/audit",
      "/api/maintenance/cycle",
      "/api/migration/status",

      "/api/self-development/candidate",
      "/api/self-development/rollback",
      "/api/snapshots",

      "/api/departments",
      "/api/capabilities",
      "/api/ceo/state",

      "/api/customer/intake",
      "/api/outcome",
      "/api/research/fetch",
      "/api/artifact",

      "/api/human-gate/approve",
      "/api/human-gate/reject",

      "/api/autonomy/cycle",
      "/api/organization/plan",

      "/api/self-development/ledger",
      "/api/self-development/reconcile",

      "/api/self-development/build",
      "/api/self-development/source-control-plan",
      "/api/self-development/release-candidate",
      "/api/self-development/health-check",

      "/api/self-development/releases",
      "/api/self-development/healthchecks",

      "/api/strategy/state",
      "/api/heartbeat",
    ]);

  if (
    ownerOnly.has(p) &&
    !(await requireOwner(
      req,
      env
    ))
  ) {
    return unauthorized();
  }

  if (
    p === "/api/state" &&
    m === "GET"
  ) {
    await migrate(env);

    await reconcileHumanGates(
      env
    );

    await reconcileSelfDevelopmentLedger(
      env
    );

    await updateCEOState(
      env
    );

    const c =
      await getStore(
        env,
        "company",
        defaultCompany()
      );

    return json({
      runtime:
        RUNTIME_VERSION,

      schemaVersion:
        SCHEMA_VERSION,

      company:
        c,

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
        SECURITY_POLICY,
    });
  }

  if (
    p === "/api/cycle" &&
    m === "POST"
  ) {
    return json(
      await withLock(
        env,
        "company_cycle",
        () =>
          companyCycle(
            env
          )
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
      await withLock(
        env,
        "company_cycle",
        () =>
          selfOrganizationCycle(
            env
          )
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
      await withLock(
        env,
        "company_cycle",
        () =>
          selfDevelopmentCycle(
            env
          )
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
      await withLock(
        env,
        "company_cycle",
        () =>
          selfDevelopmentProposal(
            env
          )
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
      await audit(env)
    );
  }

  if (
    p ===
      "/api/maintenance/cycle" &&
    m ===
      "POST"
  ) {
    return json(
      await withLock(
        env,
        "company_cycle",
        async () => {
          const a =
            await audit(
              env
            );

          const created =
            await ensureMaintenance(
              env,
              a
            );

          return {
            status:
              "maintenance_completed",

            audit:
              a,

            created,
          };
        }
      )
    );
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
      "/api/self-development/rollback" &&
    m ===
      "POST"
  ) {
    const b =
      await bodyJSON(
        req
      );

    return json(
      await rollbackSnapshot(
        env,
        str(
          b.snapshotId
        )
      )
    );
  }  if (
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

      activeDepartments:
        c.activeDepartments ||
        c.departments,

      departmentStates:
        c.departmentStates ||
        {},
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

      securityPolicy:
        SECURITY_POLICY,

      departments:
        c.departments,

      activeDepartments:
        c.activeDepartments ||
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
        c.cycleCount ||
          0
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
      "/api/security/policy" &&
    m ===
      "GET"
  ) {
    return json({
      runtime:
        RUNTIME_VERSION,

      schemaVersion:
        SCHEMA_VERSION,

      freeOnlyMode:
        FREE_ONLY_MODE,

      maxEstimatedCost:
        MAX_ESTIMATED_COST,

      policy:
        SECURITY_POLICY,

      ownerControlRequired:
        true,

      paidResourceAutonomy:
        false,

      accountUpgradeAutonomy:
        false,
    });
  }

  if (
    p ===
      "/api/ceo/state" &&
    m ===
      "GET"
  ) {
    await migrate(
      env
    );

    await reconcileHumanGates(
      env
    );

    const c =
      await updateCEOState(
        env
      );

    return json({
      runtime:
        RUNTIME_VERSION,

      currentFocus:
        c.currentFocus,

      nextAction:
        c.nextAction,

      humanGates:
        c.humanGates,

      selfDevelopment:
        c.selfDevelopment,
    });
  }

  if (
    p ===
      "/api/customer/intake" &&
    m ===
      "POST"
  ) {
    return json(
      {
        ok:
          false,

        error:
          "customer_gateway_disabled",
      },
      403
    );
  }

  if (
    p ===
      "/api/outcome" &&
    m ===
      "POST"
  ) {
    return json(
      {
        ok:
          false,

        error:
          "outcome_gateway_disabled",
      },
      403
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

    const {
      response,
      source,
    } =
      await safeResearchFetch(
        sid
      );

    const text =
      await response.text();

    return json({
      ok:
        true,

      sourceId:
        sid,

      sourceName:
        source.name,

      url:
        source.url,

      status:
        response.status,

      contentPreview:
        text.slice(
          0,
          20000
        ),
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

    const targetId =
      str(
        b.taskId
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

    const target =
      tasks.find(
        (t) =>
          t.id ===
          targetId
      );

    if (
      !target ||
      !(
        target.type ===
          "human_gate" ||
        target.requiresHuman
      ) ||
      target.status !==
        "waiting_human"
    ) {
      return json(
        {
          ok:
            false,

          error:
            "invalid_human_gate_target",
        },
        400
      );
    }

    const task =
      await updateTask(
        env,
        targetId,
        {
          status:
            "approved",

          approvedAt:
            nowIso(),
        }
      );

    if (
      task?.action ===
      "self_development_release_candidate"
    ) {
      const cid =
        str(
          task.input
            ?.candidateId
        );

      const rid =
        str(
          task.input
            ?.releaseId
        );

      const cnd =
        cid
          ? await getStore(
              env,
              `candidate:${cid}`,
              null
            )
          : null;

      const rel =
        rid
          ? await getStore(
              env,
              `release:${rid}`,
              null
            )
          : null;

      if (cnd) {
        cnd.status =
          "approved_for_deploy";

        cnd.approvedAt =
          nowIso();

        cnd.productionDeployPerformed =
          false;

        await setStore(
          env,
          `candidate:${cid}`,
          cnd
        );
      }

      if (rel) {
        rel.status =
          "approved_for_deploy";

        rel.approvedAt =
          nowIso();

        rel.productionDeployPerformed =
          false;

        await setStore(
          env,
          `release:${rid}`,
          rel
        );
      }
    }

    if (
      task?.action ===
      "self_development_deploy_candidate"
    ) {
      const cid =
        str(
          task.input
            ?.candidateId
        );

      if (cid) {
        const cnd =
          await getStore(
            env,
            `candidate:${cid}`,
            null
          );

        if (cnd) {
          cnd.status =
            "approved_pending_external_deploy";

          cnd.approvedAt =
            nowIso();

          cnd.productionDeployPerformed =
            false;

          await setStore(
            env,
            `candidate:${cid}`,
            cnd
          );
        }
      }
    }

    await reconcileHumanGates(
      env
    );

    await reconcileSelfDevelopmentLedger(
      env
    );

    const finalCompany =
      await updateCEOState(
        env
      );

    return json({
      ok:
        true,

      task,

      externalActionPerformed:
        false,

      productionDeployPerformed:
        false,

      company: {
        currentFocus:
          finalCompany.currentFocus,

        nextAction:
          finalCompany.nextAction,
      },
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

    const targetId =
      str(
        b.taskId
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

    const target =
      tasks.find(
        (t) =>
          t.id ===
          targetId
      );

    if (
      !target ||
      !(
        target.type ===
          "human_gate" ||
        target.requiresHuman
      ) ||
      target.status !==
        "waiting_human"
    ) {
      return json(
        {
          ok:
            false,

          error:
            "invalid_human_gate_target",
        },
        400
      );
    }

    const task =
      await updateTask(
        env,
        targetId,
        {
          status:
            "rejected",

          rejectedAt:
            nowIso(),
        }
      );

    if (
      task?.action ===
        "self_development_release_candidate" ||
      task?.action ===
        "self_development_deploy_candidate"
    ) {
      const cid =
        str(
          task.input
            ?.candidateId
        );

      const rid =
        str(
          task.input
            ?.releaseId
        );

      if (cid) {
        const cnd =
          await getStore(
            env,
            `candidate:${cid}`,
            null
          );

        if (cnd) {
          cnd.status =
            "rejected";

          cnd.rejectedAt =
            nowIso();

          await setStore(
            env,
            `candidate:${cid}`,
            cnd
          );
        }
      }

      if (rid) {
        const rel =
          await getStore(
            env,
            `release:${rid}`,
            null
          );

        if (rel) {
          rel.status =
            "rejected";

          rel.rejectedAt =
            nowIso();

          await setStore(
            env,
            `release:${rid}`,
            rel
          );
        }
      }

      const c =
        await getStore(
          env,
          "company",
          defaultCompany()
        );

      c.selfDevelopment
        .activeCandidateId =
        null;

      c.selfDevelopment
        .activeReleaseId =
        null;

      await setStore(
        env,
        "company",
        c
      );
    }

    await reconcileHumanGates(
      env
    );

    await reconcileSelfDevelopmentLedger(
      env
    );

    const finalCompany =
      await updateCEOState(
        env
      );

    return json({
      ok:
        true,

      task,

      company: {
        currentFocus:
          finalCompany.currentFocus,

        nextAction:
          finalCompany.nextAction,
      },
    });
  }

  if (
    p ===
      "/api/autonomy/cycle" &&
    m ===
      "POST"
  ) {
    return json(
      await withLock(
        env,
        "company_cycle",
        async () => {
          await migrate(
            env
          );

          const plan =
            await autonomousPlanningCycle(
              env
            );

          const org =
            await selfOrganizationCycle(
              env
            );

          const selfDev =
            await selfDevelopmentCycle(
              env
            );

          const business =
            await companyCycle(
              env
            );

          await reconcileHumanGates(
            env
          );

          const company =
            await updateCEOState(
              env
            );

          return {
            runtime:
              RUNTIME_VERSION,

            plan,

            organization:
              org,

            selfDevelopment:
              selfDev,

            business,

            company,
          };
        }
      )
    );
  }

  if (
    p ===
      "/api/organization/plan" &&
    m ===
      "GET"
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

    const caps =
      capabilities(
        company,
        tasks
      );

    const gaps =
      Object.entries(
        caps
      )
        .filter(
          ([, v]) =>
            v === false
        )
        .map(
          ([key]) =>
            key
        );

    const plans =
      gaps.map(
        (gap) => ({
          gap,

          recommendedDepartment:
            Object.entries(
              GENERATED_DEPARTMENTS
            ).find(
              ([, d]) =>
                d.trigger ===
                gap
            )?.[0] ||
            "開発基盤",
        })
      );

    return json({
      runtime:
        RUNTIME_VERSION,

      capabilities:
        caps,

      gaps,

      plans,

      activeDepartments:
        company.activeDepartments ||
        company.departments,
    });
  }

  if (
    p ===
      "/api/self-development/ledger" &&
    m ===
      "GET"
  ) {
    return json(
      await reconcileSelfDevelopmentLedger(
        env
      )
    );
  }

  if (
    p ===
      "/api/self-development/reconcile" &&
    m ===
      "POST"
  ) {
    return json(
      await withLock(
        env,
        "company_cycle",
        async () => {
          const ledger =
            await reconcileSelfDevelopmentLedger(
              env
            );

          const gates =
            await reconcileHumanGates(
              env
            );

          const company =
            await updateCEOState(
              env
            );

          return {
            runtime:
              RUNTIME_VERSION,

            ledger,

            gates,

            company,
          };
        }
      )
    );
  }

  if (
    p ===
      "/api/self-development/build" &&
    m ===
      "POST"
  ) {
    const b =
      await bodyJSON(
        req
      );

    return json(
      await buildCandidate(
        env,
        str(
          b.candidateId
        )
      )
    );
  }

  if (
    p ===
      "/api/self-development/source-control-plan" &&
    m ===
      "POST"
  ) {
    const b =
      await bodyJSON(
        req
      );

    return json(
      await createSourceControlPlan(
        env,
        str(
          b.candidateId
        )
      )
    );
  }

  if (
    p ===
      "/api/self-development/release-candidate" &&
    m ===
      "POST"
  ) {
    const b =
      await bodyJSON(
        req
      );

    return json(
      await createReleaseCandidate(
        env,
        str(
          b.candidateId
        )
      )
    );
  }

  if (
    p ===
      "/api/self-development/health-check" &&
    m ===
      "POST"
  ) {
    const b =
      await bodyJSON(
        req
      );

    return json(
      await healthCheck(
        env,
        str(
          b.candidateId
        ) || null
      )
    );
  }

  if (
    p ===
      "/api/self-development/source-control-plan" &&
    m ===
      "GET"
  ) {
    const cid =
      str(
        u.searchParams.get(
          "candidateId"
        )
      );

    const rows =
      await listStoreRows(
        env,
        "source_control_plan:%"
      );

    const values =
      rows
        .map(
          (r) => r.value
        )
        .filter(Boolean);

    return json(
      cid
        ? values.filter(
            (x) =>
              x.candidateId ===
              cid
          )
        : values
    );
  }

  if (
    p ===
      "/api/self-development/releases" &&
    m ===
      "GET"
  ) {
    const rows =
      await listStoreRows(
        env,
        "release:%"
      );

    return json(
      rows
        .map(
          (r) => r.value
        )
        .filter(Boolean)
    );
  }

  if (
    p ===
      "/api/self-development/healthchecks" &&
    m ===
      "GET"
  ) {
    const rows =
      await listStoreRows(
        env,
        "healthcheck:%"
      );

    return json(
      rows
        .map(
          (r) => r.value
        )
        .filter(Boolean)
    );
  }

  if (
    p ===
      "/api/strategy/state" &&
    m ===
      "GET"
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

    return json({
      runtime:
        RUNTIME_VERSION,

      goal:
        company.goal,

      mode:
        company.mode,

      currentFocus:
        company.currentFocus,

      nextAction:
        company.nextAction,

      capabilities:
        capabilities(
          company,
          tasks
        ),

      businessCount:
        company.businesses
          .length,

      customerCount:
        company.customers
          .length,

      outcomeCount:
        company.outcomes
          .length,

      securityPolicy:
        SECURITY_POLICY,
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
            status: 405,
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
      withLock(
        env,
        "company_cycle",
        async () => {
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

          await reconcileSelfDevelopmentLedger(
            env
          );

          await autonomousPlanningCycle(
            env
          );

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

          await reconcileSelfDevelopmentLedger(
            env
          );

          await updateCEOState(
            env
          );

          return {
            status:
              "scheduled_cycle_completed",
          };
        }
      )
    );
  },
};
