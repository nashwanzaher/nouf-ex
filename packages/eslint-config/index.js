// @noufex/eslint-config — root entry point.
//
// Picks the right preset for the consuming workspace:
//   - Node targets (Express API, MCP server) → node.js
//   - React/Vite targets (SPA)              → react.js
//
// Workspaces that need a specific preset should import it directly:
//   import nodeConfig from '@noufex/eslint-config/node';
//   import reactConfig from '@noufex/eslint-config/react';

import nodeConfig from './node.js';

export default nodeConfig;