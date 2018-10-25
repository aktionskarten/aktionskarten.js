function filterProperties(options) {
  var validKeys = ['id', 'label', 'radius', 'color', 'weight', 'opacity', 'fillColor', 'fillOpacity', 'dashArray', 'icon.options.iconColor', 'icon.options.iconSize', 'icon.options.icon'],
      props = {};

  validKeys.forEach(function(item) {
    var data = options;
    var keys = item.split('.');
    var key;

    for (let i=0; i<keys.length; ++i) {
      key = keys[i];
      if (typeof data != 'object' || !(key in data)) {
        return;
      }
      data = data[key]
    }

    if (data) {
      props[key] = data;
    }
  });

  return props;
}

export { filterProperties }
