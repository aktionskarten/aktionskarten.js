import i18next from 'i18next';
import locales from './i18n'

import {L, styleEditor, editable} from './leaflet'
import io from 'socket.io-client'
import { filterProperties } from './utils'

class View {
  constructor(mapElemId, data, mode) {
    this.model = data;
    this.mapElemId = mapElemId;

    // private properties for Leaflet
    this._grid = null
    this._controls = {}

    // if we don't have a bbox, set mode to bbox
    if (mode) {
      this._mode = mode;
    }

    // refresh controls on login
    this.on('authenticated', e => {
      console.log("logged " + (e.value  ? "in" : "out ") + ", redraw interface");
      this._updateUI();
    });
  }

  set mode(mode) {
    console.log("setting mode to ", mode);

    if (this._mode == mode) {
      return;
    }

    // if we have no grid yet, enforce bbox mode so
    // the user is adding one
    if (!this.model.bbox) {
      mode = 'bbox';
    }

    this._mode = mode;
    this.fire('modeChanged', mode);
    this._updateUI();
  }


  get mode() {
    return this._mode;
  }

  get t() {
    if (this._map.i18next) {
      return this._map.i18next.t.bind(this._map.i18next)
    }
    return (s) => s
  }

  async _addGridLayer() {
    let grid = new L.GeoJSON(null, {
      interactive: false,
      style: (f) => f.properties
    });

    this.on('bboxChanged', async (e) => {
      grid.clearLayers();
      grid.addData(await this.model.grid());
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
            return L.marker(latlng, {icon: markerType.createMarkerIcon(feature.properties)});
          } catch (err) {
            console.log("Could not find marker options. AktionskartenMarkerType not instantiated. AktionskartenMarkerType not instantiated");
          }
          return L.marker(latlng);
        },
        onEachFeature: (feature, layer) => {
          layer.id = layer.options.id = feature.properties.id;

          if ('label' in feature.properties) {
            let label = feature.properties.label;
            layer.options.label = label;
            layer.bindTooltip(label, {permanent: true, direction: 'bottom', className: 'label'});
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

            /// delete if ctrl or meta is pressed otherwise make it editable
            if ((e.originalEvent.ctrlKey || e.originalEvent.metaKey)) {
              removeHandler(e)
            } else {
              if (this.model.authenticated && this.mode != 'bbox') {
                this.showEditor(layer)
              }
            }
          });
        }
      });

      //
      // Model is our single point of truth. Therefor listen for changes in our
      // model
      //
      this.on('featureAdded', (e) => {
        let feature = e.value
        console.log("featureAdded", feature);
        featuresLayer.addFeature(feature.geojson);
      });

      this.on('featureUpdated', (e) => {
        let feature = e.value
        console.log("featureAdded", feature);
        featuresLayer.updateFeature(feature.geojson);
      });

      this.on('featureDeleted', (e) => {
        let id = e.value
        console.log("featureDeleted", id);
        this.hideEditor(id);
        featuresLayer.deleteFeature(id);
      });

      this._featuresLayer = featuresLayer;
      featuresLayer.addTo(this._map);
    }
  }

  async init(lng) {
    this._map = L.map(this.mapElemId, {
      zoomControl: false,
      attributionControl: false,
      editable: true,
    });

    // only needed for Aktionskartenmarker in editable.js
    this._map.view = this

    let i18nOptions = {lng: lng, fallbackLng: 'en', resources: locales, debug: true}
    this._map.i18next = i18next.createInstance(i18nOptions, (err, t) => {
      L.control.attribution({position: 'topright'}).addTo(this._map);

      // add zoom control
      var zoom = new L.Control.Zoom({ position: 'topright' });
      this._map.addControl(zoom);

      this.center();

      // add tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        detectRetina: true,
        attribution: 'Tiles &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
          '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a> '
      }).addTo(this._map);

      this._map.whenReady(async () => {
          this._updateUI();

          // init layers
          await this._addGridLayer();
          await this._addFeatureLayer();

          // init socketio
          this._socket = io.connect(this.model._api.url);

          // register event handlers
          this._registerLeafletEventHandlers();
          this._registerSocketIOEventHandlers();

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
    });
  }

  _registerLeafletEventHandlers() {
    // general
    this._map.on('click', this.onClick, this);
    this._map.on('editable:drawing:start', this.onDrawingStart, this);
    this._map.on('editable:drawing:cancel', this.onDrawingCancel, this);

    // editable - rect object
    this._map.on('editable:vertex:dragend', this.onDrawingBbox, this);
    this._map.on('editable:drawing:commit', this.onDrawingBbox, this);

    // editable - geo objects
    this._map.on('editable:drawing:commit', this.onDrawingCommit, this);
    this._map.on('editable:dragend', this.onDrawingUpdate, this)
    this._map.on('editable:vertex:dragend', this.onDrawingUpdate, this)

    // styleeditor
    this._map.on('styleeditor:changed', this.onStyleChanged, this);
  }

  _registerSocketIOEventHandlers() {
      this._socket.on('connect', () => {
        this._socket.emit('join', this.model.id);
        this.fire('connect');
      });
      this._socket.on('disconnect', () => {
        this.fire('disconnect');
      });
      this._socket.on('map-updated', (data) => {
        // TODO: use idChanged event
        this._socket.emit('leave', this.model.id);
        Object.assign(this.model, data);
        this._socket.emit('join', this.model.id);
      });
      this._socket.on('feature-created', (data) => {
        this.model.addFeature(data);
      });

      this._socket.on('feature-updated', (data) => {
        this.model.updateFeature(data);
      });

      this._socket.on('feature-deleted', (data) => {
        this.model.deleteFeature(data.properties.id);
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

    // abort all outstanding draw actions
    tools.stopDrawing();
    this._map.editTools.featuresLayer.clearLayers();

    // remove old bbox, we gonna create a new one later one
    if (this._bboxRect) {
      this._bboxRect.editor.disable();
      this._bboxRect = null;
    }


    if (this.mode == 'bbox') {
      if (!this.model.authenticated) {
        return;
      }

      let buttons = [{
        label: this.t(this._grid.count() > 0 ? 'Redraw' : 'Draw'),
        color: 'secondary',
        callback: (e) => {
          this._map.editTools.featuresLayer.clearLayers();
          this._bboxRect.editor.startDrawing()
        },
      }];

      if (this._grid.count() > 0) {
        buttons.push({
          label: this.t('Continue'),
          color: 'primary',
          callback: async (e) => {
            this.mode = '';
            await this.model.save();
          }
        });
      }

      if (!this._bboxRect) {
        let rect = tools.createRectangle([[0,0],[0,0]]);
        rect.enableEdit(this._map).setOverlayButtons(buttons);
        this._bboxRect = rect;
      }
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

  hideEditor(id) {
    let style = this._controls.style;
    let current = style.options.util.getCurrentElement();
    if (current) {
      if (id && id != current.id) {
        return;
      }
      current.disableEdit();
      style.hideEditor();
    }
  }

  showEditor(layer) {
    let style = this._controls.style;
    let current = style.options.util.getCurrentElement();

    if (current && current.id == layer.id) {
      current.enableEdit();
      style.showEditor();
      return;
    }

    console.log("enable edit");

    if (current) {
      this.hideEditor();
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

    // adjust map extract
    if (this._grid && this._grid.count() > 0) {
      let bounds = this._grid.getBounds();
      this._map.fitBounds(bounds);
    }

    await this.updateEditable();
    await this.updateStyleEditor();
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



  //
  // Event Handlers
  //
  onClick(e) {
    // if you click anywhere on the map => disable edit mode
    let style = this._controls.style;
    let current = style.options.util.getCurrentElement();
    if (current) {
      current.disableEdit();
      style.hideEditor();
    }
  }

  onDrawingStart(e) {
    console.log("editable:drawing:start")
    this.hideEditor();
    console.log("editable:drawing:started")
  }

  onDrawingCancel(e) {
    console.log('editable:drawing:cancel', e)
    if (e.layer) {
      e.layer.remove();
    }
  }

  onDrawingBbox(e) {
    if (this.mode != 'bbox') {
      return;
    }

    var layer = e.layer,
        geojson = layer.toGeoJSON();

    if (geojson.geometry.type != "Polygon") {
      console.warn("Invalid geometry type");
      return;
    }

    let bounds = layer.getBounds();
    let rect = [bounds.getSouthEast(), bounds.getNorthWest()];
    this.model.bbox = [].concat.apply([], L.GeoJSON.latLngsToCoords(rect));

    console.log("bbox changed", e);
  }

  async onDrawingCommit(e) {
      if (this.mode == 'bbox') {
        return;
      }

      var type = e.layerType,
          layer = e.layer,
          properties = filterProperties(layer.options);

      // set defaults if it's a marker
      if (layer instanceof L.Marker) {
        let markerType = this._controls.style.options.markerType;
        properties = {
          icon: markerType.options.markers['default'][0],
          iconColor: markerType.options.colorRamp[0],
          iconSize: markerType.options.size['medium']
        }
      }

      let geojson = Object.assign(layer.toGeoJSON(), {'properties': properties});
      let feature = await this.model.addFeature(geojson)

      // remove drawn feature, it gets added through model events
      this._map.editTools.featuresLayer.clearLayers();

      // find and make new feature editable
      this._featuresLayer.eachLayer(layer => {
        if (layer.id == feature.id) {
          this.showEditor(layer)
        }
      });

      console.log("added");
  }

  async onDrawingUpdate(e) {
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
  }

  async onStyleChanged(e) {
    let id = e.id;
    let feature = await this.model.getFeature(id);

    // add new style
    let layer = this._featuresLayer.contains(id),
        filtered = filterProperties(e.options),
        properties = Object.assign({'id': id, 'map_id': feature.map.id}, filtered)

    if(layer) {
      layer.feature.properties = properties;
    }

    let geojson = Object.assign(e.toGeoJSON(), {'properties': properties})
    feature.geojson = geojson;
    await feature.save()

    this._featuresLayer.eachLayer(layer => {
      if (layer.id == feature.id) {
        this.showEditor(layer)
      }
    });

    console.log("styled", feature)
    this.fire('styleChanged', id);
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
}

export {View}
