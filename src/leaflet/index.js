import L from 'leaflet'
import 'leaflet-draw'
import 'leaflet-styleeditor'
import 'AktionskartenMarker'

import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-styleeditor/dist/css/Leaflet.StyleEditor.min.css'
import 'AktionskartenMarker/AktionskartenMarker.css'
import './style.css'

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});


//
// Localized Leaflet.Draw strings
//
L.drawLocal.draw.toolbar.buttons.text = 'Schreibe Text zu einem Element';
L.drawLocal.draw.toolbar.buttons.polyline = 'Male eine Demoroute';
L.drawLocal.draw.toolbar.buttons.polygon = 'Markiere ein Gebiet';
L.drawLocal.draw.toolbar.buttons.marker = 'Platziere einen Aktionsmarker';
L.drawLocal.draw.handlers.polyline.tooltip = {
  'start': 'Klicke wo die Demo anfangen soll',
  'cond': 'Klick wo die Demo langlaufen soll',
  'end': 'Klicke auf den letzten Demopunkt um die Route zu beenden'
}
L.drawLocal.edit.handlers.text = {
  tooltip: {
    text: 'Klicke auf ein Element um es zu labeln.'
  }
}

L.Control.StyleEditor.include({
  isEnabled () {
    let ui = this.options.controlUI;
    return ui && L.DomUtil.hasClass(ui, 'enabled');
  }
});

// Limit rectangle to DINA4 ratio
L.Draw.Rectangle.include({
  _drawShape: function (latlng) {
    if (!this._shape) {
      this._shape = new L.Rectangle(new L.LatLngBounds(this._startLatLng, latlng), this.options.shapeOptions);
      this._map.addLayer(this._shape);
    } else {
      let a = this._map.latLngToLayerPoint(this._startLatLng),
          b = this._map.latLngToLayerPoint(latlng),
          width = Math.abs(b.x - a.x);

      let ratio =  1240 / 1754.; // 1./Math.sqrt(2)
      if (a.y < b.y) {
        b = new L.Point(b.x, a.y + width*ratio);
      } else {
        b = new L.Point(b.x, a.y - width*ratio);
      }

      latlng = this._map.layerPointToLatLng(b);
      this._shape.setBounds(new L.LatLngBounds(this._startLatLng, latlng));
    }
  }
});

L.GeoJSON.include({
    count() {
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
      var options = this.options;
      if (options.filter && !options.filter(geojson)) {
        return;
      }

      var layer = L.GeoJSON.geometryToLayer(geojson, options);
      if (!layer) {
        return;
      }
      layer.feature = L.GeoJSON.asFeature(geojson);

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
      if (!this._contains(id)) {
        return;
      }

      this.deleteFeature(geojson.properties.id);
      this.addFeature(geojson);
    },
    deleteFeature(id) {
      let found = this.contains(id);
      if (!!found) {
          this.removeLayer(found);
      }
    },
});


L.HTMLContainer = L.Class.extend({
  initialize(root) {
    this.elems = [];
    this._root = root;
  },

  show() {
    console.log("SHOWING CONTAINER");
    if (!this._wrapper) {
      console.log("CREATING NEW CONTAINER");
      this._wrapper = L.DomUtil.create('div', 'leaflet-styleeditor-tooltip-wrapper', this._root)
      this._tooltip = L.DomUtil.create('div', 'leaflet-styleeditor-tooltip', this._wrapper);
      this._container = L.DomUtil.create('div', 'container', this._tooltip);
    }
  },

  hide() {
    if (this._wrapper) {
      this.reset();
      L.DomUtil.remove(this._container);
      L.DomUtil.remove(this._tooltip);
      L.DomUtil.remove(this._wrapper);
    }

    this._wrapper = undefined;
    this._tooltip = undefined;
    this._container = undefined;
  },

  isOpen() {
    return !!this._wrapper;
  },

  hasContent() {
    return this.elems.length > 0
  },

  reset() {
    if (this._container) {
      L.DomUtil.empty(this._container);
    }
    this.elems = [];
  },

  add(tagName, className, content) {
    let elem = L.DomUtil.create(tagName, className, this._container);

    elem.on = function() {
      let args = [elem].concat(Array.from(arguments));
      L.DomEvent.on.apply(this , args);
    };
    elem.on('remove', (e) => {
      let idx = this.elems.indexOf(elem);
      if (idx) {
        this.elems.splice(idx, 1);
      }
    });

    if (content) {
      elem.innerHTML = content;
    }

    this.elems.push(elem);
    return elem;
  }
});

export default L;

//
// Custom Text Edit Handler - unused
//
//
//L.Draw.Event.TEXTSTART = 'draw:textstart'
//L.Draw.Event.TEXTSTOP = 'draw:textstop'
//
//L.EditToolbar.Text = L.Handler.extend({
//  statics: {
//    TYPE: 'text'
//  },
//
//  // copy/paste of L.EditToolbar.Delete.initialize
//  initialize(map, options) {
//    L.Handler.prototype.initialize.call(this, map);
//
//    L.Util.setOptions(this, options);
//
//    // Store the selectable layer group for ease of access
//    this._layers = this.options.featureGroup;
//
//    if (!(this._layers instanceof L.FeatureGroup)) {
//      throw new Error('options.featureGroup must be a L.FeatureGroup');
//    }
//
//    // Save the type so super can fire, need to do this as cannot do this.TYPE :(
//    this.type = L.EditToolbar.Text.TYPE;
//
//    var version = L.version.split('.');
//    //If Version is >= 1.2.0
//    if (parseInt(version[0], 10) === 1 && parseInt(version[1], 10) >= 2) {
//      L.EditToolbar.Text.include(L.Evented.prototype);
//    } else {
//      L.EditToolbar.Text.include(L.Mixin.Events);
//    }
//  },
//
//  enable() {
//    if (this._enabled) {
//      return;
//    }
//    this.fire('enabled', {handler: this.type});
//    this._map.fire(L.Draw.Event.TEXTSTART, {handler: this.type});
//
//    L.Handler.prototype.enable.call(this);
//
//    this._layers
//      .on('layeradd', this._enableLayerHandler, this)
//      .on('layerremove', this._disableLayerHandler, this);
//  },
//
//  disable() {
//    if (!this._enabled) {
//      return;
//    }
//
//    this._layers
//      .off('layeradd', this._enableLayerHandler, this)
//      .off('layerremove', this._disableLayerHandler, this);
//
//    L.Handler.prototype.disable.call(this);
//
//    this._map.fire(L.Draw.Event.TEXTSTOP, {handler: this.type});
//
//    this.fire('disabled', {handler: this.type});
//  },
//
//
//  _enableLayerHandler(e) {
//    var layer = e.layer || e.target || e;
//    layer.on('click', this._layerHandler, this);
//  },
//
//  _disableLayerHandler(e) {
//    var layer = e.layer || e.target || e;
//    layer.off('click', this._layerHandler, this);
//
//    // close still open popups when disabled
//    if (layer.isPopupOpen()) {
//      layer.closePopup()
//    }
//    layer.unbindPopup();
//  },
//
//  _layerHandler(e) {
//    var layer = e.layer || e.target || e;
//
//    // replace popup with tooltip and mark layer as edited
//    layer.on('popupclose', e => {
//      var elem = layer.getPopup().getContent();
//      var value = elem && elem.getAttribute('value');
//      if (layer.getTooltip()) {
//        layer.setTooltipContent(elem.value);
//      } else {
//        layer.bindTooltip(elem.value, {direction: 'left', sticky: true});
//      }
//
//      layer.options.label = elem.value;
//      layer.edited = true
//
//      layer.unbindPopup()
//    });
//
//    // create popup and focus input
//    var elem = L.DomUtil.create('input');
//    elem.setAttribute('type', 'text');
//    if ('label' in layer.options) {
//      elem.setAttribute('value', layer.options.label);
//    }
//    L.DomEvent.on(elem, 'keypress', function (ev) {
//      if (ev.key == 'Enter') {
//        layer.closePopup();
//      }
//    });
//
//    layer.bindPopup(elem, {opacity: 0.7, sticky: true}).openPopup();
//    elem.focus();
//  },
//
//  save() {
//    var editedLayers = new L.LayerGroup();
//    this._layers.eachLayer(function (layer) {
//      if (layer.isPopupOpen()) {
//        layer.closePopup()
//      }
//
//      if (layer.edited) {
//        editedLayers.addLayer(layer);
//        layer.edited = false;
//      }
//    });
//
//    this._map.fire(L.Draw.Event.EDITED, {layers: editedLayers});
//  },
//
//  addHooks() {
//    var map = this._map;
//
//    if (map) {
//      map.getContainer().focus();
//
//      this._layers.eachLayer(this._enableLayerHandler, this);
//
//      this._tooltip = new L.Draw.Tooltip(this._map);
//      this._tooltip.updateContent({text: L.drawLocal.edit.handlers.text.tooltip.text});
//
//      this._map.on('mousemove', this._onMouseMove, this);
//    }
//  },
//
//  removeHooks() {
//    if (this._map) {
//      this._layers.eachLayer(this._disableLayerHandler, this);
//
//      this._tooltip.dispose();
//      this._tooltip = null;
//
//      this._map.off('mousemove', this._onMouseMove, this);
//    }
//  },
//
//  _onMouseMove: function (e) {
//    this._tooltip.updatePosition(e.latlng);
//  },
//
//  revertLayers() {
//  }
//});
//
//
//let defaultEditModeHandlers = L.EditToolbar.prototype.getModeHandlers;
//L.EditToolbar.include({
//  getModeHandlers: function(map) {
//    var featureGroup = this.options.featureGroup;
//    let modeHandlers = defaultEditModeHandlers.bind(this).call(this, map)
//    modeHandlers.push({
//        enabled: true, //this.options.text,
//        handler: new L.EditToolbar.Text(map, {
//          featureGroup: featureGroup
//        }),
//        title: L.drawLocal.edit.toolbar.buttons.text
//    });
//    return modeHandlers;
//  }
//});
//


//
// Custom Draw Handler - unused
//
//L.Draw.Text = L.Draw.Feature.extend({
//  statics: {
//    TYPE: 'text'
//  },
//  // @method initialize(): void
//  initialize: function (map, options) {
//    // Save the type so super can fire, need to do this as cannot do this.TYPE :(
//    this.type = L.Draw.Text.TYPE;

//    //this._initialLabelText = L.drawLocal.draw.handlers.text.tooltip.start;

//    L.Draw.Feature.prototype.initialize.call(this, map, options);
//  },

//})
//let defaultModeHandlers = L.DrawToolbar.prototype.getModeHandlers;
//L.DrawToolbar.include({
//  getModeHandlers: function(map) {
//    let modeHandlers = defaultModeHandlers.bind(this).call(this, map)
//    modeHandlers.push({
//      enabled: {},//this.options.text,
//      handler: new L.Draw.Text(map, this.options.text),
//      type: 'text',
//      title: L.drawLocal.draw.toolbar.buttons.polyline
//    });
//    return modeHandlers
//  }
//});

