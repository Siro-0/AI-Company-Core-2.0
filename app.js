
const runButton = document.getElementById("runButton");
const userInput = document.getElementById("userInput");
const status = document.getElementById("status");
const result = document.getElementById("result");

runButton.addEventListener("click", function () {
  const inputText = userInput.value.trim();

  status.textContent = "正常稼働";
  
  if (inputText === "") {
    result.textContent = "動作テストに成功しました。入力は空です。";
  } else {
    result.textContent = "入力を受け取りました：" + inputText;
  }
});
