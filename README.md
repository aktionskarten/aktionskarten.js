actionmap.js
============

actionmap.js is our client library for creating interactive maps for
https://www.aktionskarten.org. It uses a ReST api as backend and for rendering
it's based on leaflet with the following plugins:

* leaflet-draw
* Leaflet-StyleEditor

Leaflet itself is a bit customized. See src/leaflet/index.js for our changes.

Quickstart
----------

If you just want to use a precompiled version, you can find one at github.io.
Include the following style and script tags:

  <link rel="stylesheet" href="https://aktionskarten_net.github.io/aktionskarten.js/dist/leaflet.css" />
  <script src="https://aktionskarten_net.github.io/aktionskarten.js/dist/leaflet.bundle.js"></script>
  <script src="https://aktionskarten_net.github.io/aktionskarten.js/dist/lib.bundle.js"></script>

Otherwise compile by hand with help of npm and webpack:

Clone and install dependencies
  $ git clone github.com/aktionskarten_org/actionmap.js
  $ cd actionmap.js
  $ npm install --dev

To compile the actually library
  $ npm run build

You should now have dist directory where the actual javascript, css and images
are located. There is as well a demo index.html to test with.

To run an interactive webpack-dev-server, type in the following:
  $ npm run start


Licences
--------

Leaflet              2-clause BSD License
Leaflet.draw         MIT
Leaflet.StyleEditor  MIT
aktionkarten.js      MIT
