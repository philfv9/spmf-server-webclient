[![License](https://img.shields.io/github/license/philfv9/spmf-server-webclient)](https://github.com/philfv9/spmf-server-webclient/blob/main/LICENSE)
[![Stars](https://img.shields.io/github/stars/philfv9/spmf-server-webclient)](https://github.com/philfv9/spmf-server-webclient/stargazers)
[![Issues](https://img.shields.io/github/issues/philfv9/spmf-server-webclient)](https://github.com/philfv9/spmf-server-webclient/issues)
[![Last Commit](https://img.shields.io/github/last-commit/philfv9/spmf-server-webclient)](https://github.com/philfv9/spmf-server-webclient/commits/main)
[![Made with JavaScript](https://img.shields.io/badge/Made%20with-JavaScript-yellow)]()
[![SPMF](https://img.shields.io/badge/SPMF-300%2B%20Algorithms-blue)](http://www.philippe-fournier-viger.com/spmf/)


# SPMF-Server Web Client

A modern, lightweight, and fully interactive **Web Client (HTML, JavaScript, CSS)** for the [SPMF-Server](https://github.com/philfv9/spmf-server).

This project provides a clean and user-friendly browser interface to remotely access and execute **300+ data mining and pattern mining algorithms** from the popular  [SPMF library](http://www.philippe-fournier-viger.com/spmf/), without requiring any installation beyond a web browser.


## Why this project?

The original SPMF ecosystem provides powerful data analysis capabilities through Java-based tools, GUI and command-line interfaces. However, it requires installing Java and running the software on our own computer. To provide more flexibility, the SPMF Server and Web client are proposed. It allows SPMF to be executed by multiple users remotely with zero installation (runs directly in the browser as a webpage) and through an intuitive user interface.

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Views](#views)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [API Interaction](#api-interaction)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

This project is a **lightweight front-end client** designed to interact with a running instance of **SPMF-Server**.

It replaces command-line or desktop tools with a visual, intuitive, and interactive browser interface.

<div align="center">
  <img src="/images/webclient.png" alt="SPMF server" >
</div>

The client automatically manages the **complete job lifecycle**, from submission to result retrieval:

<div align="center">
  <img src="/images/flow.png" alt="SPMF server" >
</div>

---

## Quick start

### 1. Start the SPMF Server

- Download the SPMF Server and launch it (see [SPMF-Server](https://github.com/philfv9/spmf-server) for details).

**Requirement:** Java must be installed.

### 2. Launch the Web Client 

- Click on `index.html`. 

### 3. Connect to the Server

- Enter server configuration (or use defaults)
- Click **Connect**

### 4. Run a Mining Job

- Go to **Run Job**
- Select an algorithm
- Upload a dataset
- Set parameters
- Click **Run Job**

The system will:
- Submit the job
- Poll its status automatically
- Retrieve results when ready

## Configuration

You can customize the connection settings in `config.js`:

You can  preset the configuration for connecting to the server in config.js by specifying the server hostname, server port, api key (optional), job poll interval (e.g. 1 second), job timeout (e.g. 300 seconds), encoding (e.g. "plain) and whether the job should auto-delete from the server after returning the results to the client.

```javascript
  /* ── Defaults ─────────────────────────────────────────────────── */
  const DEFAULTS = {
    host:     "localhost",
    port:     8585,
    apikey:   "",
    poll:     1,
    timeout:  300,
    encoding: "plain",
    cleanup:  true,
  };
```


## Views

The Web Client is organized into several intuitive views, each supporting a specific stage of the workflow:

The **Dashboard** provides an overview of the server’s current status, allowing users to monitor active jobs in real time and access system logs for troubleshooting and transparency.

<div align="center">
  <img src="/images/dashboard.png" alt="Dashboard view" width="800">
</div>

The **Algorithms** view enables users to explore the full list of available algorithms. It includes functionality for searching and filtering, as well as viewing detailed information about each algorithm’s parameters.

<div align="center">
  <img src="/images/algorithms.png" alt="Algorithms view" width="800">
</div>

The **Run Job** interface guides users through the process of executing a task. Users can select an algorithm, upload a dataset, configure the required parameters, and submit the job for execution.

<div align="center">
  <img src="/images/runjob.png" alt="Run job view" width="800">
</div>

The **Jobs** view displays a live list of all submitted jobs. It allows users to track the status of each job and delete jobs when necessary.

<div align="center">
  <img src="/images/jobs.png" alt="Jobs view" width="800">
</div>

Finally, the **Settings** allows to configure options for the Web client.

<div align="center">
  <img src="/images/settings.png" alt="Settings view" width="800">
</div>

---

## Architecture

The application follows a clean modular architecture:

| Layer | Files | Responsibility |
|------|------|----------------|
| UI Layer | `index.html`, `layout.css`, `components.css`, `views.css` | Interface rendering |
| Logic Layer | `dashboard.js`, `run.js`, `jobs.js`, `algorithms.js` | Application logic |
| Navigation | `nav.js` | Routing and view switching |
| API Layer | `api.js` | HTTP communication with server |
| Utilities | `ui.js`, `config.js` | Helpers, state, notifications |
| Visualization | `visualizer.js` | Result rendering |

---

## Project Structure

```
spmf-server-webclient/
├── index.html
├── css/
│   ├── tokens.css
│   ├── reset.css
│   ├── layout.css
│   ├── components.css
│   └── views.css
└── js/
    ├── config.js
    ├── api.js
    ├── nav.js
    ├── dashboard.js
    ├── algorithms.js
    ├── run.js
    ├── jobs.js
    ├── visualizer.js
    └── ui.js
```

## API Interaction

### Submit job
```
POST /api/run
```

### Check job status
```
GET /api/jobs/{jobId}
```

### Fetch results
```
GET /api/jobs/{jobId}/result
```

### Fetch console output
```
GET /api/jobs/{jobId}/console
```

---

## Contributing

Contributions, suggestions, and feedback are welcome!

Interested in contributing? Send us your comments and suggestions for improvements.

📧 Contact: philfv AT qq DOT com

---

## License

This project is licensed under the GNU General Public License v3.0.

The code is copyright by the authors.

© Philippe Fournier-Viger

---

## Related Projects

- SPMF Library: https://github.com/philfv9/spmf
- SPMF-Server: https://github.com/philfv9/spmf-server
- Official Website: http://philippe-fournier-viger.com/spmf/
