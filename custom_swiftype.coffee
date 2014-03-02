customRenderFunction = (document_type, item) ->
  out = "<p class=\"name\">#{item["GivenName"]} #{item["Surname"]}</p>"
  out = out + "<p>#{item["Department Name (EN)"]} #{item["Title (EN)"]}</p>"
  out

# return out.concat('<p class="genre">' + item['Surname'] + '</p>');
customOnComplete = (item, prefix) ->
  d =
     "SV": "#{item["Surname"]}, #{item["GivenName"]}"
     "SF": "Surname, Given Name"
     # "ST": "Exact"
     "ST": "Begins with"
     "x": "1"
     "y": "1"
  window.location = "http://sage-geds.tpsgc-pwgsc.gc.ca/cgi-bin/direct500/eng/SEo%3dGC%2cc%3dCA?" + jQuery.param(d)

  # window.location = "hi" # item["url"]

  # http://sage-geds.tpsgc-pwgsc.gc.ca/cgi-bin/direct500/eng/SEo%3dGC%2cc%3dCA?

  # http://sage-geds.tpsgc-pwgsc.gc.ca/cgi-bin/direct500/eng/SEo%3dGC%2cc%3dCA?SV=deschamps%2C+alice&SF=Surname%2C+Given+Name&ST=Begins+with&x=1&y=1

  # http://sage-geds.tpsgc-pwgsc.gc.ca/cgi-bin/direct500/eng/TE?FN=index.htm

  # SV = deschamps, alice
  # SF = Surname, Given Name
  # ST = Exact
  # x = 1
  # y = 1

  return

$("#st-search-input").swiftype
  renderFunction: customRenderFunction
  onComplete: customOnComplete
  engineKey: "zvZdHsZg6qDzGEunSq45"
  # fetchFields: {"people": ["whatever", "bla"]},
