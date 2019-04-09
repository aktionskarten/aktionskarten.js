aktionskarten.js [![Build Status](https://travis-ci.org/aktionskarten/aktionskarten.js.svg?branch=master)](https://travis-ci.org/aktionskarten/aktionskarten.js)
============

aktionskarten.js is our client library for creating interactive maps for
https://www.aktionskarten.org. It uses a ReST api as backend and for rendering
it's based on leaflet with the following plugins:

* [leaflet-editable](https://github.com/Leaflet/Leaflet.Editable)
* [Leaflet-StyleEditor](https://github.com/dwilhelm89/Leaflet.StyleEditor)

Leaflet itself is a bit customized. See src/leaflet/index.js for our changes.

Quickstart
----------

If you just want to use a precompiled version, install it via [npm](https://www.npmjs.com/package/aktionskarten.js)
```
$ npm i aktionskarten.js
```


Otherwise compile by hand with help of npm and webpack:

Clone and install dependencies
```
$ git clone github.com/aktionskarten/aktionskarten.js
$ cd aktionskarten.js
$ npm install --dev
```

To compile the actually library
```
$ npm run build
```

You should now have dist directory where the actual javascript, css and images
are located. There is as well a demo index.html to test with.

To run an interactive dev server, type in the following:
```
$ npm run dev
```


Licences
--------

| Package              | License              |
|----------------------|----------------------|
| Leaflet              | 2-clause BSD License |
| Leaflet.editable     | WTFPL |
| Leaflet.StyleEditor  | MIT |
| aktionkarten.js      | MIT |
