/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Main entry point for the Flare Network n8n community node package.
 */

// Export nodes
export { Flare } from './nodes/Flare/Flare.node';
export { FlareTrigger } from './nodes/Flare/FlareTrigger.node';

// Export credentials
export { FlareNetworkApi } from './credentials/FlareNetwork.credentials';
export { FlareExplorerApi } from './credentials/FlareExplorer.credentials';
