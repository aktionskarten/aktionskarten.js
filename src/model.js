import Api from './api'
import {sortObj} from './utils'

/** Class representing a GeoJSON feature of a map / collection */
class FeatureModel {
  /**
   * Creates a FeatureModel
   * @param {FeatureCollection} collection - Corresponding collection for this
   *                                         feature
   * @param {object} geojson               - valid feature GeoJSON object
   */
  constructor(collection, geojson) {
    this._collection = collection;
    this._geojson = geojson;
    this._state = this.id ? 'persistent' : 'dirty';
  }

  get token() {
    return this._collection._map.token;
  }

  get geojson() {
    return this._geojson;
  }

  set geojson(val) {
    this._state = 'dirty';
    this._geojson = val;
  }

  get id() {
    return this._geojson.properties.id;
  }

  get mapId() {
    return this._collection._map.id;
  }

  get _api() {
    return this._collection._map._api;
  }

  /**
   * Save outstanding changes to backend
   * @async
   * @return {Promise<bool>} Success of operation
   */
  async save() {
    if (this._state != 'dirty') {
      return true;
    }

    let json;
    if (!this.id) {
      json = await this._api.addFeature(this.token, this.mapId, this.geojson);
    } else {
      json = await this._api.updateFeature(this.token, this.mapId, this.id, this.geojson);
    }

    if (json) {
      this._state = 'persistent';
      this._geojson = json;
    }
    return this;
  }

  /**
   * Remove this feature from backend and corresponding collection.
   * @async
   * @return {Promise<bool>} Success of operation
   */
  async remove() {
    if (this.id) {
    let resp = await this._api.removeFeature(this.token, this.mapId, this.id);
      if (!resp.ok) {
        return false;
      }
    }

    let features = this._collection._features;
    let idx = features.indexOf(this);
    if (idx !== -1) {
      features.slice(idx, 1);
      return true;
    }
    return false;
  }
}


/** Class representing a collection of GeoJSON features of a map*/
class FeatureCollection {
  /**
   * Creates a FeatureCollection
   * @param {MapModel} map   - Corresponding map for collection
   * @param {object} geojson - Valid GeoJSON FeatureCollection object
   */
  constructor(map, geojson) {
    this._map = map;
    this._features = geojson.features.map((f) => new FeatureModel(this, f));
    this.features = new Proxy(this._features, {
      get(target, prop) {
        const val = target[prop];
        if (typeof val === 'function') {
          if (['push', 'pop', 'slice'].indexOf(prop) !== -1) {
            console.warn('Use FeatureCollection and FeatureModel methods to alter features');
            return function() {};
          }
          return val.bind(target);
        }
        return val;
      }
    });
  }

  get(id) {
    for (let feature of this._features) {
      if (feature.id == id) {
        return feature;
      }
    }
  }

  /**
   * Generator for iterating through all features. If you need an array just
   * use Array.from(..) on the generator itself
   */
  * all() {
    for (let i=0; i < this._features.length; ++i) {
      yield this._features[i];
    }
  }


  /**
   * Returns valid GeoJSON FeatureCollection object containing instance data
   */
  get geojson() {
    var data = { type: 'FeatureCollection', features: [] };
    this._features.forEach((feature) => {
      data['features'].push(feature.geojson);
    });
    return data;
  }


  /**
   * Check if a given geojson object is in our collection
   * @param {object} - Valid GeoJSON object
   */
  contains(geojson) {
    let needle = JSON.stringify(sortObj(geojson))
    let f, gen = this.all();
    while((f = gen.next().value)) {
      if (JSON.stringify(sortObj(f._geojson)) == needle) {
        return true;
      }
    }
    return false;
  }

  /**
   * Adds a feature to this collection
   * @param {object} - Valid GeoJSON feature object
   */
  add(feature) {
    let entry = new FeatureModel(this, feature);
    this._features.push(entry);
    return entry;
  }

  /**
   * Persistently saves all outsanding changes of this collection
   */
  save() {
    this._features.forEach(async (feature) => {
      if (feature._state == 'dirty') {
        await feature.save();
      }
    });
  }
}


/** Class representing a Map */
class MapModel {
  /**
   * @param {ActionApi} - instance of ActionApi (backend wrapper)
   * @param {object}    - properties of a map
   */
  constructor(api, map) {
    this._api = api;
    this._evented = new L.Evented();

    // add properties dynamically so that we can check if a map property is
    // dirty (has been changed and not yet persistently saved to backend
    // (this is used in grid calculation, to calulate new grids on bbox change)
    //
    // Furthermore we can now use data for property binding frameworks like vue
    // which will add dynamically setter+getter for each property.
    this._states = {}
    this.data = {'attributes':[]}
    let keys = ['id', 'name', 'description', 'datetime', 'date', 'time', 'attributes', 'bbox', 'place', 'token']
    for (let key of keys) {
      Object.defineProperty(this, key, {
        set: (val) => {
          if (this.data[key] != val) {
            this._states[key] = 'dirty';
            this.data[key] = val;
            this.fire(key + 'Changed', {'value': val});
            console.log("setting ", key, val);
          }
        },
        get: () => {
          return this.data[key];
        },
        configurable: false
      });

      this.data[key] = undefined
      this._states[key] = 'persistent'
    }

    // update date and time if you change datetime
    this.on('datetimeChanged', (e) => {
      if (e.value) {
        let values = e.value.split(' ');
        this.date = values[0];
        this.time = values[1];
      }
    });

    let now = new Date()
    let date = now.getFullYear() + '-' + (now.getMonth()+1) + '-' + now.getDate()
    let time = now.getHours() + ':' + now.getMinutes()
    this.datetime =  date + ' ' + time

    Object.assign(this, map);
  }

  on(type, fn) {
    this._evented.on(type, fn);
  }

  off(type, fn) {
    this._evented.off(type, fn);
  }

  fire(type, data) {
    this._evented.fire(type, data);
  }

  /**
   * @async
   * @param  {ActionApi}         - valid ActionApi instance (for working write
   *                               operations, this instance needs be logged in
   *                               for the corresponding map)
   * @param  {string}            - map id to fetch
   * @return {Promise<MapModel>} - Instance of MapModel for corresponding mapId
   */
  static async get(api, mapId) {
    let map;
    if (mapId) {
      map = await api.getMap(mapId)
    }
    return new MapModel(api, map);
  }

  async grid() {
    if (this._states['bbox'] == 'dirty') {
      return await this._api.getGridForBBox(this.bbox);
    }
    return await this._api.getGrid(this.id);
  }

  /**
   * @return {FeatureCollection} - Collection of all containing features for
   *                               this map
   */
  async features() {
    // async keyword not possible in getter, therefor capture in anon async func
    // and do lazy loading of features
    return (async () => {
      if (!this._features) {
        let entries = await this._api.getFeatures(this.id);
        this._features = new FeatureCollection(this, entries);
      }
      return this._features;
    })();
  }

  async getFeature(id) {
    return (await this.features()).get(id);
  }

  async addFeature(feature) {
    return (await this.features()).add(feature);
  }


  /**
   * Authenticate for this map to get write capabilities
   * @async
   * @param {string} - secret for this map
   * @return {Promise<bool>}
   */
  async auth(secret) {
    if (secret) {
      this.token = await this._api.loginForMap(this.id, secret)
      this.fire('authenticated');
    }
    return this.token;
  }

  get authenticated() {
    return !!this.token;
  }

  /**
   * Persistently save outstanding changes of this map and if loaded features as
   * well.
   * @async
   * @return {Promise<bool>} - Success of operation
   */
  async save() {
    // filter only certain props through object destructuring and property
    // shorthand, see https://stackoverflow.com/questions/17781472/#39333479
    let data = (({ id, name, description, date, time, datetime, attributes, bbox, place}) => ({ id, name, description, date, time, datetime, attributes, bbox, place}))(this);
    let handler = this._api.updateMap;

    let json;
    if (!this.id) {
      this.data.token = ''
      this.data.secret = ''
      json = await this._api.createMap(data);
    } else {
      json = await this._api.updateMap(this.token, data);
    }

    if (json) {
      for (let [key, value] of Object.entries(json)) {
        this.data[key] = value;
      }
    }

    if (this._features) {
      return this._features.save();
    }

    return this;
  }

  /**
   * Persistently removes this map from the backend (including features)
   * @async
   * @return {Promise<bool>} - Success of operation
   */
  async remove() {
    let resp = await this._api.removeMap(this.token, this.id);
    if (resp.ok) {
      delete this._map.id;
      return true;
    }
    return false;
  }
}

export {MapModel, FeatureModel}
