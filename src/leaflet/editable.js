import 'leaflet-editable'
import 'leaflet-path-drag'
import L from './leaflet'
import './editable.css'
import {ContainerMixin, TooltipMixin} from './mixins'


// Add tooltip functionality to all editors
L.Editable.BaseEditor.include(TooltipMixin);
L.Editable.BaseEditor.addInitHook(TooltipMixin.initTooltip)


// Add container functionality to all editors
L.Editable.BaseEditor.include(ContainerMixin);
L.Editable.BaseEditor.addInitHook(ContainerMixin.initOverlay)

//
// RectangleEditor - Add option to enforce DIN A4 landscape or potrait mode
// ratios for rectangles.
//
L.Editable.RectangleEditor.include({
  closeOnCommit: false,
  tooltipLabel: 'Hold mouse pressed to draw a rectangle',
  _mode: 'landscape',
  _extendBounds: L.Editable.RectangleEditor.prototype.extendBounds,
  enforceBounds() {
    if (!this.feature.isEmpty()) {
      this.map.fitBounds(this.getDefaultLatLngs())
    }
  },
  mode() {
    return this._mode;
  },
  setMode(mode) {
    if (['', 'portrait', 'landscape'].indexOf(mode) < 0) {
      console.warn('invalid mode');
      return;
    }

    this._mode = mode;

    if (!!mode) {
      this.enforceRatio();
      this.enforceBounds();
    }
  },
  extendBounds(e) {
    if (!!this.mode()) {
      return this.enforceRatio(e.vertex, e.latlng);
    }

    // Use default implementation if no ratio is enforced.
    return this._extendBounds.call(this, e);
  },
  enforceRatio(selected, newLatLng) {
    selected  = selected || this.getLatLngs()[0][0].__vertex;
    newLatLng = newLatLng || selected.getLatLng();

    // We are interested in enforced DIN A4 paper ratios. This means our
    // rectangle can be printed easily. The ratio is 1/sqrt(2) for landscape
    // letters and the inverse for portray.
    var ratio = 1240 / 1754.

    // If we are in portray mode, use multiplicative inverse to fix ratio
    if (this.mode() == 'portrait') {
      ratio = Math.pow(ratio, -1)
    }

    // A rectangle can be defined through two points on a diagonal:
    // selected+opposite
    var oppositeIndex  = (selected.getIndex() + 2) % 4,
        oppositeLatLng = selected.latlngs[oppositeIndex],
        opposite       = oppositeLatLng.__vertex;

    // Recalculate opposite point to keep ratio
    var a = this.map.latLngToLayerPoint(newLatLng),
        b = this.map.latLngToLayerPoint(oppositeLatLng),
        width = Math.abs(b.x - a.x),
        sign = (a.y < b.y) ? +1 : -1,
        oppositeNew = new L.Point(b.x, a.y + width*ratio*sign);

    // Transform to WSG84 (latlng)
    oppositeLatLng = this.map.layerPointToLatLng(oppositeNew);

    // Update Vertexes in-place (markers)
    var next = selected.getNext(),
        prev = selected.getPrevious();
    opposite.latlng.update(oppositeLatLng);
    prev.latlng.update([newLatLng.lat, oppositeLatLng.lng]);
    next.latlng.update([oppositeLatLng.lat, newLatLng.lng]);
    this.refreshVertexMarkers();

    // Update and redraw Rectangle
    var bounds = new L.LatLngBounds(newLatLng, oppositeLatLng);
    this.updateBounds(bounds);
    this.refresh();
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

// Rectangle Control
L.Editable.RectangleEditor.include({
  name: 'RectangleEditor'
})

function editable() {
  return [
    new MarkerControl(),
    new LineControl(),
    new PolygonControl()
  ];
}

export {editable}
