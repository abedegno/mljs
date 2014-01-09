/*
Copyright 2012 MarkLogic Corporation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
// global variable definitions
com = window.com || {};
com.marklogic = window.com.marklogic || {};
com.marklogic.widgets = window.com.marklogic.widgets || {};




/**
 * A virtual page, or workplace, with dynamically set out areas
 *
 * @constructor
 * @param {string} container - The HTML ID of the element to place this widget's content within.
 */
com.marklogic.widgets.workplace = function(container) {
  this.container = container;
  
  this._editable = false;
  
  this._contexts = new Array(); // contextname => contextObject instance
  
  this._workplaceContext = new com.marklogic.widgets.workplacecontext();
  this._workplaceContext.register(this);
  
  this._init();
};

com.marklogic.widgets.workplace.prototype._init = function() {
  // create two divs, one transparent in front of the other. When hover over top right, show an edit button if editable.
  var str = "<div id='" + this.container + "-container' class='workplace-container'>";
  str += " <div id='" + this.container + "-layout'></div>";
  str += " <div id='" + this.container + "-mask' class='workplace-mask'>";
  str += "  <div class='workplace-mask-icon' ><img id='" + this.container + "-link' src='/images/mljs/setting-small.png' title='Edit this Workplace' class='workplace-edit-link' /></div>";
  str += " </div>";
  str += "</div>";
  document.getElementById(this.container).innerHTML = str;
  
  // add click event handler
  var self = this;
  document.getElementById(this.container + "-link").onclick = function(evt) {
    com.marklogic.widgets.workplaceadmin.renderFullscreen(self._workplaceContext);
  }
};

com.marklogic.widgets.workplace.prototype.editable = function(editme) {
  if (undefined == editme) {
    editme = true;
  }
  this._editable = editme;
  
  // show editable div within page
  if (this._editable) {
    document.getElementById(this.container + "-mask").style.display = "block";
  } else {
    document.getElementById(this.container + "-mask").style.display = "none";
  }
};

com.marklogic.widgets.workplace.prototype.loadPage = function(jsonOrString) {
  this._workplaceContext.loadPage(jsonOrString);
};

com.marklogic.widgets.workplace.prototype.updateWorkplace = function(context) {
  //var json = jsonOrString; // TODO lookup json config if nothing or path specified
  
  var json = this._workplaceContext.getJson();
  
  // load top level layout for this page (or panel we are managing, at least)
  mljs.defaultconnection.logger.debug("Creating layout");
  var layout = new (com.marklogic.widgets.layouts[json.layout])(this.container + "-layout");
  
  // generate named areas for widgets to be contained
  mljs.defaultconnection.logger.debug("Creating zones");
  layout.createZones(json.assignments);
  
  var widgets = new Array(); // widgetid => wgt instance
  
  // initialise widgets in these areas
  mljs.defaultconnection.logger.debug("Creating widget instances");
  for (var w = 0, max = json.widgets.length,widget;w < max;w++) {
    widget = json.widgets[w];
    mljs.defaultconnection.logger.debug("Creating widget: " + w + " with: " + JSON.stringify(widget));
    var wgt = this._createWidget(widget.type,layout.getElementID(widget.widget),widget.config);
    mljs.defaultconnection.logger.debug("Create widget has returned");
    widgets[widget.widget] = wgt;
  }
  
  var contexts = new Array(); // contextid => context object
  
  // create management contexts from connection object
  mljs.defaultconnection.logger.debug("Creating contexts");
  for (var c = 0, max = json.contexts.length,ctx;c < max;c++) {
    ctx = json.contexts[c];
    mljs.defaultconnection.logger.debug("Context: " + c + " is " + JSON.stringify(ctx));
    
    var creator = mljs.defaultconnection["create" + ctx.type];
    mljs.defaultconnection.logger.debug("Is creator function of type function?: " + (typeof creator));
    var inst = creator.call(mljs.defaultconnection);
    contexts[ctx.context] = inst;
    mljs.defaultconnection.logger.debug("Is context instance valid?: is object?: " + (typeof inst));
    
    // initialise context configuration
    mljs.defaultconnection.logger.debug("Config: " + JSON.stringify(ctx.config));
    mljs.defaultconnection.logger.debug("Context Obj: " + JSON.stringify(inst));
    if (undefined != inst.setConfiguration && undefined != ctx.config) {
      mljs.defaultconnection.logger.debug("Setting context configuration");
      inst.setConfiguration(ctx.config);
    }
    
    // register widgets with contexts
    for (var wid = 0, widmax = ctx.register.length,widgetid;wid < widmax;wid++) {
      widgetid = ctx.register[wid];
      mljs.defaultconnection.logger.debug("registering widget: " + wid + " to " + widgetid);
      inst.register(widgets[widgetid]);
    }
  }
  
  this._contexts = contexts;
  
  // call onload actions in order
  if (undefined != json.actions && undefined != json.actions.onload) {
    mljs.defaultconnection.logger.debug("Processing onload actions");
    for (var a = 0, max = json.actions.onload.length,action;a < max;a++) {
      action = json.actions.onload[a];
      mljs.defaultconnection.logger.debug("Processing onload action: " + JSON.stringify(action));
      var actionObject = new(com.marklogic.widgets.actions[action.type])();
      mljs.defaultconnection.logger.debug("Got instance. Calling setConfiguration()...");
      actionObject.setConfiguration(action.config);
      mljs.defaultconnection.logger.debug("Finished configuring. Caling execute(this)...");
      var result = actionObject.execute(this);
      mljs.defaultconnection.logger.debug("Got result: " + JSON.stringify(result));
      // TODO do something with result
    }
    mljs.defaultconnection.logger.debug("COMPLETE processing onload actions");
  }
  
  mljs.defaultconnection.logger.debug("finished loading page");
};

com.marklogic.widgets.workplace.prototype.getContextObject = function(name) {
  return this._contexts[name];
};

com.marklogic.widgets.workplace.prototype._createWidget = function(type,elementid,config) {
  mljs.defaultconnection.logger.debug("Creating widget: " + type + " in " + elementid + " with config: " + JSON.stringify(config));
  var wobj = com;
  var splits = type.split(".");
  for (var i = 1, max = splits.length,split;i < max;i++) {
    split = splits[i];
    wobj = wobj[split];
    mljs.defaultconnection.logger.debug("split: " + split + " has type: " + (typeof wobj) + " and value: " + JSON.stringify(wobj));
  }
  mljs.defaultconnection.logger.debug("instantiating widget: " + JSON.stringify(wobj));
  var wgt = new wobj(elementid);
  
  mljs.defaultconnection.logger.debug("has widget instance been created? type is object?: " + (typeof wgt));
  
  
  // apply config to object
  if (undefined !== wgt.setConfiguration) { // backwards compatibility - widget may not have configuration
    wgt.setConfiguration(config);
  }
  
  return wgt;
};







// LAYOUTS

// thinthick layout
com.marklogic.widgets.layouts = {};
com.marklogic.widgets.layouts.thinthick = function(container) {
  this.container = container;
  
  this.assignments = new Array(); // [widgetid] => assignment json, with elementid for element linked to
  
  this._nextID = 1;
  
  this._init();
};

com.marklogic.widgets.layouts.thinthick.prototype._init = function() {
  var s = "<div id='" + this.container + "-layout' class='container_12 mljswidget layout thinthick'>";
  s += "<div id='" + this.container + "-A' class='grid_4 thinthick-thin'></div>";
  s += "<div id='" + this.container + "-B' class='grid_8 thinthick-thick'></div>";
  s += "</div>";
  document.getElementById(this.container).innerHTML = s;
};

com.marklogic.widgets.layouts.thinthick.prototype.createZones = function(assignments) {
  mljs.defaultconnection.logger.debug("Creating zones in thinthick layout");
  // group by zones, order by order
  var zones = new Array();
  zones["A"] = new Array();
  zones["B"] = new Array();
  
  if (undefined != assignments) {
    for (var i = 0, max = assignments.length,ass;i < max;i++) {
      mljs.defaultconnection.logger.debug("createZones: i: " + i); 
      ass = assignments[i];
      mljs.defaultconnection.logger.debug("createZones: i: " + i + " has ass: " + JSON.stringify(ass));
      zones[ass.zone][ass.order] = ass;
    }
  }
  
  // do zone A then zone B
  this._genZones("A",zones["A"]);
  this._genZones("B",zones["B"]);
  
};
com.marklogic.widgets.layouts.thinthick.prototype.appendToZone = function(zone,html) {
  var zoneel = document.getElementById(this.container + "-" + zone);
  
  var id = this.container + "-" + zone + "-" + this._nextID++;
  var div = document.createElement("div");
  div.id = id;
  div.innerHTML = html;
  zoneel.appendChild(div);
  return id;
};

com.marklogic.widgets.layouts.thinthick.prototype.getElementID = function(widgetid) {
  mljs.defaultconnection.logger.debug("thinthick: getElementID: for widgetid: " + widgetid);
  var elid = this.assignments[widgetid].elementid;
  mljs.defaultconnection.logger.debug("thinthick: getElementID: widgetid: " + widgetid + " => " + elid);
  return elid;
};

com.marklogic.widgets.layouts.thinthick.prototype._genZones = function(zone,arr) {
  mljs.defaultconnection.logger.debug("thinthick: _genZones: " + zone + " with array: " + JSON.stringify(arr));
  var s = "";
  for (var i = 1, max = arr.length, ass;i < max;i++) {
    mljs.defaultconnection.logger.debug("_genZones: zone: " + zone + " index: " + i); 
    ass = arr[i];
    mljs.defaultconnection.logger.debug("_genZones: zone: " + zone + " has ass: " + JSON.stringify(ass));
    if (undefined != ass) {
      var id = this.container + "-" + zone + "-" + this._nextID++;
      ass.elementid = id;
      this.assignments[ass.widget] = ass;
      s += "<div id='" + id + "'></div>";
    }
  }
  document.getElementById(this.container + "-" + zone).innerHTML = s;
};











// ACTIONS
com.marklogic.widgets.actions = {};
com.marklogic.widgets.actions.javascript = function() {
  this._config = {
    targetObject: null,
    methodName: null,
    parameters: []
  };
};

com.marklogic.widgets.actions.javascript.getConfigurationDefinition = function() {
  // TODO config definition
};

com.marklogic.widgets.actions.javascript.prototype.setConfiguration = function(config) {
  this._config = config;
};

com.marklogic.widgets.actions.javascript.prototype.execute = function(executionContext) {
  if ((null == this._config.targetObject) || (null == this._config.methodName)) {
    return {executed: false, details: "targetObject or methodName are null"};
  }
  var obj = executionContext.getContextObject(this._config.targetObject);
  mljs.defaultconnection.logger.debug("Got target object?: " + obj);
  mljs.defaultconnection.logger.debug("Fetching method name: " + this._config.methodName);
  var func = (obj[this._config.methodName]);
  mljs.defaultconnection.logger.debug("Got target object function: " + func);
  var result = func.call(obj); // TODO support parameters
  return {executed:true, result: result, details: "Method executed successfully"};
};






/**
 * Acts as a co-ordinating context for a single MLJS Workplace Page configuration
 * 
 * @constructor
 */
com.marklogic.widgets.workplacecontext = function() {
  this._json = {
    shared: false,
    widgets: [], assignments: [], contexts: [], actions: {
      onload: [], onunload: []
    },
    layout: "thinthick",
    title: "New Workplace"
  };
  this._lastSaved = this._json;
  this._uri = null;
  
  this.db = mljs.defaultconnection;
  
  this.updatePublisher = new com.marklogic.events.Publisher(); // page loaded from server
};

com.marklogic.widgets.workplacecontext.prototype.revert = function() {
  this._json = this._lastSaved;
};

com.marklogic.widgets.workplacecontext.prototype.save = function(callback) {
  // TODO
};

com.marklogic.widgets.workplacecontext.prototype.getJson = function() {
  return this._json; // DO NOT EDIT the returned JSON - use context functions only
};

com.marklogic.widgets.workplacecontext.prototype.getSummary = function() {
  return {title: this._json.title,urls: this._json.urls,layout: this._json.layout,shared:this._json.shared};
}
com.marklogic.widgets.workplacecontext.prototype.setSummary = function(title, urls, layout,shared) {
  this._json.title = title;
  this._json.urls = urls;
  this._json.layout = layout;
  this._json.shared = shared;
};

com.marklogic.widgets.workplacecontext.prototype.getWidgets = function() {
  return this._json.widgets;
};

com.marklogic.widgets.workplacecontext.prototype.addWidget = function(name,type,config) {
  var wgt = {widget: name, type: type, config: config};
  this._json.widgets.push(wgt);
};

com.marklogic.widgets.workplacecontext.prototype.removeWidget = function(name) {
  var wgts = [];
  for (var i = 0;i < this._json.widgets.length;i++) {
    if (this._json.widgets[i].name == name) {
      // do nothing
    } else {
      wgts.push(this._json.widgets[i]);
    }
  }
  this._json.widgets = wgts;
};

com.marklogic.widgets.workplacecontext.prototype.getAssignments = function() {
  return this._json.assignments;
};

com.marklogic.widgets.workplacecontext.prototype.placeWidget = function(name,zone,order) {
  // get other widgets in zone
  var zoneWidgets = [];
  var otherWidgets = [];
  var maxo = 0;
  for (var i = 0,w, max = this._json.assignments.length;i < max;i++) {
    w = this._json.assignments[i];
    if (w.zone == zone) {
      zoneWidgets[w.order-1] = w;
      maxo = w.order;
    } else {
      otherWidgets.push(w);
    }
  }
  // increment indexes on this and subsequent widget placements
  for (var i = maxo-1; i > order - 1;i--) {
    zoneWidgets[maxo] = zoneWidgets[maxo - 1];
    zoneWidgets[maxo].order++;
    zoneWidgets[maxo - 1] = undefined;
  }
  // now add in our widget
  zoneWidgets[order - 1] = {widget: name,zone:zone,order:order};
  
  var places = [];
  for (var i = 0;i < otherWidgets.length;i++) {
    places.push(otherWidgets[i]);
  }
  for (var i = 0;i < zoneWidgets.length;i++) {
    places.push(zoneWidgets[i]);
  }
  this._json.assignments = places;
};

com.marklogic.widgets.workplacecontext.prototype.getContexts = function() {
  return this._json.contexts;
};

com.marklogic.widgets.workplacecontext.prototype.addContext = function(name,type,config) {
  this._json.contexts.push({context: name,type:type,config:config,register:[]});
};

com.marklogic.widgets.workplacecontext.prototype.registerWidget = function(widgetName,contextName) {
  for (var i = 0, max = this._json.contexts.length,c;i < max;i++) {
    c = this._json.contexts[i];
    if (c.context == contextName) {
      c.register.push(widgetName);
      return;
    }
  }
};

com.marklogic.widgets.workplacecontext.prototype.setWidgetConfig = function(widgetName,config) {
  for (var i = 0, max = this._json.widgets.length,w;i < max;i++) {
    w = this._json.widgets[i];
    if (w.widget == widgetName) {
      w.config = config;
      return;
    }
  }
};

com.marklogic.widgets.workplacecontext.prototype.getActions = function() {
  return this._json.actions;
};

com.marklogic.widgets.workplacecontext.prototype.addOnloadAction = function(type, config) {
  this._json.actions.onload.push({type: type,config: config});
};

com.marklogic.widgets.workplacecontext.prototype.addOnunloadAction = function(type,config) {
  this._json.actions.onunload.push({type: type,config: config});
  
};

com.marklogic.widgets.workplacecontext.prototype.addContextAction = function(context_name,event,actiontype,actionconfig) {
  // TODO
};


com.marklogic.widgets.workplacecontext.prototype.loadPage = function(jsonOrString) {
  if (typeof(jsonOrString) == "string") {
    // doc uri
    var self = this;
    this.db.findWorkplace(url,function(result) {
      // assume just one
      self._uri = result.doc.results[0].uri;
      self._json = result.doc.results[0].content;
      if ("string" == typeof (self._json)) {
        self._json = JSON.parse(self._json);
      }
      self._fireUpdate();
    });
  } else {
    this._json = jsonOrString;
    this._fireUpdate();
  }
};

com.marklogic.widgets.workplacecontext.prototype.loadPageWithUri = function(uri) {
  this._uri = uri;
  var self = this;
  this.db.getWorkplace(uri,function(result) {
    self._json = result.doc;
    
    // fire updatePage event
    self._fireUpdate();
  });
};

// Context event handling

com.marklogic.widgets.workplacecontext.prototype.register = function(widget) {
  if (undefined != widget.setWorkplaceContext) {
    widget.setWorkplaceContext(this);
  }
  if (undefined != widget.updateWorkplace) {
    this.addWorkplaceUpdateListener(function(wp) {widget.updateWorkplace(wp);});
  }
};

/**
 * Workplace update fired whenever the configuration is loaded/changed on the server. (Not when saved to the server)
 * @private
 */
com.marklogic.widgets.workplacecontext.prototype._fireUpdate = function() {
  this.updatePublisher.publish(this);
};

com.marklogic.widgets.workplacecontext.prototype.addWorkplaceUpdateListener = function(lis) {
  this.updatePublisher.subscribe(lis);
};


com.marklogic.widgets.workplacecontext.prototype.removeWorkplaceUpdatelistener = function(lis) {
  this.updatePublisher.unsubscribe(lis);
};









com.marklogic.widgets.workplaceadmin = function(container) {
  this.container = container;
  
  this._workplaceContext = new com.marklogic.widgets.workplacecontext();

  this._config = {
    widgetList: [
      {title: "Co-occurence", classname: "com.marklogic.widgets.cooccurence", description: "Shows two way co-occurence between elements in a document."},
      {title: "Create Document", classname: "com.marklogic.widgets.create", description: "Form builder used to generate a new document on submission."},
      {title: "Document Properties", classname: "com.marklogic.widgets.docproperties", description: "Shows the MarkLogic Properties of a Document."},
      {title: "XHTML Head Viewer", classname: "com.marklogic.widgets.docheadviewer", description: "Shows the Meta data elements within an XHTML document."},
      {title: "XHTML Content Viewer", classname: "com.marklogic.widgets.docviewer", description: "Displays XHTML content inline within a page."},
      {title: "Data Explorer", classname: "com.marklogic.widgets.explorer", description: "HighCharts powered node diagram to explore semantic subjects and related document facets."},
      {title: "HighCharts", classname: "com.marklogic.widgets.highcharts", description: "HighCharts powered charting."},
      {title: "Google Kratu", classname: "com.marklogic.widgets.kratu", description: "Google Kratu tabular display of content and semantic search results."},
      {title: "Document Markings", classname: "com.marklogic.widgets.markings", description: "Allows an XHTML document to have in-document security set to paragraphs, and supports suggesting semantic triples too."},
      {title: "OpenLayers Map", classname: "com.marklogic.widgets.openlayers", description: "OpenLayers powered map supporting multiple layer types and geospatial search"},
      {title: "RDB2RDF", classname: "com.marklogic.widgets.rdb2rdf", description: "Convert and RDBMS database to a set of triples in MarkLogic."},
      {title: "Search Bar", classname: "com.marklogic.widgets.searchbar", description: "Content search query box supporting the default grammar."},
      {title: "Search Sorter", classname: "com.marklogic.widgets.searchsort", description: "Sort search results based on existing sorting options."},
      {title: "Search Pager", classname: "com.marklogic.widgets.searchpager", description: "Page through search results."},
      {title: "Search Facets", classname: "com.marklogic.widgets.searchfacets", description: "Show facets returned from a search, and allow their selection."},
      {title: "Search Results", classname: "com.marklogic.widgets.searchresults", description: "Show search results. Supports built in and custom rendering."},
      {title: "Structured Search Selection", classname: "com.marklogic.widgets.searchselection", description: "Select a structured search to execute."},
      {title: "Semantic Search Bar", classname: "com.marklogic.widgets.sparqlbar", description: "Visually create a sophisticated SPARQL query."},
      {title: "Semantic Search Results", classname: "com.marklogic.widgets.sparqlresults", description: "Show a summary of Subjects returned from a SPARQL query."},
      {title: "Semantic Subject Facts", classname: "com.marklogic.widgets.entityfacts", description: "Show the list of facts about a specific subject."}
    ]
  };
  
  this.closePublisher = new com.marklogic.events.Publisher();
  
  this._refresh();
};


/**
 * Helper function to draw the edit screen full screen
 */
com.marklogic.widgets.workplaceadmin.renderFullscreen = function(workplacecontext) {
  // draw container
  // ensure main window is 960 pixels wide (for 960.css to ensure consistent rendering)
  // ensure main window has vertical scroll bar
  //str = " <div id='workplaceeditorcontainer'>Loading...</div>";
  
  var el = document.createElement("div");
  el.id = "workplaceeditormain";
  //el.innerHTML = str;
  document.body.appendChild(el);
  
  var admin = new com.marklogic.widgets.workplaceadmin("workplaceeditormain");
  workplacecontext.register(admin);
  admin.updateWorkplace(workplacecontext);
  
  // add event listener to workplace admin for closing admin widget
  admin.addCloseListener(function(wgt) {
    // destroy edit div on close
    document.body.removeChild(document.getElementById("workplaceeditormain"));
  });
};

com.marklogic.widgets.workplaceadmin.prototype.addCloseListener = function(lis) {
  this.closePublisher.subscribe(lis);
};

com.marklogic.widgets.workplaceadmin.prototype.removeCloseListener = function(lis) {
  this.closePublisher.unsubscribe(lis);
};

com.marklogic.widgets.workplaceadmin.prototype.setWorkplaceContext = function(ctx) {
  this._workplaceContext = ctx;
};

com.marklogic.widgets.workplaceadmin.prototype.getWorkplaceContext = function() {
  return this._workplaceContext;
};

com.marklogic.widgets.workplaceadmin.prototype._refresh = function() {
  var str = "<div id='" + this.container + "-workplaceadmin' class='mljswidget workplaceadmin'>";
  str += " <div id='" + this.container + "-panels' class='workplaceadmin-panels'>";
  
  str += "  <div id='" + this.container + "-page-heading' class='workplaceadmin-page-heading subtitle active'>Page Settings</div>";
  str += "  <div id='" + this.container + "-page-content' class='workplaceadmin-page-content'>";
  str += "<table class='mljstable'>";
  str += "<tr><td>Page Name:</td><td><input type='text' size='25' id='" + this.container + "-page-name' /></td></tr>";
  str += "<tr><td>URL(s):</td><td><textarea cols='25' rows='4' id='" + this.container + "-page-urls'></textarea></td></tr>";
  str += "<tr><td>Main Layout:</td><td><input type='text' size='25' id='" + this.container + "-page-layout' /></td></tr>"; // TODO replace with drop down
  str += "</table>";
  str += "  </div>";
  
  str += "  <div id='" + this.container + "-widgets-heading' class='workplaceadmin-widgets-heading subtitle active'>Widgets</div>";
  str += "  <div id='" + this.container + "-widgets-content' class='workplaceadmin-widgets-content hidden'>";
  str += "<table class-'mljstable workplaceadmin-widgets-list'>"
  for (var i = 0, col = 0, max = this._config.widgetList.length,w;i < max;i++) {
    w = this._config.widgetList[i];
    
    col = i % 3;
    if (0 == col) {
      str += "<tr>";
    }
    
    str += "<td id='" + this.container + "-widgets-" + i + "'>";
    // TODO replace text with image of widget
    str += "<img src='' alt='" + w.title + "' />";
    str += "</td>";
    
    if (2 == col) {
      str += "</tr>";
    }
  }
  if (col < 2 && i > 0) {
    str += "</tr>";
  }
  str += "</table>";
  str += "  </div>";
  
  str += "  <div id='" + this.container + "-contexts-heading' class='workplaceadmin-contexts-heading subtitle active'>Contexts</div>";
  str += "  <div id='" + this.container + "-contexts-content' class='workplaceadmin-contexts-content hidden'>TODO</div>";
  str += "  <div id='" + this.container + "-actions-heading' class='workplaceadmin-actions-heading subtitle active'>Actions</div>";
  str += "  <div id='" + this.container + "-actions-content' class='workplaceadmin-actions-content hidden'>TODO</div>";
  str += "  <div class='workplaceadmin-buttonbar'>";
  str += "   <input class='btn btn-primary' id='" + this.container + "-save' value='Save' type='submit' />";
  str += "   <input class='btn btn-secondary' id='" + this.container + "-cancel' value='Cancel' type='submit' />";
  str += "  </div>";
  str += " </div>";
  str += " <div id='" + this.container + "-config' class='workplaceadmin-config container_12'>";
  str += " </div>";
  str += "</div>";
  
  document.getElementById(this.container).innerHTML = str;
  
  // TODO event handlers etc.
  // widget drag/drop/click
  var self = this;
  document.getElementById(this.container + "-page-heading").onclick = function(evt) {
    self._showTab("page");
  };
  document.getElementById(this.container + "-widgets-heading").onclick = function(evt) {
    self._showTab("widgets");
  };
  document.getElementById(this.container + "-contexts-heading").onclick = function(evt) {
    self._showTab("contexts");
  };
  document.getElementById(this.container + "-actions-heading").onclick = function(evt) {
    self._showTab("actions");
  };
  
  document.getElementById(this.container + "-cancel").onclick = function(evt) {
    self._workplaceContext.revert();
    self.closePublisher.publish(true);
  };
  document.getElementById(this.container + "-save").onclick = function(evt) {
    self._workplaceContext.save(function(result) {
      // TODO do something like show a save message
    });
  };
};


com.marklogic.widgets.workplaceadmin.prototype._showTab = function(tab) {
  mljs.defaultconnection.logger.debug("workplaceadmin._showTab: Showing " + tab);
  com.marklogic.widgets.hide(document.getElementById(this.container + "-page-content"),("page" != tab));
  com.marklogic.widgets.hide(document.getElementById(this.container + "-widgets-content"),("widgets" != tab));
  com.marklogic.widgets.hide(document.getElementById(this.container + "-contexts-content"),("contexts" != tab));
  com.marklogic.widgets.hide(document.getElementById(this.container + "-actions-content"),("actions" != tab));
};

com.marklogic.widgets.workplaceadmin.prototype.updateWorkplace = function(ctx) {
  // do something with this._workplaceContext.getJson()
  
  // draw layout inside this container
  
  var json = this._workplaceContext.getJson();
  
  // load top level layout for this page (or panel we are managing, at least)
  mljs.defaultconnection.logger.debug("Creating layout");
  this._layout = new (com.marklogic.widgets.layouts[json.layout])(this.container + "-config");
  
  // assign element to layout dynamically
  this._layout.appendToZone("A","<p>Some test HTML</p>");
  this._layout.appendToZone("B","<p>Some other test HTML</p>");
};