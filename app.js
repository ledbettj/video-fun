/* jshint browser:true */

(function() {
  prepareForCrossBrowserBullshit();

  window.filters = {
    inverse: function(imgData) {
      var d = imgData.data;
      var l = d.length;

      for(var i = 0; i < l; i += 4) {
        for(var j = 0; j < 3; ++j) {
          d[i + j] = 255 - d[i + j];
        }
      }

      return imgData;
    },

    blackwhite: function(imgData) {
      var d = imgData.data;
      var l = d.length;
      for(var i = 0; i < l; i += 4) {
        var lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = d[i + 1] = d[i + 2] = lum < 128 ? 0 : 255;
      }

      return imgData;
    },

    obama: function(imgData) {
      var d = imgData.data;
      var l = d.length;
      var c = [
        [29, 82, 97],
        [86, 151, 163],
        [245, 255, 201],
        [161, 30, 34],
        [97, 10, 29]
      ];

      for(var i = 0; i < l; i += 4) {
        var lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        for(var j = 0; j < c.length; ++j) {
          if (lum < 255 / (c.length) * (j+1)) {
            d[i + 0] = c[j][0];
            d[i + 1] = c[j][1];
            d[i + 2] = c[j][2];
            break;
          }
        }
      }
      return imgData;
    },

    grayscale: function(imgData) {
      var d = imgData.data;
      var l = d.length;

      for(var i = 0; i < l; i += 4) {
        var lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = d[i + 1] = d[i + 2] = lum;
      }

      return imgData;
    }
  };

  var App = function(element) {
    this.e = element;
    this.b = document.createElement('canvas');
    this.v = document.createElement('video');
    this.filters = [window.filters.obama];
    this.resize();
  };

  App.prototype.resize = function() {
    this.b.width  = this.v.width  = this.e.width  = this.e.clientWidth;
    this.b.height = this.v.height = this.e.height = this.e.clientHeight;

    this.bctx = this.b.getContext('2d');
    this.ctx  = this.e.getContext('2d');
  };


  App.prototype.run = function() {
    navigator.getUserMedia({video: true}, function(stream) {
      this.v.src = window.URL.createObjectURL(stream);
      this.v.play();
      this.step();
    }.bind(this), function(err) {});

  };

  App.prototype.step = function() {
    try {
      this.bctx.drawImage(this.v, 0, 0);
    } catch(ex) {
      if (ex.name != 'NS_ERROR_NOT_AVAILABLE') {
        throw(ex);
      }
    }

    var data = this.bctx.getImageData(0, 0, this.b.width, this.b.height);

    this.filters.forEach(function(filter) {
      data = filter(data);
    });

    this.ctx.putImageData(data, 0, 0);
    window.requestAnimationFrame(this.step.bind(this));
  };

  App.prototype.snapshot = function() {
    var data = this.e.toDataURL();
    window.open(data);
  };

  window.App = App;



  function prepareForCrossBrowserBullshit() {
    window.requestAnimationFrame = window.requestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      window.msRequestAnimationFrame ||
      window.oRequestAnimationFrame;

    navigator.getUserMedia = navigator.getUserMedia ||
      navigator.mozGetUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.msGetUserMedia ||
      navigator.oGetUserMedia;

    window.URL = window.URL ||
      window.mozURL ||
      window.webkitURL ||
      window.msURL ||
      window.oURL;
  }
})();
