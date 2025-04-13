const fs = require("fs");
const path = require("path");
const vscode = require("vscode");

const getMatrixPanel = (commitList) => {
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
  const bcdOutput = bcdKeys.map(k1 =>
    bcdKeys.map(k2 => (k1 === k2 ? null : barChordData[k1]?.[k2] ?? 0))
  );

  const maxValue = Math.max(...bcdOutput.flat().filter(v => v !== null));

  const tableHeaders = bcdKeys.map(k => `<th>${k}</th>`).join("");

  const tableRows = bcdOutput.map((row, i) => {
    const rowCells = row.map(val => {
      if (val === null) return `<td style="background-color: var(--vscode-editor-background);"></td>`;
      const red = 255;
      const greenBlue = 255 - Math.round((val / maxValue) * 255);
      const bgColor = `rgb(${red},${greenBlue},${greenBlue})`;
      return `<td style="background-color: ${bgColor};">${val}</td>`;
    }).join("");
    return `<tr><td>${bcdKeys[i]}</td>${rowCells}</tr>`;
  }).join("");

  const panel = vscode.window.createWebviewPanel(
    "matrixView",
    "Commit Co-modification Matrix",
    vscode.ViewColumn.Two,
    {
      enableScripts: true
    }
  );

  const templatePath = path.join(__dirname, "web", "matrix.html");
  let matrixHtml = fs.readFileSync(templatePath, "utf8");
  matrixHtml = matrixHtml
    .replace("{{tableHeaders}}", tableHeaders)
    .replace("{{tableRows}}", tableRows);

  panel.webview.html = matrixHtml;
};

module.exports = {
  getMatrixPanel
};
