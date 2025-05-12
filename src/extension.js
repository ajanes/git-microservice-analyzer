const vscode = require("vscode");
const util = require("util");
const path = require("path");
const exec = util.promisify(require("child_process").exec);
const moment = require("moment");

const network = require("./network.js");
const bar = require("./bar.js");
const matrix = require("./matrix.js");
const fileDecorator = require("./classes/CountDecorationProvider");

const LINES_THRESHOLD = 10;
const MODULES_THRESHOLD = 2;

let logData = [];
let outputData = [];

async function executeCommand(command) {
  const { stdout } = await exec(command);
  return stdout;
}

async function getLogs(filePath, startTime, stopTime) {
  const sinceISO = new Date(startTime).toISOString();
  const untilISO = new Date(stopTime).toISOString();

  const logOutput = await executeCommand(
    `cd ${filePath} && git log --since="${sinceISO}" --until="${untilISO}" --pretty=format:"%H%n%an - %ae%n%at"`
  );

  return logOutput.split("\n");
}

async function getDiffTree(commitHash, author, timestamp, filePath, configFolders) {
  const modifiedFiles = {};
  if (!commitHash) return;

  const diffOutput = await executeCommand(
    `cd ${filePath} && git diff-tree --no-commit-id --numstat ${commitHash}`
  );

  if (diffOutput != "") {
    const lines = diffOutput.split("\n");

    if (!lines || lines.length === 0) return;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const parts = line.trim().split(/\s+/);
      if (parts.length < 3) continue;

      const added = parseInt(parts[0]);
      const deleted = parseInt(parts[1]);
      const editedLines = added + deleted;
      const item = parts[2]

      // Find the matching config folder in this line
      const matchedFolder = configFolders.find((folder) => 
        item.includes(`${folder.path}/`)
      );
      if (!matchedFolder) continue;

      if (editedLines >= LINES_THRESHOLD) {
        const moduleName = matchedFolder.path;
        modifiedFiles[moduleName] = (modifiedFiles[moduleName] || 0) + editedLines;
      }
    }

    const moduleCount = Object.keys(modifiedFiles).length;
    if (moduleCount >= MODULES_THRESHOLD) {
      const [name, email] = author.split(" - ");
      outputData.push({
        commitName: commitHash,
        author: { name, email },
        date: moment.unix(timestamp).format("DD/MM/YYYY HH:mm:ss"),
        modifiedFiles,
      });
    }
  }
}

async function runAnalysisIfNeeded() {
  if (outputData.length > 0) return;

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.text = "Running analysis...";
  statusBarItem.show();

  const config = vscode.workspace.getConfiguration("gitMicroservicesAnalyzer");
  const globalStart = new Date(
    config.get("startTime") || "1970-01-01T00:00:00"
  );
  const configFolders = config.get("microserviceFolders") || [];
  const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

  if (!Array.isArray(configFolders) || configFolders.length === 0) {
    vscode.window.showErrorMessage(
      "No scan folders defined in settings. Please set 'gitMicroservicesAnalyzer.microserviceFolders' in .vscode/settings.json."
    );
    return;
  }

  outputData = [];

  for (const folderConfig of configFolders) {
    const {
      path: relPath,
      startTime: folderStart,
      stopTime: folderStop,
    } = folderConfig;
    const filePath = path.join(workspaceRoot, relPath);

    const folderStartDate = folderStart ? new Date(folderStart) : globalStart;
    const effectiveStart = new Date(
      Math.max(globalStart.getTime(), folderStartDate.getTime())
    );
    const effectiveStop = folderStop ? new Date(folderStop) : new Date();

    logData = await getLogs(filePath, effectiveStart, effectiveStop);
    const configFolders = vscode.workspace.getConfiguration("gitMicroservicesAnalyzer").get("microserviceFolders") || [];

    for (let i = 0; i < logData.length; i += 3) {
      await getDiffTree(
        logData[i],
        logData[i + 1],
        parseInt(logData[i + 2]),
        filePath,
        configFolders
      );
    }
  }

  statusBarItem.dispose();
}

function registerAnalysisCommand(context) {
  const disposable = vscode.commands.registerCommand(
    "git-microservice-analyzer.analyze",
    async () => {
      outputData = [];
      runAnalysisIfNeeded();
    }
  );

  context.subscriptions.push(disposable);
}

function registerChartCommands(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "git-microservice-analyzer.showCoCommitsAsBarChart",
      async () => {
        await runAnalysisIfNeeded();
        bar.getCoCommitsAsBarChart(outputData);
      }
    ),

    vscode.commands.registerCommand(
      "git-microservice-analyzer.showCoCommitsAsMatrix",
      async () => {
        await runAnalysisIfNeeded();
        matrix.getCoCommitsAsMatrix(outputData);
      }
    ),

    vscode.commands.registerCommand(
      "git-microservice-analyzer.showCoCommitsAsChart",
      async () => {
        await runAnalysisIfNeeded();
        network.getCoCommitsAsChart(outputData);
      }
    )
  );
}

function registerFileDecorator(context) {
  const provider = new fileDecorator.CountDecorationProvider();
  context.subscriptions.push(provider);

  vscode.workspace.onDidSaveTextDocument(() => {
    const gitExtension = vscode.extensions.getExtension("vscode.git")?.exports;
    const git = gitExtension?.getAPI(1);
    const repo = git?.repositories[0];

    if (!repo) return;

    const repoUri = repo.rootUri.path;
    const changes = repo.state.workingTreeChanges;

    const modules = {};

    for (const change of changes) {
      const relPath = change.uri.path.replace(repoUri, "");
      const moduleName = relPath.split("/")[1];

      if (!moduleName) continue;

      if (!modules[moduleName]) {
        modules[moduleName] = [];
      }

      modules[moduleName].push(change.uri);
    }

    const editedModules = Object.keys(modules);
    if (editedModules.length <= 1) return;

    provider.reset();

    const sortedModules = editedModules
      .map((name) => ({ name, length: modules[name].length }))
      .sort((a, b) => b.length - a.length);

    const dominantModule = sortedModules[0]?.name;
    const filteredModules = editedModules.filter(
      (name) => name !== dominantModule
    );

    for (const module of filteredModules) {
      for (const uri of modules[module]) {
        provider.setUri(uri);
      }
    }
  });
}

function activate(context) {
  console.log('Extension "git-microservice-analyzer" is now active!');

  registerAnalysisCommand(context);
  registerChartCommands(context);
  // registerFileDecorator(context);
}

function deactivate() {
  console.log('Extension "git-microservice-analyzer" is now active!');
}

module.exports = {
  activate,
  deactivate,
};
