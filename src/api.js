class Api {
  constructor(url) {
    this.url = url;
    this.mapsUrl = '/maps'
    this.errorHandler = null
  }

  get apiUrl() {
    return this.url + '/api';
  }

  urlFor(id, endpoint) {
    let url =  this.mapsUrl + '/' + id;
    if (endpoint) {
      url += '/' + (Array.isArray(endpoint) ? endpoint.join('/') : endpoint)
    }
    return url;
  }

  _fetch(method, url, headers, data) {
    let _headers = {"Content-Type": "application/json"};
    if (headers) {
      Object.assign(_headers, headers);
    }

    if (!url.startsWith('http')) {
      url = this.apiUrl + url;
    }

    return fetch(url, {
      method: method,
      body: JSON.stringify(data),
      headers: new Headers(_headers)
    }).then(async resp => {
      let json;
      try {
        json = await resp.json();
      } catch (e) {}

      if (!resp.ok) {
        throw json || resp.statusText;
      }

      return json;
    }).catch(this.errorHandler);
  }

  async _get(url, headers) {
    return  await this._fetch('GET', url, headers);
  }

  async _post(url, data, headers) {
    return await this._fetch('POST', url, headers, data);
  }

  async _patch(url, data, headers) {
    return await this._fetch('PATCH', url, headers, data);
  }

  _put(url, data, headers) {
    return this._fetch('PUT', url, headers, data);
  }

  _del(url, data, headers) {
    return this._fetch('DELETE', url, headers, data);
  }

  _genHeaders(mapId, token) {
    return {
      'X-Map': mapId,
      'X-Token': token
    }
  }

  async loginForMap(id, secret) {
    let headers = {"X-Secret": secret}
    let json = await this._get(this.urlFor(id, 'auth'), headers);

    if (json && 'token' in json) {
      return json.token;
    }
  }

  getAllMaps() {
    return this._get(this.mapsUrl);
  }

  getMap(id) {
    return this._get(this.urlFor(id));
  }

  createMap(data) {
    return this._post(this.mapsUrl, data);
  }

  updateMap(token, map) {
    let headers = this._genHeaders(map.id, token);
    return this._patch(this.urlFor(map.id), map, headers);
  }

  removeMap(token, mapId) {
    let headers = this._genHeaders(mapId, token);
    return this._del(this.urlFor(mapId), {}, headers);
  }

  getFeatures(mapId) {
    return this._get(this.urlFor(mapId, 'features'));
  }

  addFeature(token, mapId, geojson) {
    let headers = this._genHeaders(mapId, token);
    return this._post(this.urlFor(mapId, 'features'), geojson, headers);
  }

  updateFeature(token, mapId, feature, geojson) {
    let headers = this._genHeaders(mapId, token);
    let url = this.urlFor(mapId, ['features',feature]);
    return this._patch(url, geojson, headers);
  }

  removeFeature(token, mapId, feature) {
    let headers = this._genHeaders(mapId, token);
    return this._del(this.urlFor(mapId, ['features', feature]), {}, headers);
  }

  getGrid(mapId) {
    return this._get(this.urlFor(mapId, 'grid'));
  }

  getGridForBBox(bbox) {
    return this._get('/grid/' + bbox.join(','));
  }

  getGeolocationsFor(address) {
      var url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + address;
      return this._get(url);
  }
}

export {Api}
