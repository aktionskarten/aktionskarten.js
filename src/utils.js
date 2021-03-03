function filterProperties(options) {
  var validKeys = ['id', 'label', 'text', 'color', 'weight', 'opacity', 'fillColor', 'fillOpacity', 'dashArray', 'icon.options.iconColor', 'icon.options.iconSize', 'icon.options.icon'],
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

//
// see from https://stackoverflow.com/a/49694780
//
function sortObj(obj) {
  if (obj === null || typeof obj !== 'object')
    return obj;

  if (Array.isArray(obj))
    return obj.map(sortObj)

  return Object.assign({},
      ...Object.entries(obj)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([k, v]) => ({ [k]: sortObj(v) }),
    ))
}

export { filterProperties, sortObj }
