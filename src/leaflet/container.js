import {L} from './core'

//
// With HTMLContainer you can provide an overlay on your map.
//
const HTMLContainer = L.Class.extend({
    initialize(root) {
      this._root = root;
      this._wrapper = L.DomUtil.create('div', 'leaflet-styleeditor-tooltip-wrapper')
      this._tooltip = L.DomUtil.create('div', 'leaflet-styleeditor-tooltip', this._wrapper);
      this._container = L.DomUtil.create('div', 'container', this._tooltip);
    },
  
    show() {
      if (this._root && !this._root.contains(this._wrapper)) {
        this._root.appendChild(this._wrapper)
      }
    },
  
    hide() {
      if (this._root && this._root.contains(this._wrapper)) {
        this._root.removeChild(this._wrapper)
      }
    },
  
    clear() {
      L.DomUtil.empty(this._container);
    },
  
    remove() {
      this.clear();
      L.DomUtil.remove(this._container);
      L.DomUtil.remove(this._tooltip);
      L.DomUtil.remove(this._wrapper);
  
    },
  
    add(tagName, className, content, container) {
      container = container || this._container
      let elem = L.DomUtil.create(tagName, className, container);
  
      // HTMLElement has no event subscription  method, add with same defintion
      // like for leaflet
      elem.on = function(type, fn, context) {
        L.DomEvent.on(this, type, fn, context ? context : this);
        return this;
      };
  
      elem.disableClickPropagation = function() {
        L.DomEvent.disableClickPropagation(this);
        return this;
      };
  
      elem.innerHTML = content;
      return elem;
    }
  });
  

export {HTMLContainer}