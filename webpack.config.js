const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    lib: path.resolve(__dirname, '/src/index.js'),
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'Aktionskarten',   
    libraryTarget: 'umd',
  },
  devServer: {
    compress: true,
    port: 5001
  },
  devtool: 'inline-source-map',
  plugins: [
     new CleanWebpackPlugin(),
     new HtmlWebpackPlugin({
       title: 'Development',
       template: 'src/demo.html',
       scriptLoading: 'blocking'
     }),
   ],
   module: {
    rules: [
      {
        test: /\.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [ '@babel/preset-env' ]
          }
        },
      },

      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(svg|png|jpe?g|gif)$/i,
        use: [
          {
            loader: 'file-loader',
          },
        ],
      },
    ],
  },
  resolve: {
    symlinks: false,
    // modules: [path.resolve('node_modules')],   // prevent use of different leaflet versions if packages use them in their package.json
    alias: {
      // leaflet: path.join(__dirname, 'node_modules/leaflet'),
      '@': path.resolve(__dirname, './src/'),
    },
  },
};

/*
//const CleanWebpackPlugin = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin')
const path = require('path');
const webpack = require('webpack');
//const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  entry: {
    lib: './src/index.js',
  },
  mode: 'development',
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'Aktionskarten',
  },
  devServer: {
    contentBase: './dist'
  },
  plugins: [
    //new CleanWebpackPlugin(['dist']),
    new HtmlWebpackPlugin({
      template: 'src/demo.html'
    }),
    //new BundleAnalyzerPlugin()
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [ '@babel/preset-env' ]
          }
        },
      },
      {
        test: /\.css$/,
        use: [
          {loader: 'style-loader'},
          {loader: 'css-loader'},
        ]
      },
      {
        test: /\.(png|svg|jpg|gif)$/,
        use: [
          'file-loader'
        ]
      }
    ]
  },
  resolve: {
    symlinks: false,
    modules: [path.resolve('node_modules')],
    alias: {
      '@': path.resolve(__dirname, './src/'),
    },
  },
};
*/