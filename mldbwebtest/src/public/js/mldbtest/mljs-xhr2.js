
var m = window.mljs || {};
var b = m.bindings || {};
m.bindings = b;
b.xhr2 = function() {
  // constructor
  /*$.ajaxSetup({
    contentType : 'application/json',
    processData : false
  });*/
};

b.xhr2.prototype.supportsAdmin = function() {
  return false; // can only access our own REST HTTP Server
};

b.xhr2.prototype.configure = function(username,password,logger) {
  this.username = username;
  this.password = password;
  this.logger = logger;
};

b.xhr2.prototype.request = function(reqname,options,content,callback) {
  var self = this;
  /*
  var data = null;
  if (undefined != content && null != content) {
    console.log("content typeof: " + (typeof content));
    if ("ArrayBuffer" == typeof content) {
      data = content;
    } else if ("object" == typeof content) {
      data = JSON.stringify(content);
    } else if ("string" == typeof content) {
      data = content;
    }
  }*/
  var ct = options.contentType;
  if (undefined == ct) {
    self.logger.debug("XHR2: *********** CT UNDEFINED *************");
    ct = "application/json";
  }
  /*
  var dataType = "json";
  if ("application/xml" == ct) {
    dataType = "xml";
  } else if ("text/plan" == ct) {
    dataType = "text";
  }*/
  
  // binary data hack XHR2
  //if (null != content && undefined != content && -1 != options.path.indexOf("&format=binary")) {
  try {
    var xhr = new XMLHttpRequest();
    xhr.open(options.method, options.path, true); // TODO include username and password too
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhr.setRequestHeader('Content-Type', ct);
    if (options.headers) {
      for (var h in options.headers) {
        if (typeof options.headers[h] == "string" && h != "Content-type") {
          self.logger.debug("XHR2: header: " + h);
          self.logger.debug("XHR2: header value: " + options.headers[h]);
          xhr.setRequestHeader(h,options.headers[h]);
        }
      }
    }
    
    xhr.onload = function(e) {
      var res = {};
      res.inError = false;
      res.statusCode = xhr.status;
      
      self.logger.debug("XHR2: responseXML: " + xhr.responseXML);
      self.logger.debug("XHR2: responseText: " + xhr.responseText);
      self.logger.debug("XHR2: response: " + xhr.response);
      self.logger.debug("XHR2: typeof responseXML: " + typeof xhr.responseXML);
      self.logger.debug("XHR2: typeof responseText: " + typeof xhr.responseText);
      self.logger.debug("XHR2: typeof response: " + typeof xhr.response);
      
      // TODO handle 304 etc responses (don't assume a non 200 is a 400/500)
      
     if (("" + xhr.status).indexOf("2")==0) {
        // success
      var wibble;
      //if (undefined != content && null != content) {
        self.logger.debug("XHR2: Data type: " + (typeof content));
        self.logger.debug("XHR2: Data value: " + content);
        var xml = xhr.responseXML;
        if (undefined != xml) {
          res.format = "xml";
          res.doc = xml;
        } else {
          self.logger.debug("XHR2: response text: " + xhr.responseText);
          try {
            self.logger.debug("XHR2: parsing xhr.responseText");
            wibble = JSON.parse(xhr.responseText); // successes are JSON text (needs parsing)
            res.format = "json";
            self.logger.debug("XHR2: js raw: " + wibble);
            self.logger.debug("XHR2: json str: " + JSON.stringify(wibble));
            self.logger.debug("XHR2: Parsed JSON successfully");
          } catch (ex) {
            self.logger.debug("XHR2: JSON parsing failed. Trying XML parsing.");
            // try XML conversion now
            try {
              wibble = textToXML(xhr.responseText);
              res.format = "xml";
            } catch (ex2) {
              // do nothing - likely a blank document
              self.logger.debug("XHR2: Not JSON or XML. Exception: " + ex2);
            }
          }
        }
      //}
      res.doc = wibble;
      
    } else {
      //failure
      self.logger.debug("XHR2: error");
      // get failure code to determine what to do next
      //var res = {};
      if (xhr.status == 303) {
        res.location = xhr.getResponseHeader("location"); // for newly created document / upload
      }
      res.inError = true;
      res.doc = xhr.responseXML; // failures are returned in XML
      if (undefined == res.doc) {
        res.doc = xhr.responseText;
        res.format = "text"; // TODO handle binary content
        try {
          self.logger.debug("XHR2: parsing xhr.responseText");
          var wibble = JSON.parse(xhr.responseText); // successes are JSON text (needs parsing)
          res.format = "json";
          self.logger.debug("XHR2: js raw: " + wibble);
          self.logger.debug("XHR2: json str: " + JSON.stringify(wibble));
          self.logger.debug("XHR2: Parsed JSON successfully");
          res.doc = wibble;
        } catch (ex) {
          // do nothing - likely a blank XML document
          self.logger.debug("XHR2: Exception: " + ex);
        }
      } else {
        res.format = "xml";
      }
      res.details = res.doc;
      if ("string" == typeof res.details) { // TODO add response content type check (document could be plain text!)
        res.details = textToXML(res.details);
      }
      if (undefined != res.details.nodeType) { // must be an XML document
        res.details = xmlToJson(res.details); // convert text in res.doc to XML first
      } 
    }
      //self.logger.debug("json final str: " + JSON.stringify(res.doc));
      // now supports XML returned too
      callback(res);
    };
    
    if (ct == "application/xml") {
      content = (new XMLSerializer()).serializeToString(content);
    } else if (ct == "application/json") {
      // json
      content = JSON.stringify(content);
    } else {
      // binary, file, json string, etc. - do nothing
    }
    self.logger.debug("XHR2: Sending content: " + content);
    
    xhr.send(content);
    
  } catch (ex) {
    self.logger.debug("XHR2: EXCEPTION in XHR2 send() call: " + ex);
    var res = {inError:true,details: ex};
    callback(res);
  }
  
};

