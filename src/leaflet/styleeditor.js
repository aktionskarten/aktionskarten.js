// import {L} from './core'
import 'leaflet-styleeditor'
import 'aktionskarten-marker'
import {SVGTextBox} from 'leaflet-text-editable'

import 'leaflet-styleeditor/dist/css/Leaflet.StyleEditor.min.css'
import 'aktionskarten-marker/AktionskartenMarker.css'
import './styleeditor.css'


L.Control.StyleEditor.include({
  isEnabled () {
    let ui = this.options.controlUI;
    return ui && L.DomUtil.hasClass(ui, 'enabled');
  }
});

//
// ButtonElement - provides an element to fire events for any element
//
let ButtonElement = L.StyleEditor.formElements.FormElement.extend({
  options: {
    title: 'Delete'
  },
  createContent: function () {
    let label = this.options.label = L.DomUtil.create('button', 'leaflet-styleeditor-button leaflet-styleeditor-button-custom', this.options.uiElement)
    label.innerHTML = this.options.title
    L.DomEvent.addListener(label, 'click', this._fire, this)
  },

  /** No title */
  createTitle: function () {},

  _fire: function () {
    let elem = this.options.styleEditorOptions.util.getCurrentElement();
    elem.fire('triggered');
  }
})

const InputElement = L.StyleEditor.formElements.FormElement.extend({
  options: {
    title: 'Label'
  },
  createContent: function () {
    let uiElement = this.options.uiElement,
        input = this.options.input = L.DomUtil.create('input', 'form-control', uiElement);
    input.type = 'text';
    input.style.width = '100%'
    L.DomEvent.addListener(input, 'keyup', this._setStyle, this);
  },
  style: function () {
    let selectedElement = this.options.styleEditorOptions.util.getCurrentElement();
    if (selectedElement && selectedElement.options) {
      this.options.input.value = selectedElement.options.label || ''
    }
  },
  _setStyle: function () {
    let elem = this.options.styleEditorOptions.util.getCurrentElement()
    let label = this.options.input.value
    if (elem && elem.setLabel && label) {
      elem.setLabel(label);
      elem.options = elem.options || {}
      elem.options.label = label
    }
    // remove
    //else if(.unbindTooltip && !label) {
    //  marker.unbindTooltip();
    //  marker.options.label = ''
    //}
    this.setStyle(label)
  }
})

const TextAreaElement = L.StyleEditor.formElements.FormElement.extend({
  options: {
    title: 'Description'
  },
  createContent: function () {
    let uiElement = this.options.uiElement,
        textArea = this.options.text = L.DomUtil.create('textarea', 'form-control', uiElement);
    textArea.style.width = '100%'
    textArea.setAttribute('rows', 8)
    L.DomEvent.addListener(textArea, 'keyup', this._setStyle, this);
  },
  style: function () {
    let selectedElement = this.options.styleEditorOptions.util.getCurrentElement();
    if (selectedElement && selectedElement.options) {
      this.options.text.value = selectedElement.options.text || ''
    }
  },
  _setStyle: function () {
    let elem = this.options.styleEditorOptions.util.getCurrentElement()
    let text = this.options.text.value
    if (elem && elem.setText && text) {
      elem.setText(text);
      elem.options = elem.options || {}
      elem.options.text = text
    }
    // remove
    //else if(.unbindTooltip && !label) {
    //  marker.unbindTooltip();
    //  marker.options.label = ''
    //}
    this.setStyle(text)
  }
})

//
// Translate title with i18next
//
L.StyleEditor.formElements.FormElement.addInitHook(function() {
  let map = this.options.styleEditorOptions.map;
  let i18next = map.i18next;
  let t = (s) => (i18next) ? i18next.t(s) : s
  this.options.title = t(this.options.title)
});


function styleEditor() {
  let options = {
    forms: {
      geometry: {
        'label': {
          boolean: (elem) => (elem instanceof SVGTextBox),
          formElement: InputElement
        },
        'text': {
          boolean: (elem) => (elem instanceof SVGTextBox),
          formElement: TextAreaElement
        },
        'color': (elem) => !(elem instanceof L.Polygon),
        'fillColor': true,
        'opacity': (elem) => !(elem instanceof L.Polygon),
        'fillOpacity': true,
        'dashArray': (elem) => !(elem instanceof L.Polygon),
        'weight': (elem) => !(elem instanceof L.Polygon),
        'delete': ButtonElement,
      },
      marker: {
        'icon': true,
        'color': true,
        'size': true,
        'delete': ButtonElement,
      }
    },
    colorRamp: [
      '#e04f9e', '#fe0000', '#ee9c00', '#ffff00', '#00e13c', '#00a54c', '#00adf0', '#7e55fc', '#1f4199', '#7d3411'
    ],
    showTooltip: false,
    openOnLeafletEditable: false,
    markerType: L.StyleEditor.marker.AktionskartenMarker,
    useGrouping: false, // otherwise a change style applies to all
                        // auto-added featues
    strings: {
      tooltip: 'X',
      tooltipNext: 'X'
    }
  };

  return new L.Control.StyleEditor(options)
}

export {styleEditor}
