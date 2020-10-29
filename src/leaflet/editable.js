import 'leaflet-editable'
import 'leaflet-path-drag'
import './editable.css'

//
// RectangleEditor - Add option to enforce DIN A4 landscape or potrait mode
// ratios for rectangles.
//
L.Editable.RectangleEditor.include({
  _forceRatio: true,
  _isLandscape: true,
  _extendBounds: L.Editable.RectangleEditor.prototype.extendBounds,
  unforceRatio() {
    this._forceRatio = false;
  },
  setLandscape() {
    forceRatio();
    this._isLandscape = true;
  },
  setPortrait() {
    forceRatio();
    this._isLandscape = false;
  },
  extendBounds(e) {
    // Use default implementation if no ratio is enforced.
    if (!this._forceRatio) {
      return this._extendBounds.call(this, e);
    }

    // We are interested in enforced DIN A4 paper ratios. This means our
    // rectangle can be printed easily. The ratio is 1/sqrt(2) for landscape
    // letters and the inverse for portray.
    var ratio = 1240 / 1754.

    // A rectangle can be defined through two opposite points (current,
    // opposite)
    var current        = e.vertex,
        currentLatLng  = e.latlng,
        currentIndex   = current.getIndex(),
        oppositeIndex  = (currentIndex + 2) % 4,
        oppositeLatLng = current.latlngs[oppositeIndex],
        opposite       = oppositeLatLng.__vertex;

    // If we are in portray mode, use multiplicative inverse to fix ratio
    if (!this._isLandscape) {
      ratio = Math.pow(ratio, -1)
    }

    // Update opposite point to keep ratio
    var a = this.map.latLngToLayerPoint(currentLatLng),
        b = this.map.latLngToLayerPoint(oppositeLatLng),
        width = Math.abs(b.x - a.x),
        sign = (a.y < b.y) ? +1 : -1;

    // Transform to WSG84 (latlng)
    var oppositeNew = new L.Point(b.x, a.y + width*ratio*sign);
    oppositeLatLng = this.map.layerPointToLatLng(oppositeNew);

    // Update Vertexes (markers)
    var next     = current.getNext(),
        previous = current.getPrevious();
    opposite.latlng.update(oppositeLatLng);
    previous.latlng.update([currentLatLng.lat, oppositeLatLng.lng]);
    next.latlng.update([oppositeLatLng.lat, currentLatLng.lng]);

    // Update Rectangle
    var bounds = new L.LatLngBounds(currentLatLng, oppositeLatLng);
    this.updateBounds(bounds);
    this.refreshVertexMarkers();
  }
});


//
// ContainerMixin enables you to provide a help text which will be rendered
// on top of your map. See implementation below for examples
//
var ContainerMixin = {

  initOverlay: function() {
    this.feature.on('editable:enable', this.showOverlay, this);
    this.feature.on('editable:disable', this.removeOverlay, this);
    this.feature.on('editable:drawing:cancel', this.removeOverlay, this);
    this.feature.on('editable:drawing:commit', this.removeOverlay, this);

    // refresh if it's finishable (add finish button)
    this.feature.on('editable:vertex:new', (e)=> {
      console.log('editable:vertex:new')
      let minVertices = this.feature.editor.MIN_VERTEX-1
      let finishable = e.vertex.getLastIndex() >= minVertices
      if (finishable) {
        this.addOverlay()
      }
    })
  },

  addOverlay: function() {
    if (!this.overlay) {
      this.overlay = new L.HTMLContainer(this.map.getContainer());
    } else {
      this.overlay.clear();
    }

    // use translate function if available otherwise provide identity
    let i18next = this.map.i18next;
    let t = (s) => (i18next) ? i18next.t(s) : s

    // add help text (try to translate if t function is available)
    this.overlay.add('p', 'small', t(this.name + '.help') + '<br />');

    // add buttons
    let buttons = this.options.buttons || [{}]

    let vertices = this._drawnLatLngs || []
    if (vertices.length >= this.MIN_VERTEX) {
      let btn = {
        label: t('Finish'),
        color: 'primary',
        callback: this.tools.commitDrawing.bind(this.tools),
      };

      // only add if not already contained
      if (!buttons.find(elem => elem.label == btn.label)) {
        buttons.push(btn);
      }
    }

    for (let button of buttons) {
      let label = button.label || t('Cancel');
      let color = button.color || 'danger';
      let callback = button.callback || this.tools.stopDrawing.bind(this.tools)
      this.overlay.add('button', 'btn btn-sm btn-'+color, label)
                    .on('click', callback, this)
                    .disableClickPropagation();
    }
  },

  setOverlayButtons: function(buttons) {
    this.options.buttons = buttons || [{}];
    this.addOverlay();
  },

  showOverlay: function() {
    if (!this.overlay) {
      this.addOverlay();
    }

    // HACK: only show for new features (not saved ones). Should be in View
    if (this.feature.id) {
      return;
    }

    this.overlay.show();
  },

  removeOverlay: function() {
    if (this.overlay) {
      this.overlay.remove()
    }
  }
};

// Add container functionality to all editors
L.Editable.BaseEditor.include(ContainerMixin);
L.Editable.BaseEditor.addInitHook(ContainerMixin.initOverlay)


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
