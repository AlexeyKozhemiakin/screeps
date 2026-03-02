// Converts Memory.profiler JSON to callgrind format
var fs = require('fs');
var data = JSON.parse(fs.readFileSync(__dirname + '/profiler-memory.json', 'utf8'));
var map = data.map;
var totalNs = Math.round(data.totalTime * 1000000);

var lines = ['events: ns', 'summary: ' + totalNs];

Object.keys(map).forEach(function(fnName) {
  var fn = map[fnName];
  var subsTime = 0;
  var subsLines = [];
  Object.keys(fn.subs).forEach(function(subName) {
    var sub = fn.subs[subName];
    var ns = Math.round(sub.time * 1000000);
    subsLines.push('cfn=' + subName);
    subsLines.push('calls=' + sub.calls + ' 1');
    subsLines.push('1 ' + ns);
    subsTime += sub.time;
  });
  var selfNs = Math.round((fn.time - subsTime) * 1000000);
  lines.push('');
  lines.push('fn=' + fnName);
  lines.push('1 ' + selfNs);
  lines.push(subsLines.join('\n'));
});

fs.writeFileSync(__dirname + '/callgrind.out', lines.join('\n'), 'utf8');
console.log('Written callgrind.out (' + lines.length + ' lines)');
