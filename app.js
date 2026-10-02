const runButton = document.getElementById("runButton");
const userInput = document.getElementById("userInput");
const status = document.getElementById("status");
const result = document.getElementById("result");

const taskInput = document.getElementById("taskInput");
const addTaskButton = document.getElementById("addTaskButton");
const taskList = document.getElementById("taskList");
const taskCount = document.getElementById("taskCount");

const savedTasks = localStorage.getItem("aiCompanyTasks");
let tasks = savedTasks ? JSON.parse(savedTasks) : [];

/*
  以前のデータを新しい状態管理に変換する
*/
tasks = tasks.map(function (task) {
  let taskStatus = task.status;

  if (!taskStatus) {
    taskStatus = task.completed ? "completed" : "pending";
  }

  return {
    text: task.text,
    priority: task.priority || "通常",
    status: taskStatus
  };
});

const prioritySelect = document.createElement("select");

prioritySelect.innerHTML = `
  <option value="高">優先度：高</option>
  <option value="通常" selected>優先度：通常</option>
  <option value="低">優先度：低</option>
`;

prioritySelect.style.width = "100%";
prioritySelect.style.marginTop = "14px";
prioritySelect.style.padding = "10px";

taskInput.insertAdjacentElement("afterend", prioritySelect);

runButton.addEventListener("click", function () {
  const inputText = userInput.value.trim();

  status.textContent = "正常稼働";

  if (inputText === "") {
    result.textContent = "動作テストに成功しました。入力は空です。";
  } else {
    result.textContent = "入力を受け取りました：" + inputText;
  }
});

function saveTasks() {
  localStorage.setItem("aiCompanyTasks", JSON.stringify(tasks));
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

function getStatusValue(taskStatus) {
  if (taskStatus === "pending") {
    return 1;
  }

  if (taskStatus === "running") {
    return 2;
  }

  return 3;
}

function getStatusText(taskStatus) {
  if (taskStatus === "running") {
    return "（実行中）";
  }

  if (taskStatus === "completed") {
    return "（完了）";
  }

  return "";
}

function renderTasks() {
  taskList.replaceChildren();

  const sortedTasks = [...tasks].sort(function (a, b) {
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
  });

  sortedTasks.forEach(function (task) {
    const item = document.createElement("li");

    const taskText = document.createElement("span");

    taskText.textContent =
      task.text +
      "（優先度：" +
      task.priority +
      "）" +
      getStatusText(task.status);

    const editButton = document.createElement("button");
    editButton.textContent = "編集";
    editButton.type = "button";

    editButton.addEventListener("click", function () {
      const newText = window.prompt(
        "新しいタスク名を入力してください",
        task.text
      );

      if (newText === null) {
        return;
      }

      const trimmedText = newText.trim();

      if (trimmedText === "") {
        status.textContent = "タスク名を入力してください";
        return;
      }

      task.text = trimmedText;

      saveTasks();
      renderTasks();

      status.textContent = "タスクを編集しました";
    });

    const actionButton = document.createElement("button");
    actionButton.type = "button";

    if (task.status === "pending") {
      actionButton.textContent = "実行";

      actionButton.addEventListener("click", function () {
        task.status = "running";

        saveTasks();
        renderTasks();

        status.textContent = "タスクを実行中にしました";
        result.textContent = "実行中：" + task.text;
      });
    } else if (task.status === "running") {
      actionButton.textContent = "完了";

      actionButton.addEventListener("click", function () {
        task.status = "completed";

        saveTasks();
        renderTasks();

        status.textContent = "タスクを完了にしました";
        result.textContent = "完了：" + task.text;
      });
    } else {
      actionButton.textContent = "未完了に戻す";

      actionButton.addEventListener("click", function () {
        task.status = "pending";

        saveTasks();
        renderTasks();

        status.textContent = "タスクを未完了に戻しました";
        result.textContent = "未完了：" + task.text;
      });
    }

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "削除";
    deleteButton.type = "button";

    deleteButton.addEventListener("click", function () {
      const taskIndex = tasks.indexOf(task);

      if (taskIndex !== -1) {
        tasks.splice(taskIndex, 1);
      }

      saveTasks();
      renderTasks();

      status.textContent = "タスクを削除しました";
    });

    item.appendChild(taskText);
    item.appendChild(editButton);
    item.appendChild(actionButton);
    item.appendChild(deleteButton);

    taskList.appendChild(item);
  });

  taskCount.textContent = "登録数：" + tasks.length + "件";
}

addTaskButton.addEventListener("click", function () {
  const taskText = taskInput.value.trim();

  if (taskText === "") {
    status.textContent = "タスクを入力してください";
    return;
  }

  tasks.push({
    text: taskText,
    priority: prioritySelect.value,
    status: "pending"
  });

  saveTasks();

  taskInput.value = "";
  prioritySelect.value = "通常";

  renderTasks();

  status.textContent = "タスクを登録しました";
});

saveTasks();
renderTasks();
