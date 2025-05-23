const fs = require("fs");
const path = require("path");
const vscode = require("vscode");

const getCoCommitsAsChart = (commitList) => {
  const barChordData = {};

  commitList.forEach((oc) => {
    const mfKeys = Object.keys(oc.modifiedFiles);
    mfKeys.forEach((k) => {
      barChordData[k] = {
        ...barChordData[k],
        ...oc.modifiedFiles,
      };
    });
  });

  const bcdKeys = Object.keys(barChordData).sort();
  const bcdOutput = bcdKeys.map((k1) =>
    bcdKeys.map((k2) => barChordData[k1]?.[k2] ?? 0)
  );

  const panel = vscode.window.createWebviewPanel(
    "chordDiagram",
    "Co-commits (chord diagram)",
    vscode.ViewColumn.Three,
    {
      enableScripts: true,
    }
  );

  const templatePath = path.join(__dirname, "web", "chord.html");
  let chordHtml = fs.readFileSync(templatePath, "utf8");
  chordHtml = chordHtml
    .replace("{{ matrixData }}", JSON.stringify(bcdOutput))
    .replace("{{ keys }}", JSON.stringify(bcdKeys));

  panel.webview.html = chordHtml;
};

module.exports = {
  getCoCommitsAsChart,
};
