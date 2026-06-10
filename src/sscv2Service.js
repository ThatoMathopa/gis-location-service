const { executeHttpRequest } = require('@sap-cloud-sdk/http-client');

const DESTINATION_NAME = process.env.SSCV2_DESTINATION || 'Case_Object';

/**
 * Patches GIS location extension fields onto an SSCv2 Case.
 *
 * Uses the Case_Object BTP destination (HTTP, Internet) which points
 * at the Service Cloud V2 tenant.
 *
 * @param {string} caseId  - SSCv2 Case UUID
 * @param {object} location - GIS location record from gisService
 * @returns {void}
 */
async function enrichCase(caseId, location) {
  await executeHttpRequest(
    { destinationName: DESTINATION_NAME },
    {
      method:  'PATCH',
      url:     `/odata/v4/CasesService/Cases(${caseId})`,
      headers: { 'Content-Type': 'application/json' },
      data: {
        // Map GIS fields to SSCv2 Case extension fields
        yy1_Street_case:         location.Street        || '',
        yy1_StreetNo_case:       location.StreetNo      || '',
        yy1_Suburb_case:         location.Suburb        || '',
        yy1_Ward_case:           location.Ward          || '',
        yy1_Region_case:         location.Region        || '',
        yy1_NearestCorner_case:  location.NearestCorner || '',
        yy1_PortionNo_case:      location.PortionNo     || '',
        yy1_ERFNumber_case:      location.Erfno         || '',
        yy1_GPSLong_case:        location.GisX          || '',
        yy1_GPSLat_case:         location.GisY          || ''
      }
    }
  );
}

module.exports = { enrichCase };
