
var yaml = require('js-yaml');
const fs = require('fs');



module.exports.Save = (filename, data) => {
  if (!data || !Object.keys(data).length) output = '';
  else output = yaml.safeDump(data, { flowLevel: 2 });
  fs.writeFileSync(filename, output);
}

module.exports.Load = (filename) => {
  var data = fs.readFileSync(filename, 'utf8');
  data = yaml.safeLoad(data);
  return data;
}