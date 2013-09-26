/* jshint browser:true */
/* global angular */

angular.module('videoFun', [])
  .factory('videoProvider', function($q) {
    var vid = document.createElement('video');
    var can = document.createElement('canvas');
    var ctx = can.getContext('2d');
    var capturing = true;

    vid.addEventListener('loadedmetadata', function() {
      can.width  = vid.videoWidth;
      can.height = vid.videoHeight;
    });

    function onFrame() {
      try {
        ctx.drawImage(vid, 0, 0);
      } catch(ex) {
        if (ex.name != 'NS_ERROR_NOT_AVAILABLE') {
          throw(ex);
        }
      }

      if (capturing) {
        window.requestAnimationFrame(onFrame);
      }
    }

    return {
      startCapture: function() {
        var d = $q.defer();
        navigator.webkitGetUserMedia({video: true}, function(stream) {
          vid.src = window.URL.createObjectURL(stream);
          vid.play();
          capturing = true;
          window.requestAnimationFrame(onFrame);
          d.resolve();
        }, function() {
          d.reject();
        });
        return d.promise;
      },

      getFrame: function() {
        return ctx.getImageData(0, 0, can.width, can.height);
      },

      stopCapture: function() {
        capturing = false;
      }

    };

  })
  .directive('videoOut', function(videoProvider, $timeout) {
    return {
      replace: false,
      scope: {
        filters: '='
      },
      link: function(scope, elem, attrs) {
        var ctx = elem[0].getContext('2d');
        videoProvider.startCapture().then(function() {

          (function derp() {
            var frame = videoProvider.getFrame();

            if (scope.filters) {
              var filters = (scope.filters instanceof Array ? scope.filters : [scope.filters]);
              filters.forEach(function(filter) {
                frame = filter.func(frame);
              });
            }

            ctx.putImageData(frame, 0, 0);
            window.requestAnimationFrame(derp);
          })();

        });
      },

    };
  })

  .controller('MainCtrl', function($scope) {
    function lum(r, g, b) {
      return 0.299 * r + 0.587 * g + 0.114 * b;
    }

    $scope.filters = [
      {
        name: 'none',
        func: function(d) { return d; }
      },
      {
        name: 'inverse',
        func: function(imgData) {
          var d   = imgData.data;
          var len = d.length;

          for(var i = 0; i < len; i += 4) {
            for(var j = 0; j < 3; ++j) {
              d[i + j] = 255 - d[i + j];
            }
          }

          return imgData;
        }
      },
      {
        name: 'sepia',
        func: function(imgData) {
          var d   = imgData.data;
          var len = d.length;

          for(var i = 0; i < len; i += 4) {
            d[i + 0] = Math.min(255, d[i] * 0.393 + d[i + 1] * 0.769 + d[i + 2] * 0.189);
            d[i + 1] = Math.min(255, d[i] * 0.349 + d[i + 1] * 0.686 + d[i + 2] * 0.168);
            d[i + 2] = Math.min(255, d[i] * 0.272 + d[i + 1] * 0.534 + d[i + 2] * 0.131);
          }

          return imgData;
        }
      },
      {
        name: 'obama',
        func: function(imgData) {
          var d   = imgData.data;
          var len = d.length;
          var c   = [
            [29, 82, 97],
            [86, 151, 163],
            [245, 255, 201],
            [161, 30, 34],
            [97, 10, 29]
          ];

          for(var i = 0; i < len; i += 4) {
            var bright = lum(d[i], d[i + 1], d[i + 2]);
            for(var j = 0; j < c.length; ++j) {
              if (bright < 255 / (c.length) * (j+1)) {
                d[i + 0] = c[j][0];
                d[i + 1] = c[j][1];
                d[i + 2] = c[j][2];
                break;
              }
            }
          }
          return imgData;
        }
      }
    ];

    $scope.activeFilter = $scope.filters[0];

    $scope.setFilter = function(f) {
      $scope.activeFilter = f;
    };

    window.scope = $scope;
  });
