# spmf-server-webclient
A Web client (HTML, JS, CSS) with GUI application for SPMF-Server. Provide interface to submit pattern mining jobs, poll job status, and fetch results。



spmf-server-webclient/
├── index.html
├── css/
│   ├── tokens.css        ← design tokens & variables
│   ├── reset.css         ← reset & base
│   ├── layout.css        ← shell, sidebar, topbar
│   ├── components.css    ← cards, buttons, forms, badges…
│   └── views.css         ← view-specific styles
└── js/
    ├── config.js         ← settings & persistence
    ├── api.js            ← HTTP layer
    ├── nav.js            ← navigation & routing
    ├── dashboard.js      ← dashboard view
    ├── algorithms.js     ← algorithm browser & detail panel
    ├── run.js            ← run-job workflow
    ├── jobs.js           ← jobs view
    ├── visualizer.js     ← result visualization
    └── ui.js             ← toast, modals, utilities
