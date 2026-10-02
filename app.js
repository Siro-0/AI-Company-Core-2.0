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
  昔のタスクに優先度が入っていなくても
  正常に表示できるようにする
*/
tasks = tasks.map(function (task) {
  return {
    text: task.text,
    completed: task.completed || false,
    priority: task.priority || "通常"
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

function renderTasks() {
  taskList.replaceChildren();

  tasks.forEach(function (task, index) {
    const item = document.createElement("li");

    const taskText = document.createElement("span");

    taskText.textContent =
      (index + 1) +
      ". " +
      task.text +
      "（優先度：" +
      task.priority +
      "）";

    if (task.completed) {
      taskText.textContent += "（完了）";
    }

    const completeButton = document.createElement("button");
    completeButton.textContent =
      task.completed ? "未完了に戻す" : "完了";
    completeButton.type = "button";

    completeButton.addEventListener("click", function () {
      task.completed = !task.completed;

      saveTasks();
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

      saveTasks();
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
    completed: false,
    priority: prioritySelect.value
  });

  saveTasks();

  taskInput.value = "";
  prioritySelect.value = "通常";

  renderTasks();

  status.textContent = "タスクを登録しました";
});

saveTasks();
renderTasks();
