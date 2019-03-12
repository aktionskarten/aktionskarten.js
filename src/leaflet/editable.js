import 'leaflet-editable'
import 'leaflet-path-drag'
import './editable.css'

//
// Limit Rectangle to only be able to create rectangles of DIN A4 ratio
//
L.Editable.RectangleEditor.include({
  extendBounds(e) {
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
      editable.startMarker().editor.connect();
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
