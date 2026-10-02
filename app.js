function renderCeoCouncil() {
  ceoCouncilList.replaceChildren();

  founderMessages.forEach(function (message) {
    const item = document.createElement("li");

    const title = document.createElement("p");
    title.textContent = message.text;

    const statusText = document.createElement("small");
    statusText.textContent = "CEO状態：" + message.status;

    item.appendChild(title);
    item.appendChild(statusText);

    if (message.status === "CEO協議待ち") {
      const startButton = document.createElement("button");

      startButton.textContent = "CEO協議を開始";
      startButton.type = "button";

      startButton.addEventListener("click", function () {
        message.departments = determineDepartments(
          message.text
        );

        message.status = "各部署確認中";

        saveFounderMessages();
        renderFounderMessages();
        renderCeoCouncil();

        status.textContent =
          "CEOが各部署へ協議を依頼しました";
      });

      item.appendChild(startButton);
    }

    if (message.departments.length > 0) {
      const departmentList = document.createElement("ul");

      message.departments.forEach(function (department) {
        const departmentItem =
          document.createElement("li");

        departmentItem.textContent =
          department + "：協議対象";

        departmentList.appendChild(departmentItem);
      });

      item.appendChild(departmentList);
    }

    ceoCouncilList.appendChild(item);
  });
}
