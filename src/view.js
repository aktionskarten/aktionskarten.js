import L from './leaflet'
import io from 'socket.io-client'
import { filterProperties } from './utils'


class View {
  constructor(mapElemId, data, mode) {
    this.model = data;
    this.mapElemId = mapElemId;

    // private properties for Leaflet
    this._grid = {}
    this._controls = {}

    // if we don't have a bbox, set mode to bbox
    if (mode) {
      this._mode = mode;
    }
  }

  set mode(mode) {
    if (this._mode == mode) {
      return;
    }

    console.log("setting mode to ", mode);

    this._mode = mode;
    this.fire('modeChanged', mode);
    this._refresh();
  }


  get mode() {
    return this._mode;
  }

  async _addGridLayer() {
    let grid = new L.GeoJSON(null, {
      interactive: false,
      style: (f) => f.properties
    });

    this.model.on('bboxChanged', async (e) => {
      grid.clearLayers();
      grid.addData(await this.model.grid());
      this._map.fitBounds(grid.getBounds());
    });

    this._grid = grid;
    grid.addTo(this._map);
  }

  async _addFeatureLayer() {
    if (!this._features) {
      let features = new L.FeatureLayer(null, {
        // copies style and id to feature.options
        style: (f) => f.properties,
        pointToLayer: (feature, latlng) => {
          try {
            let markerType = this._controls.style.options.markerType;
            if (!('icon' in feature.properties)) {
              feature.properties.icon = markerType.options.markers['default'][0]
              feature.properties.iconColor = markerType.options.colorRamp[0]
              feature.properties.iconSize = markerType.options.size['medium']
            }
            return L.marker(latlng, {icon: markerType.createMarkerIcon(feature.properties)});
          } catch (err) {
            console.log("Could not find marker options. AktionskartenMarkerType not instantiated. AktionskartenMarkerType not instantiated");
          }
          return L.marker(latlng);
        },
        onEachFeature: (feature, layer) => {
          layer.id = layer.options.id = feature.properties.id;

          if ('label' in feature.properties) {
            layer.options.popupContent = feature.properties.label
            layer.bindPopup(feature.properties.label, {direction: 'left', sticky: true});
          }

          if (this._controls && 'style' in this._controls) {
            this._controls.style.addEditClickEvents(layer);
          }
        }
      });

      this._features = features;
      features.addTo(this._map);
    }
  }

  async updateDraw() {
    let instantiated = 'draw' in this._controls;
    if (!instantiated) {
      let options = {
          draw: {
            polygon: {
              allowIntersection: false,
              drawError: {
                  color: '#b00b00',
                  timeout: 1000
              },
              shapeOptions: {
                  color: '#bada55'
              },
              showArea: true
            },
            rectangle: false,
            circlemarker: false,
            circle: false
          },
          edit: {
            featureGroup: this._features, // only allow features to be editable
          }
      };
      let draw = new L.Control.Draw(options);
      this._controls.draw = draw;
    }

    let noDraw = !this.model.authenticated || this.mode == 'bbox';
    if (noDraw) {
      this._map.removeControl(this._controls.draw);
    } else {
      this._map.addControl(this._controls.draw);
    }
  }

  updateStyle() {
    let instantiated = 'style' in this._controls;
    if (!instantiated) {
      let options = {
        colorRamp: [
          '#e04f9e', '#fe0000', '#ee9c00', '#ffff00', '#00e13c', '#00a54c', '#00adf0', '#7e55fc', '#1f4199', '#7d3411'
        ],
        showTooltip: false,
        markerType: L.StyleEditor.marker.AktionskartenMarker,
        useGrouping: false // otherwise a change style applies to all
                           // auto-added featues
      };

      let style = new L.Control.StyleEditor(options);
      this._controls.style = style;
      this._map.addControl(style);
    }

    let noStyle = !this.model.authenticated || this.mode == 'bbox';
    if (noStyle) {
      this._controls.style.disable();
      this._map.removeControl(this._controls.style);
    } else {
      this._map.addControl(this._controls.style);
      this._controls.style.enable();
    }
  }

  async init() {
    this._map = L.map(this.mapElemId, {zoomControl: false});

    // add zoom control
    var zoom = new L.Control.Zoom({ position: 'topright' });
    this._map.addControl(zoom);

    this.center();

    // add tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      detectRetina: true,
      attribution: 'Karte &copy; Aktionskarten | Tiles &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
        '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a> '
    }).addTo(this._map);

    // init layers
    await this._addGridLayer();
    await this._addFeatureLayer();

    // init socketio
    this._socket = io.connect(this.model._api.url);
    this._socket.emit('join', this.model.id);

    // register event handlers
    this._registerLeafletEventHandlers();
    this._registerSocketIOEventHandlers();

    // render controls, tooltips and popups
    this._refresh();

    // add grid
    let grid = await this.model.grid()
    this._grid.addData(grid);

    // add features
    let features = await this.model.features()
    this._features.addData(features.geojson);

    // refresh controls on login
    this.model.on('authenticated', async e => {
      console.log("logged in, redraw interface");
      await this._refresh();
    });
  }

  async _refresh() {
    console.log("Refreshing UI");

    await this.updateStyle();
    await this.updateDraw();
    this.updateTooltip();
    this.updatePopup();
  }

  _registerLeafletEventHandlers() {
      this._map.on(L.Draw.Event.CREATED, async e => {
        var type = e.layerType,
            layer = e.layer,
            geojson = layer.toGeoJSON();

        // use rectangle as bbox if only rectangle control is enabled
        if (geojson.geometry.type == "Polygon" && this.mode == 'bbox') {
          let bounds = layer.getBounds();
          let rect = [bounds.getSouthEast(), bounds.getNorthWest()];
          this.model.bbox = [].concat.apply([], L.GeoJSON.latLngsToCoords(rect));
          return;
        }

        let feature = await this.model.addFeature(geojson)
        await feature.save();

        // convert feature to layer (with our styles)
        let featureLayer = this._features.geojsonToLayer(feature.geojson);
        featureLayer.id = feature.id;

        // mark this layer as current so style editor will be opened
        // automatically when we add it to our features
        let style = this._controls.style;
        style.options.util.setCurrentElement(featureLayer);
        this._features.addLayer(featureLayer)

        this._map.fire('featureAdded', feature.id);
      });

      this._map.on(L.Draw.Event.EDITED, e => {
        var layers = e.layers;
        layers.eachLayer(async layer => {
          var id = layer.id,
              properties = filterProperties(layer.options),
              geojson = Object.assign(layer.toGeoJSON(), {'properties': properties}),
              feature = await this.model.getFeature(id);

          feature.geojson = geojson;
          await feature.save()

          this._map.fire('featureEdited', id);
        });
      });

      this._map.on(L.Draw.Event.DELETED, e => {
        var layers = e.layers;
        layers.eachLayer(async layer => {
          var id = layer.id,
              feature = await this.model.getFeature(id);

          await feature.remove();

          this._map.fire('featureDeleted', id);
        });
      });

      var enableStyle = e => { this._controls.style.enable() };
      var disableStyle = e => { this._controls.style.disable() };
      this._map.on(L.Draw.Event.EDITSTART, disableStyle);
      this._map.on(L.Draw.Event.EDITSTOP, enableStyle);
      this._map.on(L.Draw.Event.DELETESTART, disableStyle);
      this._map.on(L.Draw.Event.DELETESTOP, enableStyle);


      this._map.on('styleeditor:changed', async e => {
        var id = e.id,
            properties = filterProperties(e.options);

        if ('options' in e && e.options.popupContent) {
          properties.label = e.options.popupContent
        }

        var geojson = Object.assign(e.toGeoJSON(), {'properties': properties}),
            feature = await this.model.getFeature(id);

        geojson.properties.id = id;
        feature.geojson = geojson;
        await feature.save()

        this._map.fire('styleChanged', id);
        console.log("styled", feature)
      });

  }


  _registerSocketIOEventHandlers() {
      this._socket.on('connect', () => {
        console.log('connected')
      });
      this._socket.on('created', (data) => {
        console.log('event create', data);
        this._features.addFeature(data);
      });

      this._socket.on('updated', (data) => {
        console.log('event update', data);
        this._features.updateFeature(data);
      });

      this._socket.on('deleted', (data) => {
        console.log('event deleted', data);
        this._features.deleteFeature(data.properties.id);
      });
  }

  async center(cords) {
    if (cords) {
      this._map.setView(cords, 12);
      return;
    }

    var a,b;
    if (this.model.bbox) {
      a = L.GeoJSON.coordsToLatLng(this.model.bbox.slice(0,2));
      b = L.GeoJSON.coordsToLatLng(this.model.bbox.slice(2,4));
    } else if(this.model.place) {
      var json = await this.model._api.getGeolocationsFor(this.model.place);
      if (json.length > 0 && 'boundingbox' in json[0]) {
        let bbox = json[0].boundingbox;
        a = [bbox[0],bbox[2]];
        b = [bbox[1], bbox[3]];
      }
    }

    // if no bbox or place fallback to bbox of Berlin
    if (!a || !b) {
      a = ["52.3570365", "13.2288599"];
      b = ["52.6770365", "13.5488599"];
    }

    this._map.fitBounds([a, b]);

  }

  on(event, handler) {
    if (this._map) {
      this._map.on(event, handler);
    }
  }

  fire(event, data) {
    if (this._map) {
      this._map.fire(event, data);
    }
  }

  updatePopup() {
    if (!this._grid.getPopup()) {
      let content = `
        <div class="container">
          <div class="row">
          <p>
            Der Ausschnitt auf der Karte stellt deine Aktionskarte dar.
            Noch ist sie leer, aber mittels der Toolbar rechts, kannst
            du sie mit Leben füllen. Klicke dazu einfach auf die Buttons.
            <br /><br />
            Du kannst Daten wie Ort, allgemeine Infos oder den
            Kartenausschnitt selbst über den Metadaten-Link in der
            Navigationsleiste nachträglich ändern.
            <br /><br />
            <b>Tip:</b>
            Benutz die Export-Funktion um am Ende die Karte als Bild für
            soziale Netzwerke / Messenger, PDF zum Drucken oder SVG
            weiterverwerden zu können.
          </p>
          </div>
        </div>
      `
      this._grid.bindPopup(content)
    }

    let popup = this._grid.getPopup();

    if (this.model.authenticated && this.mode != 'bbox' && this._grid.count() > 0 && this._features.count() == 0) {
      var bounds = this._grid.getBounds();
      this._grid.openPopup(bounds.getCenter());
    } else {
      this._grid.closePopup();
    }
  }


  updateTooltip() {
    if (!this.tooltip) {
      this.tooltip = new L.HTMLContainer(this._map.getContainer());
    }

    if (!this.model.authenticated || this.mode != 'bbox') {
      this.tooltip.hide();
      return;
    }

    this.tooltip.show();

    let drawContent = () => {
      let pElem = this.tooltip.add('p', '', 'Markiere ein DIN A4-Rechteck als Grundlage der Aktionskarte.<br />');
      this.tooltip.add('button', 'btn btn-secondary', 'Zeichnen')
                  .on('click', (e) => {
                    new L.Draw.Rectangle(this._map).enable();
                    L.DomEvent.stop(e);
                  });
    }

    let redrawContent = () => {
      this.tooltip.add('button', 'btn btn-secondary mr-1', 'Neuzeichnen')
                  .on('click', (e) => {
                    new L.Draw.Rectangle(this._map).enable();
                    L.DomEvent.stop(e);
                  });
      this.tooltip.add('button', 'btn btn-primary ml-1', 'Weiter')
                  .on('click', (e) => {
                    this.model.save();
                    this.mode = ''
                    L.DomEvent.stop(e);
                  });
    }

    if (!this.tooltip.hasContent()) {
      if (!this.model.bbox) {
        drawContent();
      } else {
        redrawContent();
      }

      this.model.on('bboxChanged', (bbox) => {
        this.tooltip.reset();
        redrawContent();
      });
    }
  }
}

export {View}
