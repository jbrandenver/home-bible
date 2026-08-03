import type { AutomationDeviceCategory } from '@home-folder/shared';
import type { AutomationDeviceRow } from './automation';
import {
  createUtilityForContext,
  getUtilityDataContext,
  type UtilityRow,
  type UtilityType
} from './utilities';

/**
 * Where the smart home and the utilities record overlap: a smart smoke
 * detector IS the home's smoke detector, a smart water valve IS the main
 * shutoff. Recording the device also writes its critical-utility record, so
 * "where is it and how do I shut it off" lives with the rest of the
 * utilities — entered once, linked both ways via utilities.device_id.
 *
 * Deliberately safety-critical only. A smart speaker or vacuum is not a
 * utility, and flooding the utilities list would bury the shutoffs.
 */
export const DEVICE_CATEGORY_UTILITY_TYPE: Partial<Record<AutomationDeviceCategory, UtilityType>> = {
  smoke_detector: 'smoke_detector',
  carbon_monoxide_detector: 'carbon_monoxide_detector',
  water_shutoff_valve: 'main_water_shutoff',
  irrigation: 'irrigation_shutoff'
};

/**
 * Create the linked utility record for a just-created device whose category
 * crosses over. Returns the utility, or null when the category doesn't map.
 * Failures here must not lose the device the user just saved — callers treat
 * a throw as "device saved, utility didn't" and say so, rather than erroring
 * the whole save.
 */
export async function createLinkedUtilityForDevice(
  device: Pick<AutomationDeviceRow, 'id' | 'name' | 'nickname' | 'category' | 'room_id'>
): Promise<UtilityRow | null> {
  const utilityType = DEVICE_CATEGORY_UTILITY_TYPE[device.category];
  if (!utilityType) {
    return null;
  }

  const utilityContext = await getUtilityDataContext();
  return createUtilityForContext(utilityContext, {
    utility_type: utilityType,
    name: device.nickname || device.name,
    room_id: device.room_id || null,
    device_id: device.id
  });
}
