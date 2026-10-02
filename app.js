const STORAGE_KEYS = {
  tasks: "aiCompanyTasks",
  founder: "aiCompanyFounderMessages"
};

const DEPARTMENTS = [
  {
    id: "planning",
    name: "企画",
    description: "事業性・顧客価値・方向性を確認"
  },
  {
    id: "technology",
    name: "技術",
    description: "実装可能性・開発負荷・技術課題を確認"
  },
  {
    id: "finance",
    name: "財務",
    description: "収益性・コスト・資金面を確認"
  },
  {
    id: "risk",
    name: "リスク管理",
    description: "安全・法務・規約・運営リスクを確認"
  }
];


/* =========================
   DOM
========================= */

const runButton = document.getElementById("runButton");
const userInput = document.getElementById("userInput");
const status = document.getElementById("status");
const result = document.getElementById("result");

const systemStatus = document.getElementById("systemStatus");
const ceoStatus = document.getElementById("ceoStatus");
const executorStatus = document.getElementById("executorStatus");
const apiStatus = document.getElementById("apiStatus");

const taskInput = document.getElementById("taskInput");
const taskPriority = document.getElementById("taskPriority");
const addTaskButton = document.getElementById("addTaskButton");
const taskList = document.getElementById("taskList");
const taskCount = document.getElementById("taskCount");

const founderInput = document.getElementById("founderInput");
const founderSubmitButton =
  document.getElementById("founderSubmitButton");
const founderLog =
  document.getElementById("founderLog");

const ceoCouncilList =
  document.getElementById("ceoCouncilList");

const departmentStatus =
  document.getElementById("departmentStatus");


/* =========================
   UTILS
========================= */

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);

    return parsed;
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

function formatDate(dateString) {
  if (!dateString) {
    return "まだありません";
  }

  return new Date(
    dateString
  ).toLocaleString("ja-JP");
}


/* =========================
   TASK DATA
========================= */

let tasks = loadJSON(
  STORAGE_KEYS.tasks,
  []
);

tasks = tasks.map(function (task) {
  let statusValue = task.status;

  if (!statusValue) {
    statusValue =
      task.completed
        ? "completed"
        : "pending";
  }

  return {
    text: task.text || "無題のタスク",
    priority:
      task.priority || "通常",

    status:
      statusValue,

    runCount:
      Number(task.runCount) || 0,

    lastRunAt:
      task.lastRunAt || null,

    result:
      task.result || "",

    executor:
      task.executor || "local"
  };
});

function saveTasks() {
  saveJSON(
    STORAGE_KEYS.tasks,
    tasks
  );
}


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
          message.ceoDecision || null,

        createdAt:
          message.createdAt ||
          new Date().toISOString(),

        updatedAt:
          message.updatedAt ||
          message.createdAt ||
          new Date().toISOString()
      };
    }
  );

function saveFounderMessages() {
  saveJSON(
    STORAGE_KEYS.founder,
    founderMessages
  );
}


/* =========================
   CORE STATUS
========================= */

function setStatus(message) {
  status.textContent = message;
}

function setSystemStatus(message) {
  systemStatus.textContent = message;
}

function setCeoStatus(message) {
  ceoStatus.textContent = message;
}


/* =========================
   BASIC TEST
========================= */

runButton.addEventListener(
  "click",
  function () {

    const inputText =
      userInput.value.trim();

    setStatus(
      "正常稼働"
    );

    setSystemStatus(
      "正常稼働"
    );

    if (inputText === "") {

      result.textContent =
        "動作テストに成功しました。入力は空です。";

      return;
    }

    result.textContent =
      "入力を受け取りました：" +
      inputText;
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

function getTaskStatusValue(taskStatus) {

  if (taskStatus === "pending") {
    return 1;
  }

  if (taskStatus === "running") {
    return 2;
  }

  return 3;
}

function getTaskStatusText(taskStatus) {

  if (taskStatus === "running") {
    return "（実行中）";
  }

  if (taskStatus === "completed") {
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
            executor: "local",

            result:
              "ローカル実行を受け付けました：" +
              task.text
          });

        },
        300
      );
    }
  );
}


function renderTasks() {

  taskList.replaceChildren();

  const sortedTasks =
    [...tasks].sort(
      function (a, b) {

        const priorityDiff =
          getPriorityValue(
            a.priority
          ) -
          getPriorityValue(
            b.priority
          );

        if (priorityDiff !== 0) {
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


  sortedTasks.forEach(
    function (task) {

      const item =
        document.createElement("li");


      const taskText =
        document.createElement("span");

      taskText.textContent =
        task.text +
        "（優先度：" +
        task.priority +
        "）" +
        getTaskStatusText(
          task.status
        );


      const historyText =
        document.createElement("small");

      historyText.textContent =
        "実行回数：" +
        task.runCount +
        "回 / 最終実行：" +
        formatDate(
          task.lastRunAt
        );


      const taskResult =
        document.createElement("small");

      taskResult.textContent =
        task.result
          ? "実行結果：" +
            task.result

          : "実行結果：まだありません";


      const executorText =
        document.createElement("small");

      executorText.textContent =
        "実行方式：" +
        (
          task.executor === "local"
            ? "Local Executor"
            : task.executor
        );


      const editButton =
        document.createElement("button");

      editButton.textContent =
        "編集";

      editButton.type =
        "button";


      editButton.addEventListener(
        "click",
        function () {

          const newText =
            window.prompt(
              "新しいタスク名を入力してください",
              task.text
            );

          if (newText === null) {
            return;
          }

          const trimmed =
            newText.trim();

          if (!trimmed) {

            setStatus(
              "タスク名を入力してください"
            );

            return;
          }

          task.text = trimmed;

          saveTasks();
          renderTasks();

          setStatus(
            "タスクを編集しました"
          );
        }
      );


      const actionButton =
        document.createElement("button");

      actionButton.type =
        "button";


      if (task.status === "pending") {

        actionButton.textContent =
          "実行";


        actionButton.addEventListener(
          "click",
          async function () {

            task.status =
              "running";

            task.runCount += 1;

            task.lastRunAt =
              new Date().toISOString();

            saveTasks();
            renderTasks();

            setStatus(
              "ローカル実行を開始しました"
            );

            result.textContent =
              "実行中：" +
              task.text;


            const execution =
              await executeTaskLocally(
                task
              );


            if (!execution.success) {

              task.status =
                "pending";

              saveTasks();
              renderTasks();

              setStatus(
                "タスクの実行に失敗しました"
              );

              return;
            }


            task.status =
              "completed";

            task.executor =
              execution.executor;

            task.result =
              execution.result;


            saveTasks();
            renderTasks();


            setStatus(
              "ローカル実行が完了しました"
            );

            result.textContent =
              execution.result;
          }
        );

      } else if (
        task.status === "running"
      ) {

        actionButton.textContent =
          "完了";


        actionButton.addEventListener(
          "click",
          function () {

            const manualResult =
              window.prompt(
                "このタスクの実行結果を入力してください",
                task.result
              );

            if (
              manualResult === null
            ) {
              return;
            }

            const trimmed =
              manualResult.trim();

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

            result.textContent =
              "完了：" +
              task.text;
          }
        );

      } else {

        actionButton.textContent =
          "未完了に戻す";


        actionButton.addEventListener(
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


      const deleteButton =
        document.createElement("button");

      deleteButton.textContent =
        "削除";

      deleteButton.type =
        "button";


      deleteButton.addEventListener(
        "click",
        function () {

          const index =
            tasks.indexOf(task);

          if (index !== -1) {
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


      item.appendChild(
        taskText
      );

      item.appendChild(
        historyText
      );

      item.appendChild(
        taskResult
      );

      item.appendChild(
        executorText
      );

      item.appendChild(
        editButton
      );

      item.appendChild(
        actionButton
      );

      item.appendChild(
        deleteButton
      );

      taskList.appendChild(
        item
      );
    }
  );

  taskCount.textContent =
    "登録数：" +
    tasks.length +
    "件";
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

      text: text,

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
        "local"
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
   DEPARTMENT LOGIC
========================= */

function determineDepartments(text) {

  const normalized =
    text.toLowerCase();

  const selected = [];


  function add(name) {

    if (
      !selected.includes(name)
    ) {
      selected.push(name);
    }
  }


  if (
    normalized.includes("事業") ||
    normalized.includes("商品") ||
    normalized.includes("サービス") ||
    normalized.includes("企画") ||
    normalized.includes("ゲーム")
  ) {
    add("企画");
  }


  if (
    normalized.includes("開発") ||
    normalized.includes("技術") ||
    normalized.includes("アプリ") ||
    normalized.includes("システム") ||
    normalized.includes("ゲーム")
  ) {
    add("技術");
  }


  if (
    normalized.includes("収益") ||
    normalized.includes("売上") ||
    normalized.includes("価格") ||
    normalized.includes("利益") ||
    normalized.includes("事業")
  ) {
    add("財務");
  }


  if (
    normalized.includes("危険") ||
    normalized.includes("リスク") ||
    normalized.includes("法律") ||
    normalized.includes("規約") ||
    normalized.includes("契約") ||
    normalized.includes("外部")
  ) {
    add("リスク管理");
  }


  if (selected.length === 0) {

    return [
      "企画",
      "技術",
      "財務"
    ];
  }


  return selected;
}


function getDepartmentByName(name) {

  return DEPARTMENTS.find(
    function (department) {
      return department.name === name;
    }
  );
}


/* =========================
   DEPARTMENT REVIEW
========================= */

function generateDepartmentReview(
  message,
  departmentName
) {

  const text =
    message.text;

  if (departmentName === "企画") {

    return {
      summary:
        "この提案について、顧客価値・事業として成立させる理由・差別化を確認する必要があります。",

      recommendation:
        "小さく検証して反応を見る方向が適切です。",

      concern:
        "需要が明確でないまま開発規模を大きくしないこと。"
    };
  }


  if (departmentName === "技術") {

    return {
      summary:
        "実装規模・必要な技術・現在のCoreで実現可能かを確認する必要があります。",

      recommendation:
        "まずは最小構成の試作から始めるのが安全です。",

      concern:
        "初期段階で複雑な外部依存を増やさないこと。"
    };
  }


  if (departmentName === "財務") {

    return {
      summary:
        "収益源・必要コスト・継続可能性を確認する必要があります。",

      recommendation:
        "大きな投資をせず、低コストで検証する方向が適切です。",

      concern:
        "収益モデルが不明確な状態で固定費を増やさないこと。"
    };
  }


  return {
    summary:
      "安全性・法務・規約・運営上のリスクを確認する必要があります。",

    recommendation:
      "不明点を解消してから段階的に進めるべきです。",

    concern:
      "理解できないリスクを残したまま自動実行しないこと。"
  };
}


/* =========================
   CEO DECISION
========================= */

function generateCeoDecision(message) {

  const departments =
    message.departments;

  const hasRisk =
    departments.includes(
      "リスク管理"
    );

  const hasBusiness =
    departments.includes(
      "企画"
    );

  const hasFinance =
    departments.includes(
      "財務"
    );


  let decision =
    "追加検討";


  let reason =
    "複数部署の確認を踏まえて、現段階では追加検討とします。";


  let nextAction =
    "小規模な検証タスクを作成する";


  if (
    hasRisk &&
    hasBusiness
  ) {

    decision =
      "条件付きで検討";

    reason =
      "事業性を確認する価値はありますが、安全面と実行条件を確認してから進めるべきです。";

    nextAction =
      "小規模検証を行い、結果を再評価する";
  }


  if (
    hasFinance &&
    hasBusiness &&
    !hasRisk
  ) {

    decision =
      "検討継続";

    reason =
      "事業性と収益性の両面から、追加の市場確認を進める価値があります。";

    nextAction =
      "市場検証と小規模実装を開始する";
  }


  if (
    !hasBusiness
  ) {

    decision =
      "保留";

    reason =
      "事業目的がまだ十分に定義されていないため、先に目的を明確化します。";

    nextAction =
      "目的と成功条件を整理する";
  }


  return {
    decision,
    reason,
    nextAction,
    decidedAt:
      new Date().toISOString()
  };
}


/* =========================
   FOUNDER ROOM RENDER
========================= */

function renderFounderMessages() {

  founderLog.replaceChildren();


  if (
    founderMessages.length === 0
  ) {

    const empty =
      document.createElement("li");

    empty.textContent =
      "まだ協議案件はありません。";

    founderLog.appendChild(
      empty
    );

    return;
  }


  founderMessages.forEach(
    function (message) {

      const item =
        document.createElement("li");


      const text =
        document.createElement("p");

      text.textContent =
        "Founder：" +
        message.text;


      const state =
        document.createElement("small");

      state.textContent =
        "状態：" +
        message.status;


      const created =
        document.createElement("small");

      created.textContent =
        "提出日時：" +
        formatDate(
          message.createdAt
        );


      item.appendChild(text);
      item.appendChild(state);
      item.appendChild(created);


      if (
        message.ceoDecision
      ) {

        const decision =
          document.createElement(
            "div"
          );

        decision.className =
          "decision-box";

        decision.textContent =
          "CEO判断：" +
          message.ceoDecision.decision +
          " / " +
          message.ceoDecision.reason;


        item.appendChild(
          decision
        );
      }


      founderLog.appendChild(
        item
      );
    }
  );
}


/* =========================
   CEO COUNCIL RENDER
========================= */

function renderCeoCouncil() {

  ceoCouncilList.replaceChildren();


  if (
    founderMessages.length === 0
  ) {

    const empty =
      document.createElement("li");

    empty.textContent =
      "現在、CEO協議案件はありません。";

    ceoCouncilList.appendChild(
      empty
    );

    return;
  }


  founderMessages.forEach(
    function (message) {

      const card =
        document.createElement("li");

      card.className =
        "council-card";


      const title =
        document.createElement("p");

      title.textContent =
        message.text;

      card.appendChild(
        title
      );


      const state =
        document.createElement("small");

      state.textContent =
        "CEO状態：" +
        message.status;

      card.appendChild(
        state
      );


      /*
        CEO協議開始
      */
      if (
        message.status ===
        "CEO協議待ち"
      ) {

        const startButton =
          document.createElement(
            "button"
          );

        startButton.textContent =
          "CEO協議を開始";

        startButton.type =
          "button";


        startButton.addEventListener(
          "click",
          function () {

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

            setCeoStatus(
              "各部署確認中"
            );

            setStatus(
              "CEOが各部署へ協議を依頼しました"
            );
          }
        );


        card.appendChild(
          startButton
        );
      }


      /*
        部署が決まった後
      */
      if (
        message.departments.length > 0
      ) {

        const departmentList =
          document.createElement(
            "ul"
          );


        message.departments.forEach(
          function (departmentName) {

            const department =
              getDepartmentByName(
                departmentName
              );


            const departmentCard =
              document.createElement(
                "li"
              );

            departmentCard.className =
              "department-card";


            const departmentTitle =
              document.createElement(
                "h3"
              );

            departmentTitle.textContent =
              departmentName;


            const departmentDescription =
              document.createElement(
                "small"
              );

            departmentDescription.textContent =
              department
                ? department.description
                : "";


            departmentCard.appendChild(
              departmentTitle
            );

            departmentCard.appendChild(
              departmentDescription
            );


            if (
              message.reviews[
                departmentName
              ]
            ) {

              const review =
                message.reviews[
                  departmentName
                ];


              const reviewText =
                document.createElement(
                  "p"
                );

              reviewText.textContent =
                review.summary;


              const recommendation =
                document.createElement(
                  "small"
                );

              recommendation.textContent =
                "提案：" +
                review.recommendation;


              const concern =
                document.createElement(
                  "small"
                );

              concern.textContent =
                "注意：" +
                review.concern;


              departmentCard.appendChild(
                reviewText
              );

              departmentCard.appendChild(
                recommendation
              );

              departmentCard.appendChild(
                concern
              );

            } else {

              const reviewButton =
                document.createElement(
                  "button"
                );

              reviewButton.textContent =
                "部署レビューを実行";

              reviewButton.type =
                "button";


              reviewButton.addEventListener(
                "click",
                function () {

                  message.reviews[
                    departmentName
                  ] =
                    generateDepartmentReview(
                      message,
                      departmentName
                    );

                  message.status =
                    "各部署レビュー中";

                  message.updatedAt =
                    new Date().toISOString();


                  saveFounderMessages();

                  renderFounderMessages();
                  renderCeoCouncil();

                  setCeoStatus(
                    "各部署レビュー中"
                  );

                  setStatus(
                    departmentName +
                    "のレビューを記録しました"
                  );
                }
              );


              departmentCard.appendChild(
                reviewButton
              );
            }


            departmentList.appendChild(
              departmentCard
            );
          }
        );


        card.appendChild(
          departmentList
        );
      }


      /*
        全部署レビュー完了後
      */
      const allReviewed =
        message.departments.length > 0 &&
        message.departments.every(
          function (department) {
            return Boolean(
              message.reviews[
                department
              ]
            );
          }
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

        decisionButton.type =
          "button";


        decisionButton.addEventListener(
          "click",
          function () {

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

            setCeoStatus(
              "判断完了"
            );

            setStatus(
              "CEOが各部署の意見を統合しました"
            );
          }
        );


        card.appendChild(
          decisionButton
        );
      }


      /*
        CEO判断表示
      */
      if (
        message.ceoDecision
      ) {

        const decisionBox =
          document.createElement(
            "div"
          );

        decisionBox.className =
          "decision-box";


        const decisionTitle =
          document.createElement(
            "strong"
          );

        decisionTitle.textContent =
          "CEO判断：" +
          message.ceoDecision.decision;


        const reason =
          document.createElement(
            "p"
          );

        reason.textContent =
          "理由：" +
          message.ceoDecision.reason;


        const next =
          document.createElement(
            "p"
          );

        next.textContent =
          "次の行動：" +
          message.ceoDecision.nextAction;


        const taskButton =
          document.createElement(
            "button"
          );

        taskButton.textContent =
          "次の行動をタスク化";

        taskButton.type =
          "button";


        taskButton.addEventListener(
          "click",
          function () {

            tasks.push({

              text:
                message.ceoDecision.nextAction,

              priority:
                "通常",

              status:
                "pending",

              runCount:
                0,

              lastRunAt:
                null,

              result:
                "",

              executor:
                "local"
            });


            saveTasks();
            renderTasks();

            message.status =
              "判断からタスク作成済み";

            message.updatedAt =
              new Date().toISOString();

            saveFounderMessages();

            renderFounderMessages();
            renderCeoCouncil();

            setStatus(
              "CEO判断からタスクを作成しました"
            );
          }
        );


        decisionBox.appendChild(
          decisionTitle
        );

        decisionBox.appendChild(
          reason
        );

        decisionBox.appendChild(
          next
        );

        decisionBox.appendChild(
          taskButton
        );


        card.appendChild(
          decisionBox
        );
      }


      ceoCouncilList.appendChild(
        card
      );
    }
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
        "founder-" +
        Date.now(),

      text,

      status:
        "CEO協議待ち",

      departments:
        [],

      reviews:
        {},

      ceoDecision:
        null,

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


    setCeoStatus(
      "新しい協議案件を受信"
    );

    setStatus(
      "Founder RoomからCEOへ議題を提出しました"
    );
  }
);


/* =========================
   DEPARTMENT STATUS
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


      const text =
        document.createElement(
          "p"
        );

      text.className =
        "department-status";

      text.textContent =
        department.description;


      card.appendChild(title);
      card.appendChild(text);


      departmentStatus.appendChild(
        card
      );
    }
  );
}


/* =========================
   INITIALIZE
========================= */

saveTasks();
saveFounderMessages();

renderTasks();
renderFounderMessages();
renderCeoCouncil();
renderDepartmentStatus();

setSystemStatus(
  "正常稼働"
);

setCeoStatus(
  founderMessages.length > 0
    ? "案件監視中"
    : "待機中"
);

executorStatus.textContent =
  "Local Executor";

apiStatus.textContent =
  "使用しない";
