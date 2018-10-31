import 'leaflet-styleeditor'
import 'leaflet-styleeditor/dist/css/Leaflet.StyleEditor.min.css'


L.Control.StyleEditor.include({
  isEnabled () {
    let ui = this.options.controlUI;
    return ui && L.DomUtil.hasClass(ui, 'enabled');
  }
});

//
// ToolTipContentElemen - provide an element to add a tooltip on a geo element
//
let TooltipContentElement = L.StyleEditor.formElements.FormElement.extend({
  options: {
    title: 'Description'
  },
  createContent: function () {
    let uiElement = this.options.uiElement,
        input = this.options.input = L.DomUtil.create('input', 'form-control', uiElement);
    input.type = 'text';
    L.DomEvent.addListener(input, 'change', this._setStyle, this);
  },
  style: function () {
    let selectedElement = this.options.styleEditorOptions.util.getCurrentElement();
    if (selectedElement && selectedElement.options) {
      this.options.input.value = selectedElement.options.label || ''
    }
  },
  _setStyle: function () {
    let marker = this.options.styleEditorOptions.util.getCurrentElement()
    let label = this.options.input.value
    if (marker && marker.getTooltip && marker.bindTooltip) {
      let tooltip = marker.getTooltip()
      if (tooltip) {
        tooltip.setContent(label)
      } else {
        marker.bindTooltip(label, {permanent: true, interactive: true})
      }
      marker.options = marker.options || {}
      marker.options.label = label
    }
    this.setStyle(label)
  }
})


//
// ButtonElement - provides an element to fire events for any element
//
let ButtonElement = L.StyleEditor.formElements.FormElement.extend({
  options: {
    title: 'Löschen'
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


// You're not able to configure forms through options. Something in the
// following way would be nice if it would be supported out-of-the-box.
//
// options: {
//   'forms': {
//     'geometry': {
//       opacity: false,
//       dashArray: (elem) => elem.feature.geometry.type == 'Polygon'
//     },
//     'marker': {
//       'popupContent': false,
//       'tooltipContent': MyOwnToolTipClassDerivedFromFormElement
//     }
//   }
// }
//
// So basically depending on the value exclude element from render. You could
// even change order by that. Supported types could be:
// * boolean
// * function: call function and check boolean return value
// * class of type FormElement: add or override this element
//
// For now we hack GeometryForm and MarkerForm to customize rendering
//
L.StyleEditor.forms.GeometryForm.include({
  initialize: function(options) {
    this.options.formElements['tooltipContent'] = TooltipContentElement;
    this.options.formElements['button'] = ButtonElement;
    delete this.options.formElements['popupContent'];
    L.StyleEditor.forms.Form.prototype.initialize.call(this, options);
  },
  showFormElements: function () {
    var util = this.options.styleEditorOptions.util,
        curr = util.getCurrentElement(),
        elems = this.options.initializedElements,
        selected = [];
    if (curr.feature.geometry.type == 'Polygon') {
      let keys = ['color', 'opacity', 'weight', 'dashArray'];
      selected = elems.filter(x=>keys.indexOf(x.options.styleOption)<0);
    } else {
      selected = elems.filter(x=>!x.options.styleOption.startsWith('fill'));
    }

    for (let elem of selected) {
      elem.show();
    }
  }
});

L.StyleEditor.forms.MarkerForm.include({
  initialize: function(options) {
    this.options.formElements['tooltipContent'] = TooltipContentElement;
    this.options.formElements['button'] = ButtonElement;
    delete this.options.formElements['popupContent'];
    L.StyleEditor.forms.Form.prototype.initialize.call(this, options);
  },
});
