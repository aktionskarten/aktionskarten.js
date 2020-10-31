import 'leaflet-editable'
import 'leaflet-path-drag'
import L from './leaflet'
import './editable.css'


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
  }
});

//
// RectangleEditor - Add option to enforce DIN A4 landscape or potrait mode
// ratios for rectangles.
//
L.Editable.RectangleEditor.include({
  closeOnCommit: false,
  _forceRatio: true,
  _isLandscape: true,
  _extendBounds: L.Editable.RectangleEditor.prototype.extendBounds,
  enforceBounds() {
    if (!this.feature.isEmpty()) {
      this.map.fitBounds(this.getDefaultLatLngs())
    }
  },
  forceRatio() {
    return this._forceRatio;
  },
  setForceRatio(forced) {
    this._forceRatio = forced;
    if (!this.feature.isEmpty() && forced) {
      this.enforceRatio();
      this.enforceBounds();
    }
  },
  setLandscape() {
    this._isLandscape = true;
    this.setForceRatio(true);
  },
  setPortrait() {
    this._isLandscape = false;
    this.setForceRatio(true);
  },
  extendBounds(e) {
    if (this._forceRatio) {
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
    if (!this._isLandscape) {
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
// ContainerMixin enables you to provide a help text which will be rendered
// on top of your map. See implementation below for examples
//
var ContainerMixin = {

  closeOnCommit: true,

  initOverlay: function() {
    this.feature.on('editable:enable', this.showOverlay, this);
    this.feature.on('editable:disable', this.removeOverlay, this);
    this.feature.on('editable:drawing:cancel', this.removeOverlay, this);

    if (this.closeOnCommit) {
      this.feature.on('editable:drawing:commit', this.removeOverlay, this);
    }

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


    // add selection
    let selections = this.options.selections || []
    if (selections.length > 0) {
      var elem = this.overlay.add('select', '', '');
      for (let select of selections) {
        let option = this.overlay.add('option', '', select.label, elem);
        if (select.selected) {
          option.setAttribute('selected', true)
        }
        option.on('click', select.callback, this)
      }
    }

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

  setOverlaySelections: function(selections) {
    this.options.selections = selections || [];
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
