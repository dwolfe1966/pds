// Jest stub for react-leaflet (ships untransformed ESM; jsdom can't render a real map anyway). AddressMap is
// the only consumer — these no-op components let any component that imports the map render in tests.
const React = require('react');
const Pass = ({ children }) => React.createElement(React.Fragment, null, children);
module.exports = {
  MapContainer: Pass,
  TileLayer: () => null,
  Marker: Pass,
  Popup: Pass,
  useMap: () => ({ setView() {}, fitBounds() {} }),
};
