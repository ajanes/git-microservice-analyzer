const fs = require("fs");
const path = require("path");
const vscode = require("vscode");

const getBarData = (commitList) => {
  const counts = {};

  const filteredCommits = commitList.filter(commit => {
    return Object.keys(commit.modifiedFiles).length > 1;
  });

  filteredCommits.forEach((commit) => {
    Object.entries(commit.modifiedFiles).forEach(([path, count]) => {
      counts[path] = (counts[path] || 0) + count;
    });
  });

  const barData = Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const panel = vscode.window.createWebviewPanel(
    "barChart",
    "Co-committed folders",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  const chartDataJson = JSON.stringify(barData).replace(/</g, '\u003c');
  const templatePath = path.join(__dirname, "web", "bar.html");
  let html = fs.readFileSync(templatePath, "utf8");
  html = html.replace("{{barData}}", chartDataJson);

  panel.webview.html = html;
};

module.exports = {
  getBarData
};
