import i18next from 'i18next';
import locales from './i18n'

import debounce from 'lodash.debounce'
import {L, styleEditor, editable, FeatureLayer} from './leaflet'
import io from 'socket.io-client'
import { filterProperties } from './utils'

//function debounce(func, wait, immediate) {
//    var timeout;
//    return function() {
//        var context = this, args = arguments;
//        clearTimeout(timeout);
//        timeout = setTimeout(function() {
//            timeout = null;
//            if (!immediate) func.apply(context, args);
//        }, wait);
//        if (immediate && !timeout) func.apply(context, args);
//    };
//}

class View {
  constructor(mapElemId, data, mode) {
    this.model = data;
    this.mapElemId = mapElemId;

    // private properties for Leaflet
    this._grid = null
    this._controls = {}
    this.mode = mode;

    // refresh controls on login
    this.on('authenticated', e => {
      console.log("logged " + (e.value  ? "in" : "out ") + ", redraw interface");
      this._updateUI();
    });
  }

  set mode(mode) {
    // if we have no grid yet, enforce bbox mode so
    // the user is adding one
    if (!this.model.bbox) {
      mode = 'bbox';
    }

    if (this._mode == mode) {
      return;
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

  _addGridLayer() {
    let grid = new L.GeoJSON(null, {
      interactive: false,
      style: (f) => f.properties,
      pointToLayer: () => {} // ignore scale label markers
    });

    this.on('bboxChanged', async (e) => {
      this._updateUI();
    });

    this._grid = grid;
    grid.addTo(this._map);
    this._controlLayers.addOverlay(this._grid, "default", "Grid");
  }

  _addFeatureLayer() {
    if (!this._featuresLayer) {
      let featuresLayer = new FeatureLayer(null, {
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

          //if ('label' in feature.properties) {
          //  let label = feature.properties.label;
          //  layer.options.label = label;
          //  layer.bindTooltip(label, {permanent: true, direction: 'bottom', className: 'label'});
          //}

          let removeHandler = async (e) => {
              let layer = e.sourceTarget,
                  id = layer.id,
                  feature = await this.model.getFeature(id),
                  style = this._controls.style;
              style.removeEditClickEvents(layer);
              this.hideEditor();
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
        if (feature.id) {
          console.log("featureAdded", feature.id);
          featuresLayer.addFeature(feature.geojson);
        }
      });

      this.on('featureUpdated', (e) => {
        let feature = e.value
        console.log("featureUpdated", feature.id);
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

      this.center();

      // add tiles

      const createMapTileLayer = function(id) {
        return L.tileLayer('http://localhost:8080/styles/'+id+'/{z}/{x}/{y}{r}.png', {
          maxZoom: 18,
          detectRetina: true,
          attribution: 'Tiles &copy; <a href="http://openmaptiles.org/">OpenMapTiles</a> <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>, ' +
            '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a> '
        })
      }

      const baseLayers = {
        'Bright':      createMapTileLayer('osm-bright'),
        'Basic':       createMapTileLayer('basic-preview'),
        'Positron':    createMapTileLayer('positron')
        //'Liberty':     createMapTileLayer('osm-liberty'),
        //'Dark Matter': createMapTileLayer('dark-matter'),
      };

      if (false) {
        baseLayers['Classic'] =  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          detectRetina: true,
          attribution: 'Tiles &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
            '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a> '
        })
      }

      const layerOptions = {exclusiveGroups: ['Grid'], position: 'bottomright'}
      const controlLayers = L.control.groupedLayers(baseLayers, {}, layerOptions);
      controlLayers.addTo(this._map);
      this._controlLayers = controlLayers;

      // add zoom control
      var zoom = new L.Control.Zoom({ position: 'topright' });
      this._map.addControl(zoom);

      this._map.whenReady(async () => {
          this._updateUI();

          const capitalize = (str) => str[0].toUpperCase() + str.slice(1);
          const baseLayerName = capitalize(this.model.theme)
          if (baseLayerName in baseLayers) {
            baseLayers[baseLayerName].addTo(this._map);
          }


          // init layers
          this._addGridLayer();
          this._addFeatureLayer();

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

          // add features
          let features = await this.model.features()
          if (features) {
            console.log("adding data", features.geojson)
            // FIX max2 exception
            this._featuresLayer.addData(features.geojson);
          }

          this._updateUI();
      });
    });
  }

  _registerLeafletEventHandlers() {
    var events  = [
      'editable:drawing:start',
      'editable:drawing:cancel',
      'editable:vertex:dragend',
      'editable:drawing:commit',
      'editable:dragend',
      'styleeditor:changed',
      'styleeditor:hidden',
    ];

    for (const e of events) {
      console.log("registering event " + e)
      this._map.on(e, () => console.log("Event", e))
    }

    // general
    this._map.on('click', this.onClick, this);
    this._map.on('baselayerchange', this.onThemeChanged, this);
    this._map.on('editable:drawing:start', this.onDrawingStart, this);
    this._map.on('editable:drawing:cancel', this.onDrawingCancel, this);

    // editable - geo objects
    this._map.on('editable:drawing:commit', this.onDrawingCommit, this);
    this._map.on('editable:dragend', this.onDrawingUpdate, this)
    this._map.on('editable:vertex:dragend', this.onDrawingUpdate, this)

    // styleeditor
    //this._map.on('styleeditor:changed', this.onStyleChanged, this);
    //this._map.on('styleeditor:changed', L.Util.throttle(this.onStyleChanged, 500, this));
    this._map.on('styleeditor:changed', debounce(e=>this.onStyleChanged(e), 1000, {trailing: true}));
    // TODO commit on hide
    this._map.on('styleeditor:hidden', this.onDrawingUpdateCancel, this)
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
      this._bboxRect.disableEdit();
      this._map.removeLayer(this._bboxRect);
      this._bboxRect = null;
    }

    if (this.mode == 'bbox') {
      if (!this.model.authenticated) {
        return;
      }

      if (this._bboxRect) {
        return;
      }

      // Either create rectangle from bbox or start with an empty one
      let rect;
      if (!!this.model.bbox) {
        let southEast = this.model.bbox.slice(0,2).reverse()
        let northWest = this.model.bbox.slice(2,4).reverse()
        let bounds = new L.LatLngBounds(southEast, northWest);
        rect = L.bbox(bounds).addTo(this._map)
        rect.enableEdit(this._map)
      } else {
        rect = this._map.editTools.startBBox();
      }

      let editor = rect.editor;
      let buttons = [
        {
          label: this.t(rect.isEmpty() ? 'Draw' : 'Redraw'),
          color: 'secondary',
          callback: (e) => editor.redraw()
        },
        {
          label: this.t('Continue'),
          color: 'primary',
          enabled: () => !rect.isEmpty(),
          callback: (e) => this.onDrawingBbox(rect.bbox())
        }
      ]

      if (rect.isLandscape()) {
        editor.setMode('landscape')
      } else if(rect.isPortrait()) {
        editor.setMode('portrait')
      } else if(!rect.isEmpty()) {
        editor.setMode('')
      }

      let selections  = [
        {
          value: 'landscape',
          label: this.t('Landscape Mode'),
          callback: () => editor.setMode('landscape'),
          selected: () => editor.mode() == 'landscape'
        },
        {
          value: 'portrait',
          label: this.t('Portrait Mode'),
          callback: () => editor.setMode('portrait'),
          selected: () => editor.mode() == 'portrait'
        },
        {
          value: '',
          label: this.t('No restrictions'),
          callback: () => editor.setMode(''),
          selected: () => !editor.mode()
        },
      ];

      rect.editor.setOverlaySelections(selections);
      rect.editor.setOverlayButtons(buttons);

      // start drawing if we have no valid bounds
      // if (rect.isEmpty()) {
      //   rect.editor.startDrawing()
      // }

      this._bboxRect = rect;
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
    if (!style.isEnabled()) {
      return;
    }
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

    // only show grid if we actually don't alter it
    if (this.mode != 'bbox') {
      let grid = await this.model.grid()
      if (grid) {
        this._grid.addData(grid);
      }
    } else {
      this._grid && this._grid.clearLayers();
    }

    // ensure features will be rendered on top of grid
    if (this._featuresLayer) {
    this._featuresLayer.bringToFront()
    }

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
      this.hideEditor();
    }
  }

  onDrawingStart(e) {
    this.hideEditor();
  }

  onDrawingCancel(e) {
    if (e.layer) {
      e.layer.remove();
    }
  }

  async onThemeChanged(e) {
    const name = e.name.toLowerCase();
    this.model.theme = name;
    await this.model.save();
    console.log("theme changed ", name);
  }

  async onDrawingBbox(bounds) {
    if (this.mode != 'bbox') {
      return;
    }

    this.model.bbox = bounds;
    await this.model.save();

    this.mode = ''

    console.log("bbox changed", bounds);
  }

  async onDrawingCommit(e) {
      if (this.mode == 'bbox') {
        //this._bboxRect.editor.enforceBounds();
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

      await this.model.save()

      // remove drawn feature, it gets added through model events
      this._map.editTools.featuresLayer.clearLayers();
      //var layer = this._featuresLayer.addFeature(feature.geojson);

      // find and make new feature editable
      this._featuresLayer.eachLayer(layer => {
        if (layer.id == feature.id) {
          this.showEditor(layer)
        }
      });

      console.log("added", feature.id);
  }

  async onDrawingUpdate(e) {
    if (this.mode == 'bbox') {
      //this._bboxRect.editor.enforceBounds();
      return;
    }

    console.log("drawing update")

    let layer = e.layer,
        id = layer.id;

    if (!id) {
      console.warn("no id");
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

    // Update placement of label
    //if ('label' in geojson.properties) {
    //  let label = geojson.properties.label;
    //  layer.options.label = label;
    //  layer.unbindTooltip();
    //  layer.bindTooltip(label, {permanent: true, direction: 'bottom', className: 'label'});
    //}


    console.log("edited", feature.id);
  }

  onDrawingUpdateCancel(e) {
    let style = this._controls.style;
    let current = style.options.util.getCurrentElement();
    if (current) {
      current.disableEdit();
    }
  }


  async onStyleChanged(e) {
    let id = e.id;
    let feature = await this.model.getFeature(id);

    // add new style
    let layer = this._featuresLayer.contains(id),
        filtered = filterProperties(e.options),
        properties = Object.assign({'id': id, 'map_id': feature.map.id}, filtered)

    if (layer.overlay) {
      console.log("fontRatio", layer.overlay.getSize().fontRatio)
      properties['fontRatio'] = layer.overlay.getSize().fontRatio
    }

    if (layer) {
      layer.feature.properties = properties;
    }

    let geojson = Object.assign(e.toGeoJSON(), {'properties': properties})
    feature.geojson = geojson;  // label+text may change geometry
    layer.feature = feature.geojson
    console.log("properties", geojson)

    await feature.save()

    this._featuresLayer.eachLayer(layer => {
      if (layer.id == feature.id) {
        this.showEditor(layer)
      }
    });

    console.log("styled", feature.id)
      window.feature = feature
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
