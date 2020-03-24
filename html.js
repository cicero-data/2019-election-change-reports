    var fs = require('fs');

    function buildHtml(items) {
      var header = '<meta charset="utf-8" />'+
      '<link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous">';
      
      var bootstrap = '<script src="https://code.jquery.com/jquery-3.3.1.slim.min.js" integrity="sha384-q8i/X+965DzO0rT7abK41JStQIAqVgRVzpbzo5smXKp4YfRvH+8abtTE1Pi6jizo" crossorigin="anonymous"></script>'
      + '<script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.7/umd/popper.min.js" integrity="sha384-UO2eT0CpHqdSJQ6hJty5KVphtPhzWj9WO1clHTMGa3JDZwrnQq4sF86dIHNDz0W1" crossorigin="anonymous"></script>'
      + '<script src="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js" integrity="sha384-JjSmVgyd0p3pXB1rRibZUAYoIIy6OrQ6VrjIEaFf/nJGzIxFDsf4x0xIM+B07jRM" crossorigin="anonymous"></script>'


      var n = [];
      var b = [];

      for (var i=0; i<items.length; i++) {
          
          var label = items[i].substr(0, items[i].length-4);

          var bi =  '<div class="row" id="' + label +'">'
                   +'<div class="col-md-8 pb-4">'
                   +'<img class="img-fluid rounded" src="change-reports/'+ items[i] +'">'
                   +'<p><a href="">#Back to Top</a></p>'
                   +'</div>'
                   +'</div>'
          var ni = '<a href="#'+label+'"><li class="nav-item">'+ label +'</li></a>'

          b.push(bi);
          n.push(ni);
      }
      nav = n.join("")
      body = b.join("")


      var html =  '<!DOCTYPE html>'
           +'<html><head>' + header + '</head>'
           +'<body>'
           +'<div class="container-fluid">'
           +'<div class="row">'
           +'<nav class="col-md-3 d-none d-md-block bg-light sidebar">'
           +'<div class="sidebar-sticky">'
           +'<ul class="nav flex-column">' + nav + '</ul>'
           +'</div>'
           +'</nav>'
           +'<main class="col-md-9" role="main">' + body + '</main>'
           +'</div>'
           +'</div>'
           + bootstrap
           +'</body></html>';
      return html

    };

    function getDirectories(path, callback) {
          fs.readdir(path, function (err, content) {
              if (err) return callback(err)
              callback(null, content)
          })
      }


    var fileName = 'index.html';
    var stream = fs.createWriteStream(fileName);

    stream.once('open', function(fd) {
      getDirectories('change-reports/', function (err, content) {
          var html = buildHtml(content)
          stream.end(html);
        }) 
    });