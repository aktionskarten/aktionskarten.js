import {L, styleEditor, editable} from './leaflet'
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

    // refresh controls on login
    this.on('authenticated', e => {
      console.log("logged in, redraw interface");
      this._updateUI();
    });
  }

  set mode(mode) {
    if (this._mode == mode) {
      return;
    }

    // if we have no grid yet, enforce bbox mode so
    // the user is adding one
    if (!this._grid && this._grid.count() == 0) {
      mode = 'bbox';
    }

    console.log("setting mode to ", mode);

    this._mode = mode;
    this.fire('modeChanged', mode);
    this._updateUI();
  }


  get mode() {
    return this._mode;
  }

  async _addGridLayer() {
    let grid = new L.GeoJSON(null, {
      interactive: false,
      style: (f) => f.properties
    });

    this.on('bboxChanged', async (e) => {
      grid.clearLayers();
      grid.addData(await this.model.grid());
      this._map.fitBounds(grid.getBounds());
      this._updateUI();
    });

    this._grid = grid;
    grid.addTo(this._map);
  }

  async _addFeatureLayer() {
    if (!this._featuresLayerLayer) {
      let featuresLayer = new L.FeatureLayer(null, {
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
            layer.bindTooltip(feature.properties.label, {permanent: true, interactive: true});
          }


          let removeHandler = async (e) => {
              let layer = e.sourceTarget,
                  id = layer.id,
                  feature = await this.model.getFeature(id),
                  style = this._controls.style;
              style.removeEditClickEvents(layer);
              style.hideEditor();
              await feature.remove();
          };
          layer.on('triggered', L.DomEvent.stop).on('triggered', async (e) => {
            removeHandler(e)
          });
          layer.on('click', L.DomEvent.stop).on('click', async (e) => {
            let layer = e.sourceTarget;
            //
            /// delete if ctrl or meta is pressed otherwise make it editable
            if ((e.originalEvent.ctrlKey || e.originalEvent.metaKey)) {
              removeHandler(e)
            } else {
              if (this.model.authenticated && this.mode != 'bbox') {
                this.enableEditFor(layer)
              }
            }
          });
        }
      });

      this._featuresLayer = featuresLayer;
      featuresLayer.addTo(this._map);
    }
  }

  async init() {
    this._map = L.map(this.mapElemId, {
      zoomControl: false,
      editable: true,
    });

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

    this._map.whenReady(async () => {
        this._updateUI();

        // init layers
        await this._addGridLayer();
        await this._addFeatureLayer();

        // init socketio
        this._socket = io.connect(this.model._api.url);
        this._socket.emit('join', this.model.id);

        // register event handlers
        this._registerLeafletEventHandlers();
        this._registerSocketIOEventHandlers();

        // add overlay
        //this.overlay = new L.HTMLContainer(this._map.getContainer());

        // render controls, tooltips and popups
        this._controls = {
          style: styleEditor(),
          editable: editable(),
        }

        // add grid
        let grid = await this.model.grid()
        if (grid) {
          this._grid.addData(grid);
        } else {
          this.mode = 'bbox';
        }

        // add features
        let features = await this.model.features()
        if (features) {
          this._featuresLayer.addData(features.geojson);
        }

        this._updateUI();
    });
  }

  async updateEditable() {
    let editable = this._controls.editable;
    if (!editable) {
      return;
    }

    if (!this.model.authenticated || this.mode == 'bbox') {
      for (let control of editable) {
        this._map.removeControl(control);
      }
    } else {
      for (let control of editable) {
        this._map.addControl(control);
      }
    }

    var tools = this._map.editTools
    if (this.model.authenticated && this.mode == 'bbox' && !tools.drawing()) {
      tools.startRectangle()
    }
  }


  updateStyleEditor() {
    let style = this._controls.style;
    if (!style) {
      return;
    }

    if (!this.model.authenticated || this.mode == 'bbox') {
      if (style.isEnabled()) {
        style.disable();
        this._map.removeControl(style);
      }
    } else {
      this._map.addControl(style);
      style.enable();
    }
  }

  enableEditFor(layer) {
    let style = this._controls.style;
    let current = style.options.util.getCurrentElement();

    if (current && current.id == layer.id) {
      current.enableEdit();
      return;
    }

    console.log("enable edit");

    if (current) {
      current.disableEdit();
      style.hideEditor();
    }
    layer.enableEdit();
    style.initChangeStyle({'target': layer});

    style.options.util.setCurrentElement(layer);
  }


  async _updateUI() {
    if (!this._map) {
      return;
    }

    console.log("Refreshing UI (mode="+this.mode+', authenticated='+this.model.authenticated+')');

    await this.updateEditable();
    await this.updateStyleEditor();
    this.updatePopup();
  }

  _registerLeafletEventHandlers() {
    // if you click anywhere on the map => disable edit mode
    this._map.on('click', (e) => {
      let style = this._controls.style;
      let current = style.options.util.getCurrentElement();
      if (current) {
        current.disableEdit();
        style.hideEditor();
      }
    });

    this._map.on('editable:drawing:cancel', (e) => {
      console.log('editable:drawing:cancel', e)
      if (e.layer) {
        e.layer.remove();
      }
      L.DomEvent.stop(e);
    })

    let bboxRectHandler = (e) => {
      if (this.mode != 'bbox') {
        return;
      }

      var layer = e.layer,
          geojson = layer.toGeoJSON();


      if (geojson.geometry.type == "Polygon") {
        let bounds = layer.getBounds();
        let rect = [bounds.getSouthEast(), bounds.getNorthWest()];
        this.model.bbox = [].concat.apply([], L.GeoJSON.latLngsToCoords(rect));
        let featuresLayer = this._map.editTools.featuresLayer;
        if (featuresLayer.getLayers().length > 1) {
          featuresLayer.removeLayer(featuresLayer.getLayers()[0]);
        }

        layer.disableEdit();

        this._updateUI();
        return;
      }
    };
    this._map.on('bbox:redraw', function(e) {
      console.log(e);
      this.editTools.stopDrawing();
      this.editTools.startRectangle();
    });

    this._map.on('bbox:commit', (e)=>{
      console.log("bbox event", e);
      this.model.save();
      this.mode = ''
    })
    this._map.on('editable:vertex:dragend', (e) => console.log('editable:vertex:dragend'))
    this._map.on('editable:vertex:dragend', bboxRectHandler);
    this._map.on('editable:drawing:commit', bboxRectHandler);
    this._map.on('editable:drawing:commit', async (e) => {
      console.log("commit");

      if (this.mode == 'bbox') {
        return;
      }

      var type = e.layerType,
          layer = e.layer,
          geojson = layer.toGeoJSON();

      let feature = await this.model.addFeature(geojson)
      await feature.save();

      // remove drawn feature, it gets added through created event (socket io)
      // with proper id and defaults
      this._map.editTools.featuresLayer.clearLayers();

      // find and make new feature editable
      this._featuresLayer.eachLayer(layer => {
        if (layer.id == feature.id) {
          this.enableEditFor(layer)
        }
      });

      this.fire('featureAdded', feature.id);
    });

    this._map.on('editable:drawing:clicked', (e) => console.log('editable:drawing:clicked'))
    this._map.on('editable:created', (e) => console.log('editable:created'))

    let updateHandler = async (e) => {
      let layer = e.layer,
          id = layer.id;
      if (!id) {
        return
      }

      let geojson = layer.toGeoJSON(),
      feature = await this.model.getFeature(id);

      if (!feature) {
        return;
      }

      feature.geojson = geojson;
      layer.feature = feature.geojson
      await feature.save()

      console.log("edited");
      this.fire('featureEdited', id);
    }

    this._map.on('editable:dragend', updateHandler)
    this._map.on('editable:vertex:dragend', updateHandler)

    this._map.on('styleeditor:changed', async e => {
      let id = e.id;
      let feature = await this.model.getFeature(id);

      // add new style
      let layer = this._featuresLayer.contains(id),
          filtered = filterProperties(e.options),
          properties = Object.assign({'id': id, 'map_id': feature.mapId}, filtered)

      if(layer) {
        layer.feature.properties = properties;
      }

      let geojson = Object.assign(e.toGeoJSON(), {'properties': properties})
      feature.geojson = geojson;
      await feature.save()

      this._featuresLayer.eachLayer(layer => {
        if (layer.id == feature.id) {
          this.enableEditFor(layer)
        }
      });

      this.fire('styleChanged', id);
      console.log("styled", feature)
    });
  }


  _registerSocketIOEventHandlers() {
      this._socket.on('connect', () => {
        console.log('connected')
      });
      this._socket.on('created', (data) => {
        console.log('event create', data);
        this._featuresLayer.addFeature(data);
      });

      this._socket.on('updated', (data) => {
        console.log('event updated', data);
        this._featuresLayer.updateFeature(data);
      });

      this._socket.on('deleted', (data) => {
        console.log('event deleted', data);
        this._featuresLayer.deleteFeature(data.properties.id);
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
    if (this.model) {
      this.model.on(event, handler, this);
    }
  }

  fire(event, data) {
    if (this.model) {
      this.model.fire(event, data, this);
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

    if (this.model.authenticated && this.mode != 'bbox' && this._grid.count() > 0 && this._featuresLayer.count() == 0) {
      var bounds = this._grid.getBounds();
      this._grid.openPopup(bounds.getCenter());
    } else {
      this._grid.closePopup();
    }
  }
}

export {View}
