// Generated by CoffeeScript 1.7.1
(function() {
  var customOnComplete, customRenderFunction;

  customRenderFunction = function(document_type, item) {
    var out;
    out = "<p class=\"name\">" + item["GivenName"] + " " + item["Surname"] + "</p>";
    out = out + ("<p>" + item["Department Name (EN)"] + " " + item["Title (EN)"] + "</p>");
    out = out + ("<p>" + item["Telephone Number"] + "</p>");
    out = out + ("<p>" + item["Email"] + "</p>");
    return out;
  };

  customOnComplete = function(item, prefix) {
    var d;
    d = {
      "SV": "" + item["Surname"] + ", " + item["GivenName"],
      "SF": "Surname, Given Name",
      "ST": "Begins with",
      "x": "1",
      "y": "1"
    };
    window.location = "http://sage-geds.tpsgc-pwgsc.gc.ca/cgi-bin/direct500/eng/SEo%3dGC%2cc%3dCA?" + jQuery.param(d);
  };

  $("#st-search-input").swiftype({
    renderFunction: customRenderFunction,
    onComplete: customOnComplete,
    engineKey: "zvZdHsZg6qDzGEunSq45"
  });

}).call(this);
