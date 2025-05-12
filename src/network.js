const fs = require("fs");
const path = require("path");
const vscode = require("vscode");

const getCoCommitsAsChart = (commitList) => {
  const coCommitLinks = {};
  const moduleSet = new Set();

  commitList.forEach((commit) => {
    const modules = Object.keys(commit.modifiedFiles);
    modules.forEach((source) => {
      moduleSet.add(source);
      modules.forEach((target) => {
        if (source === target) return;
        const key = `${source}-->${target}`;
        coCommitLinks[key] = (coCommitLinks[key] || 0) + 1;
      });
    });
  });

  const nodes = Array.from(moduleSet).map((id) => ({ id }));
  const links = Object.entries(coCommitLinks).map(([key, value]) => {
    const [source, target] = key.split("-->");
    return { source, target, value };
  });

  const panel = vscode.window.createWebviewPanel(
    "networkDiagram",
    "Co-commits (network diagram)",
    vscode.ViewColumn.Three,
    {
      enableScripts: true,
    }
  );

  const templatePath = path.join(__dirname, "web", "network.html");
  let networkHtml = fs.readFileSync(templatePath, "utf8");
  networkHtml = networkHtml
    .replace("{{ nodes }}", JSON.stringify(nodes))
    .replace("{{ links }}", JSON.stringify(links));

  panel.webview.html = networkHtml;
};

module.exports = {
  getCoCommitsAsChart,
};
