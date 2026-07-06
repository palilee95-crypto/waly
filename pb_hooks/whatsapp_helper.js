const evolutionUrl = $os.getenv('EVOLUTION_API_URL') || 'http://localhost:8080';
const evolutionKey = $os.getenv('EVOLUTION_API_KEY') || 'waly_dev_api_key';

function callEvo(method, path, body = null) {
  const options = {
    url: `${evolutionUrl}${path}`,
    method: method,
    headers: {
      "apikey": evolutionKey,
      "Content-Type": "application/json"
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const res = $http.send(options);
    return {
      status: res.statusCode,
      data: res.raw ? JSON.parse(res.raw) : null
    };
  } catch (err) {
    console.log(`Evolution API call failed [${method} ${path}]:`, err.message || err);
    return {
      status: 500,
      data: { error: err.message || err }
    };
  }
}

module.exports = {
  evolutionUrl,
  evolutionKey,
  callEvo
};
