import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'

console.log('LEAFLET', L)

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

L.Map.include({
  bar: 'yea'
});



//
// With HTMLContainer you can provide an overlay on your map.
//
const HTMLContainer = L.Class.extend({
  initialize(root) {
    this._root = root;
    this._wrapper = L.DomUtil.create('div', 'leaflet-styleeditor-tooltip-wrapper')
    this._tooltip = L.DomUtil.create('div', 'leaflet-styleeditor-tooltip', this._wrapper);
    this._container = L.DomUtil.create('div', 'container', this._tooltip);
  },

  show() {
    if (this._root && !this._root.contains(this._wrapper)) {
      this._root.appendChild(this._wrapper)
    }
  },

  hide() {
    if (this._root && this._root.contains(this._wrapper)) {
      this._root.removeChild(this._wrapper)
    }
  },

  clear() {
    L.DomUtil.empty(this._container);
  },

  remove() {
    this.clear();
    L.DomUtil.remove(this._container);
    L.DomUtil.remove(this._tooltip);
    L.DomUtil.remove(this._wrapper);

  },

  add(tagName, className, content, container) {
    container = container || this._container
    let elem = L.DomUtil.create(tagName, className, container);

    // HTMLElement has no event subscription  method, add with same defintion
    // like for leaflet
    elem.on = function(type, fn, context) {
      L.DomEvent.on(this, type, fn, context ? context : this);
      return this;
    };

    elem.disableClickPropagation = function() {
      L.DomEvent.disableClickPropagation(this);
      return this;
    };

    elem.innerHTML = content;
    return elem;
  }
});


//L.Rectangle.mergeOptions({
//  draggable: true,
//});

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
  _isRatio(ratio) {
    let _ratio = this.height()/this.width();
    return Math.abs(_ratio -  ratio) < 0.1;
  },
  isLandscape() {
    return this._isRatio(1240/1754.)
  },
  isPortrait() {
    return this._isRatio(1754/1240.)
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


export {L, HTMLContainer}
