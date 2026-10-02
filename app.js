const STORAGE_KEYS = {
  tasks: "aiCompanyTasks",
  founder: "aiCompanyFounderMessages",
  company: "aiCompanyCompanyState",
  engineLog: "aiCompanyEngineLog"
};

const DEPARTMENTS = [
  {
    name: "企画",
    description: "事業性・顧客価値・方向性を確認"
  },
  {
    name: "技術",
    description: "実装可能性・開発負荷・技術課題を確認"
  },
  {
    name: "財務",
    description: "収益性・コスト・資金面を確認"
  },
  {
    name: "リスク管理",
    description: "安全・法務・規約・運営リスクを確認"
  }
];


/* =========================
   DOM
========================= */

const runButton =
  document.getElementById("runButton");

const userInput =
  document.getElementById("userInput");

const status =
  document.getElementById("status");

const result =
  document.getElementById("result");

const systemStatus =
  document.getElementById("systemStatus");

const ceoStatus =
  document.getElementById("ceoStatus");

const engineStatus =
  document.getElementById("engineStatus");

const executorStatus =
  document.getElementById("executorStatus");

const apiStatus =
  document.getElementById("apiStatus");

const companyGoal =
  document.getElementById("companyGoal");

const companyMode =
  document.getElementById("companyMode");

const runCycleButton =
  document.getElementById("runCycleButton");

const startEngineButton =
  document.getElementById("startEngineButton");

const stopEngineButton =
  document.getElementById("stopEngineButton");

const engineSummary =
  document.getElementById("engineSummary");

const engineLog =
  document.getElementById("engineLog");

const taskInput =
  document.getElementById("taskInput");

const taskPriority =
  document.getElementById("taskPriority");

const addTaskButton =
  document.getElementById("addTaskButton");

const taskList =
  document.getElementById("taskList");

const taskCount =
  document.getElementById("taskCount");

const founderInput =
  document.getElementById("founderInput");

const founderSubmitButton =
  document.getElementById("founderSubmitButton");

const founderLog =
  document.getElementById("founderLog");

const ceoCouncilList =
  document.getElementById("ceoCouncilList");

const departmentStatus =
  document.getElementById("departmentStatus");


/* =========================
   UTILITY
========================= */

function loadJSON(key, fallback) {
  try {
    const raw =
      localStorage.getItem(key);

    return raw
      ? JSON.parse(raw)
      : fallback;

  } catch (error) {

    console.error(
      "データ読み込みエラー:",
      key,
      error
    );

    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(
    key,
    JSON.stringify(value)
  );
}

function formatDate(value) {
  return value
    ? new Date(value).toLocaleString("ja-JP")
    : "まだありません";
}

function setStatus(message) {
  status.textContent =
    message;
}


/* =========================
   COMPANY STATE
========================= */

let companyState =
  loadJSON(
    STORAGE_KEYS.company,
    {
      goal:
        "安全に自社内で収益化できる事業を探し、検証し、改善する",

      mode:
        "通常",

      running:
        false,

      cycleCount:
        0,

      lastCycleAt:
        null,

      currentFocus:
        "待機中"
    }
  );

let engineEntries =
  loadJSON(
    STORAGE_KEYS.engineLog,
    []
  );

let engineTimer =
  null;


/* =========================
   TASK DATA
========================= */

let tasks =
  loadJSON(
    STORAGE_KEYS.tasks,
    []
  );


tasks =
  tasks.map(function (task) {

    return {

      text:
        task.text ||
        "無題のタスク",

      priority:
        task.priority ||
        "通常",

      status:
        task.status ||
        (
          task.completed
            ? "completed"
            : "pending"
        ),

      runCount:
        Number(task.runCount) ||
        0,

      lastRunAt:
        task.lastRunAt ||
        null,

      result:
        task.result ||
        "",

      executor:
        task.executor ||
        "local",

      source:
        task.source ||
        "manual"
    };
  });


/* =========================
   FOUNDER DATA
========================= */

let founderMessages =
  loadJSON(
    STORAGE_KEYS.founder,
    []
  );


founderMessages =
  founderMessages.map(
    function (message, index) {

      return {

        id:
          message.id ||
          `founder-${Date.now()}-${index}`,

        text:
          message.text ||
          "",

        status:
          message.status ||
          "CEO協議待ち",

        departments:
          Array.isArray(
            message.departments
          )
            ? message.departments
            : [],

        reviews:
          message.reviews &&
          typeof message.reviews === "object"
            ? message.reviews
            : {},

        ceoDecision:
          message.ceoDecision ||
          null,

        taskCreated:
          Boolean(
            message.taskCreated
          ),

        createdAt:
          message.createdAt ||
          new Date().toISOString(),

        updatedAt:
          message.updatedAt ||
          new Date().toISOString()
      };
    }
  );


/* =========================
   SAVE
========================= */

function saveTasks() {

  saveJSON(
    STORAGE_KEYS.tasks,
    tasks
  );
}

function saveFounderMessages() {

  saveJSON(
    STORAGE_KEYS.founder,
    founderMessages
  );
}

function saveAll() {

  saveJSON(
    STORAGE_KEYS.company,
    companyState
  );

  saveJSON(
    STORAGE_KEYS.engineLog,
    engineEntries.slice(-30)
  );

  saveTasks();
  saveFounderMessages();
}


/* =========================
   ENGINE LOG
========================= */

function logEngine(message) {

  const entry = {
    time:
      new Date().toISOString(),

    message:
      message
  };

  engineEntries.push(entry);

  saveJSON(
    STORAGE_KEYS.engineLog,
    engineEntries.slice(-30)
  );

  engineSummary.textContent =
    `${formatDate(entry.time)}：${message}`;

  renderEngineLog();
}


function renderEngineLog() {

  engineLog.replaceChildren();

  [
    ...engineEntries
  ]
    .reverse()
    .slice(0, 10)
    .forEach(
      function (entry) {

        const li =
          document.createElement(
            "li"
          );

        li.textContent =
          `${formatDate(entry.time)}：${entry.message}`;

        engineLog.appendChild(
          li
        );
      }
    );
}


/* =========================
   BASIC TEST
========================= */

runButton.addEventListener(
  "click",
  function () {

    const text =
      userInput.value.trim();

    setStatus(
      "正常稼働"
    );

    if (!text) {

      result.textContent =
        "動作テストに成功しました。入力は空です。";

      return;
    }

    result.textContent =
      `入力を受け取りました：${text}`;
  }
);


/* =========================
   TASK CORE
========================= */

function getPriorityValue(priority) {

  if (priority === "高") {
    return 1;
  }

  if (priority === "通常") {
    return 2;
  }

  return 3;
}


function getTaskStatusValue(statusValue) {

  if (statusValue === "pending") {
    return 1;
  }

  if (statusValue === "running") {
    return 2;
  }

  return 3;
}


function getTaskStatusText(statusValue) {

  if (statusValue === "running") {
    return "（実行中）";
  }

  if (statusValue === "completed") {
    return "（完了）";
  }

  return "";
}


function executeTaskLocally(task) {

  return new Promise(
    function (resolve) {

      setTimeout(
        function () {

          resolve({

            success: true,

            executor:
              "local",

            result:
              `ローカル実行を受け付けました：${task.text}`
          });

        },
        300
      );
    }
  );
}


async function runSingleTask(task) {

  task.status =
    "running";

  task.runCount +=
    1;

  task.lastRunAt =
    new Date().toISOString();

  saveTasks();
  renderTasks();

  setStatus(
    `タスクを実行中：${task.text}`
  );


  const execution =
    await executeTaskLocally(
      task
    );


  if (!execution.success) {

    task.status =
      "pending";

  } else {

    task.status =
      "completed";

    task.executor =
      execution.executor;

    task.result =
      execution.result;
  }


  saveTasks();
  renderTasks();


  setStatus(
    execution.success
      ? "ローカル実行が完了しました"
      : "タスクの実行に失敗しました"
  );

  result.textContent =
    execution.success
      ? execution.result
      : "実行に失敗しました。";
}


function renderTasks() {

  taskList.replaceChildren();


  const sorted =
    [...tasks].sort(
      function (a, b) {

        const priorityDiff =
          getPriorityValue(
            a.priority
          ) -
          getPriorityValue(
            b.priority
          );

        if (
          priorityDiff !== 0
        ) {
          return priorityDiff;
        }

        return (
          getTaskStatusValue(
            a.status
          ) -
          getTaskStatusValue(
            b.status
          )
        );
      }
    );


  sorted.forEach(
    function (task) {

      const item =
        document.createElement(
          "li"
        );


      const text =
        document.createElement(
          "span"
        );

      text.textContent =
        `${task.text}（優先度：${task.priority}）${getTaskStatusText(task.status)}`;


      const history =
        document.createElement(
          "small"
        );

      history.textContent =
        `実行回数：${task.runCount}回 / 最終実行：${formatDate(task.lastRunAt)}`;


      const taskResult =
        document.createElement(
          "small"
        );

      taskResult.textContent =
        task.result
          ? `実行結果：${task.result}`
          : "実行結果：まだありません";


      const executor =
        document.createElement(
          "small"
        );

      executor.textContent =
        `実行方式：${task.executor === "local" ? "Local Executor" : task.executor}`;


      const edit =
        document.createElement(
          "button"
        );

      edit.textContent =
        "編集";


      edit.addEventListener(
        "click",
        function () {

          const value =
            window.prompt(
              "新しいタスク名を入力してください",
              task.text
            );


          if (
            value === null
          ) {
            return;
          }


          const trimmed =
            value.trim();


          if (!trimmed) {

            setStatus(
              "タスク名を入力してください"
            );

            return;
          }


          task.text =
            trimmed;

          saveTasks();
          renderTasks();

          setStatus(
            "タスクを編集しました"
          );
        }
      );


      const action =
        document.createElement(
          "button"
        );


      if (
        task.status === "pending"
      ) {

        action.textContent =
          "実行";


        action.addEventListener(
          "click",
          async function () {

            await runSingleTask(
              task
            );
          }
        );


      } else if (
        task.status === "running"
      ) {

        action.textContent =
          "完了";


        action.addEventListener(
          "click",
          function () {

            const value =
              window.prompt(
                "このタスクの実行結果を入力してください",
                task.result
              );


            if (
              value === null
            ) {
              return;
            }


            const trimmed =
              value.trim();


            if (!trimmed) {

              setStatus(
                "実行結果を入力してください"
              );

              return;
            }


            task.result =
              trimmed;

            task.status =
              "completed";


            saveTasks();
            renderTasks();


            setStatus(
              "タスクを完了にしました"
            );
          }
        );


      } else {

        action.textContent =
          "未完了に戻す";


        action.addEventListener(
          "click",
          function () {

            task.status =
              "pending";

            saveTasks();
            renderTasks();

            setStatus(
              "タスクを未完了に戻しました"
            );
          }
        );
      }


      const remove =
        document.createElement(
          "button"
        );

      remove.textContent =
        "削除";


      remove.addEventListener(
        "click",
        function () {

          const index =
            tasks.indexOf(task);

          if (
            index >= 0
          ) {
            tasks.splice(
              index,
              1
            );
          }

          saveTasks();
          renderTasks();

          setStatus(
            "タスクを削除しました"
          );
        }
      );


      item.append(
        text,
        history,
        taskResult,
        executor,
        edit,
        action,
        remove
      );


      taskList.appendChild(
        item
      );
    }
  );


  taskCount.textContent =
    `登録数：${tasks.length}件`;
}


addTaskButton.addEventListener(
  "click",
  function () {

    const text =
      taskInput.value.trim();


    if (!text) {

      setStatus(
        "タスクを入力してください"
      );

      return;
    }


    tasks.push({

      text,

      priority:
        taskPriority.value,

      status:
        "pending",

      runCount:
        0,

      lastRunAt:
        null,

      result:
        "",

      executor:
        "local",

      source:
        "manual"
    });


    saveTasks();


    taskInput.value =
      "";

    taskPriority.value =
      "通常";


    renderTasks();


    setStatus(
      "タスクを登録しました"
    );
  }
);


/* =========================
   FOUNDER / CEO
========================= */

function determineDepartments(text) {

  const value =
    text.toLowerCase();

  const selected =
    [];


  function add(name) {

    if (
      !selected.includes(name)
    ) {
      selected.push(name);
    }
  }


  if (
    [
      "事業",
      "商品",
      "サービス",
      "企画",
      "ゲーム"
    ].some(
      word => value.includes(word)
    )
  ) {
    add("企画");
  }


  if (
    [
      "開発",
      "技術",
      "アプリ",
      "システム",
      "ゲーム"
    ].some(
      word => value.includes(word)
    )
  ) {
    add("技術");
  }


  if (
    [
      "収益",
      "売上",
      "価格",
      "利益",
      "事業"
    ].some(
      word => value.includes(word)
    )
  ) {
    add("財務");
  }


  if (
    [
      "危険",
      "リスク",
      "法律",
      "規約",
      "契約",
      "外部"
    ].some(
      word => value.includes(word)
    )
  ) {
    add("リスク管理");
  }


  if (
    selected.length === 0
  ) {

    return [
      "企画",
      "技術",
      "財務"
    ];
  }


  return selected;
}


function generateDepartmentReview(
  message,
  department
) {

  const texts = {

    "企画":
      "顧客価値、需要、差別化、事業として成立させる理由を確認します。",

    "技術":
      "実装規模、技術負荷、保守性、依存関係を確認します。",

    "財務":
      "収益源、コスト、継続性、資金リスクを確認します。",

    "リスク管理":
      "安全性、法務、規約、運営上のリスクを確認します。"
  };


  const recommendations = {

    "企画":
      "小さく検証して顧客反応を確認する。",

    "技術":
      "最小構成から試作し、複雑な依存を避ける。",

    "財務":
      "大きな固定費を避け、低コストで収益仮説を検証する。",

    "リスク管理":
      "不明なリスクを残したまま自動実行しない。"
  };


  return {

    summary:
      texts[department] ||
      "追加確認が必要です。",

    recommendation:
      recommendations[department] ||
      "追加確認が必要です。",

    concern:
      `Founder提案「${message.text}」について、${department}の視点から追加確認が必要です。`,

    source:
      "Core Rule"
  };
}


function generateCeoDecision(
  message
) {

  const hasRisk =
    message.departments.includes(
      "リスク管理"
    );

  const hasBusiness =
    message.departments.includes(
      "企画"
    );

  const hasFinance =
    message.departments.includes(
      "財務"
    );


  if (
    hasRisk &&
    hasBusiness
  ) {

    return {

      decision:
        "条件付きで検討",

      reason:
        "事業性を確認する価値はありますが、安全面と実行条件を確認してから進めます。",

      nextAction:
        "小規模検証を行い、結果を再評価する",

      source:
        "Core Rule",

      decidedAt:
        new Date().toISOString()
    };
  }


  if (
    hasBusiness &&
    hasFinance
  ) {

    return {

      decision:
        "検討継続",

      reason:
        "事業性と収益性の両面から、追加検証を進めます。",

      nextAction:
        "市場検証と小規模実装を開始する",

      source:
        "Core Rule",

      decidedAt:
        new Date().toISOString()
    };
  }


  return {

    decision:
      "追加検討",

    reason:
      "情報が不足しているため、追加調査を行います。",

    nextAction:
      "提案内容を小さな検証タスクへ分解する",

    source:
      "Core Rule",

    decidedAt:
      new Date().toISOString()
  };
}


function renderFounderMessages() {

  founderLog.replaceChildren();


  if (
    !founderMessages.length
  ) {

    const li =
      document.createElement(
        "li"
      );

    li.textContent =
      "まだ協議案件はありません。";

    founderLog.appendChild(
      li
    );

    return;
  }


  founderMessages.forEach(
    function (message) {

      const li =
        document.createElement(
          "li"
        );


      const text =
        document.createElement(
          "p"
        );

      text.textContent =
        `Founder：${message.text}`;


      const state =
        document.createElement(
          "small"
        );

      state.textContent =
        `状態：${message.status}`;


      const created =
        document.createElement(
          "small"
        );

      created.textContent =
        `提出日時：${formatDate(message.createdAt)}`;


      li.append(
        text,
        state,
        created
      );


      if (
        message.ceoDecision
      ) {

        const box =
          document.createElement(
            "div"
          );

        box.className =
          "decision-box";

        box.textContent =
          `CEO判断：${message.ceoDecision.decision}`;

        li.appendChild(
          box
        );
      }


      founderLog.appendChild(
        li
      );
    }
  );
}


function renderCeoCouncil() {

  ceoCouncilList.replaceChildren();


  if (
    !founderMessages.length
  ) {

    const li =
      document.createElement(
        "li"
      );

    li.textContent =
      "現在、CEO協議案件はありません。";

    ceoCouncilList.appendChild(
      li
    );

    return;
  }


  founderMessages.forEach(
    function (message) {

      const card =
        document.createElement(
          "li"
        );

      card.className =
        "council-card";


      const title =
        document.createElement(
          "p"
        );

      title.textContent =
        message.text;


      const state =
        document.createElement(
          "small"
        );

      state.textContent =
        `CEO状態：${message.status}`;


      card.append(
        title,
        state
      );


      if (
        message.status ===
        "CEO協議待ち"
      ) {

        const start =
          document.createElement(
            "button"
          );

        start.textContent =
          "CEO協議を開始";


        start.addEventListener(
          "click",
          function () {

            processFounderStart(
              message
            );
          }
        );


        card.appendChild(
          start
        );
      }


      message.departments.forEach(
        function (department) {

          const box =
            document.createElement(
              "div"
            );

          box.className =
            "department-card";


          const heading =
            document.createElement(
              "h3"
            );

          heading.textContent =
            department;


          const info =
            DEPARTMENTS.find(
              item =>
                item.name ===
                department
            );


          const description =
            document.createElement(
              "small"
            );

          description.textContent =
            info
              ? info.description
              : "";


          box.append(
            heading,
            description
          );


          if (
            message.reviews[
              department
            ]
          ) {

            const review =
              document.createElement(
                "p"
              );

            review.textContent =
              message.reviews[
                department
              ].summary;


            const rec =
              document.createElement(
                "small"
              );

            rec.textContent =
              `提案：${message.reviews[department].recommendation}`;


            box.append(
              review,
              rec
            );


          } else {

            const reviewButton =
              document.createElement(
                "button"
              );

            reviewButton.textContent =
              "部署レビューを実行";


            reviewButton.addEventListener(
              "click",
              function () {

                processDepartmentReview(
                  message,
                  department
                );
              }
            );


            box.appendChild(
              reviewButton
            );
          }


          card.appendChild(
            box
          );
        }
      );


      const allReviewed =
        message.departments.length > 0 &&
        message.departments.every(
          department =>
            Boolean(
              message.reviews[
                department
              ]
            )
        );


      if (
        allReviewed &&
        !message.ceoDecision
      ) {

        const decisionButton =
          document.createElement(
            "button"
          );

        decisionButton.textContent =
          "CEOが総合判断する";


        decisionButton.addEventListener(
          "click",
          function () {

            processCeoDecision(
              message
            );
          }
        );


        card.appendChild(
          decisionButton
        );
      }


      if (
        message.ceoDecision
      ) {

        const box =
          document.createElement(
            "div"
          );

        box.className =
          "decision-box";


        const strong =
          document.createElement(
            "strong"
          );

        strong.textContent =
          `CEO判断：${message.ceoDecision.decision}`;


        const reason =
          document.createElement(
            "p"
          );

        reason.textContent =
          `理由：${message.ceoDecision.reason}`;


        const next =
          document.createElement(
            "p"
          );

        next.textContent =
          `次の行動：${message.ceoDecision.nextAction}`;


        box.append(
          strong,
          reason,
          next
        );


        if (
          !message.taskCreated
        ) {

          const createTask =
            document.createElement(
              "button"
            );

          createTask.textContent =
            "次の行動をタスク化";


          createTask.addEventListener(
            "click",
            function () {

              createTaskFromDecision(
                message
              );
            }
          );


          box.appendChild(
            createTask
          );
        }


        card.appendChild(
          box
        );
      }


      ceoCouncilList.appendChild(
        card
      );
    }
  );
}


function processFounderStart(
  message
) {

  message.departments =
    determineDepartments(
      message.text
    );

  message.status =
    "各部署確認中";

  message.updatedAt =
    new Date().toISOString();


  saveFounderMessages();

  renderFounderMessages();
  renderCeoCouncil();


  ceoStatus.textContent =
    "各部署確認中";


  setStatus(
    "CEOが各部署へ協議を回しました"
  );
}


function processDepartmentReview(
  message,
  department
) {

  message.reviews[
    department
  ] =
    generateDepartmentReview(
      message,
      department
    );


  message.status =
    "各部署レビュー中";

  message.updatedAt =
    new Date().toISOString();


  saveFounderMessages();

  renderFounderMessages();
  renderCeoCouncil();


  setStatus(
    `${department}のレビューを記録しました`
  );
}


function processCeoDecision(
  message
) {

  message.ceoDecision =
    generateCeoDecision(
      message
    );

  message.status =
    "CEO判断完了";

  message.updatedAt =
    new Date().toISOString();


  saveFounderMessages();

  renderFounderMessages();
  renderCeoCouncil();


  ceoStatus.textContent =
    "判断完了";


  setStatus(
    "CEOが各部署の意見を統合しました"
  );
}


function createTaskFromDecision(
  message
) {

  tasks.push({

    text:
      message.ceoDecision.nextAction,

    priority:
      companyState.mode === "攻め"
        ? "高"
        : "通常",

    status:
      "pending",

    runCount:
      0,

    lastRunAt:
      null,

    result:
      "",

    executor:
      "local",

    source:
      "ceo"
  });


  message.taskCreated =
    true;

  message.status =
    "判断からタスク作成済み";

  message.updatedAt =
    new Date().toISOString();


  saveAll();

  renderTasks();
  renderFounderMessages();
  renderCeoCouncil();


  setStatus(
    "CEO判断からタスクを作成しました"
  );
}


/* =========================
   FOUNDER SUBMIT
========================= */

founderSubmitButton.addEventListener(
  "click",
  function () {

    const text =
      founderInput.value.trim();


    if (!text) {

      setStatus(
        "相談内容を入力してください"
      );

      return;
    }


    founderMessages.push({

      id:
        `founder-${Date.now()}`,

      text,

      status:
        "CEO協議待ち",

      departments:
        [],

      reviews:
        {},

      ceoDecision:
        null,

      taskCreated:
        false,

      createdAt:
        new Date().toISOString(),

      updatedAt:
        new Date().toISOString()
    });


    saveFounderMessages();


    founderInput.value =
      "";


    renderFounderMessages();
    renderCeoCouncil();


    ceoStatus.textContent =
      "新規案件受信";


    setStatus(
      "Founder RoomからCEOへ議題を提出しました"
    );
  }
);


/* =========================
   INTERNAL DEPARTMENTS
========================= */

function renderDepartmentStatus() {

  departmentStatus.replaceChildren();


  DEPARTMENTS.forEach(
    function (department) {

      const card =
        document.createElement(
          "div"
        );

      card.className =
        "department-card";


      const title =
        document.createElement(
          "h3"
        );

      title.textContent =
        department.name;


      const description =
        document.createElement(
          "p"
        );

      description.className =
        "department-status";

      description.textContent =
        department.description;


      card.append(
        title,
        description
      );


      departmentStatus.appendChild(
        card
      );
    }
  );
}


/* =========================
   COMPANY AUTONOMOUS ENGINE
========================= */

function chooseInternalTask() {

  const textByMode = {

    "攻め":
      "新規事業機会を調査し、検証候補を整理する",

    "通常":
      "既存業務の改善余地を確認し、効率化候補を整理する",

    "守り":
      "会社運営上のリスクを確認し、問題候補を整理する"
  };


  const desired =
    textByMode[
      companyState.mode
    ];


  const exists =
    tasks.some(
      function (task) {

        return (
          task.text ===
          desired &&
          task.status !==
            "completed"
        );
      }
    );


  if (exists) {
    return null;
  }


  const task = {

    text:
      desired,

    priority:
      companyState.mode === "攻め"
        ? "高"
        : "通常",

    status:
      "pending",

    runCount:
      0,

    lastRunAt:
      null,

    result:
      "",

    executor:
      "local",

    source:
      "company-engine"
  };


  tasks.push(task);

  saveTasks();
  renderTasks();


  return task;
}


async function runCompanyCycle() {

  companyState.cycleCount +=
    1;

  companyState.lastCycleAt =
    new Date().toISOString();

  companyState.currentFocus =
    "観測中";


  saveJSON(
    STORAGE_KEYS.company,
    companyState
  );


  engineStatus.textContent =
    "サイクル実行中";

  ceoStatus.textContent =
    "観測中";


  /* Founder案件 */

  const pendingFounder =
    founderMessages.find(
      message =>
        message.status ===
        "CEO協議待ち"
    );


  if (
    pendingFounder
  ) {

    processFounderStart(
      pendingFounder
    );


    logEngine(
      `Founder案件をCEO協議へ移しました：${pendingFounder.text}`
    );


    companyState.currentFocus =
      "Founder案件の部署協議";


    finishCycle();

    return;
  }


  /* 部署レビュー */

  const reviewable =
    founderMessages.find(
      function (message) {

        return (
          message.departments.length > 0 &&
          message.departments.some(
            department =>
              !message.reviews[
                department
              ]
          )
        );
      }
    );


  if (
    reviewable
  ) {

    const department =
      reviewable.departments.find(
        department =>
          !reviewable.reviews[
            department
          ]
      );


    processDepartmentReview(
      reviewable,
      department
    );


    logEngine(
      `部署レビューを実行しました：${department}`
    );


    companyState.currentFocus =
      `${department}レビュー`;


    finishCycle();

    return;
  }


  /* CEO判断 */

  const decisionReady =
    founderMessages.find(
      function (message) {

        return (
          message.departments.length > 0 &&
          !message.ceoDecision &&
          message.departments.every(
            department =>
              Boolean(
                message.reviews[
                  department
                ]
              )
          )
        );
      }
    );


  if (
    decisionReady
  ) {

    processCeoDecision(
      decisionReady
    );


    logEngine(
      `CEO判断を実行しました：${decisionReady.text}`
    );


    companyState.currentFocus =
      "CEO判断";


    finishCycle();

    return;
  }


  /* 判断からタスク */

  const taskReady =
    founderMessages.find(
      message =>
        message.ceoDecision &&
        !message.taskCreated
    );


  if (
    taskReady
  ) {

    createTaskFromDecision(
      taskReady
    );


    logEngine(
      `CEO判断からタスクを作成しました：${taskReady.ceoDecision.nextAction}`
    );


    companyState.currentFocus =
      "判断の実行化";


    finishCycle();

    return;
  }


  /* 既存タスク */

  const pendingTask =
    [...tasks]
      .sort(
        (a, b) =>
          getPriorityValue(
            a.priority
          ) -
          getPriorityValue(
            b.priority
          )
      )
      .find(
        task =>
          task.status ===
          "pending"
      );


  if (
    pendingTask
  ) {

    await runSingleTask(
      pendingTask
    );


    logEngine(
      `タスクを実行しました：${pendingTask.text}`
    );


    companyState.currentFocus =
      `タスク実行：${pendingTask.text}`;


    finishCycle();

    return;
  }


  /* 会社自身の仕事 */

  const internalTask =
    chooseInternalTask();


  if (
    internalTask
  ) {

    logEngine(
      `会社自身の次の仕事を作成しました：${internalTask.text}`
    );


    companyState.currentFocus =
      "自律タスク生成";


    finishCycle();

    return;
  }


  companyState.currentFocus =
    "観測待機";


  logEngine(
    "現時点で優先して処理すべき仕事はありません。"
  );


  finishCycle();
}


function finishCycle() {

  companyState.lastCycleAt =
    new Date().toISOString();


  saveAll();


  engineStatus.textContent =
    companyState.running
      ? "自律運転中"
      : "待機中";


  engineSummary.textContent =
    `サイクル${companyState.cycleCount}回目 / ${formatDate(companyState.lastCycleAt)} / ${companyState.currentFocus}`;


  renderEngineLog();
  renderTasks();
  renderFounderMessages();
  renderCeoCouncil();
}


/* =========================
   ENGINE CONTROLS
========================= */

runCycleButton.addEventListener(
  "click",
  async function () {

    if (
      runCycleButton.disabled
    ) {
      return;
    }


    runCycleButton.disabled =
      true;


    try {

      await runCompanyCycle();

    } finally {

      runCycleButton.disabled =
        false;
    }
  }
);


startEngineButton.addEventListener(
  "click",
  async function () {

    if (
      companyState.running
    ) {
      return;
    }


    companyState.running =
      true;

    saveJSON(
      STORAGE_KEYS.company,
      companyState
    );


    startEngineButton.disabled =
      true;

    stopEngineButton.disabled =
      false;


    engineStatus.textContent =
      "自律運転中";


    logEngine(
      "Company Engineの自律運転を開始しました。"
    );


    await runCompanyCycle();


    engineTimer =
      setInterval(
        function () {

          if (
            companyState.running
          ) {
            runCompanyCycle();
          }

        },
        60000
      );
  }
);


stopEngineButton.addEventListener(
  "click",
  function () {

    companyState.running =
      false;


    saveJSON(
      STORAGE_KEYS.company,
      companyState
    );


    if (
      engineTimer
    ) {

      clearInterval(
        engineTimer
      );

      engineTimer =
        null;
    }


    startEngineButton.disabled =
      false;

    stopEngineButton.disabled =
      true;


    engineStatus.textContent =
      "停止中";


    logEngine(
      "Company Engineの自律運転を停止しました。"
    );
  }
);


/* =========================
   COMPANY SETTINGS
========================= */

companyGoal.value =
  companyState.goal;

companyMode.value =
  companyState.mode;


companyGoal.addEventListener(
  "change",
  function () {

    const value =
      companyGoal.value.trim();


    if (
      value
    ) {

      companyState.goal =
        value;

      saveJSON(
        STORAGE_KEYS.company,
        companyState
      );

      setStatus(
        "会社目標を更新しました"
      );
    }
  }
);


companyMode.addEventListener(
  "change",
  function () {

    companyState.mode =
      companyMode.value;


    saveJSON(
      STORAGE_KEYS.company,
      companyState
    );


    setStatus(
      `会社モードを「${companyState.mode}」に変更しました`
    );
  }
);


/* =========================
   INITIALIZE
========================= */

systemStatus.textContent =
  "正常稼働";

executorStatus.textContent =
  "Local Executor";

apiStatus.textContent =
  "使用しない";

engineStatus.textContent =
  companyState.running
    ? "自律運転中"
    : "停止中";

ceoStatus.textContent =
  founderMessages.length
    ? "案件監視中"
    : "待機中";


renderTasks();
renderFounderMessages();
renderCeoCouncil();
renderDepartmentStatus();
renderEngineLog();


if (
  companyState.running
) {

  companyState.running =
    false;

  saveJSON(
    STORAGE_KEYS.company,
    companyState
  );
}
