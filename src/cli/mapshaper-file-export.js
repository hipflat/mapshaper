/* @require mapshaper-common */

api.exportFiles = function(dataset, opts) {
  var exports = MapShaper.exportFileContent(dataset, opts);
  if (exports.length > 0 === false) {
    message("No files to save");
  } else if (opts.stdout) {
    cli.writeFile('/dev/stdout', exports[0].content);
  } else {
    var paths = MapShaper.getOutputPaths(utils.pluck(exports, 'filename'), opts);
    exports.forEach(function(obj, i) {
      var path = paths[i];
      cli.writeFile(path, obj.content);
      message("Wrote " + path);
    });
  }
};

MapShaper.getOutputPaths = function(files, opts) {
  var paths =  files.map(function(file) {
    return require('path').join(opts.output_dir || '', file);
  });
  if (!opts.force) {
    paths = resolveFileCollisions(paths);
  }
  return paths;
};

// Avoid naming conflicts with existing files
// by adding file suffixes to output filenames: -ms, -ms2, -ms3 etc.
function resolveFileCollisions(candidates) {
  var i = 0,
      suffix = "",
      paths = candidates.concat();

  while (testFileCollision(paths)) {
    i++;
    suffix = "-ms";
    if (i > 1) suffix += String(i);
    paths = addFileSuffix(candidates, suffix);
  }
  return paths;
}

function addFileSuffix(paths, suff) {
  return paths.map(function(path) {
     return utils.getPathBase(path) + suff + '.' + utils.getFileExtension(path);
  });
}

function testFileCollision(paths) {
  return utils.some(paths, function(path) {
    return cli.isFile(path) || cli.isDirectory(path);
  });
}
