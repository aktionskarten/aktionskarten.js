import {L} from './core'
import 'leaflet-editable'
import './editable.css'
import 'leaflet-path-drag'
import {sortObj} from '../utils'
import {ScaledRectangleEditor} from 'leaflet-editable-scaled-rect'
import {ContainerMixin, TooltipMixin} from './mixins'

console.log("EDITALE", L.Editable)

// Add tooltip functionality to all editors
L.Editable.BaseEditor.include(TooltipMixin);
L.Editable.BaseEditor.addInitHook(TooltipMixin.initTooltip)

// Add container functionality to all editors
L.Editable.BaseEditor.include(ContainerMixin);
L.Editable.BaseEditor.addInitHook(ContainerMixin.initOverlay)

import {ExtendedGeoJSON, SVGTextBox } from 'leaflet-text-editable'
//import {ExtendedGeoJSON, SVGTextBox, SVGTextBoxEditableMixin} from 'leaflet-text-editable'

// Map features (editable through Leaflet.Draw and Leaflet.StyleEditor)
// are normally a FeatureGroup but GeoJSON extends FeatureGroup and gives
// us functionality to populate with geojson data
const FeatureLayer = ExtendedGeoJSON.extend({
    options: {
      textClass: SVGTextBox,
    },

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
      const layer = this.createLayer(geojson);
      layer.id = id

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
      console.log(strOld)
      console.log(strNew)
      if (strOld == strNew) {
        return;
      }

      console.log("not the same")

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
// Text support
//
//L.Editable.include(SVGTextBoxEditableMixin)
L.Editable.include({
  createSVGTextBox(bounds, options) {
    return this.createLayer(SVGTextBox, bounds, options);
  },
  startSVGTextBox(latlng, options) {
    const corner = latlng || L.latLng([0, 0]);
    const bounds = L.latLngBounds(corner, corner);
    const textBox = this.createSVGTextBox(bounds, options);
    textBox.setLabel("Text")
    textBox.enableEdit(this.map).startDrawing();
    return textBox;
  }
});;



// We are interested in enforced DIN A4 paper ratios. This means our
// rectangle can be printed easily. The ratio is 1/sqrt(2) for landscape
// letters and the inverse for portray.
//
// Enhance rectangle with some utility methods
const RATIO_LANDSCAPE = 1240 / 1754.
const RATIO_PORTRAIT  = 1754 / 1240.
L.Rectangle.include({
  _isRatio(ratio) {
    let _ratio = this.height()/this.width();
    return Math.abs(_ratio -  ratio) < 0.1;
  },
  isLandscape() {
    return this._isRatio(RATIO_LANDSCAPE)
  },
  isPortrait() {
    return this._isRatio(RATIO_PORTRAIT)
  }
});

const BBoxEditor = ScaledRectangleEditor.extend({
  closeOnCommit: false,
  tooltipLabel: 'Hold mouse pressed to draw a rectangle',
  ratio: RATIO_LANDSCAPE,
  initialize: function (map, feature, options) {
    L.Editable.RectangleEditor.prototype.initialize.call(this, map, feature, options);
    L.Handler.PathDrag.makeDraggable(feature);
  },
  mode() {
    if (this.ratio == RATIO_LANDSCAPE) {
      return 'landscape'
    } else if (this.ratio == RATIO_PORTRAIT) {
      return 'portrait'
    }
    return ''
  },
  setMode(mode) {
    if (['', 'portrait', 'landscape'].indexOf(mode) < 0) {
      console.warn('invalid mode');
      return;
    }

    if (mode == 'landscape') {
      this.ratio = RATIO_LANDSCAPE
    } else if (mode == 'portrait') {
      this.ratio = RATIO_PORTRAIT
    } else {
      this.ratio = 0;
    }

    this.extendBounds()

    return this;
  },
  redraw() {
    var corner = L.latLng([0, 0]);
    var bounds = new L.LatLngBounds(corner, corner);
    this.updateBounds(bounds);
    this.updateLatLngs(bounds);
    this.refresh();
    this.reset()
    this.startDrawing()
  },
})
const BBox = L.Rectangle.extend({
  getEditorClass: function (tools) {
    return (tools && tools.options.BBoxEditorClass) ? tools.options.BBoxEditorClass : BBoxEditor;
  }
});

L.BBox = BBox
L.bbox = (bounds, options) => new BBox(bounds, options)
L.Editable.BBoxEditor = BBoxEditor

L.Editable.include({
  createBBox(bounds, options) {
    return this.createLayer(BBox, bounds, options);
  },
  startBBox(latlng) {
    var corner = L.latLng([0, 0]);
    var bounds = new L.LatLngBounds(corner, corner);
    var bbox = this.createBBox(bounds);
    bbox.enableEdit(this.map).startDrawing();
      return bbox;
  },
});


//
// Custom Controls
//
let BaseControl = L.Control.extend({
  options: {
    kind: '',
    title: '',
    html: '',
    position: 'topleft'
  },
  onAdd: function (map) {
    let container = L.DomUtil.create('div', 'leaflet-control leaflet-bar leaflet-toolbar-editable');
    let link = L.DomUtil.create('a', 'leaflet-toolbar-editable-'+this.options.kind, container);

    // use translate function if available otherwise provide identity
    let i18next = map.i18next;
    let t = (s) => (i18next) ? i18next.t(s) : s
    let label = t(this.options.kind)

    link.href = '#';
    link.title = this.options.title;
    link.innerHTML = '<span class="leaflet-toolbar-editable-' + this.options.kind + '"></span>' + label;

    L.DomEvent.on(container, 'click', L.DomEvent.stop)
              .on(container, 'click', ()=> this.callback(map.editTools))
    L.DomEvent.disableClickPropagation(container);

    return container;
  },
});

// Line Control and Editor
let LineControl = BaseControl.extend({
    options: {
      kind: 'line',
      title: 'neue Route erstellen',
    },
    callback(editable) {
      editable.startPolyline()
    }
})
L.Editable.PolylineEditor.include({
  name: 'PolylineEditor'
})

// Polygon Control and Editor
let PolygonControl = BaseControl.extend({
    options: {
      kind: 'polygon',
      title: 'Mark a new area',
    },
    callback(editable) {
      editable.startPolygon()
    }
})
L.Editable.PolygonEditor.include({
  name: 'PolygonEditor'
})

// Marker Control and Editor
let MarkerControl = BaseControl.extend({
    options: {
      kind: 'marker',
      title: 'Place a new marker',
    },
    callback(editable) {
      // HACK: Should be handled differntly in StyleEditor...
      let style = this._map.view._controls.style;
      let icon = style.getDefaultIcon()
      editable.startMarker(null, {icon:icon}).editor.connect();
    }
})
L.Editable.MarkerEditor.include({
  name: 'MarkerEditor'
})

// Text Control and Editor
const TextControl = BaseControl.extend({
    options: {
      kind: 'text',
      title: 'Write text on your map',
    },
    callback(editable) {
      console.log("start");
      return editable.startSVGTextBox();
    }
});

// BBox Control and Editor
L.Editable.BBoxEditor.include({
  name: 'BBoxEditor'
})

// factory functions for controls (to be exported)
function editable() {
  return [
    new MarkerControl(),
    new LineControl(),
    new PolygonControl(),
    //new TextControl()
  ];
}

export {L, FeatureLayer, editable}
