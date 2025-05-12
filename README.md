# git-microservice-analyzer

**git-microservice-analyzer** is a tool designed to analyze Git repositories to understand if the anti-pattern "Wrong Cuts" might be present in the repository.

The "Wrong Cuts" antipattern in microservice architecture refers to incorrectly splitting a system into microservices based on the wrong criteria, leading to poor cohesion, high coupling, and reduced maintainability. It typically happens when teams decompose the system by technical layers (e.g., frontend, backend, database) or organizational structure, rather than by business capabilities.

## Features

* Analyze the commit history of GIT repositories
* Visualize how often files belonging to different microservices are commited together, indicating potential "Wrong Cuts 
* Warn developers in the Source Control view if they are about to commit files belonging to different microservices

## Getting Started

### Prerequisites

* Visual Studio Code (https://code.visualstudio.com)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/ajanes/git-microservice-analyzer.git
   cd git-microservice-analyzer
   ```



2. Install dependencies and create vsix file:

   ```bash
   npm install
   npm install -g @vscode/vsce
   vsce package
   ```

3. Install the dependency within Visual Studio Code:


   ```code --install-extension your-extension-name.vsix
   ```

### Usage

Within Visual Studio Code, display the Command Palette and use one of the following commands:



## Configuration

TBD

## Output

TBD

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
