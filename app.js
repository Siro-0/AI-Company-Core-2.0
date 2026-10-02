const runButton = document.getElementById("runButton");
const userInput = document.getElementById("userInput");
const status = document.getElementById("status");
const result = document.getElementById("result");

const taskInput = document.getElementById("taskInput");
const addTaskButton = document.getElementById("addTaskButton");
const taskList = document.getElementById("taskList");
const taskCount = document.getElementById("taskCount");

const founderInput =
  document.getElementById("founderInput");

const founderSubmitButton =
  document.getElementById("founderSubmitButton");

const founderLog =
  document.getElementById("founderLog");

const savedTasks =
  localStorage.getItem("aiCompanyTasks");

let tasks = savedTasks
  ? JSON.parse(savedTasks)
  : [];

/*
  既存タスクを新しい形式に合わせる
*/
tasks = tasks.map(function (task) {
  let taskStatus = task.status;

  if (!taskStatus) {
    taskStatus =
      task.completed
        ? "completed"
        : "pending";
  }

  return {
    text: task.text,
    priority: task.priority || "通常",
    status: taskStatus,
    runCount: task.runCount || 0,
    lastRunAt: task.lastRunAt || null,
    result: task.result || "",
    executor: task.executor || "local"
  };
});


/*
  優先度選択
*/
const prioritySelect =
  document.createElement("select");

prioritySelect.innerHTML = `
  <option value="高">
    優先度：高
  </option>

  <option value="通常" selected>
    優先度：通常
  </option>

  <option value="低">
    優先度：低
  </option>
`;

prioritySelect.style.width = "100%";
prioritySelect.style.marginTop = "14px";
prioritySelect.style.padding = "10px";

taskInput.insertAdjacentElement(
  "afterend",
  prioritySelect
);


/*
  Founder Roomの入力欄
*/
founderInput.style.width = "100%";
founderInput.style.boxSizing = "border-box";
founderInput.style.marginTop = "8px";
founderInput.style.padding = "10px";
founderInput.style.resize = "vertical";


/*
  基本動作テスト
*/
runButton.addEventListener(
  "click",
  function () {
    const inputText =
      userInput.value.trim();

    status.textContent =
      "正常稼働";

    if (inputText === "") {
      result.textContent =
        "動作テストに成功しました。入力は空です。";
    } else {
      result.textContent =
        "入力を受け取りました：" +
        inputText;
    }
  }
);


/*
  タスク保存
*/
function saveTasks() {
  localStorage.setItem(
    "aiCompanyTasks",
    JSON.stringify(tasks)
  );
}


/*
  Founder Room保存
*/
function saveFounderMessages() {
  localStorage.setItem(
    "aiCompanyFounderMessages",
    JSON.stringify(founderMessages)
  );
}


/*
  優先度の順番
*/
function getPriorityValue(priority) {
  if (priority === "高") {
    return 1;
  }

  if (priority === "通常") {
    return 2;
  }

  return 3;
}


/*
  タスク状態の順番
*/
function getStatusValue(taskStatus) {
  if (taskStatus === "pending") {
    return 1;
  }

  if (taskStatus === "running") {
    return 2;
  }

  return 3;
}


/*
  タスク状態の表示
*/
function getStatusText(taskStatus) {
  if (taskStatus === "running") {
    return "（実行中）";
  }

  if (taskStatus === "completed") {
    return "（完了）";
  }

  return "";
}


/*
  実行日時
*/
function formatRunTime(dateString) {
  if (!dateString) {
    return "まだ実行されていません";
  }

  return new Date(
    dateString
  ).toLocaleString("ja-JP");
}


/*
  Local Executor
  現時点ではテスト用
*/
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


/*
  タスク一覧表示
*/
function renderTasks() {
  taskList.replaceChildren();

  const sortedTasks =
    [...tasks].sort(
      function (a, b) {

        const priorityDifference =
          getPriorityValue(a.priority) -
          getPriorityValue(b.priority);

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        return (
          getStatusValue(a.status) -
          getStatusValue(b.status)
        );
      }
    );

  sortedTasks.forEach(
    function (task) {

      const item =
        document.createElement("li");


      /*
        タスク名
      */
      const taskText =
        document.createElement("span");

      taskText.textContent =
        task.text +
        "（優先度：" +
        task.priority +
        "）" +
        getStatusText(task.status);


      /*
        実行履歴
      */
      const historyText =
        document.createElement("small");

      historyText.textContent =
        "実行回数：" +
        task.runCount +
        "回 / 最終実行：" +
        formatRunTime(task.lastRunAt);


      /*
        実行結果
      */
      const taskResult =
        document.createElement("small");

      if (task.result) {
        taskResult.textContent =
          "実行結果：" +
          task.result;
      } else {
        taskResult.textContent =
          "実行結果：まだありません";
      }


      /*
        実行方式
      */
      const executorText =
        document.createElement("small");

      executorText.textContent =
        "実行方式：" +
        (
          task.executor === "local"
            ? "Local Executor"
            : task.executor
        );


      /*
        編集
      */
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

          const trimmedText =
            newText.trim();

          if (trimmedText === "") {
            status.textContent =
              "タスク名を入力してください";

            return;
          }

          task.text =
            trimmedText;

          saveTasks();
          renderTasks();

          status.textContent =
            "タスクを編集しました";
        }
      );


      /*
        実行・完了・未完了
      */
      const actionButton =
        document.createElement("button");

      actionButton.type =
        "button";


      /*
        未完了
      */
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

            status.textContent =
              "ローカル実行を開始しました";

            result.textContent =
              "実行中：" +
              task.text;


            const execution =
              await executeTaskLocally(
                task
              );


            if (execution.success) {

              task.status =
                "completed";

              task.executor =
                execution.executor;

              task.result =
                execution.result;

              saveTasks();
              renderTasks();

              status.textContent =
                "ローカル実行が完了しました";

              result.textContent =
                execution.result;

            } else {

              task.status =
                "pending";

              saveTasks();
              renderTasks();

              status.textContent =
                "タスクの実行に失敗しました";
            }
          }
        );


      /*
        実行中
      */
      } else if (
        task.status === "running"
      ) {

        actionButton.textContent =
          "完了";

        actionButton.addEventListener(
          "click",
          function () {

            const taskResult =
              window.prompt(
                "このタスクの実行結果を入力してください",
                task.result
              );

            if (taskResult === null) {
              return;
            }

            const trimmedResult =
              taskResult.trim();

            if (trimmedResult === "") {
              status.textContent =
                "実行結果を入力してください";

              return;
            }

            task.result =
              trimmedResult;

            task.status =
              "completed";

            saveTasks();
            renderTasks();

            status.textContent =
              "タスクを完了にしました";

            result.textContent =
              "完了：" +
              task.text;
          }
        );


      /*
        完了
      */
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

            status.textContent =
              "タスクを未完了に戻しました";

            result.textContent =
              "未完了：" +
              task.text;
          }
        );
      }


      /*
        削除
      */
      const deleteButton =
        document.createElement("button");

      deleteButton.textContent =
        "削除";

      deleteButton.type =
        "button";

      deleteButton.addEventListener(
        "click",
        function () {

          const taskIndex =
            tasks.indexOf(task);

          if (taskIndex !== -1) {
            tasks.splice(
              taskIndex,
              1
            );
          }

          saveTasks();
          renderTasks();

          status.textContent =
            "タスクを削除しました";
        }
      );


      /*
        一覧へ追加
      */
      item.appendChild(taskText);
      item.appendChild(historyText);
      item.appendChild(taskResult);
      item.appendChild(executorText);
      item.appendChild(editButton);
      item.appendChild(actionButton);
      item.appendChild(deleteButton);

      taskList.appendChild(item);
    }
  );

  taskCount.textContent =
    "登録数：" +
    tasks.length +
    "件";
}


/*
  タスク登録
*/
addTaskButton.addEventListener(
  "click",
  function () {

    const taskText =
      taskInput.value.trim();

    if (taskText === "") {

      status.textContent =
        "タスクを入力してください";

      return;
    }


    tasks.push({
      text: taskText,
      priority: prioritySelect.value,
      status: "pending",
      runCount: 0,
      lastRunAt: null,
      result: "",
      executor: "local"
    });


    saveTasks();


    taskInput.value =
      "";

    prioritySelect.value =
      "通常";


    renderTasks();


    status.textContent =
      "タスクを登録しました";
  }
);


/*
  Founder Room
*/
const savedFounderMessages =
  localStorage.getItem(
    "aiCompanyFounderMessages"
  );

let founderMessages =
  savedFounderMessages
    ? JSON.parse(savedFounderMessages)
    : [];


/*
  Founder Room表示
*/
function renderFounderMessages() {

  founderLog.replaceChildren();


  founderMessages.forEach(
    function (message) {

      const item =
        document.createElement("li");


      const messageText =
        document.createElement("p");

      messageText.textContent =
        "Founder：" +
        message.text;


      const messageStatus =
        document.createElement("small");

      messageStatus.textContent =
        "状態：" +
        message.status;


      const messageTime =
        document.createElement("small");

      messageTime.textContent =
        "提出日時：" +
        new Date(
          message.createdAt
        ).toLocaleString("ja-JP");


      item.appendChild(
        messageText
      );

      item.appendChild(
        messageStatus
      );

      item.appendChild(
        messageTime
      );


      founderLog.appendChild(
        item
      );
    }
  );
}


/*
  Founder Roomへ相談を提出
*/
founderSubmitButton.addEventListener(
  "click",
  function () {

    const text =
      founderInput.value.trim();


    if (text === "") {

      status.textContent =
        "相談内容を入力してください";

      return;
    }


    founderMessages.push({
      text: text,
      status: "CEO協議待ち",
      createdAt:
        new Date().toISOString()
    });


    saveFounderMessages();


    founderInput.value =
      "";


    renderFounderMessages();


    status.textContent =
      "Founder Roomに相談を提出しました";
  }
);


/*
  初期表示
*/
saveTasks();
renderTasks();
renderFounderMessages();
