# GEDS Next

Introducing GEDS Next: http://edward.github.io/geds-next/

A GEDS with autocomplete. Just type in something.

Made for https://www.canadianopendataexperience.com/

[![image](https://cloud.githubusercontent.com/assets/325/2732961/8460b178-c640-11e3-9331-afaac0d2c263.png)](https://www.youtube.com/watch?v=AnEnpeJG71o)

## Details

GEDS Next provides a more human way to find contact details for a public servant by adding autocompletion across all ~160 000 records.

This is the current version of the official GEDS app: http://sage-geds.tpsgc-pwgsc.gc.ca/cgi-bin/direct500/eng/TE?FN=index.htm

Note how it feels very awkward and demands you enter fields into a particular order, etc. It feels really constrained.

Try this out: http://edward.github.io/geds-next/

It has the same data as GEDS (actually better and more correct data) and works way faster and in a more human way.


## Difficulties overcome:

The data was dirty; here are all my corrections: https://gist.github.com/edward/9296957
I ended up using Google Refine to find easy typos in location-related fields and made a zillion corrections.

The data was big; jamming ~160 000 records into an autocompletion engine creates a *gigantic* amount of data since you need to stem each string into many more substrings. Since each record has 41 records, you can imagine how much data we’re talking about here.

Matching across this much data requires a ton of computing power and expertise, so I used a hosted solution developed by some friends of mine in SF: Swiftype.

However, Swiftype has no tools that come out of the box to upload the data. I ended up creating my own uploader that transformed the open data CSV into JSON and then used Typhoeus, a multi-threaded HTTP client to push up as much data as my bandwidth would allow.

I ended up correcting some of their open source tools along the way and worked with them to point out that their bulk data transfer APIs didn’t work in certain cases. I was really pushing the limit here.

## Data used
http://data.gc.ca/data/en/dataset/8ec4a9df-b76b-4a67-8f93-cdbc2e040098

Cleaned up version of data available here:
https://www.google.com/fusiontables/DataSource?docid=187bRusBf0k0d8YeIwMIcZgj5RIIIRe9o9uV-tF8
