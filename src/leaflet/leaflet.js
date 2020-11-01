import {sortObj} from '../utils'
import 'leaflet'

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

L.Polygon.mergeOptions({
  fillColor: '#fe0000',
  fillOpacity: 0.6,
  weight: 0,
  opacity: 0
});

L.LayerGroup.include({
  count: function() {
      return this.getLayers().length;
    }
});

// Map features (editable through Leaflet.Draw and Leaflet.StyleEditor)
// are normally a FeatureGroup but GeoJSON extends FeatureGroup and gives
// us functionality to populate with geojson data
L.FeatureLayer = L.GeoJSON.extend({
    contains(id) {
      var layer;
      this.eachLayer((_layer) => {
        if (_layer.id == id) {
          layer = _layer;
        }
      })

      return layer;
    },
    addFeature(geojson) {
      let id = geojson.properties.id;
      if (!!this.contains(id)) { return; }

      // the following is basically same as addData for single features but
      // returns the actual created layer
      var options = this.options || {};
      if (options.filter && !options.filter(geojson)) {
        return;
      }

      var layer = L.GeoJSON.geometryToLayer(geojson, options);
      if (!layer) {
        console.warn('layer creation error for', geojson)
        return;
      }
      layer.feature = L.GeoJSON.asFeature(geojson);
      layer.id = id

      layer.defaultOptions = layer.options;
      this.resetStyle(layer);

      if (options.onEachFeature) {
        options.onEachFeature(geojson, layer);
      }

      this.addLayer(layer);
      return layer;
    },
    updateFeature(geojson) {
      let id = geojson.properties.id;
      let layer = this.contains(id);
      if (!layer) {
        this.addFeature(geojson);
        return;
      }

      let sortedOld = sortObj(layer.feature),
          sortedNew = sortObj(geojson),
          strOld = JSON.stringify(sortedOld),
          strNew = JSON.stringify(sortedNew);
      if (strOld == strNew) {
        return;
      }

      this.deleteFeature(id);
      this.addFeature(geojson);
    },
    deleteFeature(id) {
      let found = this.contains(id);
      if (!!found) {
          this.removeLayer(found);
      }
    },
});


//
// With HTMLContainer you can provide an overlay on your map.
//
L.HTMLContainer = L.Class.extend({
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



export default L
