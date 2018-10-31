import {sortObj} from '../utils'
import 'leaflet'
import 'leaflet-editable'
import 'leaflet-path-drag'
import 'leaflet-styleeditor'
import 'AktionskartenMarker'

import 'leaflet/dist/leaflet.css'
import 'leaflet-styleeditor/dist/css/Leaflet.StyleEditor.min.css'
import 'AktionskartenMarker/AktionskartenMarker.css'
import './style.css'

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
        console.log("same");
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

  add(tagName, className, content) {
    let elem = L.DomUtil.create(tagName, className, this._container);

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



//
// Leaflet StyleEditor
//
let TooltipContentElement = L.StyleEditor.formElements.FormElement.extend({
  options: {
    title: 'Description'
  },
  createContent: function () {
    let uiElement = this.options.uiElement,
        input = this.options.input = L.DomUtil.create('input', 'form-control', uiElement);
    input.type = 'text';
    L.DomEvent.addListener(input, 'change', this._setStyle, this);
  },
  style: function () {
    let selectedElement = this.options.styleEditorOptions.util.getCurrentElement();
    if (selectedElement && selectedElement.options) {
      this.options.input.value = selectedElement.options.label || ''
    }
  },
  _setStyle: function () {
    let marker = this.options.styleEditorOptions.util.getCurrentElement()
    let label = this.options.input.value
    if (marker && marker.getTooltip && marker.bindTooltip) {
      let tooltip = marker.getTooltip()
      if (tooltip) {
        tooltip.setContent(label)
      } else {
        marker.bindTooltip(label, {permanent: true, interactive: true})
      }
      marker.options = marker.options || {}
      marker.options.label = label
    }
    this.setStyle(label)
  }
})

let ButtonElement = L.StyleEditor.formElements.FormElement.extend({
  options: {
    title: 'Löschen'
  },
  createContent: function () {
    let label = this.options.label = L.DomUtil.create('button', 'leaflet-styleeditor-button leaflet-styleeditor-button-custom', this.options.uiElement)
    label.innerHTML = this.options.title
    L.DomEvent.addListener(label, 'click', this._fire, this)
  },

  /** No title */
  createTitle: function () {},

  _fire: function () {
    let elem = this.options.styleEditorOptions.util.getCurrentElement();
    elem.fire('triggered');
  }
})

// Add delete button to forms
L.StyleEditor.forms.GeometryForm.include({
  initialize: function(options) {
    this.options.formElements['tooltipContent'] = TooltipContentElement;
    this.options.formElements['button'] = ButtonElement;
    delete this.options.formElements['popupContent'];
    L.StyleEditor.forms.Form.prototype.initialize.call(this, options);
  },
  showFormElements: function () {
    var util = this.options.styleEditorOptions.util,
        curr = util.getCurrentElement(),
        elems = this.options.initializedElements,
        selected = [];
    if (curr.feature.geometry.type == 'Polygon') {
      let keys = ['color', 'opacity', 'weight', 'dashArray'];
      selected = elems.filter(x=>keys.indexOf(x.options.styleOption)<0);
    } else {
      selected = elems.filter(x=>!x.options.styleOption.startsWith('fill'));
    }

    for (let elem of selected) {
      elem.show();
    }
  }
});
L.StyleEditor.forms.MarkerForm.include({
  initialize: function(options) {
    this.options.formElements['tooltipContent'] = TooltipContentElement;
    this.options.formElements['button'] = ButtonElement;
    delete this.options.formElements['popupContent'];
    L.StyleEditor.forms.Form.prototype.initialize.call(this, options);
  },
});

L.Control.StyleEditor.include({
  isEnabled () {
    let ui = this.options.controlUI;
    return ui && L.DomUtil.hasClass(ui, 'enabled');
  }
});

//
// Leaflet Editable
//
L.Editable.RectangleEditor.include({
  extendBounds(e) {
    // limit ratio to DIN A4
    var index = e.vertex.getIndex(),
        next = e.vertex.getNext(),
        previous = e.vertex.getPrevious(),
        oppositeIndex = (index + 2) % 4,
        opposite = e.vertex.latlngs[oppositeIndex],
        a = this.map.latLngToLayerPoint(e.latlng),
        b = this.map.latLngToLayerPoint(opposite),
        width = Math.abs(b.x - a.x),
        ratio =  1240 / 1754.; // 1./Math.sqrt(2)

    if (a.y < b.y) {
      b = new L.Point(b.x, a.y + width*ratio);
    } else {
      b = new L.Point(b.x, a.y - width*ratio);
    }

    opposite = this.map.layerPointToLatLng(b);
    previous.latlng.update([e.latlng.lat, opposite.lng]);
    next.latlng.update([opposite.lat, e.latlng.lng]);

    var bounds = new L.LatLngBounds(e.latlng, opposite);
    this.updateBounds(bounds);
    this.updateLatLngs(bounds);
    this.refreshVertexMarkers();
  }
});


// ContainerMixin enables you to provide a help text which will be rendered
// on top of your map
var ContainerMixin = {
  initOverlay: function() {
    if (true || this.options.help) {
      this.feature.on('editable:enable', this.showOverlay, this);
      this.feature.on('editable:disable', this.hideOverlay, this);
      this.feature.on('editable:drawing:commit', this.hideOverlay, this);

      // add help text
      this.overlay = new L.HTMLContainer(this.map.getContainer());
      this.overlay.add('p', 'small', this.options.help + '<br />');

      // add buttons
      let buttons = this.options.buttons || [{}]
      for (let button of buttons) {
        let label = button.label || 'Abbrechen';
        let color = button.color || 'danger';
        let callback = button.callback || this.tools.stopDrawing
        let context = (button.callback) ? this : this.tools;
        this.overlay.add('button', 'btn btn-sm btn-'+color, label)
                      .on('click', callback, context)
                      .on('click', this.hideOverlay, this)
                      .disableClickPropagation();
      }
    }
  },

  showOverlay: function() {
    if (!this.container) {
      this.initOverlay();
    }

    // only show for new features (not saved ones)
    if (this.feature.id) {
      return;
    }

    this.overlay.show()
  },

  hideOverlay: function() {
    if (this.overlay) {
      this.overlay.hide()
    }
  }
};

L.Editable.BaseEditor.include(ContainerMixin);
L.Editable.BaseEditor.addInitHook(ContainerMixin.initOverlay)


// Controls
L.EditControl = {}
L.EditControl.Base = L.Control.extend({
  options: {
    kind: '',
    title: '',
    html: '',
    position: 'topleft'
  },
  onAdd: function (map) {
    let container = L.DomUtil.create('div', 'leaflet-control leaflet-bar leaflet-toolbar-editable');
    let link = L.DomUtil.create('a', 'leaflet-toolbar-editable-'+this.options.kind, container);
    link.href = '#';
    link.title = this.options.title;
    link.innerHTML = '<span class="leaflet-toolbar-editable-' + this.options.kind + '"></span>' + this.options.html;

    L.DomEvent.on(container, 'click', L.DomEvent.stop)
              .on(container, 'click', ()=> this.callback(map.editTools))

    return container;
  },
});

// Line Control and Editor
L.EditControl.Line = L.EditControl.Base.extend({
    options: {
      kind: 'line',
      title: 'neue Route erstellen',
      html: 'Route'
    },
    callback(editable) {
      editable.startPolyline()
    }
})
L.Editable.PolylineEditor.include({
  options: {
    help: 'Klicke auf die Karte um eine Route zu malen. Beende sie indem du den letzten Punkt nochmal anklickst.',
  }
})

// Polygon Control and Editor
L.EditControl.Polygon = L.EditControl.Base.extend({
    options: {
      kind: 'polygon',
      html: 'Gebiet',
      title: 'neues Gebiet markieren',
    },
    callback(editable) {
      editable.startPolygon()
    }
})
L.Editable.PolygonEditor.include({
  options: {
    help: 'Klicke auf die Karte um ein Gebiet zu markieren. Mindestens drei Punkte notwendig.',
  }
})

// Marker Control and Editor
L.EditControl.Marker = L.EditControl.Base.extend({
    options: {
      kind: 'marker',
      html: 'Marker',
      title: 'neuen Marker setzen',
    },
    callback(editable) {
      editable.startMarker().editor.connect();
    }
})
L.Editable.MarkerEditor.include({
  options: {
    help: 'Klicke auf die Karte um den Marker zu platzieren.',
  }
})

L.Editable.RectangleEditor.include({
  options: {
    buttons: [
      {
        label: 'Neuzeichnen',
        color: 'secondary',
        callback: function() { this.fireAndForward('bbox:redraw') },
      },
      {
        label: 'Weiter',
        color: 'primary',
        callback: function() { this.fireAndForward('bbox:commit') },
      }
    ],
    help: 'Markiere ein DIN-A4 Rechteck als Grundlage für deine Aktionskarte.',
  }
})

export default L;
