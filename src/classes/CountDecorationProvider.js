const vscode = require("vscode");
const path = require("path");

class CountDecorationProvider {
  constructor() {
    this._onDidChangeDecorations = new vscode.EventEmitter();
    this.onDidChangeFileDecorations = this._onDidChangeDecorations.event;

    this.handleChange();

    this.fileList = [];
    this.microserviceFolders = this.loadmicroserviceFolders();

    this.disposables = [];
    this.disposables.push(vscode.window.registerFileDecorationProvider(this));
  }

  loadmicroserviceFolders() {
    const configFolders = vscode.workspace.getConfiguration("gitMicroservicesAnalyzer").get("microserviceFolders") || [];
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
    return configFolders.map(folder => path.join(workspaceRoot, folder));
  }

  handleChange() {
    vscode.workspace.onDidSaveTextDocument(() => {
      this._onDidChangeDecorations.fire();
    });
  }

  reset() {
    this.fileList = [];
  }

  setUri(uri) {
    this.fileList.push(uri);
  }

  provideFileDecoration(uri) {
    if (!this.microserviceFolders.some(folderPath => uri.fsPath.startsWith(folderPath))) {
      return;
    }

    if (!this.fileList.some(a => a.path === uri.path)) {
      return;
    }

    return {
      badge: "NC",
      tooltip: "notCommittable",
      propagate: true,
      color: vscode.ThemeColor("charts.purple")
    };
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}

module.exports = { CountDecorationProvider };
