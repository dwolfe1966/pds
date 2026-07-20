// Jest stub for leaflet (untransformed ESM). AddressMap uses only L.divIcon; return a minimal icon object.
const L = { divIcon: () => ({ options: {} }) };
module.exports = L;
module.exports.default = L;
