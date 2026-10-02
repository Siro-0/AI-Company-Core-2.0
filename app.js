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

const localAiStatus =
  document.getElementById("localAiStatus");

const executorStatus =
  document.getElementById("executorStatus");

const apiStatus =
  document.getElementById("apiStatus");

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

function setStatus(message) {
  status.textContent = message;
}

/* =========================
   LOCAL AI
========================= */

const localAISessions = new Map();

let localAIAvailability = "checking";

async function checkLocalAI() {
  if (!("LanguageModel" in window)) {
    localAIAvailability = "unsupported";
    localAiStatus.textContent = "未対応";
    return;
  }

  try {
    const availability =
      await LanguageModel.availability({
        expectedInputs: [
          {
            type: "text",
            languages: ["ja"]
          }
        ],
        expectedOutputs: [
          {
            type: "text",
            languages: ["ja"]
          }
        ]
      });

    localAIAvailability =
      availability;

    const statusMap = {
      available: "使用可能",
      downloadable: "要ダウンロード",
      downloading: "ダウンロード中",
      unavailable: "使用不可"
    };

    localAiStatus.textContent =
      statusMap[availability] ||
      availability;
  } catch (error) {
    console.error(
      "Local AI確認エラー:",
      error
    );

    localAIAvailability = "error";
    localAiStatus.textContent =
      "確認エラー";
  }
}

function getRoleSystemPrompt(role) {
  if (role === "ceo") {
    return `
あなたはAI Company Core 2.0のAI CEOです。

あなたはFounderの提案を盲目的に実行しません。
必要なら反対、保留、追加調査を判断してください。

各部署の意見を重視し、
安全性、収益性、実行可能性、
攻めと守りのバランスを考えてください。

外部AI APIへの依存を前提にしないでください。
危険または理解できない行動は推進しないでください。

日本語で回答してください。
`;
  }

  if (role === "企画") {
    return `
あなたはAI Company Core 2.0の企画部署です。

顧客価値、市場性、差別化、
事業として成立する理由を検討してください。

必要なら明確に反対してください。
日本語で回答してください。
`;
  }

  if (role === "技術") {
    return `
あなたはAI Company Core 2.0の技術部署です。

実装可能性、開発規模、
技術的リスク、保守性、
依存関係を検討してください。

不要な複雑化や外部依存を避けてください。
日本語で回答してください。
`;
  }

  if (role === "財務") {
    return `
あなたはAI Company Core 2.0の財務部署です。

収益性、コスト、資金、
継続可能性を検討してください。

面白そうという理由だけで賛成しないでください。
日本語で回答してください。
`;
  }

  return `
あなたはAI Company Core 2.0のリスク管理部署です。

安全性、法務、規約、
運営上の問題を検討してください。

不明なリスクは無視せず、
必要なら明確に反対してください。

日本語で回答してください。
`;
}

async function getLocalAISession(role) {
  if (localAISessions.has(role)) {
    return localAISessions.get(role);
  }

  if (!("LanguageModel" in window)) {
    throw new Error(
      "このブラウザではLocal AIを利用できません。"
    );
  }

  const session =
    await LanguageModel.create({
      expectedInputs: [
        {
          type: "text",
          languages: ["ja"]
        }
      ],
      expectedOutputs: [
        {
          type: "text",
          languages: ["ja"]
        }
      ],
      initialPrompts: [
        {
          role: "system",
          content:
            getRoleSystemPrompt(role)
        }
      ]
    });

  localAISessions.set(
    role,
    session
  );

  localAiStatus.textContent =
    "使用中";

  return session;
}

async function askLocalAI(
  role,
  prompt
) {
  const session =
    await getLocalAISession(role);

  const response =
    await session.prompt(prompt);

  return response.trim();
}

function fallbackReview(department) {
  const defaults = {
    企画:
      "事業性と顧客価値を追加確認する必要があります。",
    技術:
      "小規模な試作から始め、技術的負荷を確認する必要があります。",
    財務:
      "収益モデルと必要コストを確認する必要があります。",
    "リスク管理":
      "安全性と運営上のリスクを確認する必要があります。"
  };

  return (
    defaults[department] ||
    "追加確認が必要です。"
  );
}

/* =========================
   TASK CORE
========================= */

let tasks = loadJSON(
  STORAGE_KEYS.tasks,
  []
);

tasks = tasks.map(function (task) {
  let taskStatus =
    task.status;

  if (!taskStatus) {
    taskStatus =
      task.completed
        ? "completed"
        : "pending";
  }

  return {
    text:
      task.text ||
      "無題のタスク",

    priority:
      task.priority ||
      "通常",

    status:
      taskStatus,

    runCount:
      Number(task.runCount) || 0,

    lastRunAt:
      task.lastRunAt ||
      null,

    result:
      task.result ||
      "",

    executor:
      task.executor ||
      "local"
  };
});

function saveTasks() {
  saveJSON(
    STORAGE_KEYS.tasks,
    tasks
  );
}

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
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve({
        success: true,
        executor: "local",
        result:
          "ローカル実行を受け付けました：" +
          task.text
      });
    }, 300);
  });
}

function renderTasks() {
  taskList.replaceChildren();

  const sortedTasks =
    [...tasks].sort(function (a, b) {
      const priorityDifference =
        getPriorityValue(
          a.priority
        ) -
        getPriorityValue(
          b.priority
        );

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return (
        getTaskStatusValue(
          a.status
        ) -
        getTaskStatusValue(
          b.status
        )
      );
    });

  sortedTasks.forEach(
    function (task) {
      const item =
        document.createElement("li");

      const text =
        document.createElement("span");

      text.textContent =
        task.text +
        "（優先度：" +
        task.priority +
        "）" +
        getTaskStatusText(
          task.status
        );

      const history =
        document.createElement("small");

      history.textContent =
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

      const executor =
        document.createElement("small");

      executor.textContent =
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
          const value =
            window.prompt(
              "新しいタスク名を入力してください",
              task.text
            );

          if (value === null) {
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
        document.createElement("button");

      action.type =
        "button";

      if (task.status === "pending") {
        action.textContent =
          "実行";

        action.addEventListener(
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

            if (value === null) {
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
            tasks.splice(index, 1);
          }

          saveTasks();
          renderTasks();

          setStatus(
            "タスクを削除しました"
          );
        }
      );

      item.appendChild(text);
      item.appendChild(history);
      item.appendChild(taskResult);
      item.appendChild(executor);
      item.appendChild(editButton);
      item.appendChild(action);
      item.appendChild(deleteButton);

      taskList.appendChild(item);
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

function saveFounderMessages() {
  saveJSON(
    STORAGE_KEYS.founder,
    founderMessages
  );
}

/* =========================
   DEPARTMENT SELECTION
========================= */

function determineDepartments(text) {
  const value =
    text.toLowerCase();

  const selected = [];

  function add(name) {
    if (!selected.includes(name)) {
      selected.push(name);
    }
  }

  if (
    value.includes("事業") ||
    value.includes("商品") ||
    value.includes("サービス") ||
    value.includes("企画") ||
    value.includes("ゲーム")
  ) {
    add("企画");
  }

  if (
    value.includes("開発") ||
    value.includes("技術") ||
    value.includes("アプリ") ||
    value.includes("システム") ||
    value.includes("ゲーム")
  ) {
    add("技術");
  }

  if (
    value.includes("収益") ||
    value.includes("売上") ||
    value.includes("価格") ||
    value.includes("利益") ||
    value.includes("事業")
  ) {
    add("財務");
  }

  if (
    value.includes("危険") ||
    value.includes("リスク") ||
    value.includes("法律") ||
    value.includes("規約") ||
    value.includes("契約") ||
    value.includes("外部")
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

/* =========================
   LOCAL AI REVIEW
========================= */

async function generateAIReview(
  message,
  department
) {
  const role =
    department === "企画"
      ? "企画"
      : department === "技術"
      ? "技術"
      : department === "財務"
      ? "財務"
      : "リスク管理";

  const prompt = `
以下のFounder提案について、
あなたの部署として独立して検討してください。

【Founder提案】
${message.text}

【担当部署】
${department}

次の4点を日本語で整理してください。

1. 分析
2. 推奨
3. 懸念点
4. CEOが判断するときに重要な点

Founderに迎合しないでください。
不要だと思った場合は反対してください。
分からない部分は分からないと明記してください。
`;

  try {
    const answer =
      await askLocalAI(
        role,
        prompt
      );

    return {
      summary:
        answer,
      source:
        "Local AI"
    };
  } catch (error) {
    console.error(
      "Local AI review failed:",
      error
    );

    return {
      summary:
        fallbackReview(
          department
        ),
      source:
        "Fallback"
    };
  }
}

/* =========================
   LOCAL AI CEO
========================= */

async function generateAICeoDecision(
  message
) {
  const reviewText =
    Object.entries(
      message.reviews
    )
      .map(
        function ([department, review]) {
          return (
            "【" +
            department +
            "】\n" +
            review.summary
          );
        }
      )
      .join("\n\n");

  const prompt = `
あなたはAI Company Core 2.0のAI CEOです。

Founderから以下の提案がありました。

【提案】
${message.text}

各部署から以下の意見を受けています。

${reviewText}

これらを踏まえて会社として判断してください。

重要:
- Founderに迎合しない
- 必要なら反対・保留する
- 攻めと守りを両方考える
- 理解できないリスクを無視しない
- 外部AI API依存を前提にしない
- 小さく検証できるなら小さく検証する
- 次の行動を具体化する

日本語で回答してください。
`;

  try {
    const answer =
      await askLocalAI(
        "ceo",
        prompt
      );

    return {
      decision:
        "Local AI CEO判断",
      reason:
        answer,
      nextAction:
        "CEO判断を確認し、必要なら具体的なタスクへ分解する",
      source:
        "Local AI"
    };
  } catch (error) {
    console.error(
      "Local AI CEO failed:",
      error
    );

    return {
      decision:
        "追加検討",
      reason:
        "Local AIを利用できなかったため、現段階では追加検討とします。",
      nextAction:
        "提案内容を小さな検証タスクへ分解する",
      source:
        "Fallback"
    };
  }
}

/* =========================
   FOUNDER ROOM
========================= */

function renderFounderMessages() {
  founderLog.replaceChildren();

  if (founderMessages.length === 0) {
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

      if (message.ceoDecision) {
        const decision =
          document.createElement(
            "div"
          );

        decision.className =
          "decision-box";

        decision.textContent =
          "CEO判断：" +
          message.ceoDecision.decision;

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
   CEO COUNCIL
========================= */

function renderCeoCouncil() {
  ceoCouncilList.replaceChildren();

  if (founderMessages.length === 0) {
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
              "CEOが協議を開始しました"
            );
          }
        );

        card.appendChild(
          startButton
        );
      }

      if (
        message.departments.length > 0
      ) {
        const list =
          document.createElement("ul");

        message.departments.forEach(
          function (department) {
            const departmentCard =
              document.createElement(
                "li"
              );

            departmentCard.className =
              "department-card";

            const departmentInfo =
              DEPARTMENTS.find(
                function (item) {
                  return (
                    item.name ===
                    department
                  );
                }
              );

            const heading =
              document.createElement(
                "h3"
              );

            heading.textContent =
              department;

            const description =
              document.createElement(
                "small"
              );

            description.textContent =
              departmentInfo
                ? departmentInfo.description
                : "";

            departmentCard.appendChild(
              heading
            );

            departmentCard.appendChild(
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

              const source =
                document.createElement(
                  "small"
                );

              source.textContent =
                "情報源：" +
                message.reviews[
                  department
                ].source;

              departmentCard.appendChild(
                review
              );

              departmentCard.appendChild(
                source
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
                async function () {
                  reviewButton.disabled =
                    true;

                  reviewButton.textContent =
                    "AIが検討中...";

                  message.status =
                    "各部署レビュー中";

                  saveFounderMessages();

                  renderFounderMessages();

                  try {
                    const review =
                      await generateAIReview(
                        message,
                        department
                      );

                    message.reviews[
                      department
                    ] =
                      review;

                    message.updatedAt =
                      new Date().toISOString();

                    saveFounderMessages();

                    renderFounderMessages();
                    renderCeoCouncil();

                    setStatus(
                      department +
                      "のレビューが完了しました"
                    );
                  } catch (error) {
                    console.error(error);

                    reviewButton.disabled =
                      false;

                    reviewButton.textContent =
                      "部署レビューを実行";

                    setStatus(
                      "部署レビューに失敗しました"
                    );
                  }
                }
              );

              departmentCard.appendChild(
                reviewButton
              );
            }

            list.appendChild(
              departmentCard
            );
          }
        );

        card.appendChild(
          list
        );
      }

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
          async function () {
            decisionButton.disabled =
              true;

            decisionButton.textContent =
              "CEOが判断中...";

            setCeoStatus(
              "AI CEO判断中"
            );

            try {
              const decision =
                await generateAICeoDecision(
                  message
                );

              message.ceoDecision =
                decision;

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
                "Local AI CEOが判断しました"
              );
            } catch (error) {
              console.error(error);

              decisionButton.disabled =
                false;

              decisionButton.textContent =
                "CEOが総合判断する";

              setStatus(
                "CEO判断に失敗しました"
              );
            }
          }
        );

        card.appendChild(
          decisionButton
        );
      }

      if (
        message.ceoDecision
      ) {
        const decisionBox =
          document.createElement(
            "div"
          );

        decisionBox.className =
          "decision-box";

        const title =
          document.createElement(
            "strong"
          );

        title.textContent =
          "CEO判断：" +
          message.ceoDecision.decision;

        const reason =
          document.createElement(
            "p"
          );

        reason.textContent =
          message.ceoDecision.reason;

        const next =
          document.createElement(
            "p"
          );

        next.textContent =
          "次の行動：" +
          message.ceoDecision.nextAction;

        decisionBox.appendChild(
          title
        );

        decisionBox.appendChild(
          reason
        );

        decisionBox.appendChild(
          next
        );

        if (
          !message.taskCreated
        ) {
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

              message.taskCreated =
                true;

              message.status =
                "判断からタスク作成済み";

              message.updatedAt =
                new Date().toISOString();

              saveTasks();
              saveFounderMessages();

              renderTasks();
              renderFounderMessages();
              renderCeoCouncil();

              setStatus(
                "CEO判断からタスクを作成しました"
              );
            }
          );

          decisionBox.appendChild(
            taskButton
          );
        }

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

      const description =
        document.createElement(
          "p"
        );

      description.className =
        "department-status";

      description.textContent =
        department.description;

      card.appendChild(
        title
      );

      card.appendChild(
        description
      );

      departmentStatus.appendChild(
        card
      );
    }
  );
}

/* =========================
   INIT
========================= */

saveTasks();
saveFounderMessages();

renderTasks();
renderFounderMessages();
renderCeoCouncil();
renderDepartmentStatus();

systemStatus.textContent =
  "正常稼働";

ceoStatus.textContent =
  founderMessages.length > 0
    ? "案件監視中"
    : "待機中";

executorStatus.textContent =
  "Local Executor";

apiStatus.textContent =
  "使用しない";

checkLocalAI();
