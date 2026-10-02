const runButton = document.getElementById("runButton");
const userInput = document.getElementById("userInput");
const status = document.getElementById("status");
const result = document.getElementById("result");

const taskInput = document.getElementById("taskInput");
const addTaskButton = document.getElementById("addTaskButton");
const taskList = document.getElementById("taskList");
const taskCount = document.getElementById("taskCount");

let tasks = [];

runButton.addEventListener("click", function () {
  const inputText = userInput.value.trim();

  status.textContent = "正常稼働";

  if (inputText === "") {
    result.textContent = "動作テストに成功しました。入力は空です。";
  } else {
    result.textContent = "入力を受け取りました：" + inputText;
  }
});

function renderTasks() {
  taskList.replaceChildren();

  tasks.forEach(function (task, index) {
    const item = document.createElement("li");

    const taskText = document.createElement("span");
    taskText.textContent =
      (index + 1) + ". " + task.text;

    if (task.completed) {
      taskText.textContent += "（完了）";
    }

    const completeButton = document.createElement("button");
    completeButton.textContent = task.completed ? "未完了に戻す" : "完了";
    completeButton.type = "button";

    completeButton.addEventListener("click", function () {
      task.completed = !task.completed;
      renderTasks();

      if (task.completed) {
        status.textContent = "タスクを完了にしました";
      } else {
        status.textContent = "タスクを未完了に戻しました";
      }
    });

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "削除";
    deleteButton.type = "button";

    deleteButton.addEventListener("click", function () {
      tasks.splice(index, 1);
      renderTasks();
      status.textContent = "タスクを削除しました";
    });

    item.appendChild(taskText);
    item.appendChild(completeButton);
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
    completed: false
  });

  taskInput.value = "";

  renderTasks();

  status.textContent = "タスクを登録しました";
});
