const vscode = require("vscode");
const util = require("util");
const path = require("path");
const exec = util.promisify(require("child_process").exec);
const moment = require("moment");

const chord = require("./chord.js");
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

async function getLogs(filePath, yearsBack = 1) {
  const sinceDate = new Date();
  sinceDate.setFullYear(sinceDate.getFullYear() - yearsBack);
  const sinceISO = sinceDate.toISOString().split("T")[0]; // Format: YYYY-MM-DD

  const logOutput = await executeCommand(
    `cd ${filePath} && git log --since="${sinceISO}" --pretty=format:"%H%n%an - %ae%n%at"`
  );

  return logOutput.split("\n");
}

async function getDiffTree(commitHash, author, timestamp, filePath) {
  const diffOutput = await executeCommand(`cd ${filePath} && git diff-tree --numstat ${commitHash}`);
  const lines = diffOutput.split("\n");

  if (!lines || lines.length === 0) return;

  const modifiedFiles = {};

  for (let i = 1; i < lines.length; i++) {
    const match = lines[i].match(/(\d+)\s+(\d+)\s+(.+)\//);
    if (match) {
      const added = parseInt(match[1]);
      const deleted = parseInt(match[2]);
      const moduleName = match[3];

      const editedLines = added + deleted;
      if (editedLines > LINES_THRESHOLD) {
        modifiedFiles[moduleName] = editedLines;
      }
    }
  }

  const [name, email] = author.split(" - ");
  if (lines[0] && Object.keys(modifiedFiles).length >= MODULES_THRESHOLD) {
    outputData.push({
      commitName: lines[0],
      author: { name, email },
      date: moment.unix(timestamp).format("DD/MM/YYYY HH:mm:ss"),
      modifiedFiles,
    });
  }
}

async function runAnalysisIfNeeded() {
  if (outputData.length > 0) return;

  vscode.window.showInformationMessage("Running automatic analysis...");

  const configFolders = vscode.workspace.getConfiguration("gitMicroservicesAnalyzer").get("scanFolders") || [];
  const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

  if (!Array.isArray(configFolders) || configFolders.length === 0) {
    vscode.window.showErrorMessage("No scan folders defined in settings. Please set 'gitMicroservicesAnalyzer.scanFolders' in .vscode/settings.json.");
    return;
  }

  const scanPaths = configFolders.map(f => path.join(workspaceRoot, f));

  outputData = [];

  for (const filePath of scanPaths) {
    logData = await getLogs(filePath);
    for (let i = 0; i < logData.length; i += 3) {
      await getDiffTree(logData[i], logData[i + 1], parseInt(logData[i + 2]), filePath);
    }
  }

  vscode.window.showInformationMessage("Automatic analysis complete.");
}

function registerAnalysisCommand(context) {
  const disposable = vscode.commands.registerCommand("git-microservice-analyzer.analyze", async () => {
    vscode.window.showInformationMessage("Analysis started.");

    const filePath = vscode.workspace.workspaceFolders[0].uri.fsPath;

    outputData = [];
    logData = await getLogs(filePath);

    for (let i = 0; i < logData.length; i += 3) {
      await getDiffTree(logData[i], logData[i + 1], parseInt(logData[i + 2]), filePath);
    }

    vscode.window.showInformationMessage("Analysis complete.");
    return true;
  });

  context.subscriptions.push(disposable);
}

function registerChartCommands(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("git-microservice-analyzer.showBarChart", async () => {
      await runAnalysisIfNeeded();
      bar.getBarData(outputData);
    }),

    vscode.commands.registerCommand("git-microservice-analyzer.showMatrixPanel", async () => {
      await runAnalysisIfNeeded();
      matrix.getMatrixPanel(outputData);
    }),

    vscode.commands.registerCommand("git-microservice-analyzer.showChordDiagram", async () => {
      await runAnalysisIfNeeded();
      chord.getChordDiagram(outputData);
    })
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
      .map(name => ({ name, length: modules[name].length }))
      .sort((a, b) => b.length - a.length);

    const dominantModule = sortedModules[0]?.name;
    const filteredModules = editedModules.filter(name => name !== dominantModule);

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
  registerFileDecorator(context);
}

function deactivate() { 
  console.log('Extension "git-microservice-analyzer" is now active!');
}

module.exports = {
  activate,
  deactivate,
};
