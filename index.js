var fs = require('fs'),
    csv = require('csv-parse'),
    d3 = Object.assign({}, require("d3-geo"), require("d3-geo-projection"), require('d3-scale'), require('d3-color')),
    YAML = require('yamljs');

const { createCanvas, loadImage } = require('canvas')
const { Image } = require('canvas')

// Load configuration
var config = YAML.load('config.yml');

// Print some helpful information to console
process.stdout.write(
  '===============================\n' +
  'Election Change Reports\n' +
  '===============================\n' +
  'Change Statistics: ' + config.changefilename + '\n' +
  'Local centroids: ' + config.localcentgeojson + '\n\n' +
  'State boundaries: ' + config.statepolygeojson + '\n\n' +
  'Infographics being added to `' + config.outputDirectory + '`\n\n'
);


// A collection of districts
class Chamber {
  constructor(name, abbreviation, geometry, data) {
    this.name = name;
    this.abbreviation = abbreviation;
    this.geometry = geometry;
    //this.point = point;
    this.stats = data;
  }

}

// Party: one of two political parties in the election
class Party {
  constructor(name, color) {
    this.name = name;
    this.color = color;
  }
}

// Election Results: the results for a set of Chambers from an election between a left-Party and a right-Party
class ElectionResults {
  constructor(leftParty, rightParty, Chambers) {
    this.parties = { left: leftParty, right: rightParty };
    this.Chambers = Chambers;
  }
}

// ChangeReport: the report for a set of Chambers from an election between a left-Party and a right-Party
class ChangeReport {
  constructor(leftParty, rightParty, otherParty, Chambers) {
    this.parties = { left: leftParty, right: rightParty, other: otherParty };
    this.Chambers = Chambers;
  }
}


// Empty arrays for recording Chambers
var collectedLocalChambers = [],
    collectedChambers = [];

// Load CSV and GeoJSON file
var csvData = fs.readFileSync(config.changefilename, 'utf8');
var geojsonLocalCent = JSON.parse(fs.readFileSync(config.localcentgeojson, 'utf8'));
var geojsonStatePoly = JSON.parse(fs.readFileSync(config.statepolygeojson, 'utf8'));



// Reformat CSV results and GeoJSON boundaries to an Election Results
csv(csvData, { columns: true }, function(err,data) {

  data.map(function(d) {

    //var ChamberIdentifier = d[config.ChamberIdentifier]
    var ChamberStateId = d['state']
    var ChamberIdentifier = d['id']


      //state gets state, city with poly gets city, city without poly gets state poly and city centroid 
      var chamberGeometry = geojsonStatePoly.features.find(function(f) {
        return f.properties['STUSPS'] === ChamberStateId;
      });

      var ChamberName = d['name_formal'];      

      if (d['level'] === 'administrativeArea1') {
        collectedChambers.push(new Chamber(ChamberName, ChamberIdentifier, chamberGeometry, d, []))
      } else {
        collectedLocalChambers.push(new Chamber(ChamberName, ChamberIdentifier, chamberGeometry, d, []))
      }

  });

  var dataLeftParty = new Party(config.partyLeftName, '#45bae8');
  var dataRightParty = new Party(config.partyRightName, '#ff595f');
  var dataOtherParty = new Party(config.partyOtherName, '#d3d3d3');

  var results = new ChangeReport(dataLeftParty, dataRightParty, dataOtherParty, collectedChambers);
  // Generate infographics
  report(results);

  var localResults = new ChangeReport(dataLeftParty, dataRightParty, dataOtherParty, collectedLocalChambers);

  // Generate infographics
  reportLocal(localResults);
});

// A function that generates infographics from an Election Results object - local chambers within a state

function reportLocal(election) {
  const state_map = election.Chambers.map(x => x.stats['state'] );
  const state_set = new Set( state_map );
  const state_set_arr = Array.from( state_set );
  state_set_arr.map( s => {
    const state_geometry = geojsonStatePoly.features.find(function(f) {
        return f.properties['STUSPS'] === s;
      });

    const election_subset = election.Chambers.filter( c => c.stats['state'] === s );

    // get points
    const e_sub_names = election_subset.map(x => ({ name: x.stats.name_formal, state: x.stats.state}) )
    var local_centroids = []
    e_sub_names.map(x => {
      var chamberPoint = geojsonLocalCent.features.find(function(f) {
        return x.name.includes( f.properties.city ) && x.state === f.properties.state ;
      });
      local_centroids.push(chamberPoint)
    })

    //sort chambers alphabetically on card
    const sort_election_subset = election_subset.sort(function(a, b) {
      var textA = a.name.toUpperCase();
      var textB = b.name.toUpperCase();
      return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
    });

    var smallHeight = 630,
        mediumHeight = 1260,
        largeHeight = 1890;

    var flexHeight = election_subset.length > 7 ? election_subset.length > 17 ? largeHeight : mediumHeight : smallHeight ;

    // Canvas dimensions
    var width = 1200,
        height = flexHeight,
        leftMargin = 60;

    // A new Canvas object to draw on
    var canvas = createCanvas(width, height),
        context = canvas.getContext("2d");

    // Design Parameters //

    // Layout
    var grid = Math.floor(height / 10);

    // Style
    var background = '#292d39',
        ptbackground = '#bfff80',
        titleFont = 'bold 42px Helvetica',
        subtitleFont = '34px Helvetica',
        sentenceFill = '#fff',
        sentenceFont = '28px Helvetica',
        sentenceBoldFont = 'bold 28px Helvetica',
        annotationFont = 'bold 14px Helvetica',
        socialFont = '10px Helvetica',
        socialFill = '#eee',
        annotationMargin = 5,
        disclaimerFont = '15px Helvetica',
        districtStroke = '#fff',
        annotationColor = '#ccc';
        seats_color = '#c6e2ff'; //light blue
        new_seats_color = '#ff8000'; //orange

    // Bar Graph
    var graphWidth = width / 1.4 - leftMargin,
        graphHeight = height / 1.8; //360,
        graphOriginX = leftMargin,
        graphOriginY = 170,
        rectangleHeight = 12;

    // Map
    var mapWidth = width * 0.30,
        mapHeight = smallHeight - Math.round(grid * 1.5);

    // Background
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Custom map projection for each Chamber
    var projection = d3.geoAlbers();
    var path = d3.geoPath()
        .projection(projection);

    var b = path.bounds(state_geometry),
      centroid = d3.geoCentroid(state_geometry),
      pOffset = b[1][1] - b[0][1] * 0.3;

    projection
        .rotate([-1 * centroid[0]])
        .scale(1)
        .translate([0, 0]);

    bounds = path.bounds(state_geometry);

    var scale = 0.9 / Math.max((bounds[1][0] - bounds[0][0]) / mapWidth, (bounds[1][1] - bounds[0][1]) / mapHeight),
        translate = [(mapWidth - scale * (bounds[1][0] + bounds[0][0])) / 2 + (width - mapWidth), grid * 1.5 + (mapHeight - scale * (bounds[1][1] + bounds[0][1])) / 2];

    projection
        .scale(scale)
        .translate(translate);

    // Draw districts shadow
    context.fillStyle = d3.color(background).darker(1).toString();
    context.beginPath();
    path.context(context)(state_geometry);
    context.fill();


    // Draw districts
    translate[0] -= 6;
    translate[1] -= 6;

    projection.translate(translate);

    // Draw districts
    context.strokeStyle = districtStroke;
    context.fillStyle = background;//d3.color(background).brighter(1).toString();
    context.beginPath();
    path.context(context)(state_geometry);
    context.fill();
    context.stroke();

    local_centroids.map(point => {

      // Draw point
      context.strokeStyle = districtStroke;
      context.fillStyle = ptbackground;//d3.color(background).brighter(1).toString();
      context.beginPath();
      path.context(context)(point);
      context.fill();
      context.stroke();

    })

    // Title Box
    context.fillStyle = '#000';
    context.globalAlpha = 0.35;
    context.fillRect(0, 0, width, 80);
    context.globalAlpha = 1.0;

    context.fillStyle = sentenceFill;

    // Title
    var titleText = state_geometry.properties.NAME;
    context.font = titleFont;
    context.fillText(titleText, leftMargin, 56);
    var titleWidth = context.measureText(titleText).width;

    // Subtitle
    var subtitleText = 'March 2020';
    context.font = subtitleFont;
    context.textAlign = 'end';
    context.globalAlpha = 0.35;
    context.fillText(subtitleText, width - leftMargin, 52 );
    context.textAlign = 'start';
    context.globalAlpha = 1.0;

    // A Sentence class with methods for writing text
    class Sentence {
      constructor(initialX, initialY, initialFont, highlightColor, newlineGap) {
        this.xPosition = initialX;
        this.xBaseline = initialX;
        this.yPosition = initialY;
        this.style = initialFont;
        this.highlightColor = highlightColor;
        this.newlineGap = newlineGap;
      }

      // Write: a method to incrementally write a sentence onto the Canvas
      write(text, style, highlight, newline) {
        if (style) { this.style = style; }
        context.font = this.style;
        if (newline) {
          this.yPosition += this.newlineGap;
          this.xPosition = this.xBaseline;
        }
        if (highlight) {
          var textFill = context.fillStyle;
          context.fillStyle = this.highlightColor;
          context.globalAlpha = 0.35;
          context.fillRect(this.xPosition - 5, this.yPosition - 24, context.measureText(text).width + 10, 34);
          context.fillStyle = textFill;
          context.globalAlpha = 1.0;
        }

        context.fillText(text, this.xPosition, this.yPosition);

        this.xPosition += context.measureText(text).width;
      }
    }

    // State introduction sentence
    var mainStateSentenceContent = [
      // First Line
      { t: ( election_subset.length ), s: sentenceBoldFont, h: true, n: false },
      { t: ( sort_election_subset.length == 1 ?' chamber in a large locality in ' :  ' chambers in large localities in ' )   , s: sentenceBoldFont, h: false, n: false},
      { t: (state_geometry.properties.NAME  ) , s: sentenceBoldFont, h: true, n: false},
      { t: ' held elections in 2019.', s: sentenceBoldFont, h: false, n: false }
    ];

    // Write the new officials sentence
    var mainSentence = new Sentence(leftMargin, 120, sentenceFont, '#bfff80'  , 34);

    mainStateSentenceContent.map(function(phrase) {
        mainSentence.write(phrase.t, phrase.s, phrase.h, phrase.n);
      });

    const max_seats_in_state = Math.max.apply(Math, election_subset.map( o => o.stats.official_count ));

    voteScale = d3.scaleLinear()
        .domain([0, max_seats_in_state ])
        .range([0, graphWidth/2]);

    var redLocales = config.redistrictedChambers; 

    sort_election_subset.map( (e, idx) => {

      var rectangleBaseline =  {
        l1: Math.floor(graphOriginY + idx * 58  ),
        l2: Math.floor(graphOriginY + graphHeight * ( (idx * 2 )  / (election_subset.length * 2) ) + annotationMargin )
      }

      var members_info = [ parseInt(e.stats.official_count) , parseInt(e.stats.retu_tot ) ]

      context.font = annotationFont;

      var chamber_summary_text = (members_info[0] == 1) ? ((members_info[1] == 1) ? 
        'The ' + e.name + ' returned to office' :
        'The ' + e.name + ' is new to office') : 
        'In the ' + e.name + ', ' + 
        ( (redLocales.indexOf( e.abbreviation ) > -1) ?
          'all ' + members_info[0] + ' members are serving in new districts following redistricting ' :
          (members_info[0] - members_info[1]) + ' out of ' + members_info[0] + ' officials are new to office '
          )
        

      // Draw rectangles for votes in current session
      context.textAlign = 'start';
      context.fillStyle = election.parties.other.color;
      context.fillText( chamber_summary_text, graphOriginX, rectangleBaseline.l1 - annotationMargin  );

      if (members_info[0] >= 0) {
        // seats 
        //// shadow
        context.fillStyle = d3.color(seats_color).darker(1).toString();
        context.fillRect(graphOriginX , rectangleBaseline.l1, voteScale(members_info[0] - members_info[1]) , rectangleHeight);
        //// highlight
        context.fillStyle = d3.color(seats_color).brighter(1).toString();
        context.fillRect(graphOriginX , rectangleBaseline.l1, voteScale(members_info[0] - members_info[1]) , rectangleHeight);
        //// fill
        context.fillStyle = new_seats_color;
        context.fillRect(graphOriginX , rectangleBaseline.l1, voteScale(members_info[0] - members_info[1]) , rectangleHeight);

        //context.fillText( members_info[0] + ' seats' , graphOriginX, rectangleBaseline.l1 - annotationMargin);

      }

      if (members_info[1] >= 0) {
        // new officials
        //// shadow
        context.fillStyle = d3.color( new_seats_color ).darker(1).toString();
        context.fillRect(graphOriginX + voteScale(members_info[0] - members_info[1]) , rectangleBaseline.l1, voteScale(members_info[1]) , rectangleHeight);    //// highlight
        //// highlight
        context.fillStyle = d3.color( new_seats_color ).brighter(1).toString();
        context.fillRect(graphOriginX + voteScale(members_info[0] - members_info[1]) , rectangleBaseline.l1, voteScale(members_info[1]) , rectangleHeight);    //// fill
        //// fill
        context.fillStyle = seats_color;
        context.fillRect(graphOriginX + voteScale(members_info[0] - members_info[1]) , rectangleBaseline.l1, voteScale(members_info[1]) , rectangleHeight);

      }

      context.fillStyle = socialFill;
      context.font = socialFont;

      
      var mediaStatsArr =  [
          { id: 'emai', pct: Math.round((e.stats.emai_tot / e.stats.official_count) * 100), l: 'Email', p: 'images/email.svg'},
          { id: 'webf', pct: Math.round((e.stats.wfor_tot / e.stats.official_count) * 100), l: 'Webform', p: 'images/webform.svg'}, 
          { id: 'twit', pct: Math.round((e.stats.ytwi_tot / e.stats.official_count) * 100), l: 'Twitter', p: 'images/twitter.svg'},
          { id: 'fcbk', pct: Math.round((e.stats.yfcb_tot / e.stats.official_count) * 100), l: 'Facebook', p: 'images/facebook.svg'},
          { id: 'inst', pct: Math.round((e.stats.yins_tot / e.stats.official_count) * 100), l: 'Instagram', p: 'images/instagram.svg'},
          { id: 'lkni', pct: Math.round((e.stats.ylkn_tot / e.stats.official_count) * 100), l: 'LinkedIn', p: 'images/linkedin.svg'}
      ]

      mediaStatsArr.map( (m,m_index) => {
        if ( members_info[0] == 1 && m.pct < 20) {

        } else {
          context.textAlign = 'start';
          if (m.pct > 20) { 
          context.fillText( ( members_info[0] == 1 ? 'has ' + m.l  : m.l + ' ' +  m.pct + '%') , 
            graphOriginX + graphWidth * .8 * (m_index/6) + 20, rectangleBaseline.l1 + 30 );
          } else {
          context.fillText( m.l + ' <20%', 
            graphOriginX + graphWidth * .8 * (m_index/6) + 20, rectangleBaseline.l1 + 30 );
          }
          context.textAlign = 'end';

          var em_logo = fs.readFileSync(m.p);
          const em_image = new Image()
          em_image.src = em_logo;
          context.globalAlpha = 0.6;
          context.drawImage(em_image, graphOriginX + graphWidth * .8 * (m_index/6), rectangleBaseline.l1 + 15 , 15,15);
          context.globalAlpha = 1.0;
        }
      } )
    } )

    // Azavea Logo    
    var logo = fs.readFileSync('images/cicero_light_sm.png');
    const image = new Image()
    image.src = logo;
    context.globalAlpha = 0.6;
    context.drawImage(image, leftMargin, height - leftMargin * 1.1);
    context.globalAlpha = 1.0;

    // Subtitle
    var subtitleText = 'www.cicerodata.com';
    context.font = subtitleFont;
    context.textAlign = 'end';
    context.globalAlpha = 0.35;
    context.fillText(subtitleText, 600 , height - 40 );
    context.textAlign = 'start';
    context.globalAlpha = 1.0;

    process.stdout.write(state_geometry.properties.NAME + '\n');

    // Save image to the output directory
    canvas.pngStream().pipe(fs.createWriteStream(config.outputDirectory + '/' + state_geometry.properties.NAME + " Localities.png"));

  } )

}

// A function that generates infographics from an Election Results object - partisan state chambers
function report(election) {

  // Generate a report for each Chamber
  for (var i = 0; i < election.Chambers.length; i++) {
    var Chamber = election.Chambers[i];
    var geometry = Chamber.geometry;
    var point = Chamber.point;

    // Canvas dimensions
    var width = 1200,
        height = 630,
        leftMargin = 60;

    // A new Canvas object to draw on
    var canvas = createCanvas(width, height),
        context = canvas.getContext("2d");


    // Design Parameters //

    // Layout
    var grid = Math.floor(height / 10);

    // Style
    var background = '#292d39',
        ptbackground = '#bfff80',
        titleFont = 'bold 42px Helvetica',
        subtitleFont = '34px Helvetica',
        sentenceFill = '#fff',
        sentenceFont = '24px Helvetica',
        sentenceBoldFont = 'bold 24px Helvetica',
        annotationFont = 'bold 20px Helvetica',
        annotationMargin = 10,
        disclaimerFont = '15px Helvetica',
        districtStroke = '#fff',
        annotationColor = '#ccc';

    // Bar Graph
    var graphWidth = width / 2 - leftMargin,
        graphHeight = 360,
        graphOriginX = leftMargin,
        graphOriginY = Math.floor(grid * 3.5),
        rectangleHeight = Math.round(graphHeight * 0.10);

    // Map
    var mapWidth = width * 0.44,
        mapHeight = height - Math.round(grid * 1.5);

    // Background
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Custom map projection for each Chamber
    var projection = d3.geoAlbers();
    var path = d3.geoPath()
        .projection(projection);

    var b = path.bounds(geometry),
      centroid = d3.geoCentroid(geometry),
      pOffset = b[1][1] - b[0][1] * 0.3;

    projection
        .rotate([-1 * centroid[0]])
        .scale(1)
        .translate([0, 0]);

    bounds = path.bounds(geometry);

    var scale = 0.9 / Math.max((bounds[1][0] - bounds[0][0]) / mapWidth, (bounds[1][1] - bounds[0][1]) / mapHeight),
        translate = [(mapWidth - scale * (bounds[1][0] + bounds[0][0])) / 2 + (width - mapWidth), grid * 1.5 + (mapHeight - scale * (bounds[1][1] + bounds[0][1])) / 2];

    projection
        .scale(scale)
        .translate(translate);

    // Draw districts shadow
    context.fillStyle = d3.color(background).darker(1).toString();
    context.beginPath();
    path.context(context)(geometry);
    context.fill();


    // Draw districts
    translate[0] -= 6;
    translate[1] -= 6;

    projection.translate(translate);

    // Draw districts
    context.strokeStyle = districtStroke;
    context.fillStyle = background;//d3.color(background).brighter(1).toString();
    context.beginPath();
    path.context(context)(geometry);
    context.fill();
    context.stroke();

    // Draw point
    context.strokeStyle = districtStroke;
    context.fillStyle = ptbackground;//d3.color(background).brighter(1).toString();
    context.beginPath();
    path.context(context)(point);
    context.fill();
    context.stroke();

    // Title Box
    context.fillStyle = '#000';
    context.globalAlpha = 0.35;
    context.fillRect(0, 0, width, Math.round(grid * 1.5));
    context.globalAlpha = 1.0;

    context.fillStyle = sentenceFill;

    // Title
    var titleText = Chamber.name;
    context.font = titleFont;
    context.fillText(titleText, leftMargin, grid);
    var titleWidth = context.measureText(titleText).width;

    // Subtitle
    var subtitleText = 'March 2020';
    context.font = subtitleFont;
    context.textAlign = 'end';
    context.globalAlpha = 0.35;
    context.fillText(subtitleText, width - leftMargin, grid);
    context.textAlign = 'start';
    context.globalAlpha = 1.0;

    // A Sentence class with methods for writing text
    class Sentence {
      constructor(initialX, initialY, initialFont, highlightColor, newlineGap) {
        this.xPosition = initialX;
        this.xBaseline = initialX;
        this.yPosition = initialY;
        this.style = initialFont;
        this.highlightColor = highlightColor;
        this.newlineGap = newlineGap;
      }

      // Write: a method to incrementally write a sentence onto the Canvas
      write(text, style, highlight, newline) {
        if (style) { this.style = style; }
        context.font = this.style;
        if (newline) {
          this.yPosition += this.newlineGap;
          this.xPosition = this.xBaseline;
        }
        if (highlight) {
          var textFill = context.fillStyle;
          context.fillStyle = this.highlightColor;
          context.globalAlpha = 0.35;
          context.fillRect(this.xPosition - 5, this.yPosition - 24, context.measureText(text).width + 10, 34);
          context.fillStyle = textFill;
          context.globalAlpha = 1.0;
        }

        context.fillText(text, this.xPosition, this.yPosition);

        this.xPosition += context.measureText(text).width;
      }
    }

    // New Officials Sentence
    var mainSentenceContent = [
      // First Line
      { t: (Chamber.stats.official_count - Chamber.stats.retu_tot ), s: sentenceBoldFont, h: true, n: false },
      { t: ' out of ' , s: sentenceBoldFont, h: false, n: false},
      { t: (Chamber.stats.official_count) , s: sentenceBoldFont, h: true, n: false},
      { t: ' members of the ', s: sentenceBoldFont, h: false, n: false },
      { t: Chamber.name, s: sentenceBoldFont, h: true, n: true },
      { t: 'are new to office after the Nov 5, 2019 elections.', s: sentenceBoldFont, h: false, n: true },
    ];

    // Alternatve sentence if state had redistricting
    var redistrictedSentenceContent = [
      // First Line
      { t: 'Following redistricting, the ' , s: sentenceBoldFont, h: false, n: false},
      { t: (Chamber.stats.official_count) , s: sentenceBoldFont, h: true, n: false},
      { t: ' members of the ', s: sentenceBoldFont, h: false, n: false },
      { t: Chamber.name, s: sentenceBoldFont, h: true, n: true },
      { t: 'are serving in new districts after the Nov 5, 2019 elections.', s: sentenceBoldFont, h: false, n: true },
    ];

    // Write the new officials sentence
    var mainSentence = new Sentence(leftMargin, Math.ceil(grid * 2.375), sentenceFont, '#bfff80'  , 34);
    
    var redistrictedLocales = config.redistrictedChambers;

    if (redistrictedLocales.indexOf( Chamber.abbreviation ) > -1) {
      redistrictedSentenceContent.map(function(phrase) {
        mainSentence.write(phrase.t, phrase.s, phrase.h, phrase.n);
      });
    } else {
      mainSentenceContent.map(function(phrase) {
        mainSentence.write(phrase.t, phrase.s, phrase.h, phrase.n);
      });
    }


    // Bar graph
    var rectangleBaseline =  {
        c_ch_l: Math.floor(graphOriginY + graphHeight * (2/16) ),
        c_ch_b: Math.floor(graphOriginY + graphHeight * (3/16)),
        o_ch_l: Math.floor(graphOriginY + graphHeight * (5.9/16)),
        o_ch_b: Math.floor(graphOriginY + graphHeight * (6.9/16)),
        sm_l: Math.floor(graphOriginY + graphHeight * (10.4/16)),
        sm_t: Math.floor(graphOriginY + graphHeight * (11.9/16)),
        sm_b: Math.floor(graphOriginY + graphHeight * (13.6/16)),
        sm_3: Math.floor(graphOriginY + graphHeight * (15.3/16))
    }


    var cvotes = [ parseInt(Chamber.stats.cdem_tot) , parseInt(Chamber.stats.crep_tot), 
            parseInt(Chamber.stats.official_count)]
    var ovotes = [ parseInt(Chamber.stats.odem_tot) , parseInt(Chamber.stats.orep_tot),
            parseInt(Chamber.stats.official_count)]


    voteScale = d3.scaleLinear()
      .domain([0, Chamber.stats.official_count ])
      .range([0, graphWidth]);

    context.font = annotationFont;

    //// Draw rectangles for votes in current session
    context.fillStyle = election.parties.other.color;
    context.fillText('Current Legislative Term', graphOriginX, rectangleBaseline.c_ch_l - annotationMargin);

    if (cvotes[0] >= 1) {
      // Left Party
      //// shadow
      context.fillStyle = d3.color(election.parties.left.color).darker(1).toString();
      context.fillRect(graphOriginX + 1, rectangleBaseline.c_ch_b, voteScale(cvotes[0]) - 4, rectangleHeight);
      //// highlight
      context.fillStyle = d3.color(election.parties.left.color).brighter(1).toString();
      context.fillRect(graphOriginX + 3, rectangleBaseline.c_ch_b, voteScale(cvotes[0]) - 4, rectangleHeight);
      //// fill
      context.fillStyle = election.parties.left.color;
      context.fillRect(graphOriginX + 2, rectangleBaseline.c_ch_b, voteScale(cvotes[0]) - 4, rectangleHeight);

      context.fillText( cvotes[0] + ' ' + election.parties.left.name
          , graphOriginX, rectangleBaseline.c_ch_b - annotationMargin);

    }

    if (cvotes[1] >= 1) {
      // Right Party
      //// shadow
      context.fillStyle = d3.color(election.parties.right.color).darker(1).toString();
      context.fillRect(graphOriginX + voteScale(cvotes[0]) + 2, rectangleBaseline.c_ch_b, voteScale(cvotes[1]) - 4, rectangleHeight);    //// highlight
      //// highlight
      context.fillStyle = d3.color(election.parties.right.color).brighter(1).toString();
      context.fillRect(graphOriginX + voteScale(cvotes[0]) + 4, rectangleBaseline.c_ch_b, voteScale(cvotes[1]) - 4, rectangleHeight);    //// fill
      //// fill
      context.fillStyle = election.parties.right.color;
      context.fillRect(graphOriginX + voteScale(cvotes[0]) + 3, rectangleBaseline.c_ch_b, voteScale(cvotes[1]) - 4, rectangleHeight);

      context.textAlign = 'end';
      context.fillText( cvotes[1] +' '+ election.parties.right.name  
        , graphOriginX + voteScale(cvotes[0]) + voteScale(cvotes[1]), rectangleBaseline.c_ch_b - annotationMargin);
      context.textAlign = 'start';
    }

    if ( (cvotes[2] - (cvotes[0] + cvotes[1]) ) >= 1) {
      // Other Party
      //// shadow
      context.fillStyle = d3.color(election.parties.other.color).darker(1).toString();
      context.fillRect(graphOriginX + voteScale(cvotes[0]) + voteScale(cvotes[1]) + 2, rectangleBaseline.c_ch_b, voteScale(cvotes[2] - (cvotes[0] + cvotes[1])) - 4, rectangleHeight);
      //// highlight
      context.fillStyle = d3.color(election.parties.other.color).brighter(1).toString();
      context.fillRect(graphOriginX + voteScale(cvotes[0]) + voteScale(cvotes[1]) + 4, rectangleBaseline.c_ch_b, voteScale(cvotes[2] - (cvotes[0] + cvotes[1])) - 4, rectangleHeight);
      //// fill
      context.fillStyle = election.parties.other.color;
      context.fillRect(graphOriginX + voteScale(cvotes[0]) + voteScale(cvotes[1]) + 3, rectangleBaseline.c_ch_b, voteScale(cvotes[2] - (cvotes[0] + cvotes[1])) - 4, rectangleHeight);
    }

    //// Draw rectangles for votes in previous session
    context.fillStyle = election.parties.other.color;
    context.fillText('Previous Legislative Term', graphOriginX, rectangleBaseline.o_ch_l - annotationMargin);

    if (ovotes[0] >= 1) {
      // Left Party
      //// shadow
      context.fillStyle = d3.color(election.parties.left.color).darker(1).toString();
      context.fillRect(graphOriginX + 1, rectangleBaseline.o_ch_b, voteScale(ovotes[0]) - 4, rectangleHeight);
      //// highlight
      context.fillStyle = d3.color(election.parties.left.color).brighter(1).toString();
      context.fillRect(graphOriginX + 3, rectangleBaseline.o_ch_b, voteScale(ovotes[0]) - 4, rectangleHeight);
      //// fill
      context.fillStyle = election.parties.left.color;
      context.fillRect(graphOriginX + 2, rectangleBaseline.o_ch_b, voteScale(ovotes[0]) - 4, rectangleHeight);

      context.fillText( ovotes[0] + ' ' + election.parties.left.name
         , graphOriginX, rectangleBaseline.o_ch_b - annotationMargin);

    }

    if (ovotes[1] >= 1) {
      // Right Party
      //// shadow
      context.fillStyle = d3.color(election.parties.right.color).darker(1).toString();
      context.fillRect(graphOriginX + voteScale(ovotes[0]) + 2, rectangleBaseline.o_ch_b, voteScale(ovotes[1]) - 4, rectangleHeight);    //// highlight
      //// highlight
      context.fillStyle = d3.color(election.parties.right.color).brighter(1).toString();
      context.fillRect(graphOriginX + voteScale(ovotes[0]) + 4, rectangleBaseline.o_ch_b, voteScale(ovotes[1]) - 4, rectangleHeight);    //// fill
      //// fill
      context.fillStyle = election.parties.right.color;
      context.fillRect(graphOriginX + voteScale(ovotes[0]) + 3, rectangleBaseline.o_ch_b, voteScale(ovotes[1]) - 4, rectangleHeight);

      context.textAlign = 'end';
      context.fillText( ovotes[1] + ' ' + election.parties.right.name 
        , graphOriginX + voteScale(ovotes[0]) + voteScale(ovotes[1]), rectangleBaseline.o_ch_b - annotationMargin);
      context.textAlign = 'start';
    }

    if ( (ovotes[2] - (ovotes[0] + ovotes[1]) )  >= 1) {
      // Other Party
      //// shadow
      context.fillStyle = d3.color(election.parties.other.color).darker(1).toString();
      context.fillRect(graphOriginX + voteScale(ovotes[0]) + voteScale(ovotes[1]) + 2, rectangleBaseline.o_ch_b, voteScale(ovotes[2] - (ovotes[0] + ovotes[1])) - 4, rectangleHeight);
      //// highlight
      context.fillStyle = d3.color(election.parties.other.color).brighter(1).toString();
      context.fillRect(graphOriginX + voteScale(ovotes[0]) + voteScale(ovotes[1]) + 4, rectangleBaseline.o_ch_b, voteScale(ovotes[2] - (ovotes[0] + ovotes[1])) - 4, rectangleHeight);
      //// fill
      context.fillStyle = election.parties.other.color;
      context.fillRect(graphOriginX + voteScale(ovotes[0]) + voteScale(ovotes[1]) + 3, rectangleBaseline.o_ch_b, voteScale(ovotes[2] - (ovotes[0] + ovotes[1])) - 4, rectangleHeight);
    }

    context.fillStyle = election.parties.other.color;
    context.fillText('Contact Information Available', graphOriginX, rectangleBaseline.sm_l - annotationMargin);

    context.fillStyle = ptbackground;
    var mediaStats =  {
        emai: Math.round((Chamber.stats.emai_tot / Chamber.stats.official_count) * 100),
        webf: Math.round((Chamber.stats.wfor_tot / Chamber.stats.official_count) * 100),
        twit: Math.round((Chamber.stats.ytwi_tot / Chamber.stats.official_count) * 100),
        fcbk: Math.round((Chamber.stats.yfcb_tot / Chamber.stats.official_count) * 100),
        inst: Math.round((Chamber.stats.yins_tot / Chamber.stats.official_count) * 100),
        lkni: Math.round((Chamber.stats.ylkn_tot / Chamber.stats.official_count) * 100)
    }

    
      context.textAlign = 'start';
      if (mediaStats.emai > 20) { 
      context.fillText( 'Email ' + mediaStats.emai + '%', 
        graphOriginX + 60, rectangleBaseline.sm_t - annotationMargin);
      } else {
      context.fillText( 'Email <20%', 
        graphOriginX + 60, rectangleBaseline.sm_t - annotationMargin);
      }
      context.textAlign = 'end';

      var em_logo = fs.readFileSync('images/email.svg');
      const em_image = new Image()
      em_image.src = em_logo;
      context.globalAlpha = 0.6;
      context.drawImage(em_image, graphOriginX, rectangleBaseline.sm_t - annotationMargin - 30, 40,40);
      context.globalAlpha = 1.0;

    
      context.textAlign = 'start';
      if (mediaStats.webf > 20) { 
      context.fillText('Webform ' + mediaStats.webf + '%', 
        graphOriginX + graphWidth * (1/2) + 60, rectangleBaseline.sm_t - annotationMargin);
      } else {
        context.fillText('Webform <20%', 
        graphOriginX + graphWidth * (1/2) + 60, rectangleBaseline.sm_t - annotationMargin);
      }
      context.textAlign = 'end';

      var wf_logo = fs.readFileSync('images/webform.svg');
      const wf_image = new Image()
      wf_image.src = wf_logo;
      context.globalAlpha = 0.6;
      context.drawImage(wf_image, graphOriginX + graphWidth * (1/2) , rectangleBaseline.sm_t - annotationMargin - 30, 40,40);
      context.globalAlpha = 1.0;

    
      context.textAlign = 'start';
      if (mediaStats.fcbk > 20) { 
      context.fillText('Facebook '+ mediaStats.fcbk + '%', 
        graphOriginX + 60, rectangleBaseline.sm_b - annotationMargin);
      } else {
      context.fillText('Facebook <20%', 
        graphOriginX + 60, rectangleBaseline.sm_b - annotationMargin);
      }
      context.textAlign = 'end';

      var fb_logo = fs.readFileSync('images/facebook.svg');
      const fb_image = new Image()
      fb_image.src = fb_logo;
      context.globalAlpha = 0.6;
      context.drawImage(fb_image, graphOriginX, rectangleBaseline.sm_b - annotationMargin - 30, 40,40);
      context.globalAlpha = 1.0;

    
      context.textAlign = 'start';
      if (mediaStats.twit > 20) { 
      context.fillText('Twitter '+ mediaStats.twit + '%', 
        graphOriginX + graphWidth * (1/2) + 60 , rectangleBaseline.sm_b - annotationMargin);
      } else {
        context.fillText('Twitter <20%', 
        graphOriginX + graphWidth * (1/2) + 60 , rectangleBaseline.sm_b - annotationMargin);
      }
      context.textAlign = 'end';

      var tw_logo = fs.readFileSync('images/twitter.svg');
      const tw_image = new Image()
      tw_image.src = tw_logo;
      context.globalAlpha = 0.6;
      context.drawImage(tw_image, graphOriginX + graphWidth * (1/2), rectangleBaseline.sm_b - annotationMargin -30 , 40,40);
      context.globalAlpha = 1.0;


      context.textAlign = 'start';
      if (mediaStats.inst > 20) { 
      context.fillText('Instagram '+ mediaStats.inst + '%', 
        graphOriginX + 60, rectangleBaseline.sm_3 - annotationMargin);
      } else {
      context.fillText('Instagram <20%', 
        graphOriginX + 60, rectangleBaseline.sm_3 - annotationMargin);
      }
      context.textAlign = 'end';

      var ig_logo = fs.readFileSync('images/instagram.svg');
      const ig_image = new Image()
      ig_image.src = ig_logo;
      context.globalAlpha = 0.6;
      context.drawImage(ig_image, graphOriginX, rectangleBaseline.sm_3 - annotationMargin - 30, 40,40);
      context.globalAlpha = 1.0;

    
      context.textAlign = 'start';
      if (mediaStats.twit > 20) { 
      context.fillText('LinkedIn '+ mediaStats.lkni + '%', 
        graphOriginX + graphWidth * (1/2) + 60 , rectangleBaseline.sm_3 - annotationMargin);
      } else {
        context.fillText('LinkedIn <20%', 
        graphOriginX + graphWidth * (1/2) + 60 , rectangleBaseline.sm_3 - annotationMargin);
      }
      context.textAlign = 'end';

      var li_logo = fs.readFileSync('images/linkedin.svg');
      const li_image = new Image()
      li_image.src = li_logo;
      context.globalAlpha = 0.6;
      context.drawImage(li_image, graphOriginX + graphWidth * (1/2), rectangleBaseline.sm_3 - annotationMargin -30 , 40,40);
      context.globalAlpha = 1.0;

    // Azavea Logo    
    var logo = fs.readFileSync('images/cicero_light_sm.png');
    const image = new Image()
    image.src = logo;
    context.globalAlpha = 0.6;
    context.drawImage(image, leftMargin, height - leftMargin * 1.1);
    context.globalAlpha = 1.0;

    // Subtitle
    var subtitleText = 'www.cicerodata.com';
    context.font = subtitleFont;
    context.textAlign = 'end';
    context.globalAlpha = 0.35;
    context.fillText(subtitleText, 600 , height - 40 );
    context.textAlign = 'start';
    context.globalAlpha = 1.0;

    process.stdout.write(Chamber.name  + '\n');

    // Save image to the output directory
    canvas.pngStream().pipe(fs.createWriteStream(config.outputDirectory + '/' + Chamber.name + ".png"));

  }
}
