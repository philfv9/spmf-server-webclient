[![License](https://img.shields.io/github/license/philfv9/spmf-server-webclient)](https://github.com/philfv9/spmf-server-webclient/blob/main/LICENSE)
[![Stars](https://img.shields.io/github/stars/philfv9/spmf-server-webclient)](https://github.com/philfv9/spmf-server-webclient/stargazers)

# A Web-Client for the SPMF-Server

A **web-based client (HTML, JavaScript, CSS)** with a modern GUI for  
[SPMF-Server](https://github.com/philfv9/spmf-server).

It provides a complete interface to:

- Browse mining algorithms
- Submit pattern mining jobs
- Monitor job execution
- Poll job status automatically
- Retrieve and visualize results

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Usage](#usage)
- [Views](#views)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [API Interaction](#api-interaction)
- [License](#license)

---

## Overview

This project is a **lightweight web client** that connects directly to a running instance of **SPMF-Server**.

It replaces command-line or desktop tools with a fully interactive browser interface.

<div align="center">
  <img src="/images/webclient.png" alt="SPMF server" >
</div>

The client handles the full job lifecycle automatically:

<div align="center">
  <img src="/images/flow.png" alt="SPMF server" >
</div>

---

## Features

- Modern **single-page web application (SPA)**
- Algorithm browser with dynamic loading
- Job submission interface with parameter support
- Automatic job polling (live status updates)
- Job history dashboard
- Result visualization module
- Console output viewer
- Modular architecture (separation of UI / API / logic)
- Fully responsive layout (desktop-friendly, extensible to mobile)

---

## Quick start

### 1. Start the server 

1. Download the SPMF Server and start the SPMF Server (see [SPMF-Server](https://github.com/philfv9/spmf-server) for details). Requires Java.

### 2. Start the webclient by clicking on `index.html`.  Click the **Connect** button to establish a connection.  If the connection success, then click on **Run job** to run an algorithm on a data file.

Optional: You can preset the configuration for connecting to the server in config.js:

| Setting | Description |
|--------|------------|
| host | Server hostname (default: localhost) |
| port | Server port (default: 8585) |
| apiKey | Optional API authentication key |

```javascript
export const config = {
  host: "localhost",
  port: 8585,
  pollInterval: 1000,
  timeout: 300
};
```

## Views

The web client for the SPMF server is organized into five main views, each designed to support a specific aspect of the user workflow.  Below is a description and screenshot of each view for reference.

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

### Check status
```
GET /api/jobs/{jobId}
```

### Fetch result
```
GET /api/jobs/{jobId}/result
```

### Fetch console
```
GET /api/jobs/{jobId}/console
```

---

##  Improvements

Interested in contributing? Send your comments and suggestions for improvements to philfv AT qq DOT com

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
