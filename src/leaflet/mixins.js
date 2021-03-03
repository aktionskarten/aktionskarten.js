import {L} from './leaflet'
import {HTMLContainer} from './container'

//
// ContainerMixin enables you to provide a help text which will be rendered
// on top of your map. See implementation below for examples
//
var ContainerMixin = {

  closeOnCommit: true,

  initOverlay: function() {
    this.feature.on('editable:enable', this.showOverlay, this);
    this.feature.on('editable:disable', this.removeOverlay, this);
    this.feature.on('editable:drawing:cancel', this.removeOverlay, this);

    if (this.closeOnCommit) {
      this.feature.on('editable:drawing:commit', this.removeOverlay, this);
    }

    let refresher = e => this.feature.fire('refresh')
    this.feature.on('editable:drawing:commit', refresher);
    this.feature.on('editable:drawing:start', refresher);
    this.feature.on('editable:vertex:new', refresher);

    // use translate function if available otherwise provide identity
    let i18next = this.map.i18next;
    this.t = (s) => (i18next) ? i18next.t(s) : s
  },

  addOverlay: function() {
    if (!this.overlay) {
      this.overlay = new HTMLContainer(this.map.getContainer());
    } else {
      this.overlay.clear();
    }

    // add help text (try to translate if t function is available)
    this.overlay.add('p', 'small', this.t(this.name + '.help') + '<br />');
    var row  = this.overlay.add('div', 'row justify-content-center', '');

    // add selection
    let selections = this.options.selections || []
    if (selections.length > 0) {
      var elem = this.overlay.add('select', '', '', row);

      for (let select of selections) {
        let option = this.overlay.add('option', '', select.label, elem);
        option.setAttribute('value', select.value)

        // listen for refresh events to select/unselect
        let selected = select.selected || (() => false);
        this.feature.on('refresh', e => option.selected = selected());
      }

      // call callbacks for change events (if option is selected)
      elem.on('change', (e)=> {
        var option = selections.find((elem) => elem.value == e.target.value)
        option.callback.bind(this)()
      }, this)

    }

    // add buttons
    let buttons = this.options.buttons || this.getDefaultButtons();
    for (let button of buttons) {
      let label = button.label;
      let color = button.color || 'primary';
      let btn = this.overlay.add('button', 'btn btn-sm btn-'+color, label, row)

      // listen for refresh events to enable/disable button
      let enabled = button.enabled || (() => true);
      this.feature.on('refresh', e => btn.disabled = !enabled());

      // install callback for click events
      btn.on('click', button.callback, this).disableClickPropagation();
    }


    // apply all dynamic properties (like selected or enabled)
    this.feature.fire('refresh');
  },

  getDefaultButtons() {
    return [
      {
        label: this.t('Cancel'),
        color: 'danger',
        callback: this.tools.stopDrawing.bind(this.tools)
      },
      {
        label: this.t('Finish'),
        enabled: () => this.finishable(),
        callback: this.tools.commitDrawing.bind(this.tools)
      }
    ];
  },

  finishable() {
    let vertices = this._drawnLatLngs || [];
    return vertices.length >= this.MIN_VERTEX;
  },

  setOverlayButtons: function(buttons) {
    this.options.buttons = buttons || [];
    this.addOverlay();
  },

  setOverlaySelections: function(selections) {
    this.options.selections = selections || [];
    this.addOverlay();
  },

  showOverlay: function() {
    if (!this.overlay) {
      this.addOverlay();
    }

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

var TooltipMixin = {
  initTooltip() {
    if (!this.tooltipLabel) {
      return;
    }

    this._tooltip = L.DomUtil.get('tooltip');
    if (!this._tooltip) {
      this._tooltip = L.DomUtil.create('div', '', this.map.getContainer());
      this._tooltip.id = 'tooltip';
    }

    // use translate function if available otherwise provide identity
    let i18next = this.map.i18next;
    this.t = (s) => (i18next) ? i18next.t(s) : s

    this.feature.on('editable:enable', this.enableTooltip, this);
    this.feature.on('editable:disable', this.disableTooltip, this);
  },

  enableTooltip() {
    this.feature.on('editable:drawing:start', this.addTooltip, this);
    this.feature.on('editable:drawing:end', this.removeTooltip, this);
  },

  disableTooltip() {
    this.feature.off('editable:drawing:start', this.addTooltip, this);
    this.feature.off('editable:drawing:end', this.removeTooltip, this);
  },

  addTooltip (e) {
    console.log(this)
    this.map.on('mousemove', this.moveTooltip, this);
    this._tooltip.innerHTML = this.t(this.tooltipLabel);
    this._tooltip.style.display = 'block';
  },

  removeTooltip (e) {
    this._tooltip.innerHTML = '';
    this._tooltip.style.display = 'none';
    this.map.off('mousemove', this.moveTooltip, this);
  },

  moveTooltip (e) {
    let ev = e.originalEvent;
    this._tooltip.style.left = ev.clientX + 20 + 'px';
    this._tooltip.style.top = ev.clientY - 10 + 'px';
  }
};

export {ContainerMixin, TooltipMixin}
