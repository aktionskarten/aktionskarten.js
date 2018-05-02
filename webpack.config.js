const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CleanWebpackPlugin = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin')
const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: {
    leaflet: './src/leaflet/index.js',
    lib: './src/index.js',
  },
  mode: 'development',
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'ActionMap'
  },
  devtool: 'source-map',
  devServer: {
    contentBase: './dist'
  },
  externals: {
    'leaflet': 'L'
  },
  plugins: [
    new CleanWebpackPlugin(['dist']),
    // patch spritesheet.svg from leaflet with our custom one
    new webpack.NormalModuleReplacementPlugin(
      /.*images\/spritesheet\.svg/,
      path.resolve(__dirname, 'src/leaflet/spritesheet.svg')
    ),
    new MiniCssExtractPlugin({
      filename: "[name].css",
      chunkFilename: "[id].css"
    }),
    new UglifyJsPlugin(),
    new HtmlWebpackPlugin({
      chunksSortMode: 'manual',
      chunks: ['leaflet', 'lib'],
      template: 'src/demo.html'
    })
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        use: 'babel-loader',
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          "css-loader"
        ]
      },
      {
        test: /\.(png|svg|jpg|gif)$/,
        use: [
          'file-loader'
        ]
      }
    ]
  }
};
