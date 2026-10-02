
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
    item.textContent = (index + 1) + ". " + task;
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

  tasks.push(taskText);
  taskInput.value = "";

  renderTasks();
  status.textContent = "タスクを登録しました";
});
