import 'cross-fetch/polyfill'   // Api is using fetch
import {Api} from '../src/api'

const url = 'http://127.0.0.1:5000'
const api = new Api(url)

api.errorHandler = (err) => {
  console.warn(err, new Error().stack);
}

async function reset_db() {
  await api._get(url + '/test/reset_db');
}

export {api, reset_db}
