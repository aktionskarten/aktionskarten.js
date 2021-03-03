import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'

//
// we're using webpack, therefor  fix dynamic url functionality by statically
// setting path and let webpack do the rest
//
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});


// Default styles for Leaflet geometries
L.Path.mergeOptions({
  color: '#7e55fc',
  weight: 5,
  opacity: 0.8
});

//L.Polygon.mergeOptions({
//  fillColor: '#fe0000',
//  fillOpacity: 0.6,
//  weight: 0,
//  opacity: 0
//});

L.LayerGroup.include({
  count: function() {
      return this.getLayers().length;
    }
});

//
// Enhance rectangle with some utility methods
//
L.Rectangle.include({
  height() {
    if (!this. _map) {
      return 0;
    }
    var bounds = this.getBounds(),
        bottomLeft = this._map.latLngToLayerPoint(bounds.getSouthWest()),
        topRight = this._map.latLngToLayerPoint(bounds.getNorthEast())
    return Math.abs(bottomLeft.y-topRight.y);
  },
  width() {
    if (!this. _map) {
      return 0;
    }
    var bounds = this.getBounds(),
        bottomLeft = this._map.latLngToLayerPoint(bounds.getSouthWest()),
        topRight = this._map.latLngToLayerPoint(bounds.getNorthEast())
    return Math.abs(bottomLeft.x-topRight.x);
  },
  isEmpty() {
    return !this.width() || !this.height();
  },
  bbox() {
    let bounds = this.getBounds();
    let latlngs = [bounds.getSouthWest(), bounds.getNorthEast()];
    let coords = L.GeoJSON.latLngsToCoords(latlngs)
    return [].concat.apply([], coords);
  }
});

export {L}
