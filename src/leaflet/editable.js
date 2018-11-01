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
    if (!this.overlay) {
      this.overlay = new L.HTMLContainer(this.map.getContainer());
      this.feature.on('editable:enable', this.showOverlay, this);
      this.feature.on('editable:disable', this.removeOverlay, this);
      this.feature.on('editable:drawing:cancel', this.removeOverlay, this);
      this.feature.on('editable:drawing:commit', this.removeOverlay, this);
    }

    this.overlay.clear();

    if (this.options.help) {
      // add help text
      this.overlay.add('p', 'small', this.options.help + '<br />');

      // add buttons
      let buttons = this.options.buttons || [{}]
      for (let button of buttons) {
        let label = button.label || 'Abbrechen';
        let color = button.color || 'danger';
        let callback = button.callback || this.tools.stopDrawing
        let context = button.callback ? this : this.tools;
        this.overlay.add('button', 'btn btn-sm btn-'+color, label)
                      .on('click', callback, context)
                      .disableClickPropagation();
      }
    }
  },

  setOverlayButtons: function(buttons) {
    this.options.buttons = buttons || [{}];
    this.initOverlay();
  },

  showOverlay: function() {
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

// Rectangle Control
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
