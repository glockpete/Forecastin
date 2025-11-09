/**
 * Local Feature Flag Overrides for Testing
 * 
 * This file enables geospatial features for local development/testing
 * when the backend FeatureFlagService is unavailable due to database/Redis issues.
 */

import { layerFeatureFlags } from './feature-flags';

/**
 * Enable all geospatial features for local testing
 */
export function enableLocalGeospatialTesting(): void {
  console.log('[Local Override] Enabling geospatial features for testing...');
  
  // Enable core geospatial features
  layerFeatureFlags.enableRollout('core_layers', 100);
  layerFeatureFlags.enableRollout('point_layers', 100);
  layerFeatureFlags.enableRollout('websocket_integration', 100);
  layerFeatureFlags.enableRollout('visual_channels', 100);
  
  // Log the status for verification
  const status = layerFeatureFlags.getStatusSummary();
  console.log('[Local Override] Feature flag status:', JSON.stringify(status, null, 2));
  
  // Verify key flags are enabled
  if (!layerFeatureFlags.isEnabled('ff.geo.layers_enabled')) {
    console.warn('[Local Override] WARNING: ff.geo.layers_enabled is still disabled');
  } else {
    console.log('[Local Override] ✅ ff.geo.layers_enabled is enabled');
  }

  if (!layerFeatureFlags.isEnabled('ff.geo.point_layer_active')) {
    console.warn('[Local Override] WARNING: ff.geo.point_layer_active is still disabled');
  } else {
    console.log('[Local Override] ✅ ff.geo.point_layer_active is enabled');
  }
  
  console.log('[Local Override] Geospatial features enabled for testing');
}

/**
 * Disable all geospatial features (emergency rollback)
 */
export function disableLocalGeospatialTesting(): void {
  console.log('[Local Override] Disabling geospatial features (emergency rollback)...');
  layerFeatureFlags.emergencyRollback();
  console.log('[Local Override] All geospatial features disabled');
}

/**
 * Check if local overrides are active
 */
export function isLocalTestingEnabled(): boolean {
  const status = layerFeatureFlags.getStatusSummary();
  return status.coreFlags.geospatialEnabled === true;
}

// Auto-enable when this module is imported (for development)
if (import.meta.env.DEV) {
  enableLocalGeospatialTesting();
}