/* @requires mapshaper-common, mapshaper-file-types */


function validateHelpOpts(cmd) {
  var commands = validateCommaSepNames(cmd._[0]);
  if (commands) {
    cmd.options.commands = commands;
  }
}

function validateInputOpts(cmd) {
  var o = cmd.options,
      _ = cmd._;

  if (_[0] == '-' || _[0] == '/dev/stdin') {
    o.stdin = true;
  } else if (_.length > 0) {
    o.files = cli.validateInputFiles(_);
  }

  if ("precision" in o && o.precision > 0 === false) {
    error("precision option should be a positive number");
  }

  if (o.encoding) {
    o.encoding = cli.validateEncoding(o.encoding);
  }
}

function validateSimplifyOpts(cmd) {
  var o = cmd.options,
      _ = cmd._,
      methods = ["visvalingam", "dp"];

  if (o.method) {
    if (!utils.contains(methods, o.method)) {
      error(o.method, "is not a recognized simplification method; choos from:", methods);
    }
  }

  var pctStr = o.pct || "";
  if (_.length > 0) {
    if (/^[0-9.]+%?$/.test(_[0])) {
      pctStr = _.shift();
    }
    if (_.length > 0) {
      error("unparsable option:", _.join(' '));
    }
  }

  if (pctStr) {
    var isPct = pctStr.indexOf('%') > 0;
    if (isPct) {
      o.pct = Number(pctStr.replace('%', '')) / 100;
    } else {
      o.pct = Number(pctStr);
    }
    if (!(o.pct >= 0 && o.pct <= 1)) {
      error(utils.format("out-of-range pct value: %s", pctStr));
    }
  }

  var intervalStr = o.interval;
  if (intervalStr) {
    o.interval = Number(intervalStr);
    if (o.interval >= 0 === false) {
      error(utils.format("out-of-range interval value: %s", intervalStr));
    }
  }

  if (isNaN(o.interval) && isNaN(o.pct)) {
    error("command requires an interval or pct");
  }
}

function validateJoinOpts(cmd) {
  var o = cmd.options;
  o.source = o.source || cmd._[0];

  if (!o.source) {
    error("command requires the name of a file to join");
  }

  if (utils.some("shp,xls,xlsx".split(','), function(suff) {
    return utils.endsWith(o.source, suff);
  })) {
    error("currently only dbf and csv files are supported");
  }

  if (!o.keys) error("missing required keys option");
}

function validateSplitOpts(cmd) {
  if (cmd._.length == 1) {
    cmd.options.field = cmd._[0];
  } else if (cmd._.length > 1) {
    error("command takes a single field name");
  }
}

function validateClipOpts(cmd) {
  var opts = cmd.options;
  if (cmd._[0]) {
    opts.source = cmd._[0];
  }
  if (opts.bbox) {
    // assume comma-sep bbox has been parsed into array of strings
    opts.bbox = opts.bbox.map(parseFloat);
  }
  if (!opts.source && !opts.bbox) {
    error("command requires a source file, layer id or bbox");
  }
}

function validateDissolveOpts(cmd) {
  var _= cmd._,
      o = cmd.options;
  if (_.length == 1) {
    o.field = _[0];
  } else if (_.length > 1) {
    error("command takes a single field name");
  }
}

function validateMergeLayersOpts(cmd) {
  if (cmd._.length > 0) error("unexpected option:", cmd._);
}

function validateRenameLayersOpts(cmd) {
  cmd.options.names = validateCommaSepNames(cmd._[0]) || null;
}

function validateSplitOnGridOpts(cmd) {
  var o = cmd.options;
  if (cmd._.length == 1) {
    var tmp = cmd._[0].split(',');
    o.cols = parseInt(tmp[0], 10);
    o.rows = parseInt(tmp[1], 10) || o.cols;
  }

  if (o.rows > 0 === false || o.cols > 0 === false) {
    error("comand expects cols,rows");
  }
}

function validateLinesOpts(cmd) {
  try {
    var fields = validateCommaSepNames(cmd.options.fields || cmd._[0]);
    if (fields) cmd.options.fields = fields;
  } catch (e) {
    error("command takes a comma-separated list of fields");
  }
}


function validateInnerLinesOpts(cmd) {
  if (cmd._.length > 0) {
    error("command takes no arguments");
  }
}

function validateSubdivideOpts(cmd) {
  if (cmd._.length !== 1) {
    error("command requires a JavaScript expression");
  }
  cmd.options.expression = cmd._[0];
}

function validateFilterFieldsOpts(cmd) {
  try {
    var fields = validateCommaSepNames(cmd._[0]);
    cmd.options.fields = fields || [];
  } catch(e) {
    error("command requires a comma-sep. list of fields");
  }
}

function validateExpressionOpts(cmd) {
  if (cmd._.length == 1) {
    cmd.options.expression = cmd._[0];
  } else if (cmd._.length > 1) {
    error("unparsable arguments:", cmd._);
  }
}

function validateOutputOpts(cmd) {
  var _ = cmd._,
      o = cmd.options,
      path = _[0] || "",
      pathInfo = utils.parseLocalPath(path);

  if (_.length > 1) {
    error("command takes one file or directory argument");
  }

  if (!path) {
    // no output file or dir
  } else if (path == '-' || path == '/dev/stdout') {
    o.stdout = true;
  } else if (!pathInfo.extension) {
    o.output_dir = path;
  } else {
    if (pathInfo.directory) o.output_dir = pathInfo.directory;
    o.output_file = pathInfo.filename;
  }

  if (o.output_file && MapShaper.filenameIsUnsupportedOutputType(o.output_file)) {
    error("Output file looks like an unsupported file type:", o.output_file);
  }

  if (o.output_dir && !cli.isDirectory(o.output_dir)) {
    if (!cli.isDirectory(o.output_dir)) {
      error("Output directory not found:", o.output_dir);
    }
  }

  if (o.format) {
    o.format = o.format.toLowerCase();
    if (o.format == 'csv') {
      o.format = 'dsv';
      o.delimiter = o.delimiter || ',';
    } else if (o.format == 'tsv') {
      o.format = 'dsv';
      o.delimiter = o.delimiter || '\t';
    }
    if (!MapShaper.isSupportedOutputFormat(o.format)) {
      error("Unsupported output format:", o.format);
    }
  }

  if (o.encoding) {
    o.encoding = cli.validateEncoding(o.encoding);
  }

  // topojson-specific
  if ("quantization" in o && o.quantization > 0 === false) {
    error("quantization= option should be a nonnegative integer");
  }

  if ("topojson_precision" in o && o.topojson_precision > 0 === false) {
    error("topojson-precision= option should be a positive number");
  }

}

// Convert a comma-separated string into an array of trimmed strings
// Return null if list is empty
function validateCommaSepNames(str, min) {
  if (!min && !str) return null; // treat
  if (!utils.isString(str)) {
    error ("expected comma-separated list; found:", str);
  }
  var parts = str.split(',').map(utils.trim).filter(function(s) {return !!s;});
  if (min && min > parts.length < min) {
    error(utils.format("expected a list of at least %d member%s; found: %s", min, 's?', str));
  }
  return parts.length > 0 ? parts : null;
}
