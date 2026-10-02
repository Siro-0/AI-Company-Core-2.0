/**
 * AI Company Core 5.0
 * Cloud CEO Runtime
 *
 * 役割:
 * - Cloudflare Worker上でCompany CoreのCEO Cycleを実行
 * - D1へ会社状態を永続保存
 * - Cronから定期的に自律サイクルを開始
 * - Human Gateがある場合は停止
 * - まだ外部AI、決済、公開、顧客送信、Python実行は行わない
 */

const RUNTIME_VERSION = "5.0-cloud-ceo";
const MAX_LOGS = 100;
const MAX_MEMORY = 100;
const MAX_STRATEGIES = 50;
const MAX_COUNCIL_CASES = 50;
const CYCLE_LOCK_MS = 10 * 60 * 1000;

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
  nextAction: "会社状態を分析して次の仕事を決定する",
  activeDepartments: BASE_DEPARTMENTS,
  runtimeVersion: RUNTIME_VERSION
};

function nowISO() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    }
  });
}

async function getStore(env, key, fallback) {
  const row = await env.DB
    .prepare(
      `SELECT value_json, updated_at
       FROM company_store
       WHERE key = ?`
    )
    .bind(key)
    .first();

  if (!row) {
    return clone(fallback);
  }

  try {
    return JSON.parse(row.value_json);
  } catch (error) {
    console.error("D1 JSON parse error:", key, error);
    return clone(fallback);
  }
}

async function setStore(env, key, value) {
  const now = nowISO();

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
    .bind(key, JSON.stringify(value), now)
    .run();
}

async function addLog(env, source, message) {
  const logs = await getStore(env, STORE_KEYS.engineLog, []);

  logs.unshift({
    id: makeId("log"),
    source,
    message,
    createdAt: nowISO()
  });

  await setStore(env, STORE_KEYS.engineLog, logs.slice(0, MAX_LOGS));
}

async function addMemory(env, item) {
  const memory = await getStore(env, STORE_KEYS.memory, []);

  memory.unshift(item);

  await setStore(
    env,
    STORE_KEYS.memory,
    memory.slice(0, MAX_MEMORY)
  );
}

function normalizeBusiness(value) {
  return {
    id: value.id || makeId("business"),
    name: String(value.name || "").trim(),
    customer: String(value.customer || "").trim(),
    problem: String(value.problem || "").trim(),
    status: value.status || "discovered",
    stage: value.stage || "discovered",
    pipeline: value.pipeline || "research",
    discoveredAt: value.discoveredAt || nowISO(),
    researchTaskId: value.researchTaskId || null,
    productTaskId: value.productTaskId || null,
    salesTaskId: value.salesTaskId || null,
    salesEvaluationTaskId: value.salesEvaluationTaskId || null,
    humanGateTaskId: value.humanGateTaskId || null
  };
}

async function findPipelineBusiness(env, businesses) {
  const activeStages = new Set([
    "discovered",
    "research",
    "product",
    "sales_preparation",
    "sales_evaluation",
    "human_approval"
  ]);

  return businesses.find(
    (business) => activeStages.has(business.stage)
  ) || null;
}

function chooseActiveDepartments(strategyTitle) {
  const departments = new Set(BASE_DEPARTMENTS);

  if (
    /市場|顧客|商品|事業/.test(strategyTitle)
  ) {
    departments.add("企画");
  }

  if (
    /商品|実装|技術|開発|コード/.test(strategyTitle)
  ) {
    departments.add("技術");
  }

  if (
    /販売|収益|価格|利益/.test(strategyTitle)
  ) {
    departments.add("財務");
  }

  if (
    /公開|契約|リスク|承認|外部/.test(strategyTitle)
  ) {
    departments.add("リスク管理");
  }

  return [...departments];
}

function makeCouncil(strategy) {
  const departments = chooseActiveDepartments(strategy.title);

  const reviewMap = {
    "企画": {
      summary: "顧客価値・事業性・方向性を確認します。",
      recommendation: "小さく検証して反応を確認します。"
    },
    "技術": {
      summary: "実装可能性・技術課題を確認します。",
      recommendation: "最小構成から始めます。"
    },
    "財務": {
      summary: "収益性・コスト・継続性を確認します。",
      recommendation: "低コストで検証します。"
    },
    "リスク管理": {
      summary: "安全・法務・規約・運営リスクを確認します。",
      recommendation: "不可逆な操作を避けます。"
    }
  };

  return {
    id: makeId("council"),
    strategyId: strategy.id,
    title: strategy.title,
    departments,
    reviews: departments.map((department) => ({
      department,
      ...(reviewMap[department] || {
        summary: "必要な能力を確認します。",
        recommendation: "小さく検証します。"
      }),
      source: "内部ルール",
      createdAt: nowISO()
    })),
    createdAt: nowISO()
  };
}

function makeDecision(strategy, council) {
  let action = "安全条件を守って小規模実行";

  if (strategy.objective === "Human Gate") {
    action = "人間承認を待つ";
  }

  if (strategy.objective === "Execution") {
    action = "実行基盤の準備を優先";
  }

  if (strategy.objective === "Discovery") {
    action = "新しい事業候補を探索";
  }

  return {
    id: makeId("decision"),
    action,
    strategyTitle: strategy.title,
    reason: strategy.reason,
    departments: council.departments,
    createdAt: nowISO()
  };
}

function makeStrategy({ pending, waitingHuman, businesses, nextBusiness }) {
  if (waitingHuman > 0) {
    return {
      id: makeId("strategy"),
      title: "Human Gate管理",
      reason: "人間承認が必要な処理を先に停止・確認する。",
      objective: "Human Gate"
    };
  }

  if (pending > 0) {
    return {
      id: makeId("strategy"),
      title: "既存タスクの実行を待機",
      reason: "登録済みタスクがあるため、重複タスクを作らず実行基盤の処理結果を待つ。",
      objective: "Execution"
    };
  }

  if (businesses.length === 0) {
    return {
      id: makeId("strategy"),
      title: "新しい事業候補を探索",
      reason: "会社の現在目標に対して新しい収益機会を発見する。",
      objective: "Discovery"
    };
  }

  if (nextBusiness) {
    return {
      id: makeId("strategy"),
      title: `事業候補「${nextBusiness.name}」を検証`,
      reason: "発見済みの候補について市場調査から段階的に検証する。",
      objective: "Business Pipeline"
    };
  }

  return {
    id: makeId("strategy"),
    title: "既存事業候補の改善",
    reason: "これまでの結果を確認し、次の改善候補を選ぶ。",
    objective: "Improvement"
  };
}

async function discoverBusiness(env) {
  const businesses = await getStore(env, STORE_KEYS.business, []);

  const existing = businesses.find(
    (item) =>
      item.name === "小規模事業向け調査レポート生成サービス" &&
      item.status !== "rejected"
  );

  if (existing) {
    return existing;
  }

  const business = normalizeBusiness({
    id: makeId("business"),
    name: "小規模事業向け調査レポート生成サービス",
    customer: "小規模事業者",
    problem: "市場調査や競合調査に時間がかかる",
    status: "discovered",
    stage: "discovered",
    pipeline: "research",
    discoveredAt: nowISO()
  });

  businesses.unshift(business);
  await setStore(env, STORE_KEYS.business, businesses);

  await addLog(
    env,
    "Business Discovery",
    `事業候補を発見しました：「${business.name}」`
  );

  return business;
}

async function createResearchTask(env, business) {
  if (business.researchTaskId) {
    return business.researchTaskId;
  }

  const tasks = await getStore(env, STORE_KEYS.tasks, []);

  const task = {
    id: makeId("task"),
    title: `市場調査:${business.name}`,
    priority: "normal",
    status: "pending",
    runCount: 0,
    lastRunAt: null,
    result: null,
    executor: "Cloud Executor (preparation)",
    source: "Business Discovery",
    createdAt: nowISO(),
    updatedAt: nowISO(),
    evaluation: null,
    level: "research",
    retryCount: 0,
    requiresHuman: false,
    humanGateId: null,
    localExecution: null,
    pipeline: {
      type: "business_pipeline",
      stage: "research",
      businessId: business.id
    }
  };

  tasks.unshift(task);
  await setStore(env, STORE_KEYS.tasks, tasks);

  const businesses = await getStore(env, STORE_KEYS.business, []);
  const index = businesses.findIndex((item) => item.id === business.id);

  if (index >= 0) {
    businesses[index] = normalizeBusiness({
      ...businesses[index],
      status: "researching",
      stage: "research",
      pipeline: "research",
      researchTaskId: task.id
    });

    await setStore(env, STORE_KEYS.business, businesses);
  }

  await addLog(
    env,
    "Task Core",
    `タスクを登録しました：「${task.title}」`
  );

  await addLog(
    env,
    "CEO",
    `市場調査タスクを生成しました：「${business.name}」`
  );

  return task.id;
}

async function executeCloudCycle(env, source = "manual") {
  const lockKey = "cycleLock";
  const currentLock = await getStore(env, lockKey, null);

  if (
    currentLock &&
    Number(currentLock.lockedAtMs || 0) > Date.now() - CYCLE_LOCK_MS
  ) {
    return {
      ok: true,
      status: "busy",
      source,
      message: "別のCompany Cycleが実行中です。"
    };
  }

  await setStore(env, lockKey, {
    lockedAtMs: Date.now(),
    source
  });

  const startedAt = nowISO();  try {
    await addLog(
      env,
      "Company Engine",
      `サイクルを開始しました。source=${source}`
    );

    const companyState = await getStore(
      env,
      STORE_KEYS.companyState,
      clone(DEFAULT_COMPANY_STATE)
    );

    const tasks = await getStore(env, STORE_KEYS.tasks, []);
    const businesses = await getStore(env, STORE_KEYS.business, []);
    const humanGates = await getStore(env, STORE_KEYS.humanGates, []);
    const strategies = await getStore(env, STORE_KEYS.strategies, []);
    const councilCases = await getStore(env, STORE_KEYS.council, []);

    companyState.runtimeVersion = RUNTIME_VERSION;
    companyState.cycleCount = Number(companyState.cycleCount || 0) + 1;
    companyState.lastCycleAt = startedAt;
    companyState.waiting = false;

    await env.DB
      .prepare(
        `UPDATE runtime_meta
         SET cycle_count = ?,
             runtime_version = ?
         WHERE id = 1`
      )
      .bind(companyState.cycleCount, RUNTIME_VERSION)
      .run();

    const pendingGate = humanGates.find(
      (gate) => gate.status === "pending"
    );

    if (pendingGate) {
      companyState.waiting = true;
      companyState.currentFocus = "人間承認待ち";
      companyState.nextAction = "Human Gateの承認を待つ";

      await setStore(env, STORE_KEYS.companyState, companyState);

      await addLog(
        env,
        "待機",
        `人間承認が必要なため停止しました：「${pendingGate.taskTitle}」`
      );

      return {
        ok: true,
        status: "waiting_human",
        source,
        cycleCount: companyState.cycleCount,
        pendingGate: pendingGate.taskTitle
      };
    }

    const pendingTasks = tasks.filter(
      (task) => task.status === "pending"
    );

    if (pendingTasks.length > 0) {
      companyState.currentFocus = "実行基盤の処理待ち";
      companyState.currentPlan = pendingTasks[0].title;
      companyState.nextAction = "Cloud Executorでタスクを実行する";

      await setStore(env, STORE_KEYS.companyState, companyState);

      await addLog(
        env,
        "CEO",
        `未実行タスクを確認しました：「${pendingTasks[0].title}」`
      );

      return {
        ok: true,
        status: "waiting_executor",
        source,
        cycleCount: companyState.cycleCount,
        pendingTask: pendingTasks[0]
      };
    }

    const nextBusiness = await findPipelineBusiness(env, businesses);

    const strategy = makeStrategy({
      pending: 0,
      waitingHuman: 0,
      businesses,
      nextBusiness
    });

    strategies.unshift(strategy);

    await setStore(
      env,
      STORE_KEYS.strategies,
      strategies.slice(0, MAX_STRATEGIES)
    );

    await addLog(
      env,
      "CEO",
      `戦略決定：「${strategy.title}」`
    );

    if (strategy.objective === "Discovery") {
      const discovered = await discoverBusiness(env);

      companyState.currentFocus = "事業機会を探索中";
      companyState.currentPlan = `「${discovered.name}」を検証`;
      companyState.nextAction = "発見した候補の市場調査タスクを生成する";

      const council = makeCouncil(strategy);

      councilCases.unshift(council);

      await setStore(
        env,
        STORE_KEYS.council,
        councilCases.slice(0, MAX_COUNCIL_CASES)
      );

      const decision = makeDecision(strategy, council);

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

      await setStore(
        env,
        STORE_KEYS.companyState,
        companyState
      );

      return {
        ok: true,
        status: "discovered",
        source,
        cycleCount: companyState.cycleCount,
        strategy,
        decision,
        business: discovered,
        council
      };
    }

    const council = makeCouncil(strategy);

    councilCases.unshift(council);

    await setStore(
      env,
      STORE_KEYS.council,
      councilCases.slice(0, MAX_COUNCIL_CASES)
    );

    const decision = makeDecision(strategy, council);

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

    if (strategy.objective === "Business Pipeline") {
      const business = nextBusiness;

      if (
        business &&
        business.stage === "discovered" &&
        !business.researchTaskId
      ) {
        const taskId = await createResearchTask(env, business);

        companyState.currentFocus = "市場調査";
        companyState.currentPlan = `「${business.name}」の市場調査`;
        companyState.nextAction = "Cloud Executorで市場調査タスクを実行する";

        await setStore(
          env,
          STORE_KEYS.companyState,
          companyState
        );

        return {
          ok: true,
          status: "task_created",
          source,
          cycleCount: companyState.cycleCount,
          strategy,
          decision,
          council,
          taskId,
          business
        };
      }

      companyState.currentFocus = "事業候補を監視中";
      companyState.nextAction = "Cloud Executorの実行結果を確認する";

      await setStore(
        env,
        STORE_KEYS.companyState,
        companyState
      );

      return {
        ok: true,
        status: "pipeline_waiting",
        source,
        cycleCount: companyState.cycleCount,
        strategy,
        decision,
        council,
        business: business || null
      };
    }

    companyState.currentFocus = "観測中";
    companyState.nextAction = "会社状態を再評価する";

    await setStore(
      env,
      STORE_KEYS.companyState,
      companyState
    );

    return {
      ok: true,
      status: "completed",
      source,
      cycleCount: companyState.cycleCount,
      strategy,
      decision,
      council
    };  } catch (error) {
    console.error("Company Cycle error:", error);

    const companyState = await getStore(
      env,
      STORE_KEYS.companyState,
      clone(DEFAULT_COMPANY_STATE)
    );

    companyState.currentFocus = "エラー確認中";
    companyState.nextAction = "エラー内容を確認して再実行する";

    await setStore(
      env,
      STORE_KEYS.companyState,
      companyState
    );

    await addLog(
      env,
      "Company Engine",
      `サイクル中にエラーが発生しました：${error.message}`
    );

    return {
      ok: false,
      status: "error",
      source,
      error: String(error.message || error)
    };
  } finally {
    await setStore(env, lockKey, null);

    await addLog(
      env,
      "Company Engine",
      "サイクルを終了しました。"
    );
  }
}

async function heartbeat(env) {
  const now = nowISO();

  await env.DB
    .prepare(
      `UPDATE runtime_meta
       SET last_heartbeat_at = ?,
           runtime_version = ?
       WHERE id = 1`
    )
    .bind(now, RUNTIME_VERSION)
    .run();

  return {
    ok: true,
    heartbeat: true,
    time: now
  };
}

async function health(env) {
  const runtimeMeta = await env.DB
    .prepare(
      `SELECT
         last_heartbeat_at,
         cycle_count,
         runtime_version
       FROM runtime_meta
       WHERE id = 1`
    )
    .first();

  const companyState = await getStore(
    env,
    STORE_KEYS.companyState,
    clone(DEFAULT_COMPANY_STATE)
  );

  const tasks = await getStore(
    env,
    STORE_KEYS.tasks,
    []
  );

  const businesses = await getStore(
    env,
    STORE_KEYS.business,
    []
  );

  const humanGates = await getStore(
    env,
    STORE_KEYS.humanGates,
    []
  );

  return {
    ok: true,
    service: "AI Company Core Cloud Runtime",
    runtime: RUNTIME_VERSION,
    database: true,
    runtime_meta: runtimeMeta,
    company: {
      cycleCount: companyState.cycleCount,
      currentFocus: companyState.currentFocus,
      nextAction: companyState.nextAction,
      pendingTasks: tasks.filter(
        (task) => task.status === "pending"
      ).length,
      businessCount: businesses.length,
      pendingHumanGates: humanGates.filter(
        (gate) => gate.status === "pending"
      ).length
    },
    capabilities: [
      "cloud_ceo_cycle",
      "d1_persistent_state",
      "business_discovery",
      "task_generation",
      "department_council",
      "human_gate_detection",
      "cloud_heartbeat"
    ],
    execution_available: false,
    external_actions: false,
    time: nowISO()
  };
}

async function handleStateRead(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!key) {
    return json(
      {
        ok: false,
        error: "key is required"
      },
      400
    );
  }

  const allowedKeys = new Set(
    Object.values(STORE_KEYS)
  );

  if (!allowedKeys.has(key)) {
    return json(
      {
        ok: false,
        error: "key is not readable"
      },
      403
    );
  }

  const data = await getStore(
    env,
    key,
    null
  );

  return json({
    ok: true,
    key,
    data,
    time: nowISO()
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/health") {
        return json(
          await health(env)
        );
      }

      if (url.pathname === "/api/heartbeat") {
        return json(
          await heartbeat(env)
        );
      }

      if (url.pathname === "/api/cycle") {
        if (
          request.method !== "GET" &&
          request.method !== "POST"
        ) {
          return json(
            {
              ok: false,
              error: "method_not_allowed"
            },
            405,
            {
              Allow: "GET, POST"
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

      if (url.pathname === "/api/state") {
        if (request.method !== "GET") {
          return json(
            {
              ok: false,
              error: "state_write_disabled"
            },
            405,
            {
              Allow: "GET"
            }
          );
        }

        return handleStateRead(
          request,
          env
        );
      }

      return env.ASSETS.fetch(request);

    } catch (error) {
      console.error(
        "Worker request error:",
        error
      );

      return json(
        {
          ok: false,
          error: String(
            error.message || error
          )
        },
        500
      );
    }
  },  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      executeCloudCycle(
        env,
        "cron"
      )
        .then(
          () => heartbeat(env)
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
