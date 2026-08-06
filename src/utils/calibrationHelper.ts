export interface CalibrationRecord {
  level?: number | string;
  Level?: number | string;
  volume?: number | string;
  Volume?: number | string;
}

/**
 * Calculates volume (in liters) from a calibration table and average measured level (in mm).
 * Handles unit conversion (cm vs mm) for train tanks and linear interpolation for non-integer levels.
 */
export function getVolumeFromCalibration(
  calibration: CalibrationRecord[],
  avgLevelMm: number,
  category: 'tank' | 'train' | string = 'tank'
): number {
  if (!calibration || !Array.isArray(calibration) || calibration.length === 0) return 0;

  const getLevel = (rec: CalibrationRecord) => {
    const l = rec.level ?? rec.Level;
    return typeof l === 'string' ? parseFloat(l.replace(',', '.')) : Number(l || 0);
  };

  const getVol = (rec: CalibrationRecord) => {
    const v = rec.volume ?? rec.Volume;
    return typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v || 0);
  };

  const levels = calibration.map(getLevel).filter(l => !isNaN(l));
  if (levels.length === 0) return 0;

  const maxTableLevel = Math.max(...levels);

  // Calibration tables for train tanks are standardly in centimeters (max level ~ 300-350 cm).
  // If max table level is < 1000 and input level (in mm) > max table level or category is 'train',
  // convert targetLevel from mm to cm.
  let targetLevel = avgLevelMm;
  if (maxTableLevel < 1000 && (avgLevelMm > maxTableLevel || category === 'train')) {
    targetLevel = avgLevelMm / 10;
  }

  // Exact match
  const exactRecord = calibration.find(r => getLevel(r) === targetLevel);
  if (exactRecord) {
    return getVol(exactRecord);
  }

  // Linear interpolation
  const sorted = [...calibration].sort((a, b) => getLevel(a) - getLevel(b));
  const lowerRecord = sorted.filter(r => getLevel(r) < targetLevel).pop();
  const upperRecord = sorted.filter(r => getLevel(r) > targetLevel).shift();

  if (lowerRecord && upperRecord) {
    const lL = getLevel(lowerRecord);
    const uL = getLevel(upperRecord);
    const volLower = getVol(lowerRecord);
    const volUpper = getVol(upperRecord);
    if (uL === lL) return volLower;
    return volLower + (volUpper - volLower) * ((targetLevel - lL) / (uL - lL));
  } else if (lowerRecord) {
    return getVol(lowerRecord);
  } else if (upperRecord) {
    return getVol(upperRecord);
  }

  return 0;
}
