const axios = require('axios');

const POSTAL_LOOKUP_URL = 'https://api.postalpincode.in/pincode';

/** Look up recognized post office areas for an Indian postal PIN code. */
async function getPostalAreas(pinCode) {
  const response = await axios.get(`${POSTAL_LOOKUP_URL}/${encodeURIComponent(pinCode)}`, {
    timeout: 8000,
  });
  const result = Array.isArray(response.data) ? response.data[0] : null;
  if (result?.Status !== 'Success' || !Array.isArray(result.PostOffice)) return [];

  return result.PostOffice
    .filter((office) => office && office.Name && office.District && office.State)
    .map((office) => `${office.Name}, ${office.District}, ${office.State}`);
}

module.exports = { getPostalAreas };
